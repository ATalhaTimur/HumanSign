# HumanSign MCP Server

Herhangi bir AI ajanına (Claude Desktop, Cursor, vb.) **insan-onaylı harcama cüzdanı** veren MCP server.

## Tools
| Tool | Ne yapar |
|---|---|
| `get_policy` | SpendGuard policy'sini zincirden okur (perTx/daily/kalan) |
| `list_catalog` | Satın alınabilir veri kaynakları + fiyatları |
| `buy_data({ resource, reason })` | Veri satın alır: **limit altı otonom**, **limit üstü telefona World ID onayı** → onaylanınca zincirde öder, veriyi döner |

## Çalıştırma (demo)
```bash
# 1) backend + seller ayakta olmalı
pnpm --filter backend dev      # :3001
pnpm --filter seller dev       # :3002

# 2) Claude Desktop config'ine claude-desktop-config.json'daki bloğu ekle
#    → ~/Library/Application Support/Claude/claude_desktop_config.json
# 3) Claude Desktop'ı yeniden başlat → "humansign" araçları görünür
```

## Demo promptu (Claude Desktop'ta)
> "Q2 pazar raporu hazırla. İhtiyacın olan veriyi data-provider'dan satın al — ucuz şeyleri direkt al, pahalı (>$1) alımlar için bana onay sor."

Claude `get_policy` → `list_catalog` → ucuz `buy_data` (otonom) → premium `buy_data` ($80, **telefonun titrer → World ID onayı**) → raporu yazar. Tüm ödemeler World Chain mainnet'te gerçek.

## Anlatı
> Herhangi bir ajan tek bir MCP tool'u (`buy_data`) ile policy + insan-onayı katmanına kavuşur. Geliştirici kontrat/imza bilmek zorunda değil; HumanSign arkada SpendGuard + World ID onayını halleder.
