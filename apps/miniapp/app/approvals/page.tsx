"use client";

import { MiniKit } from "@worldcoin/minikit-js";
import { useEffect, useState } from "react";
import { fromUsdc } from "@humansign/shared/eip712";
import { ADDRESSES } from "@humansign/shared/addresses";
import { spendGuardAbi } from "@humansign/shared/spendGuardAbi";
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
    // Polling (SSE bazı tünellerde buffer'lanıyor → her yerde çalışan poll). Yeni pending'de titret.
    let prevPendingIds = "";
    let stop = false;
    const tick = async () => {
      try {
        const list: WireIntent[] = await fetch(`${BACKEND_URL}/intents`, { cache: "no-store" }).then((r) => r.json());
        if (stop) return;
        setItems(list);
        const pendingIds = list.filter((i) => i.status === "pending").map((i) => i.id).sort().join(",");
        if (pendingIds && pendingIds !== prevPendingIds) navigator.vibrate?.([100, 50, 200]);
        prevPendingIds = pendingIds;
      } catch {
        /* tünel/ağ hıçkırığı — sonraki tick'te toparlar */
      }
    };
    tick();
    const id = setInterval(tick, 1500);
    return () => { stop = true; clearInterval(id); };
  }, []);

  async function approve(it: WireIntent) {
    // On-chain onay: owner (World App hesabı) SpendGuard.approveIntent çağırır (sponsorlu tx).
    // signTypedData/signMessage testnette smart-account doğrulanamadığı için → sendTransaction.
    const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
      transaction: [
        {
          address: ADDRESSES.spendGuard,
          abi: spendGuardAbi,
          functionName: "approveIntent",
          // PaymentIntent struct = tuple (to, amount, nonce, deadline, reasonHash, agent)
          args: [
            [
              it.message.to,
              it.message.amount,
              it.message.nonce,
              it.message.deadline,
              it.message.reasonHash,
              it.message.agent,
            ],
          ],
        },
      ],
    });
    if (finalPayload.status !== "success") {
      alert("İşlem gönderilemedi: " + JSON.stringify(finalPayload));
      return;
    }
    // backend zincirden onayı doğrulayıp kartı 'approved' yapsın
    await fetch(`${BACKEND_URL}/intents/${it.id}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ txId: finalPayload.transaction_id }),
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
