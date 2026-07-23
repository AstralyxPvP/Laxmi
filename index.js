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
// CONSTANTS & CONFIGURATION
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

// Staff roles exempt from punishments & link rules
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

const LINK_EXEMPT_ROLES = [...MOD_ROLES];
const WARN_EXEMPT_ROLES = [...MOD_ROLES];

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

// ============================================
// OBSCENITY & PATTERNS
// ============================================
const profanityMatcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

const HINGLISH_BANNED = [
  'madarchod', 'maderchod', 'maa ki', 'maaki', 'teri maa', 'behenchod', 'behen chod',
  'behnchod', 'bahenchod', 'chutiya', 'chutiye', 'choot', 'chutmarike', 'bhosdike',
  'bhosd', 'bhosdi', 'bhosdiwale', 'gandu', 'gaandu', 'harami', 'randi', 'bsdk',
  'lodu', 'lund', 'lauda', 'lavda', 'loda', 'lawde', 'lavde', 'chakka', 'hijra',
  'jhant', 'chinaal'
];

const AD_PATTERN = /discord\.gg\/[a-zA-Z0-9]+|dsc\.gg\/[a-zA-Z0-9]+|discordapp\.com\/invite\/[a-zA-Z0-9]+/i;

// In-memory trackers
const recentMessages = new Map();
const userSpamTracker = new Map(); // Tracks rapid consecutive messages per user

// ============================================
// RULE & PUNISHMENT LADDER MATRIX
// ============================================
const RULE_OPTIONS = [
  'swearing_at_players',
  'discord_advertising',
  'light_advertising',
  'asking_staff_items',
  'chat_trolling',
  'flooding_chat',
  'inappropriate_behavior',
  'discrimination',
  'referencing_tragic_events',
  'discord_server_links',
  'threatening_others',
  'advertising_social_media',
  'disease_disability_swearing',
  'general_rudeness',
  'doxxing',
  'ddos_threats',
  'harassment',
  'none'
];

const PUNISHMENT_MATRIX = {
  flooding_chat: [
    { type: 'mute', duration: 30 * 60 * 1000, label: '30 minute mute' },
    { type: 'mute', duration: 60 * 60 * 1000, label: '1 hour mute' },
    { type: 'mute', duration: 6 * 60 * 60 * 1000, label: '6 hour mute' },
  ],
  swearing_at_players: [
    { type: 'mute', duration: 30 * 60 * 1000, label: '30 minute mute' },
    { type: 'mute', duration: 3 * 60 * 60 * 1000, label: '3 hour mute' },
    { type: 'mute', duration: 24 * 60 * 60 * 1000, label: '1 day mute' },
  ],
  discord_advertising: [
    { type: 'mute', duration: 180 * 24 * 60 * 60 * 1000, label: '6 month mute' },
    { type: 'mute', duration: 365 * 24 * 60 * 60 * 1000, label: '12 month mute' },
    { type: 'ban', duration: null, label: 'Permanent ban' },
  ],
  light_advertising: [
    { type: 'mute', duration: 12 * 60 * 60 * 1000, label: '12 hour mute' },
    { type: 'mute', duration: 3 * 24 * 60 * 60 * 1000, label: '3 day mute' },
    { type: 'ban', duration: 7 * 24 * 60 * 60 * 1000, label: '7 day ban' },
  ],
  asking_staff_items: [
    { type: 'warn', label: 'Warning' },
    { type: 'mute', duration: 60 * 60 * 1000, label: '1 hour mute' },
    { type: 'mute', duration: 6 * 60 * 60 * 1000, label: '6 hour mute' },
  ],
  chat_trolling: [
    { type: 'mute', duration: 60 * 60 * 1000, label: '1 hour mute' },
    { type: 'mute', duration: 6 * 60 * 60 * 1000, label: '6 hour mute' },
    { type: 'mute', duration: 24 * 60 * 60 * 1000, label: '1 day mute' },
  ],
  inappropriate_behavior: [
    { type: 'mute', duration: 14 * 24 * 60 * 60 * 1000, label: '14 day mute' },
    { type: 'mute', duration: 31 * 24 * 60 * 60 * 1000, label: '31 day mute' },
    { type: 'ban', duration: null, label: 'Permanent ban' },
  ],
  discrimination: [
    { type: 'mute', duration: 7 * 24 * 60 * 60 * 1000, label: '7 day mute' },
    { type: 'mute', duration: 14 * 24 * 60 * 60 * 1000, label: '14 day mute' },
    { type: 'ban', duration: 31 * 24 * 60 * 60 * 1000, label: '31 day ban' },
  ],
  referencing_tragic_events: [
    { type: 'mute', duration: 24 * 60 * 60 * 1000, label: '1 day mute' },
    { type: 'mute', duration: 7 * 24 * 60 * 60 * 1000, label: '7 day mute' },
    { type: 'ban', duration: 14 * 24 * 60 * 60 * 1000, label: '14 day ban' },
  ],
  discord_server_links: [
    { type: 'ban_and_mute', banDuration: 7 * 24 * 60 * 60 * 1000, muteDuration: 3 * 24 * 60 * 60 * 1000, label: '7 day ban + 3 day mute' },
    { type: 'ban_and_mute', banDuration: 14 * 24 * 60 * 60 * 1000, muteDuration: 17 * 24 * 60 * 60 * 1000, label: '14 day ban + 17 day mute' },
    { type: 'ban', duration: null, label: 'Permanent ban' },
  ],
  threatening_others: [
    { type: 'mute', duration: 7 * 24 * 60 * 60 * 1000, label: '7 day mute' },
    { type: 'ban', duration: 14 * 24 * 60 * 60 * 1000, label: '14 day ban' },
    { type: 'ban', duration: null, label: 'Permanent ban' },
  ],
  advertising_social_media: [
    { type: 'mute', duration: 6 * 60 * 60 * 1000, label: '6 hour mute' },
    { type: 'mute', duration: 24 * 60 * 60 * 1000, label: '1 day mute' },
    { type: 'ban', duration: 7 * 24 * 60 * 60 * 1000, label: '7 day ban' },
  ],
  disease_disability_swearing: [
    { type: 'mute', duration: 3 * 24 * 60 * 60 * 1000, label: '3 day mute' },
    { type: 'mute', duration: 7 * 24 * 60 * 60 * 1000, label: '7 day mute' },
    { type: 'ban', duration: 14 * 24 * 60 * 60 * 1000, label: '14 day ban' },
  ],
  general_rudeness: [
    { type: 'warn', label: 'Warning' },
    { type: 'mute', duration: 30 * 60 * 1000, label: '30 minute mute' },
    { type: 'mute', duration: 6 * 60 * 60 * 1000, label: '6 hour mute' },
  ],
  doxxing: [
    { type: 'ban', duration: null, label: 'Permanent ban + reported to local authorities' },
    { type: 'ban', duration: null, label: 'Permanent ban + reported to local authorities' },
    { type: 'ban', duration: null, label: 'Permanent ban + reported to local authorities' },
  ],
  ddos_threats: [
    { type: 'ban', duration: null, label: 'Permanent IP ban' },
    { type: 'ban', duration: null, label: 'Permanent IP ban' },
    { type: 'ban', duration: null, label: 'Permanent IP ban' },
  ],
  harassment: [
    { type: 'warn', label: 'Warning' },
    { type: 'ban', duration: 7 * 24 * 60 * 60 * 1000, label: '7 day ban' },
    { type: 'ban', duration: 31 * 24 * 60 * 60 * 1000, label: '31 day ban' },
  ]
};

// ============================================
// HELPERS & DISCORD MODERATION ACTIONS
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

// Timeout/Mute via Discord REST API (Capped to max 28 days due to Discord API constraints)
async function timeoutUser(guildId, userId, durationMs, reason, env) {
  const maxTimeoutMs = 28 * 24 * 60 * 60 * 1000;
  const actualDuration = Math.min(durationMs, maxTimeoutMs);
  const until = new Date(Date.now() + actualDuration).toISOString();

  await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bot ${env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      communication_disabled_until: until,
      reason: reason
    })
  });
}

// Ban User via Discord REST API
async function banUser(guildId, userId, reason, env) {
  await fetch(`https://discord.com/api/v10/guilds/${guildId}/bans/${userId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bot ${env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      delete_message_seconds: 0,
      reason: reason
    })
  });
}

// Track infractions per user in Cloudflare KV & execute punishment
async function applyPunishment(guildId, channelId, userId, username, ruleKey, reason, env) {
  const kvKey = `offense:${userId}:${ruleKey}`;
  let count = 0;
  try {
    const existing = await env.LAXMI_KV.get(kvKey);
    if (existing) count = parseInt(existing, 10);
  } catch (e) {}

  count += 1;
  await env.LAXMI_KV.put(kvKey, count.toString());

  const ladder = PUNISHMENT_MATRIX[ruleKey];
  if (!ladder) {
    await warnUser(channelId, userId, reason, env);
    return { actionLabel: 'Warning', offenseCount: count };
  }

  // Use maximum punishment tier if infractions exceed ladder length
  const punishmentIndex = Math.min(count - 1, ladder.length - 1);
  const punishment = ladder[punishmentIndex];

  let actionLabel = punishment.label;

  if (punishment.type === 'warn') {
    await warnUser(channelId, userId, `${reason} (Offense #${count})`, env);
  } else if (punishment.type === 'mute') {
    await timeoutUser(guildId, userId, punishment.duration, `${reason} (Offense #${count})`, env);
    await warnUser(channelId, userId, `Muted: ${punishment.label} for ${reason} (Offense #${count})`, env);
  } else if (punishment.type === 'ban') {
    await banUser(guildId, userId, `${reason} (Offense #${count})`, env);
    await warnUser(channelId, userId, `Banned: ${punishment.label} for ${reason} (Offense #${count})`, env);
  } else if (punishment.type === 'ban_and_mute') {
    await timeoutUser(guildId, userId, punishment.muteDuration, `${reason} (Offense #${count})`, env);
    await banUser(guildId, userId, `${reason} (Offense #${count})`, env);
    await warnUser(channelId, userId, `Banned & Muted: ${punishment.label} for ${reason} (Offense #${count})`, env);
  }

  return { actionLabel, offenseCount: count };
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
          { name: 'Rule Violated', value: logEntry.rule || 'N/A', inline: true },
          { name: 'Reason', value: logEntry.reason, inline: false },
          { name: 'Layer', value: logEntry.layer, inline: true },
          { name: 'Confidence', value: logEntry.confidence, inline: true },
          { name: 'Message', value: '```' + (logEntry.message || '').substring(0, 500) + '```', inline: false }
        ],
        timestamp: new Date().toISOString()
      }]
    })
  });
}

// ============================================
// DETECTION LAYERS
// ============================================

// Layer 1: Obscenity + Hinglish + Discord Ad Links
function layer1Check(text) {
  if (profanityMatcher.hasMatch(text)) {
    return { flagged: true, rule: 'swearing_at_players', reason: 'Profanity detected', confidence: 'high' };
  }

  const cleanText = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  for (const word of HINGLISH_BANNED) {
    if (cleanText.includes(word)) {
      return { flagged: true, rule: 'swearing_at_players', reason: `Banned word detected: "${word}"`, confidence: 'high' };
    }
  }

  if (AD_PATTERN.test(text)) {
    return { flagged: true, rule: 'discord_advertising', reason: 'Discord server advertising link detected', confidence: 'high' };
  }

  return { flagged: false };
}

// Check for duplicate message raids
function raidCheck(channelId, content, userId) {
  const now = Date.now();
  const window = 10000;
  const threshold = 4;
  if (!recentMessages.has(channelId)) recentMessages.set(channelId, []);
  const msgs = recentMessages.get(channelId).filter(m => now - m.timestamp < window && m.content === content);
  msgs.push({ content, userId, timestamp: now });
  recentMessages.set(channelId, msgs);
  if (msgs.length >= threshold && new Set(msgs.map(m => m.userId)).size >= 3) {
    return { flagged: true, rule: 'flooding_chat', reason: 'Possible raid — identical messages from multiple users', confidence: 'high' };
  }
  return { flagged: false };
}

// Anti-Spam: Check if non-staff sends 4 rapid messages in a row
function checkRapidSpam(userId) {
  const now = Date.now();
  const windowMs = 7000; // 7 second window
  if (!userSpamTracker.has(userId)) {
    userSpamTracker.set(userId, []);
  }

  const timestamps = userSpamTracker.get(userId).filter(t => now - t < windowMs);
  timestamps.push(now);
  userSpamTracker.set(userId, timestamps);

  if (timestamps.length >= 4) {
    userSpamTracker.set(userId, []); // reset after triggering
    return true;
  }
  return false;
}

// Layer 2: Gemini / Gemma AI Rule Classification
async function layer2AICheck(text, env) {
  const systemPrompt = `You are the moderation AI for AstralyxPvP, an Indian Minecraft Java PvP Discord server.
Categorize incoming user messages strictly into one of the following rule violation keys:

OPTIONS:
- swearing_at_players (Swearing/insulting other players)
- discord_advertising (Posting invite links to other Discord servers)
- light_advertising (Mentioning/telling other Minecraft server names)
- asking_staff_items (Begging or asking staff for free items/ranks)
- chat_trolling (Trolling users, e.g. "press alt + f4 for free rank")
- flooding_chat (Spamming or sending repeated flooding messages)
- inappropriate_behavior (NSFW, sexually explicit, or inappropriate conduct)
- discrimination (Racism, homophobia, bigotry, or discrimination)
- referencing_tragic_events (Referencing tragedies, disasters, or mass violence)
- discord_server_links (Posting non-Astralyx Discord links)
- threatening_others (Threats of real-life harm or physical violence)
- advertising_social_media (Advertising personal YouTube, Twitch, TikTok, etc.)
- disease_disability_swearing (Using diseases or disabilities as insults)
- general_rudeness (General toxicity, rude behavior, or disrespect)
- doxxing (Sharing private personal real-life information of users)
- ddos_threats (Threatening IP attacks, booter services, or DDoS)
- harassment (Harassment or sexual harassment)
- none (Message is clean and adheres to rules)

Do NOT flag: mild frustration, casual gaming banter, or "mc"/"bc" when clearly meaning Minecraft/because in context.
Return ONLY valid JSON matching the requested schema.`;

  const userContent = `Evaluate message: "${text}"`;

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
                rule_violation: { type: 'STRING', enum: RULE_OPTIONS },
                reason: { type: 'STRING', nullable: true },
                confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] }
              },
              required: ['flagged', 'rule_violation', 'reason', 'confidence']
            }
          }
        })
      });

      if (!res.ok) continue;

      const data = await res.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!raw) continue;

      let cleaned = raw.replace(/```json|```/g, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) cleaned = jsonMatch[0];

      return JSON.parse(cleaned);
    } catch (e) {
      continue;
    }
  }

  return { flagged: false, rule_violation: 'none' };
}

// ============================================
// WELCOME & ROLE BUTTON HANDLERS
// ============================================
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
  } catch (e) {}
}

async function handleMemberJoin(userId, username, env) {
  const welcomeEmbed = {
    title: '🙏 Welcome to AstralyxPvP!',
    description: `Namaste <@${userId}>! Welcome to **AstralyxPvP** — India's premier Minecraft Java PvP server!\n\n⚔️ **Server IP:** \`java.astralyxpvp.int.yt\`\n🌐 **Website:** [astralyxpvp.pages.dev](https://astralyxpvp.pages.dev)\n\nHead over to <#1477033060078850264> to get started, check <#1477033071076442165> for the rules, and pick up your notification roles in your DMs!\n\nSee you on the battlefield! 🔥`,
    color: 0xC8102E,
    thumbnail: { url: 'https://astralyxpvp.pages.dev/Assets/logo.png' },
    footer: { text: `Welcome, ${username}! • AstralyxPvP` },
    timestamp: new Date().toISOString()
  };

  await sendDiscordMessage(LAXMI_WELCOMER_CHANNEL_ID, { content: `<@${userId}>`, embeds: [welcomeEmbed] }, env);
  await sendDM(userId, { embeds: [welcomeEmbed] }, env);
}

async function handleWelcomeReactionOptions(env) {
  await sendDiscordMessage(WELCOME_CHANNEL_ID, {
    embeds: [{
      title: '🔔 Get Notified — Pick Your Roles!',
      description: 'Click the buttons below to assign yourself notification roles. Click again to remove.',
      color: 0xC8102E,
      fields: NOTIFICATION_ROLES.map(r => ({ name: r.label, value: `<@&${r.roleId}>`, inline: true })),
      footer: { text: 'AstralyxPvP • Role Selector' }
    }],
    components: [{
      type: 1,
      components: NOTIFICATION_ROLES.map(r => ({ type: 2, style: 2, label: r.label, custom_id: `role_toggle_${r.roleId}` }))
    }]
  }, env);
}

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
    data: { content: hasRole ? `✅ Removed **${role?.label}** role!` : `✅ Added **${role?.label}** role!`, flags: 64 }
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
    if (!channels.includes(channelId)) channels.push(channelId);
    await setIgnoredChannels(channels, env);
    return jsonResponse({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: `✅ Added <#${channelId}> to ignored channels.`, flags: 64 }
    });
  }

  if (commandName === 'ignore-remove') {
    const channelId = interaction.data.options?.[0]?.value;
    let channels = await getIgnoredChannels(env);
    channels = channels.filter(c => c !== channelId);
    await setIgnoredChannels(channels, env);
    return jsonResponse({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: `✅ Removed <#${channelId}> from ignored channels.`, flags: 64 }
    });
  }

  return jsonResponse({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content: '❓ Unknown command.', flags: 64 }
  });
}

// ============================================
// AUTOMOD MESSAGE PROCESSOR
// ============================================
async function handleMessage(payload, env) {
  const { content, channelId, messageId, userId, username, roleIds = [], guildId = MAIN_GUILD_ID } = payload;
  if (!content || content.trim().length === 0) return;

  const ignoredChannels = await getIgnoredChannels(env);
  if (ignoredChannels.includes(channelId)) return;

  const isStaff = roleIds.some(r => MOD_ROLES.includes(r));
  const isLinkExempt = roleIds.some(r => LINK_EXEMPT_ROLES.includes(r));

  // 1. Anti-Spam Check (4 consecutive messages)
  if (!isStaff && checkRapidSpam(userId)) {
    await deleteMessage(channelId, messageId, env);
    const { actionLabel } = await applyPunishment(guildId, channelId, userId, username, 'flooding_chat', 'Flooding chat (4 consecutive messages)', env);
    await sendLog(env, { userId, username, channelId, action: actionLabel, rule: 'flooding_chat', reason: 'Flooding chat (4 consecutive messages)', layer: 'Anti-Spam Filter', confidence: 'high', message: content });
    return;
  }

  // 2. Layer 1 Check (Regex / Obscenity / Ads)
  const l1 = layer1Check(content);
  if (l1.flagged) {
    if (isLinkExempt && l1.rule === 'discord_advertising') return;
    await deleteMessage(channelId, messageId, env);
    
    if (isStaff) {
      await sendLog(env, { userId, username, channelId, action: 'Deleted (Staff Exempt from Punishment)', rule: l1.rule, reason: l1.reason, layer: 'Layer 1', confidence: l1.confidence, message: content });
      return;
    }

    const { actionLabel } = await applyPunishment(guildId, channelId, userId, username, l1.rule, l1.reason, env);
    await sendLog(env, { userId, username, channelId, action: actionLabel, rule: l1.rule, reason: l1.reason, layer: 'Layer 1', confidence: l1.confidence, message: content });
    return;
  }

  // 3. Raid Check
  const raid = raidCheck(channelId, content, userId);
  if (raid.flagged) {
    await deleteMessage(channelId, messageId, env);
    if (!isStaff) {
      const { actionLabel } = await applyPunishment(guildId, channelId, userId, username, raid.rule, raid.reason, env);
      await sendLog(env, { userId, username, channelId, action: actionLabel, rule: raid.rule, reason: raid.reason, layer: 'Raid Detection', confidence: raid.confidence, message: content });
    }
    return;
  }

  // 4. Layer 2 Check (Gemini / Gemma AI Rule Engine)
  const l2 = await layer2AICheck(content, env);
  if (l2.flagged && l2.rule_violation !== 'none' && (l2.confidence === 'high' || l2.confidence === 'medium')) {
    if (isLinkExempt && (l2.rule_violation === 'discord_advertising' || l2.rule_violation === 'discord_server_links')) return;

    await deleteMessage(channelId, messageId, env);

    if (isStaff) {
      await sendLog(env, { userId, username, channelId, action: 'Deleted (Staff Exempt from Punishment)', rule: l2.rule_violation, reason: l2.reason, layer: 'Layer 2 (AI)', confidence: l2.confidence, message: content });
      return;
    }

    const { actionLabel } = await applyPunishment(guildId, channelId, userId, username, l2.rule_violation, l2.reason, env);
    await sendLog(env, { userId, username, channelId, action: actionLabel, rule: l2.rule_violation, reason: l2.reason, layer: 'Layer 2 (AI)', confidence: l2.confidence, message: content });
  }
}

// ============================================
// WORKER ENTRY
// ============================================
export default {
  async fetch(request, env, ctx) {
    if (request.method === 'GET') {
      return new Response('Laxmi | AstralyxPvP Assistant is online 🙏', { headers: { 'Content-Type': 'text/plain' } });
    }

    const authHeader = request.headers.get('authorization');

    // Discord Interactions
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

    // Gateway Forwarding
    if (!authHeader || authHeader !== `Bearer ${env.GATEWAY_SECRET}`) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const payload = await request.json();

    if (payload.type === 'member_join') {
      ctx.waitUntil(handleMemberJoin(payload.userId, payload.username, env));
      return jsonResponse({ ok: true });
    }

    ctx.waitUntil(handleMessage(payload, env));
    return jsonResponse({ ok: true });
  }
};