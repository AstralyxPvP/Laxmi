/**
 * DesiBot | AstralyxPvP Assistant
 * Smart Automod + Welcome Bot + Custom Native Moderation Engine
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
const DESIBOT_WELCOMER_CHANNEL_ID = '1529028842188967977';
const MAIN_GUILD_ID = '1477025023800901766';
const MUTED_ROLE_ID = '1529919178071343214';

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

const SR_DEV_ROLE_ID = '1529483674817532066';
const JR_DEV_ROLE_ID = '1530947152900259930';

// Full active-staff roster — never banned by automod
const BAN_EXEMPT_ROLES = [
  '1477025238784151554', // Owner
  '1477291491003994214', // Co-Owner
  '1502815102716608552', // Chief Manager
  '1497335106074050620', // Sr. Manager
  '1483209618485284964', // Manager
  '1498734182615089314', // Head of General Affairs
  '1498734243352678630', // Head of Internal Affairs
  SR_DEV_ROLE_ID,         // Sr. Developer
  '1497316294632931358', // Developer
  JR_DEV_ROLE_ID,         // Jr. Developer
  '1497316250945323070', // Admin
  '1497316120452136960', // Sr. Mod
  '1477025502119334109', // Mod
  '1497316057214484735', // Jr. Mod
  '1477025528174219476', // Helper
  '1501217374102229185', // Trial Staff
];

// Sr. Developer and above — exempt from mutes too (warns only)
const MUTE_EXEMPT_ROLES = [
  '1477025238784151554', // Owner
  '1477291491003994214', // Co-Owner
  '1502815102716608552', // Chief Manager
  '1497335106074050620', // Sr. Manager
  '1483209618485284964', // Manager
  SR_DEV_ROLE_ID,         // Sr. Developer
];

const LINK_EXEMPT_ROLES = [...MOD_ROLES];

const DEFAULT_IGNORED_CHANNELS = [
  '1477033205017346259', // announcements
  '1477033060078850264', // welcome
  '1477033071076442165', // rules
  '1499020216821088296', // information
  '1477035122636095561', // events
  '1477035141221060791', // giveaways
  '1477035158770155743', // tournaments
  '1477272501699481642', // qotd
  '1529028842188967977', // desibot-welcomer
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

// AstralyxPvP's own invite links — allowed under rule 17 (only OTHER server links are punishable)
const ASTRALYX_INVITE_CODES = ['u8bfrprweg'];

// In-memory trackers
const recentMessages = new Map();
const userSpamTracker = new Map();

// Slur-split memory config — messages are split across multiple sends to evade filters.
// We keep a short per-channel history in KV, join consecutive messages from the same user,
// and re-run the filters on the combined text.
const MSG_MEMORY_MAX = 15;
const MSG_MEMORY_WINDOW_MS = 60000;

// ============================================
// RULE & PUNISHMENT LADDER MATRIX
// ============================================
const RULE_OPTIONS = [
  'hacked_clients', 'swearing_at_players', 'discord_advertising', 'light_advertising',
  'asking_staff_items', 'chat_trolling', 'flooding_chat',
  'inappropriate_behavior', 'discrimination', 'referencing_tragic_events',
  'mute_evading', 'ban_evading', 'teaming_assisting', 'interrupting_1v1',
  'inappropriate_username', 'inappropriate_skins',
  'discord_server_links', 'bug_exploiting', 'threatening_others', 'advertising_social_media',
  'disease_disability_swearing', 'general_rudeness', 'doxxing',
  'ddos_threats', 'harassment', 'none'
];

const PUNISHMENT_MATRIX = {
  hacked_clients: [
    { type: 'ban', duration: 30 * 24 * 60 * 60 * 1000, label: '30 day ban' },
    { type: 'ban', duration: null, label: 'Permanent ban' },
    { type: 'ban', duration: null, label: 'Permanent ban' },
  ],
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
    { type: 'mute', duration: null, label: 'Permanent mute' },
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
    { type: 'mute', duration: null, label: 'Permanent mute' },
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
  mute_evading: [
    { type: 'ban', duration: 3 * 24 * 60 * 60 * 1000, label: '3 day ban' },
    { type: 'ban', duration: 7 * 24 * 60 * 60 * 1000, label: '7 day ban' },
    { type: 'ban', duration: 14 * 24 * 60 * 60 * 1000, label: '14 day ban' },
  ],
  ban_evading: [
    { type: 'ban', duration: null, label: 'Permanent ban' },
    { type: 'ban', duration: null, label: 'Permanent ban' },
    { type: 'ban', duration: null, label: 'Permanent ban' },
  ],
  teaming_assisting: [
    { type: 'ban', duration: 14 * 24 * 60 * 60 * 1000, label: '14 day ban' },
    { type: 'ban', duration: 30 * 24 * 60 * 60 * 1000, label: '30 day ban' },
    { type: 'ban', duration: null, label: 'Permanent ban' },
  ],
  interrupting_1v1: [
    { type: 'warn', label: 'Warning' },
    { type: 'ban', duration: 30 * 60 * 1000, label: '30 minute ban' },
    { type: 'ban', duration: 2 * 60 * 60 * 1000, label: '2 hour ban' },
  ],
  inappropriate_username: [
    { type: 'ban', duration: null, label: 'Permanent ban' },
  ],
  inappropriate_skins: [
    { type: 'kick_warn', label: 'Warning kick + change skin request' },
    { type: 'ban', duration: 7 * 24 * 60 * 60 * 1000, label: '7 day ban' },
    { type: 'ban', duration: 14 * 24 * 60 * 60 * 1000, label: '14 day ban' },
  ],
  discord_server_links: [
    { type: 'ban_and_mute', banDuration: 7 * 24 * 60 * 60 * 1000, muteDuration: 3 * 24 * 60 * 60 * 1000, label: '7 day ban + 3 day mute' },
    { type: 'ban_and_mute', banDuration: 14 * 24 * 60 * 60 * 1000, muteDuration: 17 * 24 * 60 * 60 * 1000, label: '14 day ban + 17 day mute' },
    { type: 'ban_and_mute', banDuration: null, muteDuration: null, label: 'Permanent ban + Permanent mute' },
  ],
  bug_exploiting: [
    { type: 'ban', duration: 14 * 24 * 60 * 60 * 1000, label: '14 day ban' },
    { type: 'ban', duration: 30 * 24 * 60 * 60 * 1000, label: '30 day ban' },
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
    { type: 'ban', duration: null, label: 'Permanent ban + reported to authorities' },
    { type: 'ban', duration: null, label: 'Permanent ban + reported to authorities' },
    { type: 'ban', duration: null, label: 'Permanent ban + reported to authorities' },
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
// INFRACTION STORAGE ENGINE (CLOUDFLARE KV)
// ============================================
async function logInfraction(userId, type, reason, moderator, env) {
  const kvKey = `history:${userId}`;
  let history = [];
  try {
    const raw = await env.LAXMI_KV.get(kvKey);
    if (raw) history = JSON.parse(raw);
  } catch (e) {}

  const entry = {
    id: history.length + 1,
    type, // 'WARN', 'MUTE', 'UNMUTE', 'BAN', 'UNBAN'
    reason,
    moderator,
    timestamp: new Date().toISOString()
  };

  history.push(entry);
  await env.LAXMI_KV.put(kvKey, JSON.stringify(history));
  return entry;
}

async function getInfractions(userId, env) {
  try {
    const raw = await env.LAXMI_KV.get(`history:${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

async function clearInfractions(userId, env) {
  await env.LAXMI_KV.delete(`history:${userId}`);
}

// ============================================
// HELPERS & DISCORD API ACTIONS
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

async function getIgnoredUsers(env) {
  try {
    const stored = await env.LAXMI_KV.get('ignored_users');
    if (stored) return JSON.parse(stored);
  } catch (e) {}
  return [];
}

async function setIgnoredUsers(users, env) {
  await env.LAXMI_KV.put('ignored_users', JSON.stringify(users));
}

async function deleteMessage(channelId, messageId, env) {
  await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}` }
  });
}

async function sendDiscordMessage(channelId, payload, env) {
  return fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

async function discordApi(url, options, env) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Discord API ${res.status}: ${err.message || JSON.stringify(err)}`);
  }
  return res;
}

// Custom Native Warning
async function warnUser(channelId, userId, reason, moderator, env) {
  const entry = await logInfraction(userId, 'WARN', reason, moderator, env);
  const history = await getInfractions(userId, env);

  await sendDiscordMessage(channelId, {
    embeds: [{
      title: '⚠️ Warning Issued',
      description: `<@${userId}> has been warned by **${moderator}**.`,
      color: 0xFEE75C,
      fields: [
        { name: 'Reason', value: reason, inline: false },
        { name: 'Total Infractions', value: `${history.length}`, inline: true }
      ],
      footer: { text: 'DesiBot Custom Automod • AstralyxPvP' },
      timestamp: new Date().toISOString()
    }]
  }, env);
}

// Custom Native Mute (Timeout API + Muted Role)
async function timeoutUser(guildId, userId, durationMs, reason, moderator, env) {
  const maxTimeoutMs = 28 * 24 * 60 * 60 * 1000;
  const actualDuration = durationMs ? Math.min(durationMs, maxTimeoutMs) : maxTimeoutMs;
  const until = new Date(Date.now() + actualDuration).toISOString();

  // Apply Discord Timeout
  await discordApi(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ communication_disabled_until: until, reason })
  }, env);

  // Assign Muted Role (best effort, don't throw)
  try {
    await discordApi(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${MUTED_ROLE_ID}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'X-Audit-Log-Reason': encodeURIComponent(reason) }
    }, env);
  } catch {}

  await logInfraction(userId, 'MUTE', reason, moderator, env);
}

// Custom Native Unmute
async function unmuteUser(guildId, userId, reason, moderator, env) {
  await discordApi(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ communication_disabled_until: null, reason })
  }, env);

  try {
    await discordApi(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${MUTED_ROLE_ID}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'X-Audit-Log-Reason': encodeURIComponent(reason) }
    }, env);
  } catch {}

  await logInfraction(userId, 'UNMUTE', reason, moderator, env);
}

// Custom Native Ban
async function banUser(guildId, userId, reason, moderator, env, deleteMessageSeconds = 0) {
  await discordApi(`https://discord.com/api/v10/guilds/${guildId}/bans/${userId}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ delete_message_seconds: deleteMessageSeconds, reason })
  }, env);

  await logInfraction(userId, 'BAN', reason, moderator, env);
}

// Custom Native Kick
async function kickUser(guildId, userId, reason, moderator, env) {
  await discordApi(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'X-Audit-Log-Reason': encodeURIComponent(reason) }
  }, env);

  await logInfraction(userId, 'KICK', reason, moderator, env);
}

// Custom Native Unban
async function unbanUser(guildId, userId, reason, moderator, env) {
  await discordApi(`https://discord.com/api/v10/guilds/${guildId}/bans/${userId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'X-Audit-Log-Reason': encodeURIComponent(reason) }
  }, env);

  await logInfraction(userId, 'UNBAN', reason, moderator, env);
}

function parseDurationString(str) {
  if (!str) return 30 * 60 * 1000;
  const match = str.trim().match(/^(\d+)\s*([mhd])$/i);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  if (unit === 'm') return num * 60 * 1000;
  if (unit === 'h') return num * 60 * 60 * 1000;
  if (unit === 'd') return num * 24 * 60 * 60 * 1000;
  return null;
}

// ============================================
// PUNISHMENT TIERS
// ============================================
const TIER_ORDER = { warn: 1, mute: 2, ban: 3 };

function formatDuration(ms) {
  const days = Math.round(ms / (24 * 60 * 60 * 1000));
  const hours = Math.round(ms / (60 * 60 * 1000));
  if (days >= 1) return `${days} day${days > 1 ? 's' : ''}`;
  if (hours >= 1) return `${hours} hour${hours > 1 ? 's' : ''}`;
  return `${Math.round(ms / 60000)} min`;
}

function punishmentTierOf(type) {
  if (type === 'warn' || type === 'kick_warn') return 'warn';
  if (type === 'mute') return 'mute';
  return 'ban';
}

function getPunishmentTier(roleIds) {
  if (roleIds.some(r => MUTE_EXEMPT_ROLES.includes(r))) return 'warn';
  if (roleIds.some(r => BAN_EXEMPT_ROLES.includes(r))) return 'mute';
  return 'ban';
}

function capPunishment(punishment, maxTier) {
  if (TIER_ORDER[punishmentTierOf(punishment.type)] <= TIER_ORDER[maxTier]) {
    return punishment;
  }
  if (maxTier === 'mute') {
    const duration = punishment.type === 'ban_and_mute'
      ? (punishment.muteDuration || 28 * 24 * 60 * 60 * 1000)
      : (punishment.duration || 28 * 24 * 60 * 60 * 1000);
    return { type: 'mute', duration, label: `Mute (${formatDuration(duration)})` };
  }
  return { type: 'warn', label: 'Warning' };
}

async function applyPunishment(guildId, channelId, userId, username, ruleKey, reason, env, roleIds = []) {
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
    await warnUser(channelId, userId, reason, 'DesiBot Automod', env);
    return { actionLabel: 'Warning', offenseCount: count };
  }

  const punishmentIndex = Math.min(count - 1, ladder.length - 1);
  const punishment = capPunishment(ladder[punishmentIndex], getPunishmentTier(roleIds));

  let actionLabel = punishment.label;

  try {
    if (punishment.type === 'warn') {
      await warnUser(channelId, userId, `${reason} (Offense #${count})`, 'DesiBot Automod', env);
      await sendPunishmentDM(userId, 'warn', `${reason} (Offense #${count})`, { count }, env);
    } else if (punishment.type === 'kick_warn') {
      await warnUser(channelId, userId, `${reason} (Offense #${count})`, 'DesiBot Automod', env);
      await sendPunishmentDM(userId, 'warn', `Please change your skin and re-read the rules: ${reason} (Offense #${count})`, { count }, env);
      await kickUser(guildId, userId, `${reason} (Offense #${count})`, 'DesiBot Automod', env);
    } else if (punishment.type === 'mute') {
      await timeoutUser(guildId, userId, punishment.duration, `${reason} (Offense #${count})`, 'DesiBot Automod', env);
      await warnUser(channelId, userId, `Muted: ${punishment.label} for ${reason} (Offense #${count})`, 'DesiBot Automod', env);
      await sendPunishmentDM(userId, 'mute', `${reason} (Offense #${count})`, { label: punishment.label }, env);
    } else if (punishment.type === 'ban') {
      await sendPunishmentDM(userId, 'ban', `${reason} (Offense #${count})`, { label: punishment.label }, env);
      await banUser(guildId, userId, `${reason} (Offense #${count})`, 'DesiBot Automod', env);
      await warnUser(channelId, userId, `Banned: ${punishment.label} for ${reason} (Offense #${count})`, 'DesiBot Automod', env);
    } else if (punishment.type === 'ban_and_mute') {
      await sendPunishmentDM(userId, 'ban', `${reason} (Offense #${count})`, { label: punishment.label }, env);
      await timeoutUser(guildId, userId, punishment.muteDuration, `${reason} (Offense #${count})`, 'DesiBot Automod', env);
      await banUser(guildId, userId, `${reason} (Offense #${count})`, 'DesiBot Automod', env);
      await warnUser(channelId, userId, `Banned & Muted: ${punishment.label} for ${reason} (Offense #${count})`, 'DesiBot Automod', env);
    }
  } catch (e) {
    actionLabel = `${punishment.label} (FAILED)`;
    await warnUser(channelId, userId, `⚠️ Automod punishment failed: ${e.message}`, 'DesiBot Automod', env).catch(() => {});
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
        title: '🔨 DesiBot Automod Action',
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
// AUTOMOD DETECTION LAYERS
// ============================================
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

  const inviteMatch = text.match(AD_PATTERN);
  if (inviteMatch) {
    const code = (inviteMatch[0].split('/').pop() || '').toLowerCase();
    if (!ASTRALYX_INVITE_CODES.includes(code)) {
      return { flagged: true, rule: 'discord_server_links', reason: 'Non-AstralyxPvP Discord server link detected', confidence: 'high' };
    }
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
    return { flagged: true, rule: 'flooding_chat', reason: 'Possible raid — identical messages from multiple users', confidence: 'high' };
  }
  return { flagged: false };
}

function checkRapidSpam(userId) {
  const now = Date.now();
  const windowMs = 7000;
  if (!userSpamTracker.has(userId)) {
    userSpamTracker.set(userId, []);
  }

  const timestamps = userSpamTracker.get(userId).filter(t => now - t < windowMs);
  timestamps.push(now);
  userSpamTracker.set(userId, timestamps);

  if (timestamps.length >= 4) {
    userSpamTracker.set(userId, []);
    return true;
  }
  return false;
}

// ============================================
// SLUR-SPLIT MEMORY (KV) — catch slurs spread across messages
// ============================================
async function trackMessage(env, channelId, entry) {
  const kvKey = `msgmem:${channelId}`;
  let msgs = [];
  try {
    const raw = await env.LAXMI_KV.get(kvKey);
    if (raw) msgs = JSON.parse(raw);
  } catch (e) {}

  const now = Date.now();
  msgs = msgs.filter(m => now - m.timestamp < MSG_MEMORY_WINDOW_MS);
  msgs.push(entry);
  if (msgs.length > MSG_MEMORY_MAX) msgs = msgs.slice(-MSG_MEMORY_MAX);
  await env.LAXMI_KV.put(kvKey, JSON.stringify(msgs));
  return msgs;
}

function checkCombinedSlur(joined) {
  const variants = [
    joined,
    joined.replace(/\s+/g, ''),
    joined.toLowerCase().replace(/[^a-z0-9]/g, ''),
  ];
  for (const variant of variants) {
    const res = layer1Check(variant);
    if (res.flagged) return res;
  }
  return { flagged: false };
}

function detectSlurSplit(msgs, currentUserId) {
  let run = [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].userId !== currentUserId) break;
    run.unshift(msgs[i]);
  }
  if (run.length < 2) return null;

  const joined = run.map(m => m.content).join(' ');
  const check = checkCombinedSlur(joined);
  return check.flagged ? { run, combined: joined, check } : null;
}

async function purgeMessagesFromMemory(env, channelId, messageIds) {
  const kvKey = `msgmem:${channelId}`;
  try {
    const raw = await env.LAXMI_KV.get(kvKey);
    if (!raw) return;
    const msgs = JSON.parse(raw).filter(m => !messageIds.includes(m.messageId));
    await env.LAXMI_KV.put(kvKey, JSON.stringify(msgs));
  } catch (e) {}
}

async function layer2AICheck(text, env) {
  const systemPrompt = `You are the moderation AI for AstralyxPvP, an Indian Minecraft Java PvP Discord server.
Categorize incoming user messages strictly into one of the following rule violation keys:

OPTIONS:
- hacked_clients (Admitting to or promoting hacked clients, cheats, or unfair advantages)
- swearing_at_players (Swearing/insulting other players)
- discord_advertising (Posting invite links to other Discord servers)
- light_advertising (Mentioning/telling other Minecraft server names)
- asking_staff_items (Begging or asking staff for free items/ranks)
- chat_trolling (Trolling users, e.g. "press alt + f4 for free rank")
- flooding_chat (Spamming or sending repeated flooding messages)
- inappropriate_behavior (NSFW, sexually explicit, or inappropriate conduct)
- discrimination (Racism, homophobia, bigotry, or discrimination)
- referencing_tragic_events (Referencing tragedies, disasters, or mass violence)
- mute_evading (Admitting to or arranging mute evasions on alternate accounts)
- ban_evading (Admitting to or arranging ban evasions on alternate accounts)
- teaming_assisting (Teaming with or assisting hackers/rule breakers)
- interrupting_1v1 (Interrupting or interfering with an ongoing 1v1 fight)
- inappropriate_username (Inappropriate or offensive username/display name)
- inappropriate_skins (Inappropriate or offensive skins or avatars)
- discord_server_links (Posting non-Astralyx Discord links; AstralyxPvP's own invite discord.gg/u8BFrpRwEg is ALLOWED)
- bug_exploiting (Exploiting server bugs, glitches, or abusing exploits)
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
    env.GEMINI_MODEL || 'gemini-3.5-flash-lite-preview',
    'gemini-3.1-flash-lite-preview',
    'gemini-2.5-flash-lite',
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

const REJOIN_LINK = 'https://discord.gg/u8BFrpRwEg';

function punishmentDM(type, reason, details = {}) {
  const { duration, label, count } = details;
  const base = {
    footer: { text: 'DesiBot Automod • AstralyxPvP' },
    timestamp: new Date().toISOString(),
    color: type === 'warn' ? 0xFEE75C : type === 'mute' ? 0xF1C40F : 0xE74C3C,
  };

  if (type === 'warn') {
    return {
      embeds: [{
        ...base,
        title: '⚠️ Warning Issued',
        description: `You've received a **warning** in AstralyxPvP.`,
        fields: [
          { name: 'Reason', value: reason, inline: false },
          ...(count ? [{ name: 'Offense Count', value: String(count), inline: true }] : []),
          { name: 'Next Step', value: 'Keep it clean — repeated violations lead to mutes and bans.', inline: false }
        ]
      }]
    };
  }

  if (type === 'mute') {
    return {
      embeds: [{
        ...base,
        title: '🔇 You Have Been Muted',
        description: `You've been muted in **AstralyxPvP**.`,
        fields: [
          { name: 'Duration', value: label || 'See reason', inline: true },
          { name: 'Reason', value: reason, inline: false },
          { name: 'Next Step', value: 'Wait out the mute and re-read the rules before chatting again.', inline: false }
        ]
      }]
    };
  }

  return {
    embeds: [{
      ...base,
      title: '🔨 You Have Been Banned',
      description: `You've been banned from **AstralyxPvP**.`,
      fields: [
        { name: 'Duration', value: label || 'Permanent', inline: true },
        { name: 'Reason', value: reason, inline: false },
        { name: 'Rejoin', value: `You can rejoin after the ban period expires: ${REJOIN_LINK}`, inline: false },
        { name: 'Appeal', value: 'If you believe this was a mistake, contact a staff member after rejoining.', inline: false }
      ]
    }]
  };
}

async function sendPunishmentDM(userId, type, reason, details = {}, env) {
  try {
    await sendDM(userId, punishmentDM(type, reason, details), env);
  } catch (e) {}
}

const STAFF_ALERT_COOLDOWN_MS = 10 * 60 * 1000;

// Ticket system — button channel + forum/thread channel for tickets
const CREATE_TICKET_CHANNEL_ID = '1477032862892163113';
const TICKET_STAFF_ROLES = [
  ...MOD_ROLES,
  '1497316057214484735', // Jr. Mod
  '1477025528174219476', // Helper
  '1501217374102229185', // Trial Staff
];

async function fetchAllGuildMembers(guildId, env) {
  try {
    const all = [];
    let after = '0';
    for (let i = 0; i < 5; i++) {
      const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members?limit=1000&after=${after}`, {
        headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}` }
      });
      if (!res.ok) break;
      const members = await res.json();
      if (!Array.isArray(members) || members.length === 0) break;
      all.push(...members);
      if (members.length < 1000) break;
      after = members[members.length - 1].user.id;
    }
    return all;
  } catch (e) {
    return [];
  }
}

async function getStaffMemberIds(guildId, env) {
  const all = await fetchAllGuildMembers(guildId, env);
  return all.filter(m => (m.roles || []).some(r => MOD_ROLES.includes(r))).map(m => m.user.id);
}

async function getTicketStaffIds(guildId, env) {
  const all = await fetchAllGuildMembers(guildId, env);
  const staff = all.filter(m => (m.roles || []).some(r => TICKET_STAFF_ROLES.includes(r)));
  const rank = (m) => {
    for (let i = 0; i < TICKET_STAFF_ROLES.length; i++) {
      if (m.roles.includes(TICKET_STAFF_ROLES[i])) return i;
    }
    return TICKET_STAFF_ROLES.length;
  };
  staff.sort((a, b) => rank(a) - rank(b));
  return staff.slice(0, 9).map(m => m.user.id);
}

async function alertStaff(guildId, alertType, details, env) {
  const kvKey = `staff_alert:${alertType}`;
  try {
    const last = await env.LAXMI_KV.get(kvKey);
    if (last && Date.now() - parseInt(last, 10) < STAFF_ALERT_COOLDOWN_MS) return;
    await env.LAXMI_KV.put(kvKey, Date.now().toString());
  } catch (e) {}

  const staffIds = await getStaffMemberIds(guildId, env);
  const payload = {
    embeds: [{
      title: `🚨 ${details.title}`,
      description: details.description,
      color: 0xE74C3C,
      fields: [
        { name: 'Channel', value: `<#${details.channelId}>`, inline: true },
        { name: 'User', value: `<@${details.userId}> (${details.username})`, inline: true },
        { name: 'Message', value: '```' + (details.message || '').substring(0, 300) + '```', inline: false }
      ],
      footer: { text: 'DesiBot Staff Alert • AstralyxPvP' },
      timestamp: new Date().toISOString()
    }]
  };
  await Promise.allSettled(staffIds.map(id => sendDM(id, payload, env)));
}

// ============================================
// DM SUPPORT TICKETS — button → thread → Group DM
// ============================================
async function followUp(interaction, env, payload) {
  try {
    await fetch(`https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {}
}

async function handleOpenTicket(interaction, env, ctx) {
  ctx.waitUntil((async () => {
    const userId = interaction.member?.user?.id || interaction.user?.id;
    const username = interaction.member?.user?.username || interaction.user?.username;
    const guildId = interaction.guild_id || MAIN_GUILD_ID;
    const forumChannelId = env.TICKET_FORUM_CHANNEL_ID || CREATE_TICKET_CHANNEL_ID;

    try {
      // Detect channel type (forum vs text)
      const chanRes = await fetch(`https://discord.com/api/v10/channels/${forumChannelId}`, {
        headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}` }
      });
      const channel = await chanRes.json();
      const isForum = channel.type === 15;

      const threadName = `🎫 support-${username}`.substring(0, 100);
      let threadId = null;

      if (isForum) {
        const t = await fetch(`https://discord.com/api/v10/channels/${forumChannelId}/threads`, {
          method: 'POST',
          headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: threadName,
            type: 11,
            message: { content: `<@${userId}> needs help — staff will reach out in a Group DM.` }
          })
        });
        if (t.ok) threadId = (await t.json()).id;
      } else {
        const t = await fetch(`https://discord.com/api/v10/channels/${forumChannelId}/threads`, {
          method: 'POST',
          headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: threadName, type: 12 })
        });
        if (t.ok) {
          threadId = (await t.json()).id;
          await sendDiscordMessage(threadId, { content: `<@${userId}> needs help — staff will reach out in a Group DM.` }, env);
        }
      }

      if (!threadId) throw new Error('Could not create ticket thread');

      // Group DM: player + staff roster (Owner rank first, cap 10 total recipients)
      const staffIds = await getTicketStaffIds(guildId, env);
      const recipients = [...new Set([userId, ...staffIds])].slice(0, 10);
      let groupDmId = null;
      try {
        const dmRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
          method: 'POST',
          headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipients })
        });
        if (dmRes.ok) groupDmId = (await dmRes.json()).id;
      } catch (e) {}

      if (groupDmId) {
        await sendDiscordMessage(groupDmId, {
          embeds: [{
            title: '🎫 New Support Ticket',
            description: `<@${userId}> opened a support ticket and needs help.`,
            color: 0xC8102E,
            fields: [
              { name: 'Ticket Thread', value: `https://discord.com/channels/${guildId}/${forumChannelId}/${threadId}`, inline: false },
              { name: 'Member', value: `<@${userId}> (${username})`, inline: true }
            ],
            footer: { text: 'DesiBot Tickets • AstralyxPvP' },
            timestamp: new Date().toISOString()
          }]
        });
      }

      await followUp(interaction, env, { content: `✅ Ticket opened! <@${userId}> — staff have been notified. Thread: <#${threadId}>` });
    } catch (e) {
      await followUp(interaction, env, { content: `❌ Ticket failed: ${e.message}` });
    }
  })());

  return jsonResponse({
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    data: { flags: 64 }
  });
}

async function buildRolePickerEmbed() {
  return {
    title: '🔔 Get Notified — Pick Your Roles!',
    description: 'Use the buttons below to assign yourself notification roles. Click again to remove.',
    color: 0xC8102E,
    fields: NOTIFICATION_ROLES.map(r => ({ name: r.label, value: `<@&${r.roleId}>`, inline: true })),
    footer: { text: 'AstralyxPvP • Role Selector' }
  };
}

function buildRolePickerComponents() {
  return [{
    type: 1,
    components: NOTIFICATION_ROLES.map(r => ({ type: 2, style: 2, label: r.label, custom_id: `role_toggle_${r.roleId}` }))
  }];
}

async function handleMemberJoin(userId, username, env) {
  const welcomeEmbed = {
    title: '🙏 Welcome to AstralyxPvP!',
    description: `Namaste <@${userId}>! Welcome to **AstralyxPvP** — India's premier Minecraft Java PvP server!\n\n⚔️ **Server IP:** \`java.astralyxpvp.int.yt\`\n🌐 **Website:** [astralyxpvp.pages.dev](https://astralyxpvp.pages.dev)\n\nHead over to <#1477033060078850264> to get started and check <#1477033071076442165> for the rules!\n\nSee you on the battlefield! 🔥`,
    color: 0xC8102E,
    thumbnail: { url: 'https://astralyxpvp.pages.dev/Assets/logo.png' },
    footer: { text: `Welcome, ${username}! • AstralyxPvP` },
    timestamp: new Date().toISOString()
  };

  await sendDiscordMessage(DESIBOT_WELCOMER_CHANNEL_ID, { content: `<@${userId}>`, embeds: [welcomeEmbed] }, env);

  // DM includes the welcome message AND the notification role picker buttons
  await sendDM(userId, {
    embeds: [welcomeEmbed, await buildRolePickerEmbed()],
    components: buildRolePickerComponents()
  }, env);
}

async function handleWelcomeReactionOptions(env) {
  await sendDiscordMessage(WELCOME_CHANNEL_ID, {
    embeds: [await buildRolePickerEmbed()],
    components: buildRolePickerComponents()
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
// CUSTOM SLASH COMMAND HANDLER
// ============================================
async function handleSlashCommand(interaction, env) {
  try {
    return await handleSlashCommandInner(interaction, env);
  } catch (e) {
    return jsonResponse({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: `❌ Command failed: ${e.message}\n\nCheck bot permissions and role hierarchy.`, flags: 64 }
    });
  }
}

async function handleSlashCommandInner(interaction, env) {
  const commandName = interaction.data.name;
  const memberRoles = interaction.member?.roles || [];
  const isStaff = memberRoles.some(r => MOD_ROLES.includes(r));
  const guildId = interaction.guild_id || MAIN_GUILD_ID;
  const staffUsername = interaction.member?.user?.username || 'Staff';

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

  if (commandName === 'ignore-user') {
    const targetUserId = interaction.data.options?.[0]?.value;
    const users = await getIgnoredUsers(env);
    if (!users.includes(targetUserId)) users.push(targetUserId);
    await setIgnoredUsers(users, env);
    return jsonResponse({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: `✅ <@${targetUserId}> added to the automod ignore list.`, flags: 64 }
    });
  }

  if (commandName === 'unignore-user') {
    const targetUserId = interaction.data.options?.[0]?.value;
    let users = await getIgnoredUsers(env);
    users = users.filter(u => u !== targetUserId);
    await setIgnoredUsers(users, env);
    return jsonResponse({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: `✅ <@${targetUserId}> removed from the automod ignore list.`, flags: 64 }
    });
  }

  // NATIVE COMMAND: /warn
  if (commandName === 'warn') {
    const options = interaction.data.options || [];
    const targetUserId = options.find(o => o.name === 'user')?.value;
    const reason = options.find(o => o.name === 'reason')?.value || 'Warned by staff';

    await warnUser(interaction.channel_id, targetUserId, reason, staffUsername, env);
    await sendLog(env, {
      userId: targetUserId,
      username: `<@${targetUserId}>`,
      channelId: interaction.channel_id,
      action: 'Warning',
      rule: 'Manual Staff Warn',
      reason: reason,
      layer: 'Staff Command (/warn)',
      confidence: 'high',
      message: `Issued by ${staffUsername}`
    });

    return jsonResponse({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: `⚠️ <@${targetUserId}> has been warned.\n**Reason:** ${reason}` }
    });
  }

  // NATIVE COMMAND: /warns or /infractions
  if (commandName === 'warns' || commandName === 'infractions') {
    const options = interaction.data.options || [];
    const targetUserId = options.find(o => o.name === 'user')?.value;
    const history = await getInfractions(targetUserId, env);

    if (history.length === 0) {
      return jsonResponse({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: `✅ <@${targetUserId}> has a clean record (0 infractions).` }
      });
    }

    const fields = history.slice(-10).map(i => ({
      name: `#${i.id} | ${i.type} (${new Date(i.timestamp).toLocaleDateString()})`,
      value: `**Reason:** ${i.reason}\n**By:** ${i.moderator}`,
      inline: false
    }));

    return jsonResponse({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [{
          title: `📜 Infraction History for <@${targetUserId}>`,
          description: `Total Infractions: **${history.length}**`,
          color: 0xC8102E,
          fields
        }]
      }
    });
  }

  // NATIVE COMMAND: /clearwarns
  if (commandName === 'clearwarns') {
    const options = interaction.data.options || [];
    const targetUserId = options.find(o => o.name === 'user')?.value;

    await clearInfractions(targetUserId, env);
    return jsonResponse({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: `🧹 Cleared all infractions and warning history for <@${targetUserId}>.` }
    });
  }

  // NATIVE COMMAND: /mute
  if (commandName === 'mute') {
    const options = interaction.data.options || [];
    const targetUserId = options.find(o => o.name === 'user')?.value;
    const durationInput = options.find(o => o.name === 'duration')?.value || '30m';
    const reason = options.find(o => o.name === 'reason')?.value || 'Muted by staff';

    const durationMs = parseDurationString(durationInput);
    if (!durationMs) {
      return jsonResponse({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: '❌ Invalid duration format! Use formats like `30m`, `1h`, `6h`, or `1d`.', flags: 64 }
      });
    }

    await timeoutUser(guildId, targetUserId, durationMs, reason, staffUsername, env);
    await sendLog(env, {
      userId: targetUserId,
      username: `<@${targetUserId}>`,
      channelId: interaction.channel_id,
      action: `Muted (${durationInput})`,
      rule: 'Manual Staff Mute',
      reason: reason,
      layer: 'Staff Command (/mute)',
      confidence: 'high',
      message: `Issued by ${staffUsername}`
    });

    return jsonResponse({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: `🔇 <@${targetUserId}> has been muted for **${durationInput}**.\n**Reason:** ${reason}` }
    });
  }

  // NATIVE COMMAND: /unmute
  if (commandName === 'unmute') {
    const options = interaction.data.options || [];
    const targetUserId = options.find(o => o.name === 'user')?.value;
    const reason = options.find(o => o.name === 'reason')?.value || 'Unmuted by staff';

    await unmuteUser(guildId, targetUserId, reason, staffUsername, env);
    await sendLog(env, {
      userId: targetUserId,
      username: `<@${targetUserId}>`,
      channelId: interaction.channel_id,
      action: 'Unmuted',
      rule: 'Manual Staff Unmute',
      reason: reason,
      layer: 'Staff Command (/unmute)',
      confidence: 'high',
      message: `Issued by ${staffUsername}`
    });

    return jsonResponse({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: `🔊 <@${targetUserId}> has been unmuted.\n**Reason:** ${reason}` }
    });
  }

  // NATIVE COMMAND: /ban
  if (commandName === 'ban') {
    const options = interaction.data.options || [];
    const targetUserId = options.find(o => o.name === 'user')?.value;
    const reason = options.find(o => o.name === 'reason')?.value || 'Banned by staff';
    const deleteDays = options.find(o => o.name === 'delete_days')?.value || 0;
    const deleteSeconds = Math.min(Math.max(deleteDays, 0), 7) * 24 * 60 * 60;

    await banUser(guildId, targetUserId, reason, staffUsername, env, deleteSeconds);
    await sendLog(env, {
      userId: targetUserId,
      username: `<@${targetUserId}>`,
      channelId: interaction.channel_id,
      action: 'Banned',
      rule: 'Manual Staff Ban',
      reason: reason,
      layer: 'Staff Command (/ban)',
      confidence: 'high',
      message: `Issued by ${staffUsername}`
    });

    return jsonResponse({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: `🔨 <@${targetUserId}> has been banned.\n**Reason:** ${reason}` }
    });
  }

  // NATIVE COMMAND: /unban
  if (commandName === 'unban') {
    const options = interaction.data.options || [];
    const targetUserId = options.find(o => o.name === 'user_id')?.value;
    const reason = options.find(o => o.name === 'reason')?.value || 'Unbanned by staff';

    if (!targetUserId || !/^\d{17,20}$/.test(targetUserId.trim())) {
      return jsonResponse({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: '❌ Please provide a valid numerical Discord User ID.', flags: 64 }
      });
    }

    await unbanUser(guildId, targetUserId.trim(), reason, staffUsername, env);
    await sendLog(env, {
      userId: targetUserId.trim(),
      username: `<@${targetUserId.trim()}>`,
      channelId: interaction.channel_id,
      action: 'Unbanned',
      rule: 'Manual Staff Unban',
      reason: reason,
      layer: 'Staff Command (/unban)',
      confidence: 'high',
      message: `Issued by ${staffUsername}`
    });

    return jsonResponse({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: `🔓 User \`${targetUserId}\` has been unbanned.\n**Reason:** ${reason}` }
    });
  }

  // NATIVE COMMAND: /clearchat
  if (commandName === 'clearchat') {
    const count = Math.min(Math.max(parseInt(interaction.data.options?.[0]?.value, 10) || 0, 1), 100);
    const channelId = interaction.channel_id;

    const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages?limit=${count}`, {
      headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}` }
    });
    if (!res.ok) {
      return jsonResponse({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: `❌ Failed to fetch messages (${res.status}).`, flags: 64 }
      });
    }
    const messages = await res.json();
    const ids = (Array.isArray(messages) ? messages : []).map(m => m.id);

    if (ids.length === 0) {
      return jsonResponse({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: '✅ Nothing to delete — channel is already clean.', flags: 64 }
      });
    }

    // Bulk delete (works for messages < 14 days old)
    let deleted = 0;
    if (ids.length === 1) {
      await deleteMessage(channelId, ids[0], env);
      deleted = 1;
    } else {
      const bulk = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/bulk-delete`, {
        method: 'POST',
        headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: ids })
      });
      if (bulk.ok) deleted = ids.length;
      else {
        // Fall back to individual deletion
        await Promise.allSettled(ids.map(id => deleteMessage(channelId, id, env)));
        deleted = ids.length;
      }
    }

    await sendLog(env, {
      userId: interaction.member?.user?.id,
      username: staffUsername,
      channelId,
      action: `Cleared ${deleted} messages`,
      rule: 'Manual Staff Purge',
      reason: `Cleared ${count} requested messages`,
      layer: 'Staff Command (/clearchat)',
      confidence: 'high',
      message: `Issued by ${staffUsername}`
    });

    return jsonResponse({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: `🧹 Deleted **${deleted}** message${deleted === 1 ? '' : 's'} in <#${channelId}>.`, flags: 64 }
    });
  }

  // NATIVE COMMAND: /ticket-setup
  if (commandName === 'ticket-setup') {
    await sendDiscordMessage(CREATE_TICKET_CHANNEL_ID, {
      embeds: [{
        title: '🎫 Need Help?',
        description: 'Click the button below to open a support ticket. Staff (including the Owner) will be pulled into a **Group DM** with you to sort it out.',
        color: 0xC8102E,
        footer: { text: 'DesiBot Tickets • AstralyxPvP' }
      }],
      components: [{
        type: 1,
        components: [{ type: 2, style: 1, label: 'Open Support Ticket', custom_id: 'open_ticket', emoji: { name: '🎫' } }]
      }]
    }, env);

    return jsonResponse({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: `✅ Ticket button posted in <#${CREATE_TICKET_CHANNEL_ID}>!`, flags: 64 }
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

  const ignoredUsers = await getIgnoredUsers(env);
  if (ignoredUsers.includes(userId)) return;

  const isLinkExempt = roleIds.some(r => LINK_EXEMPT_ROLES.includes(r));

  // 1. Anti-Spam Check
  if (checkRapidSpam(userId)) {
    await deleteMessage(channelId, messageId, env);
    const { actionLabel } = await applyPunishment(guildId, channelId, userId, username, 'flooding_chat', 'Flooding chat (4 consecutive messages)', env, roleIds);
    await sendLog(env, { userId, username, channelId, action: actionLabel, rule: 'flooding_chat', reason: 'Flooding chat (4 consecutive messages)', layer: 'Anti-Spam Filter', confidence: 'high', message: content });
    await alertStaff(guildId, 'flood', { title: 'Spam Flood Detected', description: 'A user is flooding the chat at high speed.', channelId, userId, username, message: content }, env);
    return;
  }

  // 1b. Slur-Split Check (combine consecutive messages from same user in KV memory)
  const msgs = await trackMessage(env, channelId, { userId, content, messageId, timestamp: Date.now() });
  const split = detectSlurSplit(msgs, userId);
  if (split) {
    const messageIds = split.run.map(m => m.messageId).filter(Boolean);
    await Promise.allSettled(messageIds.map(id => deleteMessage(channelId, id, env)));
    await purgeMessagesFromMemory(env, channelId, messageIds);
    const { actionLabel } = await applyPunishment(guildId, channelId, userId, username, split.check.rule, split.check.reason, env, roleIds);
    await sendLog(env, { userId, username, channelId, action: actionLabel, rule: split.check.rule, reason: split.check.reason, layer: 'Slur-Split Detection', confidence: 'high', message: split.combined });
    return;
  }

  // 2. Layer 1 Check (Regex / Obscenity / Ads)
  const l1 = layer1Check(content);
  if (l1.flagged) {
    if (isLinkExempt && (l1.rule === 'discord_advertising' || l1.rule === 'discord_server_links')) return;
    await deleteMessage(channelId, messageId, env);

    const { actionLabel } = await applyPunishment(guildId, channelId, userId, username, l1.rule, l1.reason, env, roleIds);
    await sendLog(env, { userId, username, channelId, action: actionLabel, rule: l1.rule, reason: l1.reason, layer: 'Layer 1', confidence: l1.confidence, message: content });
    return;
  }

  // 3. Raid Check
  const raid = raidCheck(channelId, content, userId);
  if (raid.flagged) {
    await deleteMessage(channelId, messageId, env);
    const { actionLabel } = await applyPunishment(guildId, channelId, userId, username, raid.rule, raid.reason, env, roleIds);
    await sendLog(env, { userId, username, channelId, action: actionLabel, rule: raid.rule, reason: raid.reason, layer: 'Raid Detection', confidence: raid.confidence, message: content });
    await alertStaff(guildId, 'raid', { title: 'Raid In Progress', description: 'Identical messages detected from multiple users.', channelId, userId, username, message: content }, env);
    return;
  }

  // 4. Layer 2 Check (Gemini / Gemma AI Rule Engine)
  const l2 = await layer2AICheck(content, env);
  if (l2.flagged && l2.rule_violation !== 'none' && (l2.confidence === 'high' || l2.confidence === 'medium')) {
    if (isLinkExempt && (l2.rule_violation === 'discord_advertising' || l2.rule_violation === 'discord_server_links')) return;

    await deleteMessage(channelId, messageId, env);

    const { actionLabel } = await applyPunishment(guildId, channelId, userId, username, l2.rule_violation, l2.reason, env, roleIds);
    await sendLog(env, { userId, username, channelId, action: actionLabel, rule: l2.rule_violation, reason: l2.reason, layer: 'Layer 2 (AI)', confidence: l2.confidence, message: content });
  }
}

// ============================================
// FORUM MODERATION CHECK (READ-ONLY VERDICT)
// ============================================
async function handleModerate(payload, env) {
  const content = String(payload.content || '').trim();
  if (!content) {
    return jsonResponse({ verdict: 'ok', rule: 'none', reason: 'Empty content', confidence: 'high', layer: 'validation' });
  }

  const l1 = layer1Check(content);
  if (l1.flagged) {
    return jsonResponse({
      verdict: 'block',
      rule: l1.rule,
      reason: l1.reason,
      confidence: l1.confidence,
      layer: 'layer1'
    });
  }

  const l2 = await layer2AICheck(content, env);
  if (l2.flagged && l2.rule_violation !== 'none') {
    return jsonResponse({
      verdict: l2.confidence === 'high' ? 'block' : 'flag',
      rule: l2.rule_violation,
      reason: l2.reason || l2.rule_violation,
      confidence: l2.confidence,
      layer: 'layer2'
    });
  }

  return jsonResponse({
    verdict: 'ok',
    rule: 'none',
    reason: 'Clean',
    confidence: 'high',
    layer: 'all'
  });
}

// ============================================
// WORKER ENTRY
// ============================================
export default {
  async fetch(request, env, ctx) {
    if (request.method === 'GET') {
      return new Response('DesiBot | AstralyxPvP Assistant is online 🙏', { headers: { 'Content-Type': 'text/plain' } });
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
        if (customId === 'open_ticket') {
          return await handleOpenTicket(interaction, env, ctx);
        }
      }

      return jsonResponse({ type: InteractionResponseType.PONG });
    }

    // Gateway / Moderator Forwarding
    const isGateway = authHeader === `Bearer ${env.GATEWAY_SECRET}`;
    const isModerator = authHeader === `Bearer ${env.FORUM_SECRET}`;
    if (!isGateway && !isModerator) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const payload = await request.json();

    // Forum moderation check — synchronous verdict for the forums frontend
    if (payload.type === 'moderate') {
      if (!isModerator) return jsonResponse({ error: 'Unauthorized' }, 401);
      return await handleModerate(payload, env);
    }

    if (payload.type === 'member_join') {
      ctx.waitUntil(handleMemberJoin(payload.userId, payload.username, env));
      return jsonResponse({ ok: true });
    }

    ctx.waitUntil(handleMessage(payload, env));
    return jsonResponse({ ok: true });
  }
};