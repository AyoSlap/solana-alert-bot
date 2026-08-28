# Solana Telegram Alert Bot

A production-oriented starter bot that sends screenshot-style token alerts to Telegram.

## What it monitors

### 1. Pump.fun / PumpSwap
Uses the PumpPortal WebSocket to receive new-token events in real time. The token is then enriched with current DEX Screener pair data.

### 2. Non-Pump Solana DEX tokens
Polls DEX Screener's latest Solana token profiles and enriches each newly discovered address with pair data. This catches Solana tokens appearing across supported DEXes (for example Raydium, Meteora, Orca and others) once DEX Screener has a profile/pair for them.

> Important: DEX Screener's public REST API does not provide a universal "every new Solana pair" endpoint. The non-Pump adapter therefore uses its latest Solana token-profile feed. If you need a true every-pool/on-chain feed, add a Helius/Yellowstone/Geyser adapter later.

## Features

- Screenshot-inspired alert formatting
- Pump.fun/PumpSwap real-time creation events
- Non-Pump Solana discovery
- FDV, liquidity, 1h volume, age, 1h price change
- 1h buys/sells and buy/sell ratio
- Configurable filters in `.env`
- Duplicate suppression and cooldown
- Telegram inline buttons for DexScreener, Pump.fun and Solscan
- Optional token image
- `/status`, `/filters`, `/test`, `/reload` admin commands
- Persistent JSON state so restarts do not immediately spam old tokens
- No trading/private keys are required

## Setup

1. Install Node.js 20+.
2. Create a Telegram bot with BotFather and copy its token.
3. Add the bot to your target group/channel. For a channel, make it an administrator with permission to post.
4. Copy `.env.example` to `.env`.
5. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`.
6. For real-time Pump.fun events, put your PumpPortal API key in `PUMPPORTAL_API_KEY`.
7. Run:

```bash
npm install
npm start
```

## Getting the Telegram chat ID

- For a public channel, `TELEGRAM_CHAT_ID=@channelusername` works.
- For a private group/channel, use the numeric `-100...` chat ID. A common way is to add the bot, send a message, and inspect `getUpdates` or use a Telegram chat-ID helper.

## Commands

Admin users listed in `ADMIN_USER_IDS` can use:

- `/status`
- `/filters`
- `/test`
- `/reload`

## Recommended first settings

The example filter is intentionally fairly selective:

- Liquidity >= $20k
- 1h volume >= $500k
- FDV >= $300k
- Age <= 60 minutes
- 1h price change >= +20%
- Buy/sell ratio >= 1.0

Change these in `.env` to match the screenshot bot you are trying to replicate.

## Safety

This is an alerting/market-monitoring bot, not an auto-trader. It does not hold private keys, execute trades, or guarantee that a token is legitimate or profitable. Meme coins can be extremely volatile and can be honeypots, rugs, or otherwise manipulated.

## API notes

The bot uses:
- Telegram Bot API for messages/buttons.
- PumpPortal WebSocket for Pump.fun/PumpSwap real-time token events.
- DEX Screener public API for token/pair enrichment and non-Pump discovery.

See the official documentation links in the response that accompanied this project.
