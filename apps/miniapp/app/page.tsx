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
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">HumanSign 🖊️</h1>
      <p className="text-sm text-gray-500">AI ajanlar harcar, insanlar imzalar.</p>

      {!addr && (
        <button onClick={connect} disabled={busy} className="btn">
          {busy ? "Bağlanıyor…" : "Cüzdanı Bağla"}
        </button>
      )}

      {addr && !verified && (
        <div className="space-y-2">
          <div className="text-xs text-gray-400 font-mono break-all">{addr}</div>
          <button onClick={delegate} disabled={busy} className="btn">
            {busy ? "Doğrulanıyor…" : "World ID ile Ajana Yetki Ver"}
          </button>
        </div>
      )}

      {/* walletAuth sonrası approvals'a geç (verify opsiyonel — World ID v4 düzeltmesi ayrı iş) */}
      {addr && (
        <Link href="/approvals" className="btn">
          Onay Kuyruğu →
        </Link>
      )}
      {verified && <div className="text-sm text-green-600">✅ World ID ile yetki verildi</div>}

      {error && <div className="text-sm text-red-500 break-all">{error}</div>}
    </main>
  );
}
