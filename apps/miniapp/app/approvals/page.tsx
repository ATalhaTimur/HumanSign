"use client";

import { MiniKit } from "@worldcoin/minikit-js";
import { useEffect, useState } from "react";
import { fromUsdc } from "@humansign/shared/eip712";
import { ADDRESSES } from "@humansign/shared/addresses";
import { spendGuardAbi } from "@humansign/shared/spendGuardAbi";
import type { IntentStatus } from "@humansign/shared/intent";
import { BACKEND_URL } from "../config";

const EXPLORER = "https://worldscan.org/tx/";

type WireIntent = {
  id: string;
  message: { to: `0x${string}`; amount: string; nonce: string; deadline: string; reasonHash: `0x${string}`; agent: `0x${string}` };
  reason: string;
  toLabel: string;
  agentLabel: string;
  status: IntentStatus;
  txHash?: `0x${string}`;
  createdAt: number;
};

export default function Approvals() {
  const [items, setItems] = useState<WireIntent[]>([]);
  const [busyId, setBusyId] = useState<string>();

  useEffect(() => {
    // Polling (SSE bazı tünellerde buffer'lanıyor). Yeni pending'de titret.
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
        /* ağ hıçkırığı — sonraki tick toparlar */
      }
    };
    tick();
    const id = setInterval(tick, 1500);
    return () => { stop = true; clearInterval(id); };
  }, []);

  async function approve(it: WireIntent) {
    setBusyId(it.id);
    try {
      const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
        transaction: [{
          address: ADDRESSES.spendGuard,
          abi: spendGuardAbi,
          functionName: "approveIntent",
          args: [[it.message.to, it.message.amount, it.message.nonce, it.message.deadline, it.message.reasonHash, it.message.agent]],
        }],
      });
      if (finalPayload.status !== "success") {
        alert("İşlem gönderilemedi: " + JSON.stringify(finalPayload));
        return;
      }
      await fetch(`${BACKEND_URL}/intents/${it.id}/approve`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ txId: finalPayload.transaction_id }),
      });
    } finally {
      setBusyId(undefined);
    }
  }

  const reject = (it: WireIntent) => fetch(`${BACKEND_URL}/intents/${it.id}/reject`, { method: "POST" });

  const pending = items.filter((i) => i.status === "pending");
  const history = items.filter((i) => i.status !== "pending");

  return (
    <main className="mx-auto max-w-md px-5 py-6 space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">HumanSign 🖊️</h1>
          <p className="text-xs text-gray-400">Ajan harcar, sen imzalarsın</p>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full ${pending.length ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
          {pending.length ? `${pending.length} onay bekliyor` : "otonom 🟢"}
        </span>
      </header>

      {pending.length === 0 && (
        <div className="rounded-3xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
          Bekleyen onay yok.<br />Ajan limit içinde otonom çalışıyor.
        </div>
      )}

      {pending.map((it) => {
        const busy = busyId === it.id;
        return (
          <div key={it.id} className="rounded-3xl border border-gray-100 bg-white p-5 shadow-xl shadow-black/5 space-y-4 animate-[pulse_2s_ease-in-out_1]">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-600">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
              </span>
              POLICY LİMİTİ AŞILDI — ONAYIN GEREKİYOR
            </div>

            {/* ajan → alıcı */}
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-lg">🤖</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{it.agentLabel}</div>
                <div className="truncate text-xs text-gray-400">→ {it.toLabel}</div>
              </div>
            </div>

            {/* tutar */}
            <div className="rounded-2xl bg-gray-50 p-4 text-center">
              <div className="text-3xl font-extrabold tracking-tight">{fromUsdc(BigInt(it.message.amount))} <span className="text-lg font-bold text-gray-400">USDC</span></div>
              <div className="mt-1 text-sm italic text-gray-500">&ldquo;{it.reason}&rdquo;</div>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => reject(it)} disabled={busy} className="flex-1 rounded-2xl border border-gray-200 py-3.5 text-sm font-semibold text-gray-600 disabled:opacity-40">
                Reddet
              </button>
              <button onClick={() => approve(it)} disabled={busy}
                className="flex-1 rounded-2xl bg-black py-3.5 text-sm font-semibold text-white disabled:opacity-60">
                {busy ? "İmzalanıyor…" : "Onayla 🔒"}
              </button>
            </div>
            <p className="text-center text-[11px] text-gray-300">World ID destekli · zincir üstünde kriptografik kanıt</p>
          </div>
        );
      })}

      {history.length > 0 && (
        <section className="space-y-2 pt-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Geçmiş</h2>
          {history.map((it) => {
            const badge = it.status === "executed" ? { e: "✅", t: "Ödendi", c: "text-emerald-600" }
              : it.status === "approved" ? { e: "✍️", t: "Onaylandı", c: "text-indigo-600" }
              : it.status === "rejected" ? { e: "🚫", t: "Reddedildi", c: "text-red-500" }
              : { e: "⏳", t: "Süresi doldu", c: "text-gray-400" };
            return (
              <div key={it.id} className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3 text-sm">
                <div className="flex items-center gap-2">
                  <span>{badge.e}</span>
                  <span className="font-semibold">{fromUsdc(BigInt(it.message.amount))} USDC</span>
                  <span className="text-gray-400">→ {it.toLabel}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${badge.c}`}>{badge.t}</span>
                  {it.txHash && <a className="text-xs text-indigo-500 underline" href={`${EXPLORER}${it.txHash}`} target="_blank" rel="noreferrer">tx</a>}
                </div>
              </div>
            );
          })}
        </section>
      )}
    </main>
  );
}
