# HumanSign MCP Server

An MCP server that gives any AI agent (Claude Desktop, Cursor, etc.) a **human-approved spending account**.

## Tools
| Tool | What it does |
|---|---|
| `get_policy` | Reads the SpendGuard policy from chain (per-tx / daily / remaining) |
| `list_catalog` | Lists the data resources available to buy + their prices |
| `buy_data({ resource, reason })` | Buys data: **autonomous under the limit**, **one-tap World ID approval on your phone over the limit** → once approved it pays on-chain and returns the data |

## Running (demo)
```bash
# 1) backend + seller must be up
pnpm --filter backend dev      # :3001
pnpm --filter seller dev       # :3002

# 2) Add the block from claude-desktop-config.json to your Claude Desktop config
#    → ~/Library/Application Support/Claude/claude_desktop_config.json
# 3) Restart Claude Desktop → the "humansign" tools appear
```

## Demo prompt (in Claude Desktop)
> "Prepare a Q2 market report. Buy the data you need from the data provider — small stuff just buy it, but ask me to approve anything over $1."

Claude calls `get_policy` → `list_catalog` → cheap `buy_data` (autonomous) → premium `buy_data` ($80, **your phone buzzes → World ID approval**) → writes the report. Every payment is real, on World Chain mainnet.

## The idea
> Any agent gets a policy + human-approval layer through a single MCP tool (`buy_data`). The developer never has to touch contracts or signatures — HumanSign handles SpendGuard + the World ID approval behind the scenes.
