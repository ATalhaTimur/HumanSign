# 07 · KİMLİK: ERC-8004 + ENS

> Sahip: Kontrat dev (Cmt gece bloğu) · Amaç: iki sponsor track'inin kanıt katmanı. UI cilası değil, ZİNCİRDE GERÇEK KAYIT esastır — jüriye explorer'dan gösterilir.

## 1. ERC-8004 Ajan Kaydı

### 1.1 agentURI JSON şablonu (agent card)

ERC-8004 ruhu: ERC-721 token → `agentURI` → ajan kartı JSON. IPFS derdi yok, base64 `data:` URI kullan (tamamen on-chain, bağımlılık sıfır):

```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "HumanSign Research Agent",
  "description": "Q2 pazar raporu icin veri toplayan demo ajan. Harcamalari HumanSign SpendGuard policy kasasi ile sinirli; limit ustu islemler World ID destekli insan onayi gerektirir.",
  "ens": "research.humansign.eth",
  "wallet": { "chainId": 4801, "spendGuard": "<SPEND_GUARD_ADDRESS>", "agentKey": "<AGENT_ADDRESS>" },
  "humanBacking": { "method": "world-id-orb", "action": "delegate-agent" },
  "endpoints": [{ "type": "demo", "url": "https://github.com/<repo>" }]
}
```

### 1.2 Kayıt script'i — packages/contracts/script/Register8004.s.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Script, console2} from "forge-std/Script.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

contract Register8004 is Script {
    function run() external {
        string memory json = vm.readFile("./agent-card.json"); // 1.1'deki dosya, adresler doldurulmuş
        string memory uri = string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
        vm.startBroadcast(vm.envUint("AGENT_PRIVATE_KEY")); // kaydı AJAN kendi yapar (anlatı!)
        uint256 id = IdentityRegistry(vm.envAddress("IDENTITY_REGISTRY_ADDRESS")).register(uri);
        vm.stopBroadcast();
        console2.log("agentId:", id);
    }
}
```

> Anlatı detayı: token'ı ajan mint eder ama istersen `safeTransferFrom` ile owner'a geçir — "ajanın kimliği insana ait" mesajı. Vakit varsa yap, yoksa söyle.

### 1.3 Jüriye gösterilecekler

- Explorer → IdentityRegistry → `Registered` event'i → `tokenURI(agentId)` çağrısı → base64 decode edilmiş kart (explorer çoğu zaman decode eder; etmezse `cast call` + `base64 -d` terminalde hazır olsun).
- README'ye dürüst not: "Identity Registry'nin minimal implementasyonu; Reputation/Validation registry'leri yol haritası."

## 2. ENS Subname'leri

### 2.1 Plan A — Durin / L2Registry (önerilen)

1. `durin.dev` arayüzünden takım ENS adını (`humansign.eth` — Sepolia'da kaydet, ~5 dk) L2Registry'ye bağla.
2. Hedef L2 olarak **World Chain Sepolia** seç — listede yoksa **Base Sepolia** (mimaride hiçbir şey değişmez; isim katmanı ayrı zincirde olabilir, bunu jüriye artı olarak anlat: "ENS'in cross-chain subname mimarisini kullanıyoruz").
3. Subname'leri mint et:
   - `research.humansign.eth` → AGENT_ADDRESS
   - `data-provider.humansign.eth` → SELLER_ADDRESS
   - `vault.humansign.eth` → SPEND_GUARD_ADDRESS
4. **Cuma akşamı ENS standına sor:** "L2Registry'yi WC Sepolia'da mı kurayım, Base Sepolia'da mı? Hangisi track kriterlerinize daha uygun?" — Hem doğru cevabı alırsın hem jüri seni hatırlar.

### 2.2 Text Record'lar (track'i kazandıran kısım)

Her subname'e ENSIP-25/26 ruhunda record'lar (Durin UI'dan veya registry kontratına `setText` ile):

| Record key | Değer | Amaç |
|---|---|---|
| `erc8004.registry` | `eip155:4801:<IDENTITY_REGISTRY_ADDRESS>` | 8004 backlink (isim → kimlik) |
| `erc8004.agentId` | `<agentId>` | hangi token |
| `humansign.vault` | `<SPEND_GUARD_ADDRESS>` | ismin harcama kasası |
| `humansign.policy` | `perTx=1USDC;daily=10USDC;approval=world-id` | insan-okunur policy özeti |
| `avatar` | bir emoji/png URL'i | onay kartı görseli (süs) |

Çift yön: agent card JSON'unda `"ens"` alanı zaten var → **isim ↔ kimlik doğrulanabilir döngüsü** tamam. Sunum cümlesi: "ENS'e bakan ajanın kimliğini, kimliğe bakan ismini bulur."

### 2.3 UI'da İsim Gösterimi — Bilinçli Kısayol

Onay kartı isimleri `shared/addresses.ts → ENS_LABELS` map'inden okur (canlı resolver entegrasyonu 36 saatte lüks). Kayıtlar zincirde GERÇEK olduğundan bu bir "fake" değil, performans kısayoludur. ENS jürisi sorarsa: "Record'lar zincirde [explorer'ı aç], UI çözümlemesi universal-resolver ile yol haritasında — kısıt 36 saatti, dürüstlük puanı bizden."

### 2.4 Plan B (Durin tamamen tıkanırsa)

Sepolia L1'de `humansign.eth` al → ENS app'ten 3 subname'i L1'de oluştur → text record'ları L1'de set et. Daha az havalı ama %100 çalışır ve yine gerçek ENS.

## 3. Sunumdaki "Denetim Zinciri" Slaytı İçin Kanıt Linkleri

Aşağıdaki 4 linki `08` dokümanındaki demo script'ine yapıştır (Pazar sabahı doldur):

1. World ID verify logu / Dev Portal action ekran görüntüsü → **insan**
2. IdentityRegistry `Registered` tx → **ajan kimliği**
3. ENS subname + text record sayfası → **isim ↔ kimlik bağı**
4. `ApprovedPaymentExecuted` tx (reasonHash + nonce) → **onaylı işlem**

> Bu dört link yan yana geldiğinde hikaye kendini anlatır: *gerçek tekil insan → kayıtlı ajan → isimli kimlik → insan-onaylı ödeme.*
