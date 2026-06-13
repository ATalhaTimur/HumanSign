# 06 · AJAN + SATICI (x402-uyumlu 402 akışı)

> Sahip: Backend dev (paralel iş) · `apps/agent` + `apps/seller`
> Anlatı: satıcı 402 döner → ajan policy'ye bakar → öder ya da insana sorar → ödeme kanıtıyla tekrar dener.

## 1. SATICI — apps/seller/src/index.ts (TAM KOD)

```typescript
import Fastify from "fastify";
import { createPublicClient, http, parseEventLogs, erc20Abi } from "viem";
import { ADDRESSES } from "@humansign/shared/addresses";
import "dotenv/config";

const app = Fastify({ logger: true });
const pub = createPublicClient({ transport: http(process.env.RPC_URL!) });
const usedTx = new Set<string>();   // aynı tx ile iki kaynak alınamaz

const CATALOG: Record<string, { price: bigint; data: unknown }> = {
  "/api/quote":           { price: 50_000n,      data: { tip: "mikro veri", v: Math.random() } },      // $0.05
  "/api/premium-dataset": { price: 80_000_000n,  data: { report: "Q2 PAZAR VERISI (premium)", rows: 1337 } }, // $80
};

app.get("/api/*", async (req, reply) => {
  const path = req.url.split("?")[0];
  const item = CATALOG[path];
  if (!item) return reply.code(404).send();

  const payHeader = req.headers["x-payment"] as string | undefined;
  if (!payHeader) {
    // ── 402 Payment Required: x402-uyumlu fiyat teklifi ──
    return reply.code(402).send({
      scheme: "humansign-v1",          // mainnet yol haritası: resmi x402 facilitator
      chainId: 4801,
      token: ADDRESSES.mockUsdc,
      to: ADDRESSES.seller,
      amount: item.price.toString(),
      resource: path,
    });
  }

  // ── Ödeme kanıtı doğrulama: tx receipt'te bize gelen Transfer var mı? ──
  const { txHash } = JSON.parse(payHeader) as { txHash: `0x${string}` };
  if (usedTx.has(txHash)) return reply.code(409).send({ error: "payment already redeemed" });

  const receipt = await pub.waitForTransactionReceipt({ hash: txHash, timeout: 30_000 });
  const transfers = parseEventLogs({ abi: erc20Abi, logs: receipt.logs, eventName: "Transfer" });
  const paid = transfers.some(t =>
    t.address.toLowerCase() === ADDRESSES.mockUsdc.toLowerCase() &&
    (t.args.to as string).toLowerCase() === ADDRESSES.seller.toLowerCase() &&
    (t.args.value as bigint) >= item.price
  );
  if (!paid) return reply.code(402).send({ error: "payment not found in tx" });

  usedTx.add(txHash);
  app.log.info({ path, txHash }, "💰 ödeme doğrulandı, kaynak teslim");
  return reply.send({ paidWith: txHash, ...item.data as object });
});

await app.listen({ port: Number(process.env.SELLER_PORT ?? 3002), host: "0.0.0.0" });
```

## 2. AJAN — apps/agent/src/index.ts (TAM KOD)

```typescript
import { createWalletClient, createPublicClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ADDRESSES, CHAIN_ID } from "@humansign/shared/addresses";
import { spendGuardAbi } from "@humansign/shared/spendGuardAbi";
import { hashReason } from "@humansign/shared/eip712";
import "dotenv/config";

const SELLER = `http://localhost:${process.env.SELLER_PORT ?? 3002}`;
const BE = process.env.BACKEND_URL!;
const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as Hex);
const chain = { id: CHAIN_ID, name: "wc-sepolia", nativeCurrency: { name:"ETH", symbol:"ETH", decimals:18 }, rpcUrls: { default: { http: [process.env.RPC_URL!] } } } as const;
const wallet = createWalletClient({ account, chain, transport: http() });
const pub = createPublicClient({ chain, transport: http() });

const log = (s: string) => console.log(`\x1b[36m[agent]\x1b[0m ${s}`);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function buy(path: string, reason: string) {
  log(`📡 GET ${path}`);
  let res = await fetch(SELLER + path);
  if (res.status !== 402) return res.json();
  const quote = await res.json();
  const amount = BigInt(quote.amount);
  log(`💸 402: ${Number(amount)/1e6} USDC isteniyor → policy kontrol`);

  // ── Policy görünümü (zincirden oku) ──
  const [perTx, remaining, listed] = await Promise.all([
    pub.readContract({ address: ADDRESSES.spendGuard, abi: spendGuardAbi, functionName: "perTxLimit" }),
    pub.readContract({ address: ADDRESSES.spendGuard, abi: spendGuardAbi, functionName: "remainingDaily" }),
    pub.readContract({ address: ADDRESSES.spendGuard, abi: spendGuardAbi, functionName: "whitelist", args: [quote.to] }),
  ]) as [bigint, bigint, boolean];

  let txHash: Hex;
  if (listed && amount <= perTx && amount <= remaining) {
    // ── OTONOM YOL ──
    log("✅ limit içinde → otonom ödeme");
    txHash = await wallet.writeContract({
      address: ADDRESSES.spendGuard, abi: spendGuardAbi, functionName: "executePayment",
      args: [quote.to, amount, hashReason(reason)],
    });
  } else {
    // ── İNSAN ONAYI YOLU ──
    console.log("\x1b[33m%s\x1b[0m", `🛑 POLICY: APPROVAL REQUIRED (${Number(amount)/1e6} USDC > limit)`);
    const { id } = await (await fetch(`${BE}/intents`, { method: "POST",
      headers: {"content-type":"application/json"},
      body: JSON.stringify({ to: quote.to, amount: amount.toString(), reason }) })).json();
    log(`📲 onay isteği gönderildi (intent ${id}) — telefon bekleniyor...`);

    // poll
    let it: any;
    for (;;) {
      await sleep(1500);
      it = await (await fetch(`${BE}/intents/${id}`)).json();
      if (it.status === "approved") break;
      if (["rejected", "expired"].includes(it.status)) { log(`🚫 insan ${it.status} — vazgeçiyorum.`); return null; }
      process.stdout.write(".");
    }
    console.log("");
    log("✍️  insan imzası alındı → executeApprovedPayment");
    txHash = await wallet.writeContract({
      address: ADDRESSES.spendGuard, abi: spendGuardAbi, functionName: "executeApprovedPayment",
      args: [[it.message.to, BigInt(it.message.amount), BigInt(it.message.nonce), BigInt(it.message.deadline), it.message.reasonHash, it.message.agent], it.signature],
    });
    await fetch(`${BE}/intents/${id}/executed`, { method: "PATCH",
      headers: {"content-type":"application/json"}, body: JSON.stringify({ txHash }) });
  }

  await pub.waitForTransactionReceipt({ hash: txHash });
  log(`⛓️  tx: ${txHash}`);
  res = await fetch(SELLER + path, { headers: { "x-payment": JSON.stringify({ txHash }) } });
  return res.json();
}

// ── DEMO SENARYOSU ──
(async () => {
  log("HumanSign demo ajanı başladı 🤖  görev: Q2 pazar raporu hazırla");
  for (let i = 1; i <= 3; i++) {
    const d = await buy("/api/quote", `API çağrısı #${i} — fiyat verisi`);
    log(`📦 mikro veri alındı: ${JSON.stringify(d)}`);
  }
  const ds = await buy("/api/premium-dataset", "Q2 pazar verisi raporu için premium dataset");
  if (ds) log(`🎉 RAPOR TAMAM — premium dataset: ${JSON.stringify(ds).slice(0, 80)}...`);
})();
```

Opsiyonel LLM süsü (30 dk, riski sıfır): `reason` metnini Anthropic/OpenAI SDK ile ürettir — sadece string, akışa dokunmaz. Vakit yoksa atla.

## 3. Bilinen Tuzaklar

1. **Nonce/gas:** Ajan ardışık tx atıyor; viem nonce'u yönetir ama RPC yavaşsa `waitForTransactionReceipt` bitmeden yeni tx atma (kod zaten sıralı — paralelleştirme hevesine kapılma).
2. **Replay koruması satıcıda:** `usedTx` seti restart'ta sıfırlanır — demo için sorun değil, README'de "prod: kalıcı store" notu düş.
3. **$80 intent'inin amount'u perTxLimit'ten BÜYÜK olmalı** yoksa otonom yoldan geçer ve sahne anı kaçar. Demo değerleri: perTx $1, daily $10, premium $80 — dokunma.
4. **Public RPC oran limiti:** Demo öncesi kendi Alchemy key'ine geç; poll aralığını 1.5 sn altına indirme.

## 4. Kontrol Listesi

- [ ] 3 mikro ödeme `AutoPaymentExecuted` event'iyle explorer'da
- [ ] $80 denemesi sarı `APPROVAL REQUIRED` logu basıyor ve kart düşüyor
- [ ] Onay → tx → `paidWith` alanıyla dataset dönüyor
- [ ] Reddet → ajan `🚫` loguyla zarifçe çıkıyor (demo'da gösterilecek!)
