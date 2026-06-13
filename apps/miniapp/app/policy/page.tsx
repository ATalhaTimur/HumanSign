"use client";

import { useEffect, useState } from "react";
import { createPublicClient, http } from "viem";
import { CHAIN_ID, ADDRESSES } from "@humansign/shared/addresses";
import { spendGuardAbi } from "@humansign/shared/spendGuardAbi";
import { fromUsdc } from "@humansign/shared/eip712";

// Ekran 3: Policy (read-only yeterli — 04 §4)
// setPolicy (sendTransaction) nice-to-have, G3'ten önce dokunma.
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://worldchain-sepolia.g.alchemy.com/public";

const chain = {
  id: CHAIN_ID,
  name: "wc-sepolia",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
} as const;

const pub = createPublicClient({ chain, transport: http() });

export default function Policy() {
  const [data, setData] = useState<{ perTx: bigint; daily: bigint; remaining: bigint }>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    (async () => {
      try {
        const [perTx, daily, remaining] = (await Promise.all([
          pub.readContract({ address: ADDRESSES.spendGuard, abi: spendGuardAbi, functionName: "perTxLimit" }),
          pub.readContract({ address: ADDRESSES.spendGuard, abi: spendGuardAbi, functionName: "dailyLimit" }),
          pub.readContract({ address: ADDRESSES.spendGuard, abi: spendGuardAbi, functionName: "remainingDaily" }),
        ])) as [bigint, bigint, bigint];
        setData({ perTx, daily, remaining });
      } catch (e) {
        setError(String(e));
      }
    })();
  }, []);

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-lg font-bold">Policy</h1>
      {!data && !error && <div className="text-sm text-gray-400">Zincirden okunuyor…</div>}
      {error && <div className="text-sm text-red-500 break-all">{error}</div>}
      {data && (
        <div className="space-y-2 text-sm">
          <Row label="İşlem başına limit" value={`${fromUsdc(data.perTx)} USDC`} />
          <Row label="Günlük limit" value={`${fromUsdc(data.daily)} USDC`} />
          <Row label="Bugün kalan" value={`${fromUsdc(data.remaining)} USDC`} />
          <div className="text-xs text-gray-400 pt-2">
            Limit altı: ajan otonom · limit üstü: World ID onayı gerekir.
          </div>
        </div>
      )}
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b py-2">
      <span className="text-gray-500">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}
