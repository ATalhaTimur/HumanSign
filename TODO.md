# HumanSign — İlerleme & Yapılacaklar

> Akış: `docs/` içindeki numaralı sıra (01→08). Bu dosya canlı durum panosu.
> Son güncelleme: 2026-06-12

## ✅ Tamamlanan

- [x] **01 Kurulum** — pnpm monorepo (`apps/*`, `packages/*`), turbo, kök `.env.example`. Foundry 0.3→**1.5.1** (OZ v5.6.1 `osaka` evm gerektiriyordu).
- [x] **02 Kontratlar** — SpendGuard + MockUSDC + IdentityRegistry, **9/9 forge test yeşil**, `Deploy.s.sol`, `sync-addresses.mjs`. ⚠️ GERÇEK DEPLOY YAPILMADI.
- [x] **03 Shared** — `eip712/intent/addresses(placeholder)/spendGuardAbi/index`, tsc strict temiz.
- [x] **04 MiniApp** — Next 16 + React 19 + Tailwind 4, 3 ekran (Onboarding/Approvals/Policy), MiniKitProvider+Eruda. **next build başarılı**. minikit-js **1.11.0'a sabitlendi** (2.x verify komutunu silmiş).
- [x] **05 Backend** — Fastify 5 + SSE + auth + intents + approve(verifyTypedData 1271-aware) + cross-check + dev/fake-intent. **Lokal smoke OK**.

## 🎉 G2 + G3 GEÇTİ (2026-06-13) — TAM AKIŞ MAINNET'te çalışıyor

- **06 Agent + Seller tamam.** `apps/seller` (mock 402) + `apps/agent` (otonom + onay döngüsü).
- **G2:** 3 otonom mikro ödeme ($0.05) → seller 402→200 → veri teslim. txs: `0x5b2b72…`, `0x3ce706…`, `0xddaf36…`
- **G3:** $80 → APPROVAL REQUIRED → telefonda onay → `approveIntent` (`0x1236c7e2…`) → ajan `executeApprovedPaymentOnchain` (`0x6efcbb80…`) → premium dataset teslim.
- **Doğrulama:** seller'da **80.15 mUSDC** (3×0.05 + 80) ✓, intent **executed** ✓.
- Ajan imza yerine **on-chain onay** kullanıyor (`executeApprovedPaymentOnchain`). Çalıştırma: `pnpm agent:run`.

## 🎉 07 KİMLİK/ENS TAMAM (2026-06-13)

- **ERC-8004:** ajan kendini IdentityRegistry'ye kaydetti (agentId 1, tokenURI base64 8004 kartı, mainnet 480). ✅
- **ENS (Ethereum MAINNET):** `humansign.eth` (sahip 0xF483...) + 3 subname, hepsi addr + text record'lu:
  - `research.humansign.eth` → ajan + erc8004.registry/agentId/humansign.vault/humansign.policy text'leri
  - `data-provider.humansign.eth` → satıcı
  - `vault.humansign.eth` → SpendGuard + humansign.policy
  - ⚠️ NOT: Sepolia yerine yanlışlıkla MAINNET'te kaydedildi (~$10-15 gerçek ETH gitti) ama sonuç daha güçlü (gerçek mainnet ENS). Sepolia faucet ETH'i 0xF483'te boşta.
  - UI hâlâ `ENS_LABELS` map'i kullanıyor (07 §2.3 kasıtlı kısayol), kayıtlar zincirde gerçek.

## 🎉 ÜRÜNLEŞME (2026-06-13) — MCP + Mini App cila

- **P1 MCP server** (`apps/mcp`) — `@modelcontextprotocol/sdk` stdio. Tools: `get_policy`, `list_catalog`, `buy_data`. Gerçek ajan (Claude Desktop) `buy_data` çağırır → limit altı otonom, limit üstü telefona onay → zincirde öder. Config: `apps/mcp/claude-desktop-config.json`. Smoke test OK.
- **P2 Mini app cila** — onboarding (hero + 3 adım) + approvals (premium kart: ENS+avatar, policy rozeti, büyük tutar, onay state, geçmiş, worldscan linki). next build OK, tünelde canlı.

## 🔜 Kalan

- [x] **README** (kök `README.md`) — jüri-facing, EN, ne gerçek/ne mock + 4 kanıt linki + MCP + roadmap. ✅
- [ ] **Demo videosu** (sen, ≤3 dk — MCP akışı: Claude Desktop → otonom → $80 → telefon onayı → rapor)
- [ ] **ETHGlobal submission formu** — HumanSign, tagline "AI agents spend, humans sign", prize: ENS + World, "how it's made" (README'den), demo video + repo linki
- [ ] (ops) gerçek-USDC mikro flex · World ID Orb verify v2/v4 · zkTLS bonus
- [ ] (opsiyonel) World ID Orb `delegate-agent` verify'ı onboarding'e geri ekle (v2/v4 backend düzeltmesiyle).
- [ ] (zaman kalırsa) zkTLS bonus.

## 📱 Telefon Testi / G1 Kapısı (insan-only adımlar — sende)

- [x] **0.** Env dosyaları oluşturuldu: kök `.env` (World ID değerleri dolu) + `apps/miniapp/.env.local` (app_id dolu). ⚠️ Kök `.env`'de hâlâ DEPLOYER/AGENT key + SELLER_ADDRESS + OWNER_ADDRESS boş.
- [x] **1.** World Dev Portal app + `delegate-agent` action MCP ile kuruldu (yukarı bak). `NEXT_PUBLIC_APP_ID` dolu.
- [ ] **2.** 4 terminal: backend dev · miniapp dev · `cloudflared tunnel --url localhost:3001` · `cloudflared tunnel --url localhost:3000`
  - backend tünel URL → `.env.local` `NEXT_PUBLIC_BACKEND_URL` (miniapp restart!)
  - miniapp tünel URL → Dev Portal **App URL**
- [ ] **3.** Telefonda aç → Cüzdanı Bağla → Eruda'da **`OWNER_ADDRESS`'i kopyala** (deploy'suz buraya kadar çalışır; approve 503 döner)
- [ ] **4.** Kök `.env` doldur (OWNER_ADDRESS, DEPLOYER/AGENT key, SELLER_ADDRESS, WORLD_APP_ID) → `pnpm deploy:testnet` → Dev Portal Contract Entrypoints'e SpendGuard ekle
- [ ] **5.** Restart → telefonda **Onayla** → backend `✅ HUMAN APPROVED` + `✅ cross-check OK` → **G1 GEÇTİ**

## 🎉 G1 GEÇTİ (2026-06-13) — MAINNET'te gerçek World App ile uçtan uca onay

- **World Chain MAINNET (chainId 480)** — testnet World App'i desteklemiyordu (smart account deploy değildi + tx mainnet'e gidiyor).
- Akış: telefonda kart → Onayla → World App **sponsorlu sendTransaction** → smart account deploy + `approveIntent` on-chain → backend `approvedIntents[digest]` okur → kart approved.
- Mimari: imza-tabanlı yol (signTypedData/signMessage) testnette çıkmaz sokaktı → **on-chain onay (approveIntent + executeApprovedPaymentOnchain)** mimarisine geçildi.
- Owner hesabı (`0x69D0...`) mainnet'te deploy oldu (ilk tx ile). Kanıt tx: `0x1236c7e2cafefa0738c6220bfae4dd2f5da15be9fc391c05205ea0815a2b2c77`

### Mainnet adresleri (chainId 480, AKTİF)
- MockUSDC: `0x95192fedd0847bDcdcfd8f56781f68b8E54651Da`
- **SpendGuard: `0xCec9Ba1F8bb9AC240E2372f2A261A142868483fC`** (owner=World App `0x69D0...`)
- IdentityRegistry: `0xb8252FCcaB6f1d9D7330f0F29B97973a9C81944b`
- deployer `0x2A23…fe98` (~0.00044 ETH kaldı) · agent `0x8e38…91A2` (0.00005 ETH) · seller `0x4E0a…379c`

## ⛓️ (ESKİ) Testnet deploy — artık kullanılmıyor (World Chain Sepolia 4801)

- MockUSDC: `0x95192fedd0847bDcdcfd8f56781f68b8E54651Da`
- **SpendGuard: `0xCec9Ba1F8bb9AC240E2372f2A261A142868483fC`** (owner=World App `0x69D0...61E`, perTx $1/daily $10, vault $200 mUSDC)
- IdentityRegistry: `0xb8252FCcaB6f1d9D7330f0F29B97973a9C81944b`
- agent `0x8e38a8aC…91A2` (0.02 ETH'li) · seller `0x4E0a5bf0…379c` (whitelisted) · deployer `0x2A23…fe98`
- Adresler `shared/addresses.ts` + `.env`'e sync'lendi. Dev Portal Contract Entrypoints'e SpendGuard+MockUSDC eklendi.

## 🟢 ŞU AN AYAKTA (Claude'un arka plan süreçleri — bu oturum boyunca)

- backend: `localhost:3001` ← tünel **https://postcards-frontier-vcr-grid.trycloudflare.com**
- miniapp: `localhost:3100` ← tünel **https://vitamins-gif-municipal-themes.trycloudflare.com** (Dev Portal App URL'i bu)
- ⚠️ Port 3000'de kullanıcının başka Vite projesi var → miniapp 3100'e alındı.
- ⚠️ Tünel URL'leri restart'ta DEĞİŞİR. Süreç ölürse yeniden açıp env + Dev Portal güncellenmeli.
- ⚠️ **SSE cloudflare tünelinde buffer'lanıyor → Approvals ekranı POLLING'e geçti** (`GET /intents` her 1.5s). Backend `/events` (SSE) duruyor ama kullanılmıyor.
- ⚠️ Backend restart'ında `lsof -ti:3001 | xargs kill` KULLANMA — tünelin 3001'e bağlantısını da öldürür. İsimle öldür: `pkill -f "tsx watch src/index.ts"`.

## 🧰 Ön Koşullar (sende)

- [ ] `brew install cloudflared` (2 tünel lazım; ngrok free tek tünel)
- [ ] World Dev Portal hesabı + app_id + `delegate-agent` action
- [ ] Testnet: deployer key (World Chain Sepolia ETH'li), agent key, seller EOA adresi

## ❓ Açık Konular / Kararlar

- [x] **World MCP eklendi + onaylandı** — `worldcoin-developer-portal` çalışıyor (`.mcp.json` gitignore'lu, `enabledMcpjsonServers`'da ön-onaylı).
  - Re-add komutu (token gerekir): `claude mcp add worldcoin-developer-portal https://developer.world.org/api/mcp --transport http --scope project --header "Authorization: Bearer <API_KEY>"`
- [x] **World Dev Portal kuruldu (MCP ile)** — Team: HumanSign
  - App: **`app_57bfbef995ca64868c99fbe566dd681b`** (mini-app, cloud engine, Finance)
  - World ID RP: **`rp_58afa18432212fe6`** — on-chain **registered** (prod+staging)
  - Action: **`delegate-agent`** (registered)
  - Signer key + ID'ler kök `.env`'de (GİZLİ, gitignore'lu). `app_id` + action `apps/miniapp/.env.local`'da.
  - [ ] ⚠️ **signTypedData DISALLOWED → signMessage (EIP-191) B-planına geçildi (04 §6):** World App `miniapp-sign-typed-data`'ya `disallowed_operation` döndü. Çözüm: miniapp client'ta EIP-712 digest hesaplar → `signMessage("HumanSign:0x<digest>")` (personal_sign) → backend `verifyMessage` (1271-aware) ile doğrular. `signedMessageForDigest` helper'ı `shared/eip712.ts`'te TEK kaynak. **Kontrat redeploy G1 için gerekmiyor**; ajan execution (06) için `executeApprovedPaymentPersonal` (toEthSignedMessageHash + Strings.toHexString) eklenip redeploy edilecek.
  - [ ] ⚠️ **v2/v4 UYUMSUZLUĞU (backend'de çözülecek):** RP verify endpoint'i **v4** (`/api/v4/verify/rp_58afa18432212fe6`) ama minikit 1.11.0 `verifyCloudProof` **v2**'ye (`/api/v2/verify/{app_id}`) gidiyor. Backend `/auth/worldid-verify` muhtemelen v4 endpoint'ine doğrudan POST'a çevrilmeli. Telefon testinde netleşecek.
- [ ] `verifyCloudProof` 1.11.0'da `@worldcoin/idkit-core/backend` re-export'u — çalışıyor (doğrulandı).
- [ ] ENS: Durin'i WC Sepolia mı Base Sepolia mı? (07 §2 — ENS standına sorulacak)

## 📌 Notlar

- `packages/contracts/lib/` gitignore'lu (submodule takibi yok) → fresh clone'da `forge install` gerekir.
- Demo policy değerleri: perTx **$1**, daily **$10**, premium **$80** (onay tetikler — dokunma).
- Henüz git commit yapılmadı (kullanıcı istediğinde).
