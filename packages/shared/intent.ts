import { z } from "zod";
import type { PaymentIntentMessage } from "./eip712";

export type IntentStatus = "pending" | "approved" | "rejected" | "expired" | "executed";

export interface StoredIntent {
  id: string;                 // uuid
  message: PaymentIntentMessage;
  reason: string;             // insan-okunur (hash'in kaynağı)
  intentHash: `0x${string}`;  // EIP-712 digest — ödemeyi benzersiz tanımlar; World ID proof'una signal olarak gömülür
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
