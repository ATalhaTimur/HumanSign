# 01 · KURULUM VE ORTAM

> Hedef: Cuma akşamı ilk 2 saatte herkesin makinesi aynı durumda + Dev Portal hazır + G1 smoke testine zemin.

## 1. Araçlar

```bash
# Node 20+, pnpm, Foundry
node -v        # >= 20
npm i -g pnpm
curl -L https://foundry.paradigm.xyz | bash && foundryup
# Tünel (Mini App'i World App'te açmak için)
npm i -g ngrok        # veya: cloudflared
```

## 2. Monorepo İskeleti

```bash
mkdir humansign && cd humansign && git init
pnpm init
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`package.json` (kök) script'leri:
```json
{
  "scripts": {
    "dev": "turbo run dev --parallel",
    "deploy:testnet": "pnpm -F contracts deploy:testnet",
    "agent:run": "pnpm -F agent start"
  }
}
```

Mini App'i en hızlı başlatma: `npx @worldcoin/create-mini-app@latest apps/miniapp`
(Şablon Next.js + MiniKit provider'ı hazır kurar. Şablon yoksa/değiştiyse 04 nolu dokümandaki manuel kurulum.)

## 3. Ağ Bilgileri

| Alan | Değer |
|---|---|
| Chain | World Chain Sepolia |
| chainId | **4801** |
| RPC | `https://worldchain-sepolia.g.alchemy.com/public` (kendi Alchemy key'inle değiştir — public RPC demo anında risk) |
| Explorer | `https://worldchain-sepolia.explorer.alchemy.com` |
| Gas token | ETH (Sepolia ETH'yi World Chain Sepolia'ya bridge'le veya WC Sepolia faucet kullan) |

> Cuma akşamı sponsor masası görevi: World standından güncel faucet/RPC önerisini teyit et.

## 4. Ortam Değişkenleri

Kökte `.env.example` (herkes kopyalayıp `.env` yapar; **asla commit etme**):

```bash
# Zincir
CHAIN_ID=4801
RPC_URL=https://worldchain-sepolia.g.alchemy.com/public

# Deploy sonrası doldurulur (deploy script'i otomatik yazar)
SPEND_GUARD_ADDRESS=
MOCK_USDC_ADDRESS=
IDENTITY_REGISTRY_ADDRESS=

# Anahtarlar (SADECE testnet anahtarları!)
DEPLOYER_PRIVATE_KEY=
AGENT_PRIVATE_KEY=

# Adresler
OWNER_ADDRESS=            # World App cüzdan adresi (aşağıda 6. adımda alınır)
SELLER_ADDRESS=           # satıcının para alacağı adres (deployer'dan farklı bir EOA aç)

# World
WORLD_APP_ID=app_xxxxxxxx
WORLD_ACTION_DELEGATE=delegate-agent

# Servisler
BACKEND_PORT=3001
SELLER_PORT=3002
BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_BACKEND_URL=https://<ngrok-id>.ngrok.app   # miniapp telefondan eriştiği için TÜNEL adresi!
```

⚠️ **En sık yapılan hata:** Mini App telefonda çalışır, `localhost`'unu göremez. `NEXT_PUBLIC_BACKEND_URL` her zaman tünel URL'i olmalı (backend'i de ngrok'la aç ya da miniapp'in Next.js API route'larını proxy yap).

## 5. World Developer Portal (kod yazmadan önce)

1. `developer.worldcoin.org` → **Create App** → adı `HumanSign` → `app_id`'yi `.env`'e.
2. **Incognito Actions** → yeni action: id `delegate-agent`, max verifications: sınırsız/uygun.
3. **Configuration → Advanced**: SpendGuard deploy edilince adresini **Contract Entrypoints**'e ekle (signTypedData/sendTransaction domain doğrulaması için gerekebilir — G1 testinde anlaşılır).
4. App URL: ngrok adresin (`https://xxxx.ngrok.app`). Her ngrok yeniden başlatmasında güncelle (ücretsiz ngrok'ta URL değişir; `ngrok http 3000 --domain=...` ile sabit domain varsa kullan).
5. Telefonda World App → arama → mini app'ini aç. Görmüyorsan: portal'da "draft" görünürlüğü + aynı hesapla giriş kontrolü.

## 6. Owner Adresini Alma (tavuk-yumurta çözümü)

SpendGuard constructor'ı `OWNER_ADDRESS` ister; o da Mini App'ten gelir:

1. Miniapp şablonunu boş haliyle ayağa kaldır (`pnpm -F miniapp dev` + ngrok).
2. Telefonda aç → şablondaki **Wallet Auth** butonuna bas → ekrana/konsola düşen adresi `.env`'deki `OWNER_ADDRESS`'e yaz.
3. (Kontratta `transferOwnership` da var — yanlış yazarsan düzeltilebilir.)

## 7. Deploy Sırası

```bash
pnpm -F contracts test            # önce testler yeşil
pnpm -F contracts deploy:testnet  # script: MockUSDC → SpendGuard → Registry
                                  # → adresleri .env'e VE packages/shared/addresses.ts'e yazar
```

Deploy script'i ayrıca: ajan cüzdanına gas için 0.02 ETH yollar, SpendGuard'a 200 mUSDC mint+transfer eder, `SELLER_ADDRESS`'i whitelist'e ekler. (Detay: 02-KONTRATLAR.md §5)

## 8. G1 Smoke Testi Tanımı (Cuma gece bitiş çizgisi)

1. Backend ayakta, `POST /dev/fake-intent` ile sahte intent yarat (05 nolu dokümanda hazır).
2. Mini App onay kartında görünüyor → **Onayla** → signTypedData → imza backend'e.
3. Backend logu: `✅ signature valid (1271-aware)`.

Bu üç satır yeşilse uyuyabilirsiniz. Değilse 04-MINIAPP.md §6'daki sorun giderme sırasını izle.
