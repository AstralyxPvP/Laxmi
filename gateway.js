/**
 * Laxmi | AstralyxPvP Assistant — Gateway
 * Render Web Service
 */

import { Client, GatewayIntentBits } from 'discord.js';
import fetch from 'node-fetch';
import http from 'http';
import 'dotenv/config';

const DISCORD_TOKEN  = process.env.DISCORD_TOKEN;
const WORKER_URL     = process.env.WORKER_URL;
const GATEWAY_SECRET = process.env.GATEWAY_SECRET;
const RENDER_URL     = process.env.RENDER_URL;
const PORT           = process.env.PORT || 3001;

if (!DISCORD_TOKEN || !WORKER_URL || !GATEWAY_SECRET) {
  console.error('❌ Missing required env vars!');
  process.exit(1);
}

// Keep Render alive
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Laxmi is watching 👀');
});
server.listen(PORT, () => console.log(`🌐 HTTP alive on port ${PORT}`));

if (RENDER_URL) {
  setInterval(async () => {
    try {
      await fetch(RENDER_URL);
      console.log('📡 Self-ping sent');
    } catch (e) {
      console.warn('⚠️ Self-ping failed:', e.message);
    }
  }, 10 * 60 * 1000);
}

async function sendToWorker(payload) {
  try {
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GATEWAY_SECRET}`
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) console.error(`❌ Worker responded with ${res.status}`);
  } catch (e) {
    console.error('❌ Failed to reach Worker:', e.message);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', () => {
  console.log(`✅ Laxmi online — ${client.user.tag}`);
  console.log(`👀 Watching all messages + member joins`);
});

// Auto welcome on member join
client.on('guildMemberAdd', async (member) => {
  console.log(`👋 New member: ${member.user.username}`);
  await sendToWorker({
    type: 'member_join',
    userId: member.user.id,
    username: member.displayName || member.user.globalName || member.user.username
  });
});

// Message moderation
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content || message.content.trim().length === 0) return;

  await sendToWorker({
    content: message.content,
    channelId: message.channel.id,
    messageId: message.id,
    userId: message.author.id,
    username: message.member?.displayName || message.author.username,
    roleIds: message.member?.roles.cache.map(r => r.id) || []
  });
});

client.login(DISCORD_TOKEN);
