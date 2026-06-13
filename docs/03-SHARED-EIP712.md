# 03 · SHARED PAKETİ — EIP-712 TEK KAYNAK

> Sahip: ilk yazan kontrat dev, sonra herkes import eder · `packages/shared`
> **Kural:** Bu paketteki şema, kontrattaki `PAYMENT_INTENT_TYPEHASH` ile birebir aynıdır. Birinde alan değişirse İKİSİ birden değişir ve `hashIntent` cross-check testi koşulur.

## 1. Kurulum

```bash
cd packages/shared && pnpm init
pnpm add viem zod
```

`package.json`: `{ "name": "@humansign/shared", "type": "module", "main": "index.ts" }`
(Diğer app'ler: `pnpm add @humansign/shared --workspace`)

## 2. eip712.ts (TAM KOD)

```typescript
import { keccak256, stringToBytes, type Address, type Hex } from "viem";

export const HUMANSIGN_DOMAIN_NAME = "HumanSign";
export const HUMANSIGN_DOMAIN_VERSION = "1";

export const humanSignDomain = (chainId: number, verifyingContract: Address) => ({
  name: HUMANSIGN_DOMAIN_NAME,
  version: HUMANSIGN_DOMAIN_VERSION,
  chainId,
  verifyingContract,
}) as const;

/** Kontrattaki struct ile ALAN SIRASI DAHİL birebir aynı. Dokunma. */
export const PAYMENT_INTENT_TYPES = {
  PaymentIntent: [
    { name: "to", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "reasonHash", type: "bytes32" },
    { name: "agent", type: "address" },
  ],
} as const;

export type PaymentIntentMessage = {
  to: Address;
  amount: bigint;     // 6 decimal (mUSDC)
  nonce: bigint;
  deadline: bigint;   // unix saniye
  reasonHash: Hex;
  agent: Address;
};

/** Onay kartında gösterilen sebep metni → zincirdeki hash. Kart metniyle AYNI string. */
export const hashReason = (reason: string): Hex => keccak256(stringToBytes(reason));

export const usdc = (amountHuman: number): bigint => BigInt(Math.round(amountHuman * 1e6));
export const fromUsdc = (amount: bigint): string => (Number(amount) / 1e6).toFixed(2);

export const newNonce = (): bigint => BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 1000));
export const deadlineIn = (seconds: number): bigint => BigInt(Math.floor(Date.now() / 1000) + seconds);
```

## 3. intent.ts — yaşam döngüsü tipleri

```typescript
import { z } from "zod";
import type { PaymentIntentMessage } from "./eip712";

export type IntentStatus = "pending" | "approved" | "rejected" | "expired" | "executed";

export interface StoredIntent {
  id: string;                 // uuid
  message: PaymentIntentMessage;
  reason: string;             // insan-okunur (hash'in kaynağı)
  toLabel: string;            // "data-provider.humansign.eth"
  agentLabel: string;         // "research.humansign.eth"
  status: IntentStatus;
  signature?: `0x${string}`;  // owner imzası (approved'da dolar)
  txHash?: `0x${string}`;     // executed'da dolar
  createdAt: number;
}

export const approveBodySchema = z.object({
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
  ownerAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
});

export const createIntentSchema = z.object({
  to: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  amount: z.string(),         // bigint string
  reason: z.string().min(3).max(140),
});
```

## 4. addresses.ts (deploy script'i otomatik yazar)

```typescript
export const CHAIN_ID = 4801;
export const ADDRESSES = {
  spendGuard: "0x...",
  mockUsdc: "0x...",
  identityRegistry: "0x...",
  seller: "0x...",
  agent: "0x...",
} as const;

/** ENS çözümlemesi yerine demo map'i (07 nolu doküman §3'teki karar). Kayıtlar zincirde gerçek. */
export const ENS_LABELS: Record<string, string> = {
  [ADDRESSES.agent]: "research.humansign.eth",
  [ADDRESSES.seller]: "data-provider.humansign.eth",
  [ADDRESSES.spendGuard]: "vault.humansign.eth",
};
```

## 5. abi.ts

```bash
# Kontrat build sonrası ABI'yi shared'a kopyalayan script (contracts/package.json'a ekle):
# "sync-abi": "node -e \"const a=require('./out/SpendGuard.sol/SpendGuard.json').abi; require('fs').writeFileSync('../shared/spendGuardAbi.ts','export const spendGuardAbi = '+JSON.stringify(a)+' as const;')\""
```

viem ile `as const` ABI → tüm `readContract/writeContract` çağrıları tam tip güvenli.

## 6. Cross-Check Testi (G1'in parçası)

Backend'de tek seferlik kontrol — TS tarafının digest'i ile kontratın `hashIntent`'i aynı mı:

```typescript
import { hashTypedData } from "viem";
const tsDigest = hashTypedData({ domain, types: PAYMENT_INTENT_TYPES, primaryType: "PaymentIntent", message });
const chainDigest = await publicClient.readContract({
  address: ADDRESSES.spendGuard, abi: spendGuardAbi, functionName: "hashIntent",
  args: [[message.to, message.amount, message.nonce, message.deadline, message.reasonHash, message.agent]],
});
console.assert(tsDigest === chainDigest, "EIP-712 ŞEMA UYUŞMAZLIĞI! Alan sırası/tipi kontrol et.");
```

Bu assert bir kez yeşil yandıysa, "invalid signature" hatası gördüğünde sorunun şemada DEĞİL imzalayanda olduğunu bilirsin — saatlerce yanlış yerde arama yapmazsın.
