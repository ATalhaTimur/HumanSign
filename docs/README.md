# HumanSign 🖊️

> **AI ajanlar harcar, insanlar imzalar.**
> Ajan cüzdanları için policy + anlık insan onayı katmanı. Limit içinde otonom, limit dışında telefonuna düşen kartı World ID destekli biyometriyle imzalarsın; onay zincir üstünde kriptografik denetim izine dönüşür.

**ETHGlobal New York 2026 · 12–14 Haziran · Hedef track'ler: ENS ($20K) + World ($15K)**

---

## Mimari (1 bakışta)

```
ai-agent ──HTTP GET──► seller-api (402 Payment Required)
   │                        ▲
   │ viem                   │ zincirden Transfer doğrular
   ▼                        │
SpendGuard.sol (World Chain Sepolia, 2-of-2) ─────┘
   ▲  limit altı: executePayment (sadece ajan imzası)
   │  limit üstü: executeApprovedPayment (ajan + owner EIP-712 imzası)
   │
backend ◄──SSE──► miniapp (World App içinde, MiniKit)
   pending kuyruğu        verify · walletAuth · signTypedData

Kimlik: IdentityRegistry (ERC-8004 min.) ◄─text record─► ENS subname
İnsan kanıtı: World ID (Orb) → "delegate-agent" aksiyonu
```

## Repo Yapısı

```
humansign/
├─ apps/
│  ├─ miniapp/    # Next.js + @worldcoin/minikit-js  → 04-MINIAPP.md
│  ├─ backend/    # Node + Fastify + viem + SSE      → 05-BACKEND.md
│  ├─ agent/      # ajan döngüsü                     → 06-AGENT-SELLER.md
│  └─ seller/     # mock 402 satıcı API              → 06-AGENT-SELLER.md
├─ packages/
│  ├─ contracts/  # Foundry                          → 02-KONTRATLAR.md
│  └─ shared/     # EIP-712 tek kaynak               → 03-SHARED-EIP712.md
```

## Doküman Dizini

| # | Dosya | Kim okur | Özet |
|---|---|---|---|
| 01 | 01-KURULUM.md | Herkes (ilk 2 saat) | Araçlar, monorepo, env, Dev Portal, deploy sırası |
| 02 | 02-KONTRATLAR.md | Kontrat dev | SpendGuard/MockUSDC/Registry tam kod + testler |
| 03 | 03-SHARED-EIP712.md | Herkes | İmza şemasının TEK kaynağı + yardımcılar |
| 04 | 04-MINIAPP.md | Frontend dev | 3 ekran, MiniKit komutları, gotcha'lar |
| 05 | 05-BACKEND.md | Backend dev | Endpointler, intent yaşam döngüsü, doğrulamalar |
| 06 | 06-AGENT-SELLER.md | Backend dev | Ajan döngüsü + 402 satıcı + ödeme kanıtı |
| 07 | 07-KIMLIK-ENS.md | Kontrat dev | 8004 kaydı, agentURI, ENS subname + record |
| 08 | 08-DEMO-SUNUM-GOREVLER.md | Herkes (Pazar) | Demo script, submission, Q&A, görev panosu |

## Kilometre Taşı Kapıları (geçmeden ilerleme yok)

1. **G1 (Cuma gece):** Mini App'te sahte PaymentIntent `signTypedData` ile imzalandı, backend `verifyTypedData` ile doğruladı. → *Proje kalbi atıyor.*
2. **G2 (Cmt 14:00):** Ajan limit-altı ödemeyi zincirde tamamladı, seller 402→200 döndü.
3. **G3 (Cmt 22:00):** Tam akış 1 kez uçtan uca: $80 → kart → onay → tx → dataset.
4. **G4 (Pazar 09:00):** Video çekildi, submission gönderildi. Sonrası sadece prova.

## Hızlı Başlangıç

```bash
pnpm install
pnpm -F contracts build && pnpm -F contracts test
pnpm deploy:testnet          # adresleri packages/shared/addresses.ts'e yazar
pnpm dev                     # backend + seller + miniapp (turbo)
pnpm agent:run               # demo ajan döngüsü
```

## Altın Kurallar

1. EIP-712 şeması SADECE `packages/shared/eip712.ts`'te yaşar. Kopyalayan ekip arkadaşına su ısmarlar.
2. Owner = World App **smart account** → kontratta `SignatureChecker`, backend'de viem `verifyTypedData` (1271-aware). `ecrecover` YASAK.
3. Kapsam tartışması: "4 dk'lık demoda anlatılamıyorsa kapsam dışı."
4. Son 4 saat kod freeze. Pazar sabahı kahraman olmaya çalışan, demo'yu öldürür.
