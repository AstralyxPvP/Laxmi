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
// OFFENSIVE WORD LIST (Used strictly for Layer 1 Regex)
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

  // Short/ambiguous words — require a real word boundary
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
  // Describing moderation categories instead of dumping explicit words to prevent Google API prompt filtering
  const prompt = `You are the moderation AI for AstralyxPvP, an Indian Minecraft Java PvP Discord server. You are the PRIMARY filter — a lightweight regex pre-check runs before you and only catches exact plain-text matches, so assume obfuscated or borderline messages will reach you and it's your job to catch them.

CATEGORIES OF VIOLATIONS TO WATCH FOR:
- Severe profanity, vulgarity, or obscenity (in English, Hindi, or Hinglish).
- Evasion/Obfuscation of toxic words: leetspeak (numbers/symbols replacing letters like f1ck, @ss, sh!t, b!tch), spaced-out letters (f u c k), punctuation separation (f.u.c.k, f_u_c_k), repeated-letter stretching (fuuuuck, shiiiit), or phonetic misspellings.
- Hate speech, racial/ethnic/religious slurs, targeted harassment, or toxic abuse.
- Sexual, vulgar, or NSFW terms, including requests for explicit photos or content.
- Server/Discord advertising (invite links, "join my server", "join my disc", etc.) — unless posted by staff.
- Staff impersonation (claiming to be admin, mod, or staff when not).
- Threats of violence, toxic behavior, or encouraging self-harm (e.g., kys / end yourself).

DO NOT FLAG:
- Mild frustration ("this is annoying", "ugh"), casual banter, or harmless excitement.
- Terms like "mc" or "bc" when clearly referring to Minecraft or "because" in context.
- Light words like "idiot", "moron", "sala" when used casually without malicious intent between players.

Message to evaluate: "${text}"

Respond ONLY with JSON (no markdown, no extra text, no comments): {"flagged": true/false, "reason": "short reason or null", "confidence": "high/medium/low"}
`;
  const modelChain = [
    env.GEMMA_MODEL || 'gemma-4-26b-a4b-it',
    'gemma-3-27b-it',
    env.GEMINI_MODEL || 'gemini-3.1-flash-lite-preview',
  ];

  // Relaxed safety settings to prevent API-level pre-blocking of user-submitted text
  const safetySettings = [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
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
          { name: 'Message', value: '