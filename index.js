/**
 * Laxmi | AstralyxPvP Assistant
 * Smart Automod + Welcome Bot — Cloudflare Worker
 * Built by IndianCoder3
 */

import { verifyKey, InteractionType, InteractionResponseType } from 'discord-interactions';
import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
} from 'obscenity';

// ============================================
// CONSTANTS & OBSCENITY INITIALIZATION
// ============================================
const WELCOME_CHANNEL_ID = '1477033060078850264';
const LAXMI_WELCOMER_CHANNEL_ID = '1529028842188967977';
const MAIN_GUILD_ID = '1477024790555672718';

const NOTIFICATION_ROLES = [
  { label: '📣 Announcements', roleId: '1483166577259188406' },
  { label: '🎉 Giveaways', roleId: '1483166679499407582' },
  { label: '🏆 Tournaments', roleId: '1500206420627427539' },
  { label: '📊 Polls', roleId: '1500206496535937195' },
];

// Staff roles allowed to use mod commands
const MOD_ROLES = [
  '1477025238784151554', // Owner
  '1477291491003994214', // Co-Owner
  '1502815102716608552', // Chief Manager
  '1497335106074050620', // Sr. Manager
  '1483209618485284964', // Manager
  '1497316294632931358', // Developer
  '1497316250945323070', // Admin
  '1497316120452136960', // Sr. Mod
  '1477025502119334109', // Mod
];

// Staff roles exempt from link moderation
const LINK_EXEMPT_ROLES = [...MOD_ROLES];

// Staff roles — delete only, no warn
const WARN_EXEMPT_ROLES = [...MOD_ROLES];

// Default ignored channels (can be modified via commands, stored in KV)
const DEFAULT_IGNORED_CHANNELS = [
  '1477033205017346259', // announcements
  '1477033060078850264', // welcome
  '1477033071076442165', // rules
  '1499020216821088296', // information
  '1477035122636095561', // events
  '1477035141221060791', // giveaways
  '1477035158770155743', // tournaments
  '1477272501699481642', // qotd
  '1529028842188967977', // laxmi-welcomer
];

// Initialize Obscenity Matcher once at worker startup
const profanityMatcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

// Hindi / Hinglish moderation pre-check (since English Obscenity target is English)
const HINGLISH_BANNED = [
  'madarchod', 'maderchod', 'maa ki', 'maaki', 'teri maa', 'behenchod', 'behen chod',
  'behnchod', 'bahenchod', 'chutiya', 'chutiye', 'choot', 'chutmarike', 'bhosdike',
  'bhosd', 'bhosdi', 'bhosdiwale', 'gandu', 'gaandu', 'harami', 'randi', 'bsdk',
  'lodu', 'lund', 'lauda', 'lavda', 'loda', 'lawde', 'lavde', 'chakka', 'hijra',
  'jhant', 'chinaal'
];

const AD_PATTERN = /discord\.gg\/[a-zA-Z0-9]+|dsc\.gg\/[a-zA-Z0-9]+|discordapp\.com\/invite\/[a-zA-Z0-9]+/i;
const recentMessages = new Map();

// ============================================
// HELPERS
// ============================================
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function getIgnoredChannels(env) {
  try {
    const stored = await env.LAXMI_KV.get('ignored_channels');
    if (stored) return JSON.parse(stored);
  } catch (e) {}
  return [...DEFAULT_IGNORED_CHANNELS];
}

async function setIgnoredChannels(channels, env) {
  await env.LAXMI_KV.put('ignored_channels', JSON.stringify(channels));
}

// Layer 1 check using Obscenity + Hinglish array + Ad pattern
function layer1Check(text) {
  // 1. English Profanity check via Obscenity
  const matches = profanityMatcher.match(text);
  if (matches.length > 0) {
    return { flagged: true, reason: 'Profanity detected', confidence: 'high' };
  }

  // 2. Hinglish pre-check
  const cleanText = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  for (const word of HINGLISH_BANNED) {
    if (cleanText.includes(word)) {
      return { flagged: true, reason: `Banned word: "${word}"`, confidence: 'high' };
    }
  }

  // 3. Discord link advertising check
  if (AD_PATTERN.test(text)) {
    return { flagged: true, reason: 'Discord server advertising', confidence: 'high' };
  }

  return { flagged: false };
}

function raidCheck(channelId, content, userId) {
  const now = Date.now();
  const window = 10000;
  const threshold = 4;
  if (!recentMessages.has(channelId)) recentMessages.set(channelId, []);
  const msgs = recentMessages.get(channelId).filter(m => now - m.timestamp < window && m.content === content);
  msgs.push({ content, userId, timestamp: now });
  recentMessages.set(channelId, msgs);
  if (msgs.length >= threshold && new Set(msgs.map(m => m.userId)).size >= 3) {
    return { flagged: true, reason: 'Possible raid — identical messages from multiple users', confidence: 'high' };
  }
  return { flagged: false };
}

async function layer2AICheck(text, env) {
  const systemPrompt = `You are the moderation AI for AstralyxPvP, an Indian Minecraft Java PvP Discord server. You are the PRIMARY filter — a lightweight pre-check runs before you and only catches exact plain-text matches, so assume obfuscated or borderline messages will reach you and it's your job to catch them.

Use your own knowledge of what counts as profanity, slurs, hate speech, harassment, sexual/NSFW content, or abusive language in English and Hindi/Hinglish (common in Indian gaming communities) to judge each message. Also flag Discord server advertising (invite links, "join my server") and staff impersonation (claiming to be admin/mod/staff falsely).

Users often try to dodge filters by disguising words — treat a disguised word the same as the plain word it represents: substituted numbers/symbols for letters, spaced-out letters, punctuation between letters, or stretched repeated letters all count as the original word.

Do NOT flag: mild frustration, casual banter, "mc"/"bc" when clearly meaning Minecraft/because from context, or mild words used lightly between friends. Use judgment — context matters more than exact word matching.

This is a content-moderation classification task. You must respond ONLY with a raw JSON object matching the requested schema. Do not output reasoning, commentary, thinking steps, or bullet points.
When answering, you must give your model like Gemini or Gemma next to the reason like
profanity Gemma / Gemini
`;

  const userContent = `Message to evaluate: "${text}"`;

  const safetySettings = [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
  ];

  const modelChain = [
    env.GEMMA_MODEL || 'gemma-4-26b-a4b-it',
    env.GEMINI_MODEL || 'gemini-3.1-flash-lite-preview',
  ];

  for (const model of modelChain) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GOOGLE_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: userContent }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          safetySettings,
          generationConfig: {
            temperature: 0.0,
            maxOutputTokens: 150,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                flagged: { type: 'BOOLEAN' },
                reason: { type: 'STRING', nullable: true },
                confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] }
              },
              required: ['flagged', 'reason', 'confidence']
            }
          }
        })
      });

      if (res.status === 429) {
        console.error(`[Laxmi Layer2] ${model} rate-limited (429), trying next model`);
        continue;
      }

      if (!res.ok) {
        const errBody = await res.text();
        console.error(`[Laxmi Layer2] ${model} returned ${res.status}: ${errBody}`);
        continue;
      }

      const data = await res.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!raw) {
        console.error(`[Laxmi Layer2] ${model} returned no text. Full response: ${JSON.stringify(data)}`);
        continue;
      }

      try {
        let cleaned = raw.replace(/```json|```/g, '').trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          cleaned = jsonMatch[0];
        }

        return JSON.parse(cleaned);
      } catch (parseErr) {
        console.error(`[Laxmi Layer2] ${model} returned unparseable JSON: "${raw}"`);
        continue;
      }
    } catch (e) {
      console.error(`[Laxmi Layer2] ${model} threw an error: ${e.message}`);
      continue;
    }
  }

  console.error(`[Laxmi Layer2] All models failed or unavailable. Message NOT AI-checked: "${text.substring(0, 100)}"`);
  return { flagged: false };
}

async function deleteMessage(channelId, messageId, env) {
  await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}` }
  });
}

async function warnUser(channelId, userId, reason, env) {
  await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: `?warn <@${userId}> ${reason}` })
  });
}

async function sendLog(env, logEntry) {
  if (!env.LOG_CHANNEL_ID) return;
  await fetch(`https://discord.com/api/v10/channels/${env.LOG_CHANNEL_ID}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [{
        title: '🔨 Laxmi Automod Action',
        color: 0xC8102E,
        fields: [
          { name: 'User', value: `<@${logEntry.userId}> (${logEntry.username})`, inline: true },
          { name: 'Channel', value: `<#${logEntry.channelId}>`, inline: true },
          { name: 'Action', value: logEntry.action, inline: true },
          { name: 'Reason', value: logEntry.reason, inline: false },
          { name: 'Layer', value: logEntry.layer, inline: true },
          { name: 'Confidence', value: logEntry.confidence, inline: true },
          { name: 'Message', value: '```' + logEntry.message.substring(0, 500) + '```', inline: false }
        ],
        timestamp: new Date().toISOString()
      }]
    })
  });
}

async function sendDiscordMessage(channelId, payload, env) {
  return fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

async function getDMChannelId(userId, env) {
  const res = await fetch('https://discord.com/api/v10/users/@me/channels', {
    method: 'POST',
    headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient_id: userId })
  });
  const data = await res.json();
  return data.id;
}

async function sendDM(userId, payload, env) {
  try {
    const dmChannelId = await getDMChannelId(userId, env);
    if (!dmChannelId) return;
    await sendDiscordMessage(dmChannelId, payload, env);
  } catch (e) {
    // User likely has server DMs disabled
  }
}

// ============================================
// WELCOME MESSAGE
// ============================================
async function handleMemberJoin(userId, username, env) {
  const welcomeEmbed = {
    title: '🙏 Welcome to AstralyxPvP!',
    description: `Namaste <@${userId}>! Welcome to **AstralyxPvP** — India's premier Minecraft Java PvP server!\n\n⚔️ **Server IP:** \`java.astralyxpvp.int.yt\`\n🌐 **Website:** [astralyxpvp.pages.dev](https://astralyxpvp.pages.dev)\n\nHead over to <#1477033060078850264> to get started, check <#1477033071076442165> for the rules, and pick up your notification roles in your DMs!\n\nSee you on the battlefield! 🔥`,
    color: 0xC8102E,
    thumbnail: { url: 'https://astralyxpvp.pages.dev/Assets/logo.png' },
    footer: { text: `Welcome, ${username}! • AstralyxPvP` },
    timestamp: new Date().toISOString()
  };

  await sendDiscordMessage(LAXMI_WELCOMER_CHANNEL_ID, {
    content: `<@${userId}>`,
    embeds: [welcomeEmbed]
  }, env);

  await sendDM(userId, { embeds: [welcomeEmbed] }, env);

  await sendDM(userId, {
    embeds: [{
      title: '🔔 Get Notified — Pick Your Roles!',
      description: 'Stay updated with what matters to you! Click the buttons below to assign yourself notification roles.\n\nYou can click again to remove a role anytime.',
      color: 0xC8102E,
      fields: NOTIFICATION_ROLES.map(r => ({
        name: r.label,
        value: `<@&${r.roleId}>`,
        inline: true
      })),
      footer: { text: 'AstralyxPvP • Role Selector' }
    }],
    components: [{
      type: 1,
      components: NOTIFICATION_ROLES.map(r => ({
        type: 2,
        style: 2,
        label: r.label,
        custom_id: `role_toggle_${r.roleId}`
      }))
    }]
  }, env);
}

// ============================================
// ROLE SELECTOR MESSAGE
// ============================================
async function handleWelcomeReactionOptions(env) {
  await sendDiscordMessage(WELCOME_CHANNEL_ID, {
    embeds: [{
      title: '🔔 Get Notified — Pick Your Roles!',
      description: 'Stay updated with what matters to you! Click the buttons below to assign yourself notification roles.\n\nYou can click again to remove a role anytime.',
      color: 0xC8102E,
      fields: NOTIFICATION_ROLES.map(r => ({
        name: r.label,
        value: `<@&${r.roleId}>`,
        inline: true
      })),
      footer: { text: 'AstralyxPvP • Role Selector' }
    }],
    components: [{
      type: 1,
      components: NOTIFICATION_ROLES.map(r => ({
        type: 2,
        style: 2,
        label: r.label,
        custom_id: `role_toggle_${r.roleId}`
      }))
    }]
  }, env);
}

// ============================================
// HANDLE ROLE BUTTON CLICK
// ============================================
async function handleRoleToggle(interaction, roleId, env) {
  const userId = interaction.member?.user?.id || interaction.user?.id;
  const guildId = interaction.guild_id || MAIN_GUILD_ID;
  const memberRoles = interaction.member?.roles || [];
  let hasRole = memberRoles.includes(roleId);

  if (!interaction.guild_id) {
    try {
      const memberRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
        headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}` }
      });
      const memberData = await memberRes.json();
      hasRole = (memberData.roles || []).includes(roleId);
    } catch (e) {}
  }

  const method = hasRole ? 'DELETE' : 'PUT';
  await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
    method,
    headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}` }
  });

  const role = NOTIFICATION_ROLES.find(r => r.roleId === roleId);
  return jsonResponse({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: hasRole
        ? `✅ Removed **${role?.label}** role!`
        : `✅ Added **${role?.label}** role! You'll now get notified.`,
      flags: 64
    }
  });
}

// ============================================
// SLASH COMMAND HANDLER
// ============================================
async function handleSlashCommand(interaction, env) {
  const commandName = interaction.data.name;
  const memberRoles = interaction.member?.roles || [];
  const isStaff = memberRoles.some(r => MOD_ROLES.includes(r));

  if (!isStaff) {
    return jsonResponse({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: '❌ You do not have permission to use this command.', flags: 64 }
    });
  }

  if (commandName === 'welcome-role-options') {
    await handleWelcomeReactionOptions(env);
    return jsonResponse({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: '✅ Role selector posted in welcome channel!', flags: 64 }
    });
  }

  if (commandName === 'ignore-add') {
    const channelId = interaction.data.options?.[0]?.value;
    const channels = await getIgnoredChannels(env);
    if (channels.includes(channelId)) {
      return jsonResponse({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: `⚠️ <#${channelId}> is already ignored.`, flags: 64 }
      });
    }
    channels.push(channelId);
    await setIgnoredChannels(channels, env);
    return jsonResponse({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: `✅ Added <#${channelId}> to ignored channels. Laxmi will no longer moderate there.`, flags: 64 }
    });
  }

  if (commandName === 'ignore-remove') {
    const channelId = interaction.data.options?.[0]?.value;
    let channels = await getIgnoredChannels(env);
    if (!channels.includes(channelId)) {
      return jsonResponse({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: `⚠️ <#${channelId}> is not in the ignore list.`, flags: 64 }
      });
    }
    channels = channels.filter(c => c !== channelId);
    await setIgnoredChannels(channels, env);
    return jsonResponse({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: `✅ Removed <#${channelId}> from ignored channels. Laxmi will now moderate there.`, flags: 64 }
    });
  }

  return jsonResponse({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content: '❓ Unknown command.', flags: 64 }
  });
}

// ============================================
// AUTOMOD HANDLER
// ============================================
async function handleMessage(payload, env) {
  const { content, channelId, messageId, userId, username, roleIds = [] } = payload;
  if (!content || content.trim().length === 0) return;

  const ignoredChannels = await getIgnoredChannels(env);
  if (ignoredChannels.includes(channelId)) return;

  const isLinkExempt = roleIds.some(r => LINK_EXEMPT_ROLES.includes(r));
  const isWarnExempt = roleIds.some(r => WARN_EXEMPT_ROLES.includes(r));

  const l1 = layer1Check(content);
  if (l1.flagged) {
    if (isLinkExempt && l1.reason.toLowerCase().includes('advertising')) return;
    await deleteMessage(channelId, messageId, env);
    const action = isWarnExempt ? 'Delete' : 'Delete + Warn';
    if (!isWarnExempt) await warnUser(channelId, userId, l1.reason, env);
    await sendLog(env, { userId, username, channelId, action, reason: l1.reason, layer: 'Layer 1 (Obscenity)', confidence: l1.confidence, message: content });
    return;
  }

  const raid = raidCheck(channelId, content, userId);
  if (raid.flagged) {
    await deleteMessage(channelId, messageId, env);
    await sendLog(env, { userId, username, channelId, action: 'Delete', reason: raid.reason, layer: 'Raid Detection', confidence: raid.confidence, message: content });
    return;
  }

  const l2 = await layer2AICheck(content, env);
  if (l2.flagged && (l2.confidence === 'high' || l2.confidence === 'medium')) {
    if (isLinkExempt && l2.reason?.toLowerCase().includes('advert')) return;
    await deleteMessage(channelId, messageId, env);
    const shouldWarn = !isWarnExempt && l2.confidence === 'high';
    if (shouldWarn) await warnUser(channelId, userId, l2.reason, env);
    await sendLog(env, { userId, username, channelId, action: shouldWarn ? 'Delete + Warn' : 'Delete', reason: l2.reason, layer: 'Layer 2 (AI)', confidence: l2.confidence, message: content });
  }
}

// ============================================
// CLOUDFLARE WORKER ENTRY
// ============================================
export default {
  async fetch(request, env, ctx) {
    if (request.method === 'GET') {
      return new Response('Laxmi | AstralyxPvP Assistant is online 🙏', {
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    const authHeader = request.headers.get('authorization');

    // Discord interaction (slash commands / buttons)
    if (request.headers.get('x-signature-ed25519')) {
      const signature = request.headers.get('x-signature-ed25519');
      const timestamp = request.headers.get('x-signature-timestamp');
      const body = await request.text();

      const isValid = await verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY);
      if (!isValid) return new Response('Unauthorized', { status: 401 });

      const interaction = JSON.parse(body);

      if (interaction.type === InteractionType.PING) {
        return jsonResponse({ type: InteractionResponseType.PONG });
      }

      if (interaction.type === InteractionType.APPLICATION_COMMAND) {
        return await handleSlashCommand(interaction, env);
      }

      if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
        const customId = interaction.data.custom_id;
        if (customId.startsWith('role_toggle_')) {
          const roleId = customId.replace('role_toggle_', '');
          return await handleRoleToggle(interaction, roleId, env);
        }
      }

      return jsonResponse({ type: InteractionResponseType.PONG });
    }

    // Gateway message forwarding
    if (!authHeader || authHeader !== `Bearer ${env.GATEWAY_SECRET}`) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const payload = await request.json();

    // Member join event
    if (payload.type === 'member_join') {
      ctx.waitUntil(handleMemberJoin(payload.userId, payload.username, env));
      return jsonResponse({ ok: true });
    }

    // Regular message moderation
    ctx.waitUntil(handleMessage(payload, env));
    return jsonResponse({ ok: true });
  }
};