// OTOMATIK ÜRETILDI — sync-addresses.mjs (elle düzenleme, deploy üzerine yazar)
export const CHAIN_ID = 480;
export const ADDRESSES = {
  spendGuard: "0xcec9ba1f8bb9ac240e2372f2a261a142868483fc",
  mockUsdc: "0x95192fedd0847bdcdcfd8f56781f68b8e54651da",
  identityRegistry: "0xb8252fccab6f1d9d7330f0f29b97973a9c81944b",
  seller: "0x4E0a5bf07fC2dadb4b1910f084a3B506DDe0379c",
  agent: "0x8e38a8aC277b72074653ff653c84366e402e91A2",
} as const;

/** ENS çözümlemesi yerine demo map'i (07 §3'teki karar). Kayıtlar zincirde gerçek. */
export const ENS_LABELS: Record<string, string> = {
  [ADDRESSES.agent]: "research.humansign.eth",
  [ADDRESSES.seller]: "data-provider.humansign.eth",
  [ADDRESSES.spendGuard]: "vault.humansign.eth",
};
