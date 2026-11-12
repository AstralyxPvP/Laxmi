# DesiBot
DesiBot is the Discord AutoMod + community bot for AstralyxPvP.

## Features
- **Custom Native Automod**: multi-layer profanity detection (English + Hinglish), spam and raid detection
- **Role-Aware Moderation**: staff roles get appropriate immunity levels
- **AI Content Moderation**: Google Gemini for context-aware rule violation detection
- **Welcome System**: welcome messages with notification role buttons
- **Ticket System**: support tickets with staff Group DMs
- **Slash Commands**: moderation and utility commands
- **Daily QOTD Polls**: AI-generated poll + role ping + discussion thread, every day at 2:00 PM IST

## Project Structure
```
├── index.js               # Worker entry: interactions, automod, commands, cron handler
├── poll.js                # Daily QOTD poll engine (AI generation + Discord publishing)
├── gateway.js             # Gateway connection for bot presence (run separately)
├── register-commands.js   # Slash command registration
├── wrangler.toml          # Worker config (KV binding, cron trigger)
└── README.md              # This file
```

## Deployment
```bash
npx wrangler deploy
```

Secrets required on the `laxmi` Worker:
```bash
npx wrangler secret put DISCORD_TOKEN
npx wrangler secret put DISCORD_PUBLIC_KEY
npx wrangler secret put GATEWAY_SECRET
npx wrangler secret put GOOGLE_API_KEY
npx wrangler secret put FORUM_SECRET
npx wrangler secret put LOG_CHANNEL_ID   # optional, receives QOTD logs
npx wrangler secret put GROQ_API_KEY    # fallback AI for polls + moderation
```

`wrangler.toml` pins the target account and KV namespace, so no other secrets
are needed for the poll job — it runs inside the same Worker.

## Daily QOTD Polls
- **Schedule**: `30 8 * * *` → 08:30 UTC → **2:00 PM IST** daily
- **Channel**: `#qotd` (`1477272501699481642`)
- **Flow**: post poll → ping `@Polls` (`1500206496535937195`) in a new message → create a
  discussion thread on the poll → post a thread intro message

The question and answers come from Gemini, with **Groq (`gpt-oss-120b` → `gpt-oss-20b`) as an automatic fallback**.
Both are constrained to Minecraft PvP / server topics. If every AI call fails, a rotating curated
fallback poll is used so the channel never goes empty.

A date guard in KV (`qotd:last_date`) prevents double-posting on the same day, and the
QOTD number is tracked in `qotd:counter`.

### Testing without posting
```bash
# Generate a poll and return the JSON (nothing is posted)
# add ?provider=groq or ?provider=gemini to force a provider
curl -X POST "https://laxmi.indiancoder3.workers.dev/poll/preview?provider=groq" \
  -H "Authorization: Bearer $GATEWAY_SECRET"
```

### Testing the moderation classifier
```bash
curl -X POST "https://laxmi.indiancoder3.workers.dev/moderation/test?provider=groq&text=you%20suck" \
  -H "Authorization: Bearer $GATEWAY_SECRET"
```

### Testing with posting
```bash
curl -X POST "https://laxmi.indiancoder3.workers.dev/poll/test?force=1" \
  -H "Authorization: Bearer $GATEWAY_SECRET"
```

## Tech Stack
- **Runtime**: Cloudflare Workers
- **Storage**: Cloudflare KV
- **AI**: Google Gemini (moderation + poll generation)
- **Discord API**: v10
- **Profanity Detection**: Obscenity
