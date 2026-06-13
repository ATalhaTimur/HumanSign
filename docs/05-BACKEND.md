# 05 · BACKEND (Node.js + Fastify)

> Sahip: Backend dev · `apps/backend` · Görev: intent yaşam döngüsü + iki doğrulama (World ID proof, EIP-712 imza) + SSE

## 1. Kurulum

```bash
cd apps/backend && pnpm init
pnpm add fastify @fastify/cors viem zod uuid @worldcoin/minikit-js dotenv
pnpm add -D tsx typescript
```

`package.json`: `{ "scripts": { "dev": "tsx watch src/index.ts" } }`

## 2. Intent Yaşam Döngüsü

```
agent POST /intents        →  pending  ──(SSE)──► Mini App kartı
Mini App POST /approve     →  approved (imza saklanır)
Mini App POST /reject      →  rejected
agent GET /intents/:id     →  approved görünce imzayı alır, zinciri çağırır
agent PATCH /intents/:id/executed {txHash} → executed
backend timer              →  deadline geçen pending'ler → expired
```

Depolama: in-memory `Map` yeter (DB kurma — 36 saat!). Restart = demo state sıfırlanır, zaten istenen bu.

## 3. src/index.ts (TAM İSKELET)

```typescript
import Fastify from "fastify";
import cors from "@fastify/cors";
import { v4 as uuid } from "uuid";
import { createPublicClient, http } from "viem";
import { verifyCloudProof, type ISuccessResult } from "@worldcoin/minikit-js";
import {
  humanSignDomain, PAYMENT_INTENT_TYPES, hashReason, newNonce, deadlineIn,
} from "@humansign/shared/eip712";
import { CHAIN_ID, ADDRESSES, ENS_LABELS } from "@humansign/shared/addresses";
import { approveBodySchema, createIntentSchema, type StoredIntent } from "@humansign/shared/intent";
import "dotenv/config";

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

const pub = createPublicClient({ transport: http(process.env.RPC_URL!) });
const intents = new Map<string, StoredIntent>();
const sseClients = new Set<(data: string) => void>();
const broadcast = () => {
  const list = [...intents.values()].sort((a, b) => b.createdAt - a.createdAt);
  const payload = JSON.stringify(list, (_, v) => typeof v === "bigint" ? v.toString() : v);
  sseClients.forEach(send => send(payload));
};

// ── AUTH ──────────────────────────────────────────────────────────
const nonces = new Set<string>();
app.get("/auth/nonce", async () => { const n = uuid().replace(/-/g, ""); nonces.add(n); return { nonce: n }; });

app.post("/auth/siwe-verify", async (req, reply) => {
  // Hackathon-basit: nonce kontrolü + adresi kaydet. (Prod: tam SIWE imza doğrulaması)
  const { payload, nonce } = req.body as any;
  if (!nonces.delete(nonce)) return reply.code(400).send({ error: "bad nonce" });
  app.log.info({ owner: payload.address }, "wallet connected");
  return { ok: true, address: payload.address };
});

app.post("/auth/worldid-verify", async (req, reply) => {
  const { payload, ownerAddress } = req.body as { payload: ISuccessResult; ownerAddress: string };
  const result = await verifyCloudProof(payload, process.env.WORLD_APP_ID as `app_${string}`, "delegate-agent");
  if (!result.success) return reply.code(400).send(result);
  app.log.info({ ownerAddress }, "✅ proof-of-human: ajan yetkilendirildi");
  return { ok: true }; // (owner→verified map'i tutmak istersen buraya)
});

// ── INTENTS ───────────────────────────────────────────────────────
app.post("/intents", async (req, reply) => {
  const body = createIntentSchema.parse(req.body);
  const id = uuid();
  const it: StoredIntent = {
    id,
    message: {
      to: body.to as `0x${string}`,
      amount: BigInt(body.amount),
      nonce: newNonce(),
      deadline: deadlineIn(300),
      reasonHash: hashReason(body.reason),
      agent: ADDRESSES.agent,
    },
    reason: body.reason,
    toLabel: ENS_LABELS[body.to] ?? body.to,
    agentLabel: ENS_LABELS[ADDRESSES.agent] ?? "agent",
    status: "pending",
    createdAt: Date.now(),
  };
  intents.set(id, it); broadcast();
  return reply.code(201).send({ id });
});

app.get("/intents/:id", async (req) => {
  const it = intents.get((req.params as any).id);
  return JSON.parse(JSON.stringify(it, (_, v) => typeof v === "bigint" ? v.toString() : v));
});

app.post("/intents/:id/approve", async (req, reply) => {
  const it = intents.get((req.params as any).id);
  if (!it || it.status !== "pending") return reply.code(404).send();
  const { signature, ownerAddress } = approveBodySchema.parse(req.body);

  // Güvenlik 1: imzalayan gerçekten kontratın owner'ı mı?
  const onchainOwner = await pub.readContract({
    address: ADDRESSES.spendGuard, abi: spendGuardAbi, functionName: "owner",
  }) as string;
  if (onchainOwner.toLowerCase() !== ownerAddress.toLowerCase())
    return reply.code(403).send({ error: "signer is not vault owner" });

  // Güvenlik 2: EIP-712 ön-doğrulama — viem verifyTypedData EIP-1271-AWARE'dir
  // (smart account ise zincirde isValidSignature çağırır). ecrecover KULLANMA.
  const valid = await pub.verifyTypedData({
    address: ownerAddress as `0x${string}`,
    domain: humanSignDomain(CHAIN_ID, ADDRESSES.spendGuard),
    types: PAYMENT_INTENT_TYPES,
    primaryType: "PaymentIntent",
    message: it.message,
    signature: signature as `0x${string}`,
  });
  if (!valid) return reply.code(400).send({ error: "invalid signature" });

  it.status = "approved"; it.signature = signature as `0x${string}`;
  broadcast();
  app.log.info({ id: it.id }, "✅ HUMAN APPROVED");
  return { ok: true };
});

app.post("/intents/:id/reject", async (req, reply) => {
  const it = intents.get((req.params as any).id);
  if (!it || it.status !== "pending") return reply.code(404).send();
  it.status = "rejected"; broadcast(); return { ok: true };
});

app.patch("/intents/:id/executed", async (req, reply) => {
  const it = intents.get((req.params as any).id);
  if (!it) return reply.code(404).send();
  it.status = "executed"; it.txHash = (req.body as any).txHash; broadcast();
  return { ok: true };
});

// ── SSE ───────────────────────────────────────────────────────────
app.get("/events", (req, reply) => {
  reply.raw.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive", "access-control-allow-origin": "*" });
  const send = (d: string) => reply.raw.write(`data: ${d}\n\n`);
  sseClients.add(send); send("[]"); broadcast();
  req.raw.on("close", () => sseClients.delete(send));
});

// ── G1 yardımcıları ───────────────────────────────────────────────
app.post("/dev/fake-intent", async () => {  // Mini App'i ajan olmadan test et
  const r = await app.inject({ method: "POST", url: "/intents", payload: {
    to: ADDRESSES.seller, amount: "80000000", reason: "G1 smoke test — Q2 pazar verisi" } });
  return r.json();
});

// deadline süpürücü
setInterval(() => {
  const now = BigInt(Math.floor(Date.now() / 1000));
  let dirty = false;
  intents.forEach(it => { if (it.status === "pending" && it.message.deadline < now) { it.status = "expired"; dirty = true; } });
  if (dirty) broadcast();
}, 10_000);

await app.listen({ port: Number(process.env.BACKEND_PORT ?? 3001), host: "0.0.0.0" });
```

(`spendGuardAbi` importu: `@humansign/shared/spendGuardAbi` — 03 §5'teki sync-abi script'i üretir.)

## 4. Tasarım Kararları (jüri sorarsa hazır cevaplar)

- **Zinciri backend değil AJAN çağırır.** Backend imza taşıyıcısıdır; "ajan öder, insan yetkilendirir" anlatısı ve sorumluluk ayrımı net kalır. Backend çökse bile imza + intent ile ödeme replay edilebilir (deadline içinde).
- **Çifte doğrulama:** Backend ön-doğrular (UX: kötü imzayı kullanıcıya anında söyler), kontrat NİHAİ doğrular (güven backend'e dayanmaz). Backend'i tamamen kapatsan sistem güvenli kalır — bunu sunumda söyle, güçlü puan.
- **bigint JSON:** Tüm response'larda replacer ile string'e çevriliyor; agent/miniapp geri `BigInt()` yapar.

## 5. Backend Kontrol Listesi

- [ ] `curl $BE/auth/nonce` → nonce dönüyor
- [ ] `/dev/fake-intent` → Mini App kartı ≤2 sn'de düşüyor (SSE)
- [ ] Approve sonrası log: `✅ HUMAN APPROVED` ve shared §6 cross-check assert'i bir kez koşuldu
- [ ] Reject ve expired akışları kartta doğru rozetle görünüyor
