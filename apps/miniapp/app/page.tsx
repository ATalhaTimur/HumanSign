"use client";

import { MiniKit } from "@worldcoin/minikit-js";
import { useState } from "react";
import Link from "next/link";
import { BACKEND_URL } from "./config";

function PenMark() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

export default function Onboarding() {
  const [addr, setAddr] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function connect() {
    setError(undefined);
    setBusy(true);
    try {
      const { nonce } = await fetch(`${BACKEND_URL}/auth/nonce`).then((r) => r.json());
      const { finalPayload } = await MiniKit.commandsAsync.walletAuth({ nonce });
      if (finalPayload.status !== "success") { setError("Wallet connection cancelled."); return; }
      await fetch(`${BACKEND_URL}/auth/siwe-verify`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ payload: finalPayload, nonce }),
      });
      setAddr(finalPayload.address);
      console.log("OWNER_ADDRESS =", finalPayload.address);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col px-6 py-12">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-xl shadow-indigo-500/20">
          <PenMark />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">HumanSign</h1>
        <p className="mt-2 text-sm text-gray-500">AI agents spend, <span className="font-semibold text-gray-700">humans sign.</span></p>
        <p className="mt-1 text-xs text-gray-400">Policy + instant human approval for agent wallets</p>

        <div className="mt-10 w-full space-y-2.5 text-left">
          <Row label="Under-limit spending" sub="The agent pays automatically — zero friction" />
          <Row label="Over-limit transactions" sub="Land on your phone — you approve" />
          <Row label="Every approval" sub="Becomes an on-chain cryptographic audit trail" />
        </div>
      </div>

      <div className="space-y-3 pt-8">
        {!addr ? (
          <button onClick={connect} disabled={busy} className="btn">
            {busy ? "Connecting…" : "Connect Wallet"}
          </button>
        ) : (
          <>
            <Link href="/approvals" className="btn">Go to Approval Queue</Link>
            <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="font-mono">{addr.slice(0, 6)}…{addr.slice(-4)}</span> connected
            </div>
          </>
        )}
        {error && <div className="text-center text-sm text-red-500 break-all">{error}</div>}
      </div>
    </main>
  );
}

function Row({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-gray-50 px-4 py-3.5">
      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500" />
      <div>
        <div className="text-sm font-medium text-gray-800">{label}</div>
        <div className="text-xs text-gray-400">{sub}</div>
      </div>
    </div>
  );
}
