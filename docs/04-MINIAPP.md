# 04 · MİNİ APP (World App içi onay uygulaması)

> Sahip: Frontend dev · `apps/miniapp` · Next.js (App Router) + @worldcoin/minikit-js
> ⚠️ MiniKit API yüzeyi beta'da evrilebiliyor — fonksiyon imzalarını `docs.world.org/mini-apps` ile teyit et; bu doküman akışın mantığını ve bilinen tuzakları verir.

## 1. Kurulum

```bash
npx @worldcoin/create-mini-app@latest apps/miniapp   # şablon (önerilen)
# veya manuel: pnpm create next-app apps/miniapp && pnpm -F miniapp add @worldcoin/minikit-js
pnpm -F miniapp add @humansign/shared viem
```

Root layout'ta MiniKit provider (şablonda hazır):

```tsx
// app/layout.tsx
"use client";
import { MiniKitProvider } from "@worldcoin/minikit-js/minikit-provider";
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html><body>
      <MiniKitProvider>{children}</MiniKitProvider>
      {/* DEBUG: Mini App'te devtools yok → Eruda şart */}
      <script src="https://cdn.jsdelivr.net/npm/eruda" />
      <script dangerouslySetInnerHTML={{ __html: "eruda.init()" }} />
    </body></html>
  );
}
```

Geliştirme döngüsü: `pnpm -F miniapp dev` → `ngrok http 3000` → Dev Portal'da App URL güncelle → World App'te aç. **Tarayıcıda MiniKit komutları çalışmaz** (`MiniKit.isInstalled()` false döner) — her test telefonda.

## 2. Ekran 1: Onboarding (`app/page.tsx`)

Akış: Wallet Auth → owner adresi → Verify(delegate-agent) → proof backend'e → "ajan bağlandı" durumu.

```tsx
"use client";
import { MiniKit, VerificationLevel } from "@worldcoin/minikit-js";
import { useState } from "react";
const BE = process.env.NEXT_PUBLIC_BACKEND_URL!;

export default function Onboarding() {
  const [addr, setAddr] = useState<string>();
  const [verified, setVerified] = useState(false);

  async function connect() {
    // 1) SIWE nonce'u backend'den al
    const { nonce } = await fetch(`${BE}/auth/nonce`).then(r => r.json());
    const { finalPayload } = await MiniKit.commandsAsync.walletAuth({ nonce });
    if (finalPayload.status !== "success") return;
    // 2) backend'de doğrula + session
    await fetch(`${BE}/auth/siwe-verify`, { method: "POST", headers: {"content-type":"application/json"},
      body: JSON.stringify({ payload: finalPayload, nonce }) });
    setAddr(finalPayload.address);
  }

  async function delegate() {
    const { finalPayload } = await MiniKit.commandsAsync.verify({
      action: "delegate-agent",                 // Dev Portal'daki action id
      verification_level: VerificationLevel.Orb,
    });
    if (finalPayload.status !== "success") return;
    const r = await fetch(`${BE}/auth/worldid-verify`, { method: "POST",
      headers: {"content-type":"application/json"},
      body: JSON.stringify({ payload: finalPayload, ownerAddress: addr }) });
    if (r.ok) setVerified(true);
  }

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">HumanSign 🖊️</h1>
      {!addr && <button onClick={connect} className="btn">Cüzdanı Bağla</button>}
      {addr && !verified && <button onClick={delegate} className="btn">World ID ile Ajana Yetki Ver</button>}
      {verified && <a href="/approvals" className="btn">Onay Kuyruğu →</a>}
    </main>
  );
}
```

> İlk açılışta konsola düşen `addr`'i `.env OWNER_ADDRESS`'e yaz (01 §6 — deploy bunu bekliyor).

## 3. Ekran 2: Onay Kuyruğu + Kart (`app/approvals/page.tsx`) — ÇEKİRDEK

```tsx
"use client";
import { MiniKit } from "@worldcoin/minikit-js";
import { useEffect, useState } from "react";
import { humanSignDomain, PAYMENT_INTENT_TYPES, fromUsdc } from "@humansign/shared/eip712";
import { CHAIN_ID, ADDRESSES } from "@humansign/shared/addresses";
import type { StoredIntent } from "@humansign/shared/intent";
const BE = process.env.NEXT_PUBLIC_BACKEND_URL!;

export default function Approvals() {
  const [items, setItems] = useState<StoredIntent[]>([]);

  useEffect(() => {                       // SSE: kart anında düşsün + titreşim
    const es = new EventSource(`${BE}/events`);
    es.onmessage = (e) => {
      const list: StoredIntent[] = JSON.parse(e.data);
      setItems(list);
      if (list.some(i => i.status === "pending")) navigator.vibrate?.([100, 50, 200]);
    };
    return () => es.close();
  }, []);

  async function approve(it: StoredIntent) {
    const { finalPayload } = await MiniKit.commandsAsync.signTypedData({
      domain: humanSignDomain(CHAIN_ID, ADDRESSES.spendGuard),
      types: PAYMENT_INTENT_TYPES,
      primaryType: "PaymentIntent",
      message: {                          // bigint'ler string olarak gider (JSON)
        to: it.message.to,
        amount: it.message.amount.toString(),
        nonce: it.message.nonce.toString(),
        deadline: it.message.deadline.toString(),
        reasonHash: it.message.reasonHash,
        agent: it.message.agent,
      },
    });
    if (finalPayload.status !== "success") return;
    await fetch(`${BE}/intents/${it.id}/approve`, { method: "POST",
      headers: {"content-type":"application/json"},
      body: JSON.stringify({ signature: finalPayload.signature, ownerAddress: finalPayload.address }) });
  }

  const reject = (it: StoredIntent) => fetch(`${BE}/intents/${it.id}/reject`, { method: "POST" });

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-lg font-bold">Onay Bekleyenler</h1>
      {items.filter(i => i.status === "pending").map(it => (
        <div key={it.id} className="rounded-2xl border p-4 shadow space-y-2">
          <div className="text-sm text-gray-500">🔔 Onay Bekliyor</div>
          <div className="font-mono text-sm">{it.agentLabel}</div>
          <div className="text-sm">→ {it.toLabel}</div>
          <div className="text-2xl font-bold">{fromUsdc(it.message.amount)} USDC</div>
          <div className="text-sm italic">"{it.reason}"</div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => reject(it)} className="flex-1 rounded-xl border py-3">Reddet</button>
            <button onClick={() => approve(it)} className="flex-1 rounded-xl bg-black text-white py-3">Onayla 🔒</button>
          </div>
        </div>
      ))}
      {items.filter(i => i.status !== "pending").map(it => (
        <div key={it.id} className="text-xs text-gray-400">
          {it.status === "executed" ? "✅" : it.status === "rejected" ? "🚫" : "⏳"} {fromUsdc(it.message.amount)} → {it.toLabel} {it.txHash && <a className="underline" href={`https://worldchain-sepolia.explorer.alchemy.com/tx/${it.txHash}`}>tx</a>}
        </div>
      ))}
    </main>
  );
}
```

## 4. Ekran 3: Policy (read-only yeterli)

`readContract` ile `perTxLimit/dailyLimit/remainingDaily` göster (viem public client, RPC `.env`'den). `setPolicy` için `MiniKit.commandsAsync.sendTransaction` nice-to-have — **G3'ten önce dokunma.**

## 5. Bilinen Tuzaklar

1. **bigint serileştirme:** signTypedData message'ında bigint'leri `.toString()` ile gönder; backend doğrularken tekrar `BigInt()`e çevir. En sık "invalid signature" sebebi tip uyuşmazlığıdır, şema değil.
2. **finalPayload.address ≠ OWNER_ADDRESS olabilir** (kullanıcı başka hesapla girdiyse). Backend approve'da `ownerAddress === guard.owner()` kontrolü yapıyor — UI'da da bağlı adresi göster.
3. **Dev Portal Contract Entrypoints:** signTypedData domain'inde verifyingContract allowlist dışıysa World App imzayı reddedebilir. G1'de ilk denenecek şey bu.
4. **ngrok URL değişti → app açılmıyor:** Portal'daki URL'i güncellemeyi unutma; takım için tek sabit tünel kullanın.
5. **İmza formatı:** World App smart account imzası uzun bytes dönebilir (1271 wrapper) — kontrat `SignatureChecker` kullandığı için sorun değil; imzayı OLDUĞU GİBİ ilet, parse etmeye çalışma.

## 6. Sorun Giderme Sırası ("imza geçmiyor")

1. shared §6 cross-check assert'i yeşil mi? (şema eşit mi)
2. Backend `verifyTypedData`'ya giden `message` alanları bigint'e geri çevrildi mi?
3. `ownerAddress` gerçekten `guard.owner()` mı? (`cast call` ile bak)
4. Dev Portal entrypoint eklendi mi?
5. Hâlâ yoksa → B planı: `signMessage` (EIP-191) ile `hashIntent` digest'ini personal_sign'la imzalat; kontrat SignatureChecker'ı `\x19Ethereum Signed Message` ön ekli digest ile çağıracak şekilde `executeApprovedPaymentPersonal` varyantı ekle (15 dk iş, demoyu kurtarır).
