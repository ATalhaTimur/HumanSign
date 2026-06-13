import { keccak256, stringToBytes, type Address, type Hex } from "viem";

export const HUMANSIGN_DOMAIN_NAME = "HumanSign";
export const HUMANSIGN_DOMAIN_VERSION = "1";

export const humanSignDomain = (chainId: number, verifyingContract: Address) => ({
  name: HUMANSIGN_DOMAIN_NAME,
  version: HUMANSIGN_DOMAIN_VERSION,
  chainId,
  verifyingContract,
}) as const;

/** Matches the contract struct exactly, including field order. */
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

/** Human-readable reason shown on the approval card → its on-chain hash (same string). */
export const hashReason = (reason: string): Hex => keccak256(stringToBytes(reason));

export const usdc = (amountHuman: number): bigint => BigInt(Math.round(amountHuman * 1e6));
export const fromUsdc = (amount: bigint): string => (Number(amount) / 1e6).toFixed(2);

export const newNonce = (): bigint => BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 1000));
export const deadlineIn = (seconds: number): bigint => BigInt(Math.floor(Date.now() / 1000) + seconds);
