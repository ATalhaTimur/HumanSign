import Fastify from "fastify";
import cors from "@fastify/cors";
import { v4 as uuid } from "uuid";
import { createPublicClient, http, hashTypedData } from "viem";
import { verifyCloudProof, type ISuccessResult } from "@worldcoin/minikit-js";
import {
  humanSignDomain, PAYMENT_INTENT_TYPES, hashReason, newNonce, deadlineIn,
} from "@humansign/shared/eip712";
import { CHAIN_ID, ADDRESSES, ENS_LABELS } from "@humansign/shared/addresses";
import { approveBodySchema, createIntentSchema, type StoredIntent } from "@humansign/shared/intent";
import { spendGuardAbi } from "@humansign/shared/spendGuardAbi";
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Kök .env'i yükle (backend apps/backend'den koşar → iki seviye yukarı)
const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, "..", "..", "..", ".env") });

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

const PLACEHOLDER = ADDRESSES.spendGuard.startsWith("0x000000000000000000000000000000000000000");
let crossChecked = false;

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

// Liste (polling — SSE bazı tünellerde buffer'lanıyor, bu her yerde çalışır)
app.get("/intents", async () => {
  const list = [...intents.values()].sort((a, b) => b.createdAt - a.createdAt);
  return JSON.parse(JSON.stringify(list, (_, v) => typeof v === "bigint" ? v.toString() : v));
});

app.get("/intents/:id", async (req) => {
  const it = intents.get((req.params as any).id);
  return JSON.parse(JSON.stringify(it, (_, v) => typeof v === "bigint" ? v.toString() : v));
});

app.post("/intents/:id/approve", async (req, reply) => {
  const it = intents.get((req.params as any).id);
  if (!it || it.status !== "pending") return reply.code(404).send();

  if (PLACEHOLDER) {
    return reply.code(503).send({ error: "kontratlar deploy edilmedi (addresses.ts placeholder)" });
  }

  // On-chain onay yolu (sendTransaction): owner World App'ten approveIntent çağırdı.
  // Backend zincirden onayı DOĞRULAR (backend'e güven yok — kontrat nihai kaynak).
  // intentHash = kontrat hashIntent = EIP-712 _hashTypedDataV4 = viem hashTypedData
  const digest = hashTypedData({
    domain: humanSignDomain(CHAIN_ID, ADDRESSES.spendGuard),
    types: PAYMENT_INTENT_TYPES,
    primaryType: "PaymentIntent",
    message: it.message,
  });
  // World App sponsorlu tx'i mine olana dek poll et (~30s)
  let approved = false;
  for (let k = 0; k < 20; k++) {
    approved = await pub.readContract({
      address: ADDRESSES.spendGuard, abi: spendGuardAbi, functionName: "approvedIntents", args: [digest],
    }) as boolean;
    if (approved || it.status !== "pending") break;
    await new Promise((r) => setTimeout(r, 1500));
  }
  if (!approved) {
    app.log.warn({ id: it.id, digest }, "approval on-chain'de görünmedi (timeout)");
    return reply.code(425).send({ error: "onay henüz zincirde değil — tekrar dene" });
  }

  await crossCheckOnce(it); // Cross-check (03 §6): TS digest == kontrat hashIntent (bir kez)

  it.status = "approved";
  broadcast();
  app.log.info({ id: it.id, digest }, "✅ HUMAN APPROVED (on-chain)");
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
  reply.raw.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache, no-transform",   // no-transform: proxy sıkıştırma/buffer'ı engelle
    "x-accel-buffering": "no",                    // nginx/proxy buffer kapat
    connection: "keep-alive",
    "access-control-allow-origin": "*",
  });
  // 2KB padding: bazı reverse-proxy'ler (cloudflare tüneli) ilk byte'ları eşik dolana dek tutar
  reply.raw.write(`:${" ".repeat(2048)}\n\n`);
  const send = (d: string) => reply.raw.write(`data: ${d}\n\n`);
  sseClients.add(send); send("[]"); broadcast();
  const heartbeat = setInterval(() => reply.raw.write(`: ping\n\n`), 15_000);
  req.raw.on("close", () => { clearInterval(heartbeat); sseClients.delete(send); });
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

// TS tarafının digest'i ile kontratın hashIntent'i aynı mı (03 §6)
async function crossCheckOnce(it: StoredIntent) {
  if (crossChecked || PLACEHOLDER) return;
  crossChecked = true;
  try {
    const tsDigest = hashTypedData({
      domain: humanSignDomain(CHAIN_ID, ADDRESSES.spendGuard),
      types: PAYMENT_INTENT_TYPES, primaryType: "PaymentIntent", message: it.message,
    });
    const chainDigest = await pub.readContract({
      address: ADDRESSES.spendGuard, abi: spendGuardAbi, functionName: "hashIntent",
      args: [{
        to: it.message.to, amount: it.message.amount, nonce: it.message.nonce,
        deadline: it.message.deadline, reasonHash: it.message.reasonHash, agent: it.message.agent,
      }],
    }) as `0x${string}`;
    if (tsDigest === chainDigest) app.log.info("✅ EIP-712 cross-check OK (TS digest == kontrat hashIntent)");
    else app.log.error({ tsDigest, chainDigest }, "❌ EIP-712 ŞEMA UYUŞMAZLIĞI! Alan sırası/tipi kontrol et.");
  } catch (e) {
    app.log.warn({ e: String(e) }, "cross-check atlandı (kontrat okunamadı)");
  }
}

await app.listen({ port: Number(process.env.BACKEND_PORT ?? 3001), host: "0.0.0.0" });
