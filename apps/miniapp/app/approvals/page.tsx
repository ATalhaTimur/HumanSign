"use client";

import { MiniKit, VerificationLevel } from "@worldcoin/minikit-js";
import { useEffect, useRef, useState } from "react";
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
  intentHash: `0x${string}`;
  toLabel: string;
  agentLabel: string;
  status: IntentStatus;
  txHash?: `0x${string}`;
  createdAt: number;
};

const time = (ms: number) => new Date(ms).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
const monogram = (label: string) => (label.replace(/^.*?([a-zA-Z])/, "$1")[0] ?? "A").toUpperCase();

function ExtLink() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="inline -mt-0.5">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

export default function Approvals() {
  const [items, setItems] = useState<WireIntent[]>([]);
  const [busyId, setBusyId] = useState<string>();
  const [verified, setVerified] = useState<Record<string, unknown>>({}); // intentId → World ID proof (kimlik kanıtlandı)
  const [notif, setNotif] = useState<{ amount: string; to: string } | null>(null);
  const notifTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let prevPending = "";
    let first = true;
    let stop = false;
    const tick = async () => {
      try {
        const list: WireIntent[] = await fetch(`${BACKEND_URL}/intents`, { cache: "no-store" }).then((r) => r.json());
        if (stop) return;
        setItems(list);
        const pend = list.filter((i) => i.status === "pending");
        const ids = pend.map((i) => i.id).sort().join(",");
        if (!first && ids && ids !== prevPending) {
          // yeni onay isteği geldi → titret + uygulama-içi bildirim
          navigator.vibrate?.([100, 50, 200]);
          const fresh = pend[0];
          setNotif({ amount: fromUsdc(BigInt(fresh.message.amount)), to: fresh.toLabel });
          clearTimeout(notifTimer.current);
          notifTimer.current = setTimeout(() => setNotif(null), 6000);
        }
        prevPending = ids;
        first = false;
      } catch { /* ağ hıçkırığı */ }
    };
    tick();
    const id = setInterval(tick, 1500);
    return () => { stop = true; clearInterval(id); clearTimeout(notifTimer.current); };
  }, []);

  // ADIM 1 — KİMLİK KANITI: "bu gerçekten doğrulanmış insan mı?" World ID + Face ID.
  // signal = intentHash → kanıt TAM BU ödemeye kilitli. (İki MiniKit komutunu aynı tap'te
  // zincirleyince World App ikinci sheet'i düşürüyor → ayrı tap'lere böldük.)
  async function verifyHuman(it: WireIntent) {
    setBusyId(it.id);
    try {
      const { finalPayload } = await MiniKit.commandsAsync.verify({
        action: "approve-payment",
        signal: it.intentHash,
        verification_level: VerificationLevel.Device, // Face ID/biyometrik; herkeste çalışır (Orb'a 1 satırla çevrilir)
      });
      if (finalPayload.status !== "success") {
        alert("Identity verification failed: " + JSON.stringify(finalPayload));
        return;
      }
      setVerified((s) => ({ ...s, [it.id]: finalPayload })); // kimlik kanıtlandı → ADIM 2 açılır
    } finally { setBusyId(undefined); }
  }

  // ADIM 2 — ON-CHAIN ONAY: kimlik kanıtlandıktan sonra owner approveIntent tx'i (gas sponsorlu).
  async function approve(it: WireIntent) {
    const proof = verified[it.id];
    if (!proof) return verifyHuman(it); // önce kimlik kanıtı
    setBusyId(it.id);
    try {
      const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
        transaction: [{
          address: ADDRESSES.spendGuard, abi: spendGuardAbi, functionName: "approveIntent",
          args: [[it.message.to, it.message.amount, it.message.nonce, it.message.deadline, it.message.reasonHash, it.message.agent]],
        }],
      });
      if (finalPayload.status !== "success") { alert("Transaction failed to send: " + JSON.stringify(finalPayload)); return; }

      // backend: kimlik kanıtını (ödemeye bağlı) + on-chain onayı kaydeder
      await fetch(`${BACKEND_URL}/intents/${it.id}/approve`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ txId: finalPayload.transaction_id, proof, signal: it.intentHash }),
      });
    } finally { setBusyId(undefined); }
  }

  const reject = (it: WireIntent) => fetch(`${BACKEND_URL}/intents/${it.id}/reject`, { method: "POST" });

  const pending = items.filter((i) => i.status === "pending");
  const history = items.filter((i) => i.status !== "pending");

  return (
    <main className="mx-auto max-w-md px-5 py-6 space-y-5">
      {/* uygulama-içi bildirim */}
      {notif && (
        <div className="fixed inset-x-4 top-4 z-50 mx-auto max-w-md rounded-2xl bg-gray-900 px-4 py-3 text-white shadow-2xl shadow-black/30 transition">
          <div className="flex items-center gap-3">
            <span className="flex h-2 w-2 shrink-0 rounded-full bg-amber-400" />
            <div className="text-sm">
              <span className="font-semibold">New approval request</span>
              <span className="text-gray-300"> · {notif.amount} USDC → {notif.to}</span>
            </div>
          </div>
        </div>
      )}

      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">HumanSign</h1>
          <p className="text-xs text-gray-400">Approval queue</p>
        </div>
        <span className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${pending.length ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${pending.length ? "bg-amber-500" : "bg-emerald-500"}`} />
          {pending.length ? `${pending.length} pending` : "Autonomous"}
        </span>
      </header>

      {pending.length === 0 && (
        <div className="rounded-3xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-400">
          No pending approvals.<br />The agent is operating autonomously within its limits.
        </div>
      )}

      {pending.map((it) => {
        const busy = busyId === it.id;
        return (
          <div key={it.id} className="rounded-3xl border border-gray-100 bg-white p-5 shadow-xl shadow-black/5 space-y-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-amber-600">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
              </span>
              Policy limit exceeded — your approval is required
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-base font-bold text-white">
                {monogram(it.agentLabel)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{it.agentLabel}</div>
                <div className="truncate text-xs text-gray-400">paying → {it.toLabel}</div>
              </div>
              <div className="text-right text-[11px] text-gray-300">{time(it.createdAt)}</div>
            </div>

            <div className="rounded-2xl bg-gray-50 p-4 text-center">
              <div className="text-3xl font-extrabold tracking-tight">
                {fromUsdc(BigInt(it.message.amount))} <span className="text-lg font-bold text-gray-400">USDC</span>
              </div>
              <div className="mt-1 text-sm text-gray-500">{it.reason}</div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => reject(it)} disabled={busy} className="flex-1 rounded-2xl border border-gray-200 py-3.5 text-sm font-semibold text-gray-600 disabled:opacity-40">
                Reject
              </button>
              <button onClick={() => approve(it)} disabled={busy} className="flex-1 rounded-2xl bg-black py-3.5 text-sm font-semibold text-white disabled:opacity-60">
                {busy ? (verified[it.id] ? "Confirming…" : "Verifying…") : (verified[it.id] ? "Confirm payment" : "Verify it's you")}
              </button>
            </div>
            <p className="text-center text-[11px] text-gray-300">
              {verified[it.id]
                ? "Identity verified with World ID · confirm on-chain"
                : "Prove it's really you with World ID before approving"}
            </p>
          </div>
        );
      })}

      {history.length > 0 && (
        <section className="space-y-2.5 pt-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">History</h2>
          {history.map((it) => {
            const s = it.status === "executed" ? { t: "Paid", c: "text-emerald-600", d: "bg-emerald-500" }
              : it.status === "approved" ? { t: "Approved", c: "text-indigo-600", d: "bg-indigo-500" }
              : it.status === "rejected" ? { t: "Rejected", c: "text-red-500", d: "bg-red-400" }
              : { t: "Expired", c: "text-gray-400", d: "bg-gray-300" };
            return (
              <div key={it.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${s.d}`} />
                    <span className={`text-xs font-semibold ${s.c}`}>{s.t}</span>
                  </div>
                  <span className="text-[11px] text-gray-400">{time(it.createdAt)}</span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <div className="text-lg font-bold">{fromUsdc(BigInt(it.message.amount))} <span className="text-xs font-medium text-gray-400">USDC</span></div>
                  <div className="text-xs text-gray-400">→ {it.toLabel}</div>
                </div>
                {it.txHash && (
                  <a href={`${EXPLORER}${it.txHash}`} target="_blank" rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-500 hover:text-indigo-600">
                    View on-chain <ExtLink />
                  </a>
                )}
              </div>
            );
          })}
        </section>
      )}
    </main>
  );
}
