"use client";

import { MiniKit } from "@worldcoin/minikit-js";
import { useEffect, useState } from "react";
import { humanSignDomain, PAYMENT_INTENT_TYPES, fromUsdc } from "@humansign/shared/eip712";
import { CHAIN_ID, ADDRESSES } from "@humansign/shared/addresses";
import type { IntentStatus } from "@humansign/shared/intent";
import { BACKEND_URL } from "../config";

// SSE üstünden gelen intent: backend bigint'leri string'e çevirir (JSON).
type WireIntent = {
  id: string;
  message: {
    to: `0x${string}`;
    amount: string;
    nonce: string;
    deadline: string;
    reasonHash: `0x${string}`;
    agent: `0x${string}`;
  };
  reason: string;
  toLabel: string;
  agentLabel: string;
  status: IntentStatus;
  signature?: `0x${string}`;
  txHash?: `0x${string}`;
  createdAt: number;
};

// Ekran 2: Onay Kuyruğu + Kart (04 §3) — ÇEKİRDEK
export default function Approvals() {
  const [items, setItems] = useState<WireIntent[]>([]);

  useEffect(() => {
    // SSE: kart anında düşsün + titreşim
    const es = new EventSource(`${BACKEND_URL}/events`);
    es.onmessage = (e) => {
      const list: WireIntent[] = JSON.parse(e.data);
      setItems(list);
      if (list.some((i) => i.status === "pending")) navigator.vibrate?.([100, 50, 200]);
    };
    return () => es.close();
  }, []);

  async function approve(it: WireIntent) {
    const { finalPayload } = await MiniKit.commandsAsync.signTypedData({
      domain: humanSignDomain(CHAIN_ID, ADDRESSES.spendGuard),
      types: PAYMENT_INTENT_TYPES,
      primaryType: "PaymentIntent",
      // bigint'ler zaten string olarak geliyor (SSE) — olduğu gibi ilet
      message: {
        to: it.message.to,
        amount: it.message.amount,
        nonce: it.message.nonce,
        deadline: it.message.deadline,
        reasonHash: it.message.reasonHash,
        agent: it.message.agent,
      },
    });
    if (finalPayload.status !== "success") return;
    await fetch(`${BACKEND_URL}/intents/${it.id}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ signature: finalPayload.signature, ownerAddress: finalPayload.address }),
    });
  }

  const reject = (it: WireIntent) =>
    fetch(`${BACKEND_URL}/intents/${it.id}/reject`, { method: "POST" });

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-lg font-bold">Onay Bekleyenler</h1>

      {items
        .filter((i) => i.status === "pending")
        .map((it) => (
          <div key={it.id} className="rounded-2xl border p-4 shadow space-y-2">
            <div className="text-sm text-gray-500">🔔 Onay Bekliyor</div>
            <div className="font-mono text-sm">{it.agentLabel}</div>
            <div className="text-sm">→ {it.toLabel}</div>
            <div className="text-2xl font-bold">{fromUsdc(BigInt(it.message.amount))} USDC</div>
            <div className="text-sm italic">&quot;{it.reason}&quot;</div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => reject(it)} className="flex-1 rounded-xl border py-3">
                Reddet
              </button>
              <button
                onClick={() => approve(it)}
                className="flex-1 rounded-xl bg-black text-white py-3"
              >
                Onayla 🔒
              </button>
            </div>
          </div>
        ))}

      {items
        .filter((i) => i.status !== "pending")
        .map((it) => (
          <div key={it.id} className="text-xs text-gray-400">
            {it.status === "executed" ? "✅" : it.status === "rejected" ? "🚫" : "⏳"}{" "}
            {fromUsdc(BigInt(it.message.amount))} → {it.toLabel}{" "}
            {it.txHash && (
              <a
                className="underline"
                href={`https://worldchain-sepolia.explorer.alchemy.com/tx/${it.txHash}`}
              >
                tx
              </a>
            )}
          </div>
        ))}
    </main>
  );
}
