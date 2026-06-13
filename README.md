# HumanSign 🖊️

> **AI agents spend, humans sign.**
> A policy + instant human-approval layer for AI agent wallets. Under the limit, the agent is autonomous. Over the limit, the transaction lands on your phone as an approval card — you sign it with your World ID-backed World App, and the approval becomes a cryptographic, on-chain audit trail.

**ETHGlobal · Live on World Chain Mainnet · Tracks: ENS + World**

---

## The problem

You give an AI agent a wallet. At 3am it tries to spend $80. What stops it?

Today: nothing, or a blunt allowance. Multisigs are too slow for agent-speed spending; cold wallets solve key custody, not **authority delegation**. A 24/7 agent means a hot key is unavoidable — so the brake has to live in policy + a human-in-the-loop, not in key storage.

**HumanSign** is that brake: a spend-guard vault with per-tx and daily limits. Small spends fly through autonomously; anything over the limit pauses and asks a real, unique human (proven via World ID) for a one-tap biometric approval.

---

## How it works

```
AI agent (via MCP)  ──"buy data"──►  seller (HTTP 402 Payment Required)
      │                                     ▲
      │ reads policy from chain             │ verifies USDC Transfer in tx receipt
      ▼                                     │
SpendGuard.sol  (World Chain mainnet, policy vault)
   ├─ under limit → executePayment            (agent key only)          → AUTONOMOUS
   └─ over limit  → approveIntent (owner)  +  executeApprovedPaymentOnchain (agent)
                          ▲
                          │ on-chain approval (gas sponsored by World App)
   backend (intent queue) ──poll──►  Mini App (World App)  ──biometric──►  human
                                      research.humansign.eth → vault.humansign.eth · $80 · reason

Identity:   IdentityRegistry (ERC-8004)  ◄─ text record ─►  ENS subname
Human-proof: World ID (Orb) → "delegate-agent" action
```

**The flow in one breath:** the agent makes micro-purchases autonomously; when it reaches for the $80 premium dataset, your phone buzzes, you approve with World ID, the agent pays on-chain, the seller delivers the data — and every step is verifiable on-chain.

---

## ✅ What's real vs. mock (honest "how it's made")

| Real | Mock / shortcut |
|---|---|
| World Chain **mainnet** (chainId 480) — not testnet | The spent token is **MockUSDC** (no real value) so demos don't burn real money |
| Real **World App** — sponsored tx, smart-account deploy, biometric approval | Single-tenant: one vault hardcoded to the demo owner |
| Real **ENS** names + text records on **Ethereum mainnet** | Mini App resolves names from a label map (records are real on-chain) |
| Real **ERC-8004** agent identity (on-chain `tokenURI`) | |
| Real **on-chain settlement** of every payment | |
| Real **MCP** integration (any AI agent can use it) | |

> **Going to real money is a one-line change.** `SpendGuard` takes any `IERC20` in its constructor — point it at real USDC (`0x79A0…24d1` on World Chain) and it moves real value with **zero code changes**. We use MockUSDC only so each demo run is free.

---

## Live deployment (World Chain Mainnet, chainId 480)

| Contract | Address |
|---|---|
| **SpendGuard** (policy vault) | [`0xCec9Ba1F8bb9AC240E2372f2A261A142868483fC`](https://worldscan.org/address/0xCec9Ba1F8bb9AC240E2372f2A261A142868483fC) |
| MockUSDC | [`0x95192fedd0847bDcdcfd8f56781f68b8E54651Da`](https://worldscan.org/address/0x95192fedd0847bDcdcfd8f56781f68b8E54651Da) |
| IdentityRegistry (ERC-8004) | [`0xb8252FCcaB6f1d9D7330f0F29B97973a9C81944b`](https://worldscan.org/address/0xb8252FCcaB6f1d9D7330f0F29B97973a9C81944b) |

- World App: `app_57bfbef995ca64868c99fbe566dd681b` · World ID action: `delegate-agent` (RP `rp_58afa18432212fe6`)
- ENS (Ethereum mainnet): `humansign.eth` → `research`, `data-provider`, `vault` subnames

---

## 🔗 The audit chain (4 proofs, side by side)

*A real unique human → a registered agent → a named identity → a human-approved payment.*

1. **Human** → World App approval tx (sponsored): [`0x1236c7e2…`](https://worldscan.org/tx/0x1236c7e2cafefa0738c6220bfae4dd2f5da15be9fc391c05205ea0815a2b2c77)
2. **Agent identity** → ERC-8004 token #1 — `tokenURI` is the on-chain agent card
3. **Name ↔ identity** → [`research.humansign.eth`](https://app.ens.domains/research.humansign.eth) text records: `erc8004.registry`, `erc8004.agentId`, `humansign.vault`, `humansign.policy`
4. **Approved payment** → executeApprovedPaymentOnchain ($80): [`0x6efcbb80…`](https://worldscan.org/tx/0x6efcbb80ae7693dd814808e9f126e18e8dabd24c9de06e75e7bd0ef7ad0e43e1)

---

## Repo layout

```
apps/
  miniapp/   Next.js + @worldcoin/minikit-js  — 3 screens (onboard / approvals / policy)
  backend/   Fastify + viem                   — intent queue, on-chain approval verify
  agent/     viem                             — autonomous loop (demo agent)
  seller/    Fastify                          — mock x402 (HTTP 402) data provider
  mcp/        @modelcontextprotocol/sdk        — exposes HumanSign to ANY AI agent
packages/
  contracts/ Foundry — SpendGuard, MockUSDC, IdentityRegistry (12 tests, ERC-8004 + ENS scripts)
  shared/    EIP-712 schema, ABIs, addresses (single source of truth)
```

---

## Run it

```bash
pnpm install
pnpm -F contracts test                 # 12/12 green

# services (each its own terminal)
pnpm -F backend dev                    # :3001
pnpm -F seller  dev                    # :3002
pnpm -F miniapp dev                    # :3100  → expose via tunnel for World App

# the scripted demo agent (G2 autonomous + G3 approval flow)
pnpm agent:run
```

### Use it from a real AI agent (MCP)

HumanSign ships as an **MCP server** — drop one tool into any MCP-compatible agent (Claude Desktop, Cursor, …) and it gets a spending account with human guardrails. Tools: `get_policy`, `list_catalog`, `buy_data`.

Add to your Claude Desktop config (see `apps/mcp/claude-desktop-config.json`), then prompt:

> *"Prepare a Q2 market report. Buy the data you need from the data provider — small stuff just buy it, but ask me to approve anything over $1."*

The agent reasons, buys cheap data autonomously, hits $80 → **your phone buzzes** → you approve with World ID → the agent finishes the report. Every payment settles on World Chain mainnet.

---

## Production roadmap

- **Multi-tenant:** a `SpendGuard` factory — each user connects their own World App (walletAuth), gets their own vault (owner = their account), and approvals route to *their* phone. No shared keys.
- **Real USDC:** point the vault at real USDC — zero code change (token-agnostic `IERC20`).
- **Auto-issued ENS:** every new agent gets a free subname under `humansign.eth` via an L2 registrar (Durin) — no manual registration.
- **ERC-4337 module:** the intent + EIP-712 architecture ports directly to a 4337 module; the same guarantees in ~150 lines today.
- Reputation/Validation ERC-8004 registries; zkTLS-attested data provenance.

---

## Tech

Foundry · Solidity 0.8.24 (OpenZeppelin `SignatureChecker`/EIP-712) · World Chain · `@worldcoin/minikit-js` · World ID · ENS (mainnet subnames + text records) · ERC-8004 · viem · Fastify · Next.js · Model Context Protocol.

**Tracks:** ENS (named, record-rich agent identities) · World (World ID-backed human approval + Mini App + sponsored on-chain settlement).
