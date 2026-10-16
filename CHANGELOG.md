# Changelog

The taxonomy is versioned like software: the data in this repo is always an export of what [ethereumtv.co](https://ethereumtv.co) serves, and every release here matches a state of the live database. Internal drafts v1 through v13 predate this repo; the public history starts at the finalized v14.

## 1.1.0 (2026-10-16)

Two new shared subtopics, so market, macro and venture talks have a home without a new topic.

- **Macro** (`macro`), home DeFi, also under RWA: crypto in the wider economy: market cycles, liquidity and interest rates, outlooks, and how crypto moves with traditional markets.
- **Investing** (`investing`), home RWA, also under DeFi: venture funding and theses, funds, ETFs, treasury companies, and how institutions and individuals build positions.
- Now 20 topics, 111 unique subtopics, 16 shared. New aliases: Macroeconomics, Market Cycles, Market Outlook (Macro); Venture Capital, VC, Crypto Funds (Investing).
- `scripts/export.mjs`: shape check moved to 111/16, and the taxonomy.md legend now states the exported counts instead of fixed numbers.

## 1.0.0 (2026-08-27)

Initial public release: taxonomy v14.

- 20 topics, 109 unique subtopics, 14 shared subtopics, globally unique slugs, a one-sentence definition on every node.
- Finalized after an external verification pass against conference track taxonomies (Devcon, Devconnect, EthCC, ETHDenver, ETHGlobal, Protocol Berg, SBC), industry sector taxonomies (Messari, CoinGecko, The Block, Galaxy, a16z, Binance, Coinbase), 2025 to 2026 Ethereum discourse, and navigation research from the Baymard Institute and Nielsen Norman Group.
- Ships with `data/aliases.json`, the seed list of search synonyms.
