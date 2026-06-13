# 08 · DEMO · SUBMISSION · GÖREV PANOSU

## 1. Demo Script'i (saniye saniye — minimum 5 prova)

**Sahne düzeni:** Sol ekran: terminal (ajan logları, büyük font). Sağ ekran: explorer. Elde: telefon (ekran yansıtma hazır — Mac+iPhone: QuickTime; Android: scrcpy).

```
0:00  "Ajanına cüzdan verdin. Gece 3'te 80 dolar harcamaya kalkarsa ne olur?"
0:10  `pnpm agent:run` → 3 mikro ödeme akar; explorer'da AutoPaymentExecuted'ı göster
0:45  Ajan $80 dener → SARI LOG: "🛑 POLICY: APPROVAL REQUIRED"
1:00  📱 TELEFON TİTRER → kartı yansıt: research.humansign.eth → data-provider.humansign.eth · 80 USDC · sebep
1:20  "Onayla" → World App imza ekranı → biyometri
1:35  Terminal: "✍️ insan imzası alındı" → tx → "🎉 RAPOR TAMAM"
1:50  Explorer: ApprovedPaymentExecuted event → nonce + reasonHash alanlarını göster
2:10  ENS record sayfası + 8004 tokenURI: "isim ↔ kimlik ↔ kasa ↔ onay — denetim zinciri tamam"
2:30  (İsteğe bağlı, jüri ilgiliyse) Reddet akışı: ikinci $80 denemesi → Reddet → ajan zarifçe vazgeçer
```

**Yedekler:** (a) tüm akışın 2:30'luk kaydı telefonda VE laptopta, (b) anvil fork'ta çalışan lokal kopya, (c) ekran görüntüleri klasörü. Wifi'ye güvenme — hotspot yedeği.

## 2. ETHGlobal Submission Checklist (Pazar 09:00 hard deadline kendine koy)

- [ ] Showcase: isim **HumanSign**, tagline: *"AI agents spend, humans sign."*
- [ ] Kısa açıklama (EN, ~280): policy vault + instant human approval for agent payments; under-limit autonomous, over-limit one-tap biometric approval in a World Mini App; every approval becomes an on-chain, World ID-backed audit trail with ENS-named agents.
- [ ] "How it's made": SpendGuard 2-of-2 + EIP-1271 gotcha'sını, MiniKit signTypedData akışını, 8004+ENS backlink'i DÜRÜSTÇE anlat (kısayollar dahil — jüri dürüstlüğü ödüllendirir)
- [ ] Demo video ≤3 dk (script §1'in kaydı; ses temiz, font büyük)
- [ ] Public repo: README (mimari şema + adresler + `pnpm demo` adımları + "production yol haritası" bölümü)
- [ ] Kontrat adresleri + explorer linkleri
- [ ] Prize seçimi: **ENS**, **World** (+ uygunsa Google Cloud)
- [ ] Sponsor feedback formları (bazıları ödül şartı!)
- [ ] Takım profilleri showcase'e bağlı

## 3. Sahne/Jüri Q&A Kartları (ezberle)

| Soru | Cevap (≤20 sn) |
|---|---|
| Safe bunu yapmıyor mu? | "Safe genel multisig; biz ajan-hızında policy + tüketici onay kartı + kimlik bağıyız. Limit altı sıfır sürtünme — multisig'de bu yok." |
| AgentKit HITL varken siz ne? | "Primitif ≠ ürün. World primitifi verdi; biz policy motoru + askıya alma + onay UX'ini pakete çevirdik. AgentKit'in var olma amacı bizim gibi ürünler." |
| Neden ERC-4337 değil? | "36 saatlik dürüst mühendislik. SpendGuard aynı garantiyi ~150 satırda veriyor; intent+EIP-712 mimarisi 4337 modülüne birebir taşınır — yol haritası." |
| Soğuk cüzdan? | "Anahtar saklamayı çözer, yetki devrini çözmez. 7/24 ajan = sıcak anahtar kaçınılmaz; fren bizde." |
| Onay darboğaz olmaz mı? | "%95+ işlem otonom. İnsan sadece kuyruk riskini görür — banka da her işlemde SMS atmaz." |
| Backend'e güven? | "Hayır: kontrat nihai doğrulayıcı (SignatureChecker). Backend'i kapat, imza+intent ile ödeme yine güvenli." |
| İş modeli? | "OSS çekirdek; ajan başı abonelik + onaylı hacimde bps + AI Act Madde 14 compliance tier'ı." |

## 4. Görev Panosu (rol bazlı, sırayla)

### 🟪 A — Kontrat dev
- [ ] A1 foundry init + SpendGuard + Mock'lar (02 §1–3)
- [ ] A2 9 test yeşil (02 §4) — **G1 ön şartı değil ama Cmt sabah biter**
- [ ] A3 Deploy + sync-addresses (02 §5) → herkese adres dağıt
- [ ] A4 Register8004 + agent-card.json (07 §1)
- [ ] A5 ENS: durin + 3 subname + text record'lar (07 §2) — *Cuma akşamı ENS standına soruyu sor*
- [ ] A6 Kanıt linkleri dosyası (07 §3)

### 🟦 B — Mini App dev
- [ ] B1 create-mini-app + ngrok + Dev Portal app/action (01 §5, 04 §1)
- [ ] B2 Onboarding: walletAuth → OWNER_ADDRESS'i A3 için ver (04 §2) ⚠️ kritik yol
- [ ] B3 verify(delegate-agent) → backend doğrulaması (C2 ile birlikte)
- [ ] B4 Onay kartı + SSE + signTypedData (04 §3) → **G1**
- [ ] B5 Geçmiş/rozetler + policy read-only ekranı
- [ ] B6 Görsel cila: avatar, titreşim, explorer linkleri

### 🟩 C — Backend/Agent dev
- [ ] C1 backend iskeleti + /dev/fake-intent + SSE (05 §3) → **G1'in diğer yarısı**
- [ ] C2 worldid-verify + siwe-verify uçları
- [ ] C3 approve: owner check + verifyTypedData + cross-check assert (03 §6)
- [ ] C4 seller 402 + receipt doğrulama (06 §1)
- [ ] C5 agent döngüsü: otonom yol → **G2**
- [ ] C6 agent onay yolu + executed PATCH → **G3**
- [ ] C7 (lüks) LLM reason üretimi

### 🟨 Ortak
- [ ] O1 Cuma: sponsor masaları (World: AgentKit/entrypoint sorusu · ENS: Durin/L2 sorusu)
- [ ] O2 Cmt gece: tam akış 3 kez üst üste temiz
- [ ] O3 Pazar 07:00 video → 09:00 submission → 5x prova → KOD FREEZE
- [ ] O4 Hotspot + şarj + yansıtma testi

## 5. Zaman Kapıları (tekrar)

| Kapı | Zaman | Tanım | Geçemezsek |
|---|---|---|---|
| G1 | Cuma gece | fake-intent → kart → signTypedData → backend ✅ | 04 §6 sıra + B planı (signMessage) |
| G2 | Cmt 14:00 | otonom ödeme + 402→200 ucu uca | LLM/cila iptal, çekirdeğe herkes |
| G3 | Cmt 22:00 | $80 tam akış 1 kez temiz | ENS/8004'ü minimuma indir (kayıt var, record az) |
| G4 | Pazar 09:00 | video + submission gönderildi | — (bu kapı esnemez) |

---
*"Demo gününde kahramanlık yok; Cuma gecesi G1'i geçen takım Pazar günü uyumuş olur."* 🖊️
