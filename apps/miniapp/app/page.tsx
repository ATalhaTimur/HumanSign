"use client";

import { MiniKit, VerificationLevel } from "@worldcoin/minikit-js";
import { useState } from "react";
import Link from "next/link";
import { BACKEND_URL, ACTION_DELEGATE } from "./config";

// Ekran 1: Onboarding (04 §2)
// Akış: Wallet Auth → owner adresi → Verify(delegate-agent, Orb) → proof backend'e → "ajan bağlandı".
export default function Onboarding() {
  const [addr, setAddr] = useState<string>();
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function connect() {
    setError(undefined);
    setBusy(true);
    try {
      // 1) SIWE nonce'u backend'den al
      const { nonce } = await fetch(`${BACKEND_URL}/auth/nonce`).then((r) => r.json());
      const { finalPayload } = await MiniKit.commandsAsync.walletAuth({ nonce });
      if (finalPayload.status !== "success") {
        setError("Cüzdan bağlama iptal edildi.");
        return;
      }
      // 2) backend'de doğrula + session
      await fetch(`${BACKEND_URL}/auth/siwe-verify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payload: finalPayload, nonce }),
      });
      setAddr(finalPayload.address);
      // İlk açılışta bu adresi .env OWNER_ADDRESS'e yaz (01 §6 — deploy bunu bekliyor).
      console.log("OWNER_ADDRESS =", finalPayload.address);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function delegate() {
    setError(undefined);
    setBusy(true);
    try {
      const { finalPayload } = await MiniKit.commandsAsync.verify({
        action: ACTION_DELEGATE, // Dev Portal'daki action id
        verification_level: VerificationLevel.Orb,
      });
      if (finalPayload.status !== "success") {
        setError("World ID doğrulaması iptal edildi.");
        return;
      }
      const r = await fetch(`${BACKEND_URL}/auth/worldid-verify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payload: finalPayload, ownerAddress: addr }),
      });
      if (r.ok) setVerified(true);
      else setError("Backend proof doğrulaması başarısız.");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col px-6 py-10">
      {/* hero */}
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-4xl shadow-xl shadow-fuchsia-500/20">
          🖊️
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">HumanSign</h1>
        <p className="mt-2 text-sm text-gray-500">AI ajanlar harcar, <b>insanlar imzalar.</b></p>
        <p className="mt-1 text-xs text-gray-400">Ajan cüzdanları için policy + anlık insan onayı</p>

        {/* 3 adım */}
        <div className="mt-8 w-full space-y-2.5 text-left">
          <Step n="1" done={!!addr} label="Cüzdanını bağla" />
          <Step n="2" done={verified} label="World ID ile ajana yetki ver" sub="opsiyonel" />
          <Step n="3" done={false} label="Onay kuyruğuna geç" />
        </div>
      </div>

      {/* aksiyonlar */}
      <div className="space-y-3 pt-8">
        {!addr && (
          <button onClick={connect} disabled={busy} className="btn">
            {busy ? "Bağlanıyor…" : "Cüzdanı Bağla"}
          </button>
        )}
        {addr && !verified && (
          <button onClick={delegate} disabled={busy} className="btn !bg-white !text-black border border-gray-200">
            {busy ? "Doğrulanıyor…" : "World ID ile Yetki Ver"}
          </button>
        )}
        {addr && (
          <Link href="/approvals" className="btn">Onay Kuyruğu →</Link>
        )}
        {addr && <div className="text-center text-[11px] font-mono text-gray-300 break-all">{addr}</div>}
        {verified && <div className="text-center text-sm text-emerald-600">✅ World ID ile yetki verildi</div>}
        {error && <div className="text-center text-sm text-red-500 break-all">{error}</div>}
      </div>
    </main>
  );
}

function Step({ n, label, sub, done }: { n: string; label: string; sub?: string; done: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-gray-50 px-4 py-3">
      <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-emerald-500 text-white" : "bg-gray-200 text-gray-500"}`}>
        {done ? "✓" : n}
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium">{label}</div>
        {sub && <div className="text-[11px] text-gray-400">{sub}</div>}
      </div>
    </div>
  );
}
