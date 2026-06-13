// Deploy broadcast çıktısındaki kontrat adreslerini okur →
// packages/shared/addresses.ts + kök .env'e yazar. (02 §5)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHAIN_ID = process.env.CHAIN_ID ?? "4801";
const root = join(__dirname, "..", "..");

const runPath = join(__dirname, "broadcast", "Deploy.s.sol", CHAIN_ID, "run-latest.json");
if (!existsSync(runPath)) {
  console.error(`✗ broadcast bulunamadı: ${runPath}\n  Önce 'forge script ... --broadcast' çalıştır.`);
  process.exit(1);
}

const run = JSON.parse(readFileSync(runPath, "utf8"));
const byName = {};
for (const tx of run.transactions ?? []) {
  if (tx.transactionType === "CREATE" && tx.contractName && tx.contractAddress) {
    byName[tx.contractName] = tx.contractAddress;
  }
}

const need = ["MockUSDC", "SpendGuard", "IdentityRegistry"];
const missing = need.filter((n) => !byName[n]);
if (missing.length) {
  console.error(`✗ deploy çıktısında eksik kontrat(lar): ${missing.join(", ")}`);
  process.exit(1);
}

const agent = process.env.AGENT_ADDRESS ?? "";
const seller = process.env.SELLER_ADDRESS ?? "";

// ── 1) packages/shared/addresses.ts ──
const addressesTs = `// OTOMATIK ÜRETILDI — sync-addresses.mjs (elle düzenleme, deploy üzerine yazar)
export const CHAIN_ID = ${CHAIN_ID};
export const ADDRESSES = {
  spendGuard: "${byName.SpendGuard}",
  mockUsdc: "${byName.MockUSDC}",
  identityRegistry: "${byName.IdentityRegistry}",
  seller: "${seller}",
  agent: "${agent}",
} as const;

/** ENS çözümlemesi yerine demo map'i (07 §3'teki karar). Kayıtlar zincirde gerçek. */
export const ENS_LABELS: Record<string, string> = {
  [ADDRESSES.agent]: "research.humansign.eth",
  [ADDRESSES.seller]: "data-provider.humansign.eth",
  [ADDRESSES.spendGuard]: "vault.humansign.eth",
};
`;
const addressesPath = join(root, "packages", "shared", "addresses.ts");
writeFileSync(addressesPath, addressesTs);
console.log(`✓ yazıldı: ${addressesPath}`);

// ── 2) kök .env içindeki adres satırlarını güncelle (varsa) ──
const envPath = join(root, ".env");
if (existsSync(envPath)) {
  let env = readFileSync(envPath, "utf8");
  const set = (key, val) => {
    const line = `${key}=${val}`;
    env = new RegExp(`^${key}=.*$`, "m").test(env)
      ? env.replace(new RegExp(`^${key}=.*$`, "m"), line)
      : env + (env.endsWith("\n") ? "" : "\n") + line + "\n";
  };
  set("SPEND_GUARD_ADDRESS", byName.SpendGuard);
  set("MOCK_USDC_ADDRESS", byName.MockUSDC);
  set("IDENTITY_REGISTRY_ADDRESS", byName.IdentityRegistry);
  writeFileSync(envPath, env);
  console.log(`✓ güncellendi: ${envPath}`);
} else {
  console.log("ℹ .env yok — adresleri manuel kopyala (yukarıda addresses.ts hazır).");
}

console.log("\nAdresler:");
for (const n of need) console.log(`  ${n} = ${byName[n]}`);
