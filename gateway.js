/**
 * DesiBot | AstralyxPvP Assistant — Gateway
 * Standalone legacy gateway. The AstralyxBridge plugin replaces this service.
 */

import { Client, GatewayIntentBits } from 'discord.js';
import fetch from 'node-fetch';
import 'dotenv/config';

const DISCORD_TOKEN  = process.env.DISCORD_TOKEN;
const WORKER_URL     = process.env.WORKER_URL;
const GATEWAY_SECRET = process.env.GATEWAY_SECRET;

if (!DISCORD_TOKEN || !WORKER_URL || !GATEWAY_SECRET) {
  console.error('❌ Missing required env vars!');
  process.exit(1);
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
  console.log(`✅ DesiBot online — ${client.user.tag}`);
  console.log(`👀 Watching all messages + member joins`);
});

// Auto welcome on member join
client.on('guildMemberAdd', async (member) => {
  console.log(`👋 New member: ${member.user.username}`);
  await sendToWorker({
    type: 'member_join',
    userId: member.user.id,
    username: member.displayName || member.user.globalName || member.user.username,
    guildId: member.guild.id
  });
});

// New channel created (used to detect TicketTool ticket-XXXX channels)
client.on('channelCreate', async (channel) => {
  try {
    // Only real text channels in a category — skip threads, forum posts, voice, etc.
    if (channel.type !== 0 || !channel.parentId) return;
    await sendToWorker({
      type: 'channel_create',
      channelId: channel.id,
      name: channel.name,
      parentId: channel.parentId,
      topic: channel.topic || '',
      guildId: channel.guildId || channel.guild?.id
    });
  } catch (e) {
    console.error('❌ channelCreate forward failed:', e.message);
  }
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
    roleIds: message.member?.roles.cache.map(r => r.id) || [],
    guildId: message.guildId,
    parentId: message.channel.parentId
  });
});

client.login(DISCORD_TOKEN);
