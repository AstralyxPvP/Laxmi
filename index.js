/**
 * Laxmi | AstralyxPvP Assistant
 * Smart Automod + Welcome Bot — Cloudflare Worker
 * Built by IndianCoder3
 */

import { verifyKey, InteractionType, InteractionResponseType } from 'discord-interactions';

// ============================================
// CONSTANTS
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

// ============================================
// OFFENSIVE WORD LIST
// ============================================
// Longer / unambiguous words — safe to substring-match anywhere in a message.
const BANNED_WORDS = [
  // English — direct + common misspells/obfuscation
  'fuck', 'f**k', 'fck', 'fuk', 'fucc', 'fvck', 'phuck', 'fuq', 'fuking', 'fuked',
  'focking', 'focked', 'motherfucker', 'motherfucking', 'frick', 'fricking', 'frickin',
  'fudge', 'effing', 'effin', 'ffs',
  'shit', 'sh1t', 'sht', 'shiit', 'shyt', 'shithead', 'shitty', 'horseshit',
  'bitch', 'b1tch', 'btch', 'biatch',
  'asshole', 'a**hole', 'a55hole', 'azzhole', 'asswipe',
  'bastard', 'b@stard', 'bastad',
  'dammit',
  'dick', 'd1ck', 'dik', 'dickpic', 'dick pic',
  'c0ck',
  'pussy', 'puss1',
  'nigga', 'nigger', 'n1gga', 'n1gger',
  'r3tard',
  'whore', 'wh0re',
  'slut', 'sl*t', 'skank', 'skanky',
  'kill yourself', 'k.y.s', 'end yourself',
  'rape', 'r@pe',
  'cunt', 'c*nt',
  'prick', 'pr1ck',
  'twat', 'tw@t',
  'wanker', 'w@nker',
  'bollocks', 'bullshit', 'bulls**t', 'bullcrap',
  'jackass', 'dumbass', 'dumb@ss', 'dipshit',
  'douchebag', 'douche',
  'jerkoff', 'jerk off', 'blowjob', 'handjob', 'boner',
  'nudes', 'send nudes', 'nsfw',
  'shut up',
  // Hindi / Hinglish — direct + common misspells
  'madarchod', 'maderchod', 'maa ki', 'maaki', 'teri maa', 'teri ma', 'teri maa ki',
  'behenchod', 'behen chod', 'behnchod', 'bahenchod', 'behen ke lode', 'bhen ke lode',
  'chutiya', 'chutiye', 'choot', 'chutmarike',
  'bhosdike', 'bhosd', 'bhosdi', 'bhosdiwale', 'bhosdiki',
  'gandu', 'gaandu', 'g@ndu', 'gandmasti',
  'harami', 'haraami', 'haraamzada',
  'r@ndi', 'randibaaz',
  'bsdk', 'lodu', 'lund', 'lauda', 'lavda', 'loda', 'lawde', 'lavde',
  'chakka', 'hijra',
  'kutte', 'kutta', 'kutiya', 'kutte ki aulad', 'suar ki aulad',
  'kamina', 'kamine', 'kamini',
  'ullu ka pattha',
  'gadha', 'gadhe',
  'bakwas', 'bakwaas',
  'chup kar',
  'nikl', 'nikal',
  'jhant', 'jhaant', 'chinaal', 'nalayak', 'nikamma', 'nikammi', 'ghatiya', 'faltu',
  // Advertising patterns
  'discord.gg/', 'dsc.gg/', 'discordapp.com/invite',
  'join my server', 'join our server', 'join my disc',
  // Staff impersonation
  'i am admin', 'i am mod', 'i am staff', "i'm admin", "i'm mod", "i'm staff",
];

// Short / ambiguous words — require real word boundaries so they don't
// misfire inside legit words (class, cockpit, Gandhi, parachute, etc.)
const BOUNDARY_WORDS = [
  'ass', 'cock', 'gand', 'chut', 'raand',
  'kys', 'wtf', 'wth', 'stfu',
];

// Words that are genuinely context-dependent — NOT hard-matched at all.
// These are intentionally left for the Layer 2 AI check (below) to judge
// in context, instead of auto-deleting on every occurrence:
//   'mc'    → also short for Minecraft
//   'bc'    → also short for "because"
//   'tard'  → too many false positives (leotard, mustard, custard)
//   'sala'/'saala'/'saale' → also a literal relation term (brother-in-law)
//   'moron', 'idiot' → often used in harmless self-deprecating banter

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

function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u200b\u200c\u200d\u2060\ufeff]/g, '')
    .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e')
    .replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't')
    .replace(/9/g, 'g').replace(/\$/g, 's').replace(/@/g, 'a')
    .replace(/\+/g, 't').replace(/8/g, 'b')
    // collapse 3+ repeated letters to 1 → catches "fuuuuck", "shiiiit", "assss"
    .replace(/([a-z])\1{2,}/g, '$1')
    .replace(/\s+/g, ' ').trim();
}

// Strips every non-alphanumeric character. Used to catch spaced-out or
// punctuated obfuscation like "f.u.c.k", "f_u_c_k", "f-u-c-k", "f u c k".
function superStrip(text) {
  return text.replace(/[^a-z0-9]/g, '');
}

function layer1Check(text) {
  const normalized = normalizeText(text);
  const stripped = superStrip(normalized);

  // Longer/unambiguous words — safe to match anywhere in the message.
  for (const word of BANNED_WORDS) {
    const nw = superStrip(normalizeText(word));
    if (nw && stripped.includes(nw)) {
      return { flagged: true, reason: `Banned word: "${word}"`, confidence: 'high' };
    }
  }

  // Short/ambiguous words (ass, mc, bc, gand, chut...) — require a real word
  // boundary so they don't fire inside "class", "Gandhi", "parachute", etc.
  for (const word of BOUNDARY_WORDS) {
    const re = new RegExp(`(^|[^a-z0-9])${word}([^a-z0-9]|$)`, 'i');
    if (re.test(normalized)) {
      return { flagged: true, reason: `Banned word: "${word}"`, confidence: 'high' };
    }
  }

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
  // IMPORTANT: do NOT paste the raw banned-word list into this prompt.
  // Doing that got the prompt itself blocked by Google's own safety filter
  // (blockReason: PROHIBITED_CONTENT) — every message silently failed
  // moderation because the prompt looked like a wall of slurs to Google.
  // Describe categories instead; the model already knows common profanity.
  const prompt = `You are the moderation AI for AstralyxPvP, an Indian Minecraft Java PvP Discord server. You are the PRIMARY filter — a lightweight regex pre-check runs before you and only catches exact plain-text matches, so assume obfuscated or borderline messages will reach you and it's your job to catch them.

Use your own knowledge of what counts as profanity, slurs, hate speech, harassment, sexual/NSFW content, or abusive language in English and Hindi/Hinglish (common in Indian gaming communities) to judge this message. Also flag Discord server advertising (invite links, "join my server") and staff impersonation (claiming to be admin/mod/staff falsely).

Users often try to dodge filters by disguising words — treat a disguised word the same as the plain word it represents: substituted numbers/symbols for letters, spaced-out letters, punctuation between letters, or stretched repeated letters all count as the original word.

This is a content-moderation classification task — you are only returning a JSON verdict, not generating or repeating offensive content.

Do NOT flag: mild frustration, casual banter, "mc"/"bc" when clearly meaning Minecraft/because from context, or mild words used lightly between friends. Use judgment — context matters more than exact word matching.

Message to evaluate: "${text}"

Respond ONLY with JSON (no markdown, no extra text): {"flagged": true/false, "reason": "short reason or null", "confidence": "high/medium/low"}`;

  // Loosen safety blocking on the classifier calls themselves — without this,
  // Google's default filters can still refuse to even look at messages that
  // contain profanity/harassment content, which is exactly what we need to
  // classify. BLOCK_ONLY_HIGH still blocks truly extreme content.
  const safetySettings = [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
  ];

  // Gemma 4 26B first — newer, natively supports structured JSON output
  // (Gemma 3 doesn't as cleanly), and still free-tier. Falls back to Gemma 3,
  // then Gemini, if the primary model is rate-limited or errors out.
  const modelChain = [
    env.GEMMA_MODEL || 'gemma-4-26b-a4b-it',
    'gemma-3-27b-it',
    env.GEMINI_MODEL || 'gemini-3.1-flash-lite-preview',
  ];

  for (const model of modelChain) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GOOGLE_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          safetySettings,
          generationConfig: { temperature: 0.1, maxOutputTokens: 120 }
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
        return JSON.parse(raw.replace(/```json|```/g, '').trim());
      } catch (parseErr) {
        console.error(`[Laxmi Layer2] ${model} returned unparseable JSON: "${raw}"`);
        continue;
      }
    } catch (e) {
      console.error(`[Laxmi Layer2] ${model} threw an error: ${e.message}`);
      continue; // try next model in the chain
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

// Opens (or fetches) a DM channel with a user, returns the DM channel ID.
async function getDMChannelId(userId, env) {
  const res = await fetch('https://discord.com/api/v10/users/@me/channels', {
    method: 'POST',
    headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient_id: userId })
  });
  const data = await res.json();
  return data.id;
}

// Sends a DM to a user. Wrapped so a failure (DMs closed) never throws.
async function sendDM(userId, payload, env) {
  try {
    const dmChannelId = await getDMChannelId(userId, env);
    if (!dmChannelId) return;
    await sendDiscordMessage(dmChannelId, payload, env);
  } catch (e) {
    // User likely has server DMs disabled — safe to ignore.
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

  // ONE message in the public welcome channel — nothing else posted here.
  await sendDiscordMessage(LAXMI_WELCOMER_CHANNEL_ID, {
    content: `<@${userId}>`,
    embeds: [welcomeEmbed]
  }, env);

  // DM a copy of the welcome message to the user directly.
  await sendDM(userId, { embeds: [welcomeEmbed] }, env);

  // DM the role selector too, instead of posting it in the channel.
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
  // Buttons are now sent via DM, so interaction.guild_id won't be present there —
  // fall back to the known server ID so role add/remove still targets the right guild.
  const guildId = interaction.guild_id || MAIN_GUILD_ID;
  const memberRoles = interaction.member?.roles || [];
  let hasRole = memberRoles.includes(roleId);

  // In DMs we don't get member.roles from the interaction payload directly,
  // so fetch current roles from the guild to know whether to add or remove.
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
  const action = hasRole ? 'removed' : 'added';
  return jsonResponse({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: hasRole
        ? `✅ Removed **${role?.label}** role!`
        : `✅ Added **${role?.label}** role! You'll now get notified.`,
      flags: 64 // ephemeral
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
    await sendLog(env, { userId, username, channelId, action, reason: l1.reason, layer: 'Layer 1 (Regex)', confidence: l1.confidence, message: content });
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
