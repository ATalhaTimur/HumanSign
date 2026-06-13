// OTOMATIK ÜRETILDI — sync-addresses.mjs deploy sonrası bu dosyanın üzerine yazar.
// Aşağıdaki değerler PLACEHOLDER'dır; `pnpm deploy:testnet` ile gerçek adresler gelir.
export const CHAIN_ID = 4801;
// Not: ayırt edici placeholder'lar (hepsi aynı olursa ENS_LABELS computed-key'leri çakışır).
export const ADDRESSES = {
  spendGuard: "0x0000000000000000000000000000000000000001",
  mockUsdc: "0x0000000000000000000000000000000000000002",
  identityRegistry: "0x0000000000000000000000000000000000000003",
  seller: "0x0000000000000000000000000000000000000004",
  agent: "0x0000000000000000000000000000000000000005",
} as const;

/** ENS çözümlemesi yerine demo map'i (07 §3'teki karar). Kayıtlar zincirde gerçek. */
export const ENS_LABELS: Record<string, string> = {
  [ADDRESSES.agent]: "research.humansign.eth",
  [ADDRESSES.seller]: "data-provider.humansign.eth",
  [ADDRESSES.spendGuard]: "vault.humansign.eth",
};
