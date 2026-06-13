"use client";

import { useEffect, useState } from "react";
import { createPublicClient, http } from "viem";
import { CHAIN_ID, ADDRESSES } from "@humansign/shared/addresses";
import { spendGuardAbi } from "@humansign/shared/spendGuardAbi";
import { fromUsdc } from "@humansign/shared/eip712";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://worldchain-mainnet.g.alchemy.com/public";

const chain = {
  id: CHAIN_ID,
  name: "world-chain",
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
    <main className="mx-auto max-w-md px-5 py-6 space-y-5">
      <header>
        <h1 className="text-xl font-bold tracking-tight">Spending Policy</h1>
        <p className="text-xs text-gray-400">vault.humansign.eth · on-chain</p>
      </header>

      {!data && !error && <div className="text-sm text-gray-400">Reading from chain…</div>}
      {error && <div className="text-sm text-red-500 break-all">{error}</div>}

      {data && (
        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm divide-y divide-gray-100">
          <Row label="Per-transaction limit" value={`$${fromUsdc(data.perTx)}`} />
          <Row label="Daily limit" value={`$${fromUsdc(data.daily)}`} />
          <Row label="Remaining today" value={`$${fromUsdc(data.remaining)}`} />
        </div>
      )}

      <p className="px-1 text-xs text-gray-400">
        These limits gate <span className="font-medium text-gray-600">autonomous</span> spending only.
        Below the limit the agent pays automatically; above it, a transaction requires your one-tap approval.
      </p>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3.5">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-lg font-bold tracking-tight">{value}</span>
    </div>
  );
}
