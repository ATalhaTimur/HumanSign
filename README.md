<div align="center">

# HumanSign 🖊️

### AI agents spend, humans sign.

**A policy + instant human-approval layer for AI agent wallets.**
Under the limit, the agent is autonomous. Over the limit, the transaction lands on your phone as an approval card — you sign it with your World ID-backed World App, and the approval becomes a cryptographic, on-chain audit trail.

[![Live on World Chain](https://img.shields.io/badge/live-World_Chain_mainnet-000000)](https://worldscan.org/address/0xCec9Ba1F8bb9AC240E2372f2A261A142868483fC)
[![Tracks](https://img.shields.io/badge/tracks-ENS_%2B_World-4F46E5)](#-tracks)
[![MCP](https://img.shields.io/badge/MCP-any_AI_agent-7C3AED)](#-use-it-from-any-ai-agent-mcp)
[![Tests](https://img.shields.io/badge/contracts-12%2F12_passing-16A34A)](#-run-it)

[**▶ Watch the 3-min demo**](#) · [Live contracts](#-live-deployment-world-chain-mainnet) · [The audit chain](#-the-audit-chain)

</div>

---

## The problem

> You give an AI agent a wallet. At 3am it tries to spend **$80**. What stops it?

Today: nothing, or a blunt allowance. **Multisigs** are too slow for agent-speed spending. **Cold wallets** solve key custody, not *authority delegation*. A 24/7 agent means a hot key is unavoidable — so the brake has to live in **policy + a human-in-the-loop**, not in key storage.

**HumanSign** is that brake. A spend-guard vault with per-tx and daily limits: small spends fly through autonomously; anything over the limit pauses and asks a real, unique human — proven via World ID — for a one-tap biometric approval.

---

## How it works

```
AI agent (via MCP)  ──"buy data"──►  seller (HTTP 402 Payment Required)
      │                                     ▲
      │ reads policy from chain             │ verifies USDC Transfer in tx receipt
      ▼                                     │
SpendGuard.sol  (World Chain mainnet · policy vault)
   ├─ under limit → executePayment            (agent key only)              → AUTONOMOUS
   └─ over limit  → approveIntent (owner)  +  executeApprovedPaymentOnchain (agent)
                          ▲
                          │ on-chain approval — gas sponsored by World App
   backend (intent queue) ──poll──►  Mini App (World App)  ──biometric──►  human
                                      research.humansign.eth → vault.humansign.eth · $80
```

**In one breath:** the agent makes micro-purchases autonomously; when it reaches for the $80 premium dataset, your phone buzzes, you approve with World ID, the agent pays on-chain, the seller delivers the data — and **every step is verifiable on-chain.**

---

## 🔗 The audit chain

> *A real unique human → a registered agent → a named identity → a human-approved payment.*
> When these four sit side by side on-chain, the story tells itself.

| # | Layer | Proof |
|---|---|---|
| 1 | **Human** | World App approval tx (sponsored): [`0x1236c7e2…`](https://worldscan.org/tx/0x1236c7e2cafefa0738c6220bfae4dd2f5da15be9fc391c05205ea0815a2b2c77) |
| 2 | **Agent identity** | ERC-8004 token #1 — `tokenURI` is the on-chain agent card |
| 3 | **Name ↔ identity** | [`research.humansign.eth`](https://app.ens.domains/research.humansign.eth) → text records `erc8004.registry`, `erc8004.agentId`, `humansign.vault`, `humansign.policy` |
| 4 | **Approved payment** | `executeApprovedPaymentOnchain` ($80): [`0x6efcbb80…`](https://worldscan.org/tx/0x6efcbb80ae7693dd814808e9f126e18e8dabd24c9de06e75e7bd0ef7ad0e43e1) |

---

## Why HumanSign?

| | What others do | What HumanSign does |
|---|---|---|
| **Multisig / Safe** | Every tx needs signatures — too slow for agents | **Zero friction under the limit**, human only on exceptions |
| **Cold wallet** | Protects keys, not delegation | Bounds a *necessary* hot key with policy + human override |
| **Spend allowance** | A cap that can't ask anyone | Escalates over-limit spends to a **real human, one tap** |
| **HITL primitives** | A building block | A packaged product: policy engine + approval UX + **on-chain identity** |

The limits gate **autonomy**, not total spend — so a human can always authorize more. Like a contactless card: tap-to-pay up to a limit, PIN above it.

---

## ✅ What's real vs. mock

*Honest "how it's made" — judges reward honesty, so here it is up front.*

| Real | Mock / shortcut |
|---|---|
| World Chain **mainnet** (chainId 480) — not testnet | Spent token is **MockUSDC** (no value) so demos are free |
| **World App** — sponsored tx, smart-account deploy, biometric approval | Single-tenant — one vault for the demo owner |
| **ENS** names + text records on **Ethereum mainnet** | Mini App reads names from a label map (records are real on-chain) |
| **ERC-8004** agent identity (on-chain `tokenURI`) | |
| **On-chain settlement** of every payment | |
| **MCP** — any AI agent can use it | |

> **Real money is a one-line change.** `SpendGuard`'s constructor takes any `IERC20`. Point it at real USDC (`0x79A0…24d1` on World Chain) and it moves real value with **zero code changes** — we use MockUSDC only so each demo run is free.

---

## 📍 Live deployment (World Chain Mainnet · chainId 480)

| Contract | Address |
|---|---|
| **SpendGuard** — policy vault | [`0xCec9Ba1F8bb9AC240E2372f2A261A142868483fC`](https://worldscan.org/address/0xCec9Ba1F8bb9AC240E2372f2A261A142868483fC) |
| MockUSDC | [`0x95192fedd0847bDcdcfd8f56781f68b8E54651Da`](https://worldscan.org/address/0x95192fedd0847bDcdcfd8f56781f68b8E54651Da) |
| IdentityRegistry — ERC-8004 | [`0xb8252FCcaB6f1d9D7330f0F29B97973a9C81944b`](https://worldscan.org/address/0xb8252FCcaB6f1d9D7330f0F29B97973a9C81944b) |

- **World App:** `app_57bfbef995ca64868c99fbe566dd681b` · World ID action `delegate-agent`
- **ENS:** `humansign.eth` → `research` · `data-provider` · `vault`

---

## 🚀 Run it

```bash
pnpm install
pnpm -F contracts test          # 12/12 passing

# services (each in its own terminal)
pnpm -F backend dev             # :3001
pnpm -F seller  dev             # :3002
pnpm -F miniapp dev             # :3100  → expose via a tunnel for World App

pnpm agent:run                  # scripted demo agent (autonomous + approval flow)
```

### 🤖 Use it from any AI agent (MCP)

HumanSign ships as a **Model Context Protocol server** — drop one tool into any MCP-compatible agent (Claude Desktop, Cursor, …) and it gets a spending account with human guardrails. Tools: `get_policy`, `list_catalog`, `buy_data`.

Add the block from `apps/mcp/claude-desktop-config.json` to your Claude Desktop config, then prompt:

> *"Prepare a Q2 market report. Buy the data you need — small stuff just buy it, but ask me to approve anything over $1."*

The agent reasons, buys cheap data autonomously, hits $80 → **your phone buzzes** → you approve with World ID → it finishes the report. Every payment settles on World Chain mainnet.

---

## 🧱 Architecture

```
apps/
  miniapp/    Next.js + @worldcoin/minikit-js   3 screens: onboard · approvals · policy
  backend/    Fastify + viem                    intent queue, on-chain approval verification
  agent/      viem                              autonomous loop (demo agent)
  seller/     Fastify                           mock x402 (HTTP 402) data provider
  mcp/        @modelcontextprotocol/sdk         exposes HumanSign to any AI agent
packages/
  contracts/  Foundry                           SpendGuard · MockUSDC · IdentityRegistry (12 tests)
  shared/     viem + zod                        EIP-712 schema · ABIs · addresses (single source)
```

**Key contract design:** `SpendGuard` has two paths — `executePayment` (autonomous, under-limit, agent signature only) and `approveIntent` + `executeApprovedPaymentOnchain` (the human-approved, over-limit path). It's token-agnostic, with per-tx + rolling-daily limits, nonce/deadline replay protection, and a whitelist.

---

## 🗺️ Production roadmap

- **Multi-tenant** — a `SpendGuard` factory: each user connects their own World App and gets their own vault; approvals route to *their* phone. No shared keys.
- **Real USDC** — point the vault at real USDC; zero code change.
- **Auto-issued ENS** — every new agent gets a free subname under `humansign.eth` via an L2 registrar (Durin); no manual registration.
- **ERC-4337 module** — the intent + EIP-712 design ports directly to a 4337 module.
- Reputation/Validation ERC-8004 registries · zkTLS-attested data provenance.

---

## 🛠️ Tech

Foundry · Solidity 0.8.24 (OpenZeppelin `SignatureChecker` / EIP-712) · World Chain · `@worldcoin/minikit-js` · World ID · ENS (mainnet subnames + text records) · ERC-8004 · viem · Fastify · Next.js · Model Context Protocol.

## 🏆 Tracks

- **ENS** — named, record-rich agent identities; an on-chain *name ↔ identity ↔ vault ↔ policy* audit chain.
- **World** — World ID-backed human approval, World App Mini App, and gas-sponsored on-chain settlement.

<div align="center">

**HumanSign** — any AI agent gets a spending account with human guardrails, through one MCP tool.

*AI agents spend · humans sign.*

</div>
