#!/usr/bin/env -S npx tsx
/**
 * HumanSign MCP Server
 * Herhangi bir AI ajanına (Claude Desktop vb.) insan-onaylı harcama cüzdanı verir.
 * Tools: get_policy · list_catalog · buy_data
 *   - Limit altı → otonom ödeme (executePayment)
 *   - Limit üstü → telefona onay (intent) → onaylanınca executeApprovedPaymentOnchain
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createWalletClient, createPublicClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ADDRESSES, CHAIN_ID } from "@humansign/shared/addresses";
import { spendGuardAbi } from "@humansign/shared/spendGuardAbi";
import { hashReason, fromUsdc } from "@humansign/shared/eip712";
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, "..", "..", "..", ".env") });

const SELLER = `http://localhost:${process.env.SELLER_PORT ?? 3002}`;
const BE = process.env.BACKEND_URL ?? "http://localhost:3001";
const EXPLORER = "https://worldscan.org/tx/";
const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as Hex);
const chain = {
  id: CHAIN_ID,
  name: "world-chain",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [process.env.RPC_URL!] } },
} as const;
const wallet = createWalletClient({ account, chain, transport: http() });
const pub = createPublicClient({ chain, transport: http() });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const CATALOG = [
  { resource: "/api/quote", price: "$0.05", desc: "Mikro fiyat/quote verisi (ucuz, limit altı → otonom)" },
  { resource: "/api/premium-dataset", price: "$80", desc: "Q2 premium pazar dataset'i (pahalı, limit üstü → insan onayı gerekir)" },
];

const server = new McpServer({ name: "humansign", version: "0.1.0" });

// ── get_policy ───────────────────────────────────────────────
server.registerTool(
  "get_policy",
  {
    title: "Harcama policy'sini oku",
    description:
      "SpendGuard harcama policy'sini zincirden okur. ÖNEMLİ: bu limitler yalnızca OTONOM harcamayı (insana sormadan) sınırlar — TOPLAM harcama tavanı DEĞİLDİR. Limit üstü alımlar ENGELLENMEZ; tek-dokunuş insan onayı (World ID) gerektirir ve onaylanınca o ödeme limitten bağımsız tamamlanır. Yani $80'lik bir alım, günlük limit $10 olsa bile, insan onayından sonra BAŞARIYLA gerçekleşir.",
    inputSchema: {},
  },
  async () => {
    const [perTx, daily, remaining] = (await Promise.all([
      pub.readContract({ address: ADDRESSES.spendGuard, abi: spendGuardAbi, functionName: "perTxLimit" }),
      pub.readContract({ address: ADDRESSES.spendGuard, abi: spendGuardAbi, functionName: "dailyLimit" }),
      pub.readContract({ address: ADDRESSES.spendGuard, abi: spendGuardAbi, functionName: "remainingDaily" }),
    ])) as [bigint, bigint, bigint];
    const text =
      `HumanSign harcama policy'si (vault.humansign.eth):\n` +
      `• Otonom işlem başına limit: $${fromUsdc(perTx)}\n` +
      `• Otonom günlük limit: $${fromUsdc(daily)}\n` +
      `• Bugün otonom kalan: $${fromUsdc(remaining)}\n\n` +
      `Bu limitler "insana SORMADAN" harcayabileceğim sınırdır, toplam tavan değil:\n` +
      `• Limit ALTI → otomatik öderim (sürtünmesiz)\n` +
      `• Limit ÜSTÜ → DURUR, insana sorarım. İnsan World ID ile onaylarsa, ödeme limitten BAĞIMSIZ tamamlanır (onay bilinçli bir yetkilendirmedir, engel değil).\n` +
      `Yani $80'lik premium alım da onaydan sonra kesinlikle gerçekleşir.`;
    return { content: [{ type: "text", text }] };
  }
);

// ── list_catalog ─────────────────────────────────────────────
server.registerTool(
  "list_catalog",
  {
    title: "Satın alınabilir verileri listele",
    description: "Data provider'dan (data-provider.humansign.eth) satın alınabilecek kaynakları ve fiyatlarını döner.",
    inputSchema: {},
  },
  async () => {
    const text = "Mevcut veri kaynakları:\n" + CATALOG.map((c) => `• ${c.resource} — ${c.price} — ${c.desc}`).join("\n");
    return { content: [{ type: "text", text }] };
  }
);

// ── buy_data ─────────────────────────────────────────────────
server.registerTool(
  "buy_data",
  {
    title: "Veri satın al (policy + insan onayı katmanlı)",
    description:
      "Data provider'dan veri satın alır. Limit ALTIYSA otomatik öder. Limit ÜSTÜYSE (örn. $80 premium) kullanıcının telefonuna World ID onay isteği düşer ve onaylanana kadar bekler — onaylanınca ödeme limitten BAĞIMSIZ tamamlanır (günlük/işlem limiti onaylı ödemeyi ENGELLEMEZ; onay bir override'dır). Yani pahalı alımları çekinmeden başlat; sistem otomatik olarak insana sorar ve onaydan sonra teslim eder. Ödeme World Chain mainnet'te gerçekleşir. resource: /api/quote veya /api/premium-dataset. reason: insanın onay kartında göreceği sebep.",
    inputSchema: { resource: z.string(), reason: z.string() },
  },
  async ({ resource, reason }) => {
    try {
      const res0 = await fetch(SELLER + resource);
      if (res0.status !== 402) {
        const d = await res0.json();
        return { content: [{ type: "text", text: `Ücretsiz/önbellekli kaynak: ${JSON.stringify(d)}` }] };
      }
      const quote = (await res0.json()) as { amount: string; to: Hex };
      const amount = BigInt(quote.amount);

      const [perTx, remaining, listed] = (await Promise.all([
        pub.readContract({ address: ADDRESSES.spendGuard, abi: spendGuardAbi, functionName: "perTxLimit" }),
        pub.readContract({ address: ADDRESSES.spendGuard, abi: spendGuardAbi, functionName: "remainingDaily" }),
        pub.readContract({ address: ADDRESSES.spendGuard, abi: spendGuardAbi, functionName: "whitelist", args: [quote.to] }),
      ])) as [bigint, bigint, boolean];

      let txHash: Hex;
      let mode: string;

      if (listed && amount <= perTx && amount <= remaining) {
        // OTONOM
        mode = "otonom";
        txHash = await wallet.writeContract({
          address: ADDRESSES.spendGuard, abi: spendGuardAbi, functionName: "executePayment",
          args: [quote.to, amount, hashReason(reason)],
        });
      } else {
        // İNSAN ONAYI
        mode = "insan onayı";
        const { id } = (await (await fetch(`${BE}/intents`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ to: quote.to, amount: amount.toString(), reason }),
        })).json()) as { id: string };

        // onay bekle (telefon) — max ~3 dk
        let it: any = null;
        const deadline = Date.now() + 180_000;
        for (;;) {
          if (Date.now() > deadline) {
            return { content: [{ type: "text", text: `⏱️ $${fromUsdc(amount)} için onay zaman aşımına uğradı (intent ${id}). İnsan onaylamadı.` }], isError: true };
          }
          await sleep(2000);
          it = await (await fetch(`${BE}/intents/${id}`)).json();
          if (it.status === "approved") break;
          if (["rejected", "expired"].includes(it.status)) {
            return { content: [{ type: "text", text: `🚫 İnsan $${fromUsdc(amount)} ödemesini ${it.status === "rejected" ? "REDDETTİ" : "süresi doldu"}. Bu satın almadan vazgeçildi.` }], isError: true };
          }
        }
        txHash = await wallet.writeContract({
          address: ADDRESSES.spendGuard, abi: spendGuardAbi, functionName: "executeApprovedPaymentOnchain",
          args: [{
            to: it.message.to as Hex, amount: BigInt(it.message.amount), nonce: BigInt(it.message.nonce),
            deadline: BigInt(it.message.deadline), reasonHash: it.message.reasonHash as Hex, agent: it.message.agent as Hex,
          }],
        });
        await fetch(`${BE}/intents/${id}/executed`, {
          method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ txHash }),
        });
      }

      await pub.waitForTransactionReceipt({ hash: txHash });
      const delivered = await (await fetch(SELLER + resource, { headers: { "x-payment": JSON.stringify({ txHash }) } })).json();

      const text =
        `✅ Satın alma tamam (${mode}).\n` +
        `• Tutar: $${fromUsdc(amount)}\n` +
        `• Tx: ${EXPLORER}${txHash}\n` +
        `• Teslim edilen veri: ${JSON.stringify(delivered)}`;
      return { content: [{ type: "text", text }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Hata: ${String(e)}` }], isError: true };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
