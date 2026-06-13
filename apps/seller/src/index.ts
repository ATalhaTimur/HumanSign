import Fastify from "fastify";
import { createPublicClient, http, parseEventLogs, erc20Abi } from "viem";
import { ADDRESSES } from "@humansign/shared/addresses";
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, "..", "..", "..", ".env") }); // kök .env

const app = Fastify({ logger: true });
const pub = createPublicClient({ transport: http(process.env.RPC_URL!) });
const usedTx = new Set<string>(); // aynı tx ile iki kaynak alınamaz

const CATALOG: Record<string, { price: bigint; data: unknown }> = {
  "/api/quote":           { price: 50_000n,      data: { tip: "mikro veri", v: Math.random() } },               // $0.05
  "/api/premium-dataset": { price: 80_000_000n,  data: { report: "Q2 PAZAR VERISI (premium)", rows: 1337 } },   // $80
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
      chainId: 480,
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
  const paid = transfers.some((t) =>
    t.address.toLowerCase() === ADDRESSES.mockUsdc.toLowerCase() &&
    (t.args.to as string).toLowerCase() === ADDRESSES.seller.toLowerCase() &&
    (t.args.value as bigint) >= item.price
  );
  if (!paid) return reply.code(402).send({ error: "payment not found in tx" });

  usedTx.add(txHash);
  app.log.info({ path, txHash }, "💰 ödeme doğrulandı, kaynak teslim");
  return reply.send({ paidWith: txHash, ...(item.data as object) });
});

await app.listen({ port: Number(process.env.SELLER_PORT ?? 3002), host: "0.0.0.0" });
