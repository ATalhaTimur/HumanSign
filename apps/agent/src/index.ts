import { createWalletClient, createPublicClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ADDRESSES, CHAIN_ID } from "@humansign/shared/addresses";
import { spendGuardAbi } from "@humansign/shared/spendGuardAbi";
import { hashReason } from "@humansign/shared/eip712";
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, "..", "..", "..", ".env") }); // kök .env

const SELLER = `http://localhost:${process.env.SELLER_PORT ?? 3002}`;
const BE = process.env.BACKEND_URL ?? "http://localhost:3001";
const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as Hex);
const chain = {
  id: CHAIN_ID,
  name: "world-chain",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [process.env.RPC_URL!] } },
} as const;
const wallet = createWalletClient({ account, chain, transport: http() });
const pub = createPublicClient({ chain, transport: http() });

const log = (s: string) => console.log(`\x1b[36m[agent]\x1b[0m ${s}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function buy(path: string, reason: string) {
  log(`📡 GET ${path}`);
  let res = await fetch(SELLER + path);
  if (res.status !== 402) return res.json();
  const quote = (await res.json()) as { amount: string; to: Hex };
  const amount = BigInt(quote.amount);
  log(`💸 402: ${Number(amount) / 1e6} USDC isteniyor → policy kontrol`);

  // ── Policy görünümü (zincirden oku) ──
  const [perTx, remaining, listed] = (await Promise.all([
    pub.readContract({ address: ADDRESSES.spendGuard, abi: spendGuardAbi, functionName: "perTxLimit" }),
    pub.readContract({ address: ADDRESSES.spendGuard, abi: spendGuardAbi, functionName: "remainingDaily" }),
    pub.readContract({ address: ADDRESSES.spendGuard, abi: spendGuardAbi, functionName: "whitelist", args: [quote.to] }),
  ])) as [bigint, bigint, boolean];

  let txHash: Hex;
  if (listed && amount <= perTx && amount <= remaining) {
    // ── OTONOM YOL (limit altı) ──
    log("✅ limit içinde → otonom ödeme");
    txHash = await wallet.writeContract({
      address: ADDRESSES.spendGuard, abi: spendGuardAbi, functionName: "executePayment",
      args: [quote.to, amount, hashReason(reason)],
    });
  } else {
    // ── İNSAN ONAYI YOLU (limit üstü) ──
    console.log("\x1b[33m%s\x1b[0m", `🛑 POLICY: APPROVAL REQUIRED (${Number(amount) / 1e6} USDC > limit)`);
    const { id } = (await (await fetch(`${BE}/intents`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ to: quote.to, amount: amount.toString(), reason }),
    })).json()) as { id: string };
    log(`📲 onay isteği gönderildi (intent ${id}) — telefon bekleniyor...`);

    // poll: insan onayı (backend, zincirdeki approveIntent'i görünce 'approved' yapar)
    let it: any;
    for (;;) {
      await sleep(1500);
      it = await (await fetch(`${BE}/intents/${id}`)).json();
      if (it.status === "approved") break;
      if (["rejected", "expired"].includes(it.status)) { log(`🚫 insan ${it.status} — vazgeçiyorum.`); return null; }
      process.stdout.write(".");
    }
    console.log("");
    log("✍️  insan onayı zincirde → executeApprovedPaymentOnchain");
    // İmza YOK — onay on-chain (approveIntent). Ajan sadece intent struct'ını geçer.
    txHash = await wallet.writeContract({
      address: ADDRESSES.spendGuard, abi: spendGuardAbi, functionName: "executeApprovedPaymentOnchain",
      args: [{
        to: it.message.to as Hex,
        amount: BigInt(it.message.amount),
        nonce: BigInt(it.message.nonce),
        deadline: BigInt(it.message.deadline),
        reasonHash: it.message.reasonHash as Hex,
        agent: it.message.agent as Hex,
      }],
    });
    await fetch(`${BE}/intents/${id}/executed`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ txHash }),
    });
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
