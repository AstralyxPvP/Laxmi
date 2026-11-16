/**
 * DesiBot — Daily QOTD Poll Engine
 * Runs inside the main `laxmi` Worker via a cron trigger so it can reuse the
 * existing Discord/AI secrets (secrets are per-Worker and cannot be shared).
 *
 * Schedule: 30 8 * * *  →  08:30 UTC  →  2:00 PM IST
 */

const QOTD_CHANNEL_ID = '1477272501699481642';
const POLLS_ROLE_ID = '1500206496535937195';
const MAIN_GUILD_ID = '1477025023800901766';
const DISCORD_API = 'https://discord.com/api/v10';

const KV_COUNTER = 'qotd:counter';
const KV_LAST_DATE = 'qotd:last_date';
const KV_RECENT_POLLS = 'qotd:recent';
const RECENT_POLL_LIMIT = 30;

const SERVER_CONTEXT = `AstralyxPvP is a free India-based Java 1.9+ FFA Minecraft PvP server.
Game modes: Sword FFA, Mace PvP, Netherite Pot, Lifesteal, Crystal PvP, Sumo, and 1v1 arenas.
Features: custom ELO system with live leaderboards, vote keys, crates, cosmetics, PvP bots.
Community: players from India and Europe, cracked/offline-mode clients supported, founded April 2026.
Vibe: competitive but friendly, Hindi/English mix, memes, and lots of 1v1s.`;

const FALLBACK_POLLS = [
  {
    question: 'Which PvP game mode on AstralyxPvP do you main?',
    answers: [
      { emoji: '⚔️', text: 'Sword FFA' },
      { emoji: '🔨', text: 'Mace PvP FFA' },
      { emoji: '🛡️', text: 'Netherite Pot FFA' },
      { emoji: '💎', text: 'Crystal PvP FFA' },
      { emoji: '🥊', text: 'Sumo FFA' },
      { emoji: '❤️', text: 'Lifesteal PvP' },
      { emoji: '🎯', text: '1v1 Arenas' },
    ],
    durationHours: 24,
  },
  {
    question: 'When do you usually hop on AstralyxPvP?',
    answers: [
      { emoji: '🌅', text: 'Morning (6–10 AM)' },
      { emoji: '☀️', text: 'Midday (10 AM–2 PM)' },
      { emoji: '🌤️', text: 'Afternoon (2–6 PM)' },
      { emoji: '🌆', text: 'Evening (6–10 PM)' },
      { emoji: '🌙', text: 'Late night (10 PM–2 AM)' },
      { emoji: '🌑', text: 'I am always online' },
    ],
    durationHours: 24,
  },
  {
    question: 'What should we add or improve next on the server?',
    answers: [
      { emoji: '🗺️', text: 'New arena maps' },
      { emoji: '⚔️', text: 'More game modes' },
      { emoji: '🎨', text: 'More cosmetics' },
      { emoji: '🏆', text: 'More tournaments' },
      { emoji: '🎁', text: 'Better crates / rewards' },
      { emoji: '🤖', text: 'Smarter PvP bots' },
      { emoji: '📊', text: 'Better stats & ELO pages' },
    ],
    durationHours: 48,
  },
  {
    question: 'What is your go-to kit for a 1v1?',
    answers: [
      { emoji: '🗡️', text: 'Netherite sword + shield' },
      { emoji: '🔱', text: 'Trident (Riptide)' },
      { emoji: '🏹', text: 'Bow / crossbow spam' },
      { emoji: '🧪', text: 'Potions and pearls' },
      { emoji: '💥', text: 'Crystals + obsidian' },
      { emoji: '🛡️', text: 'Full tank, no damage' },
    ],
    durationHours: 24,
  },
  {
    question: 'Would you rather… (hardest PvP choice)',
    answers: [
      { emoji: '🟢', text: 'Perfect ping, bad aim' },
      { emoji: '🔴', text: 'Perfect aim, 300 ms ping' },
      { emoji: '⚫', text: 'Max gear, no skill' },
      { emoji: '⚪', text: 'No gear, max skill' },
    ],
    durationHours: 24,
  },
];

const AI_SYSTEM_PROMPT = `You create one daily poll (QOTD) for the AstralyxPvP Discord server.

SERVER CONTEXT:
${SERVER_CONTEXT}

RULES:
1. The poll must be safe for a general audience and follow normal community rules.
2. Never ask about politics, religion, caste, gender, sexuality, real-life violence, or anything divisive.
3. Prefer Minecraft PvP / server / gaming-humour topics. A fun "would you rather" is fine.
4. Keep the question under 200 characters and clearly answerable with one vote.
5. Give 4 to 8 answers. Each answer text must be under 50 characters and feel distinct.
6. Prefix every answer with one fitting unicode emoji.
7. Never repeat or closely paraphrase any recent QOTD question supplied by the user. Pick a clearly different topic and angle. Do not repeat generic questions like "favourite colour" unless there is a PvP twist.
8. Avoid mentioning other servers, cheat clients, or anything that breaks rules.
9. Use light desi-gamer humour when it fits, but keep it understandable for everyone.

Return JSON only.`;

const LEADING_EMOJI = /^(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)\s*/u;

const QUESTION_STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'do', 'does', 'did', 'doing', 'have', 'has', 'had', 'having',
  'i', 'you', 'your', 'yours', 'u', 'ur', 'we', 'our', 'ours',
  'they', 'their', 'theirs', 'he', 'she', 'it', 'him', 'her', 'his',
  'hers', 'its', 'them', 'me', 'my', 'mine', 'us',
  'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom',
  'whose', 'when', 'where', 'why', 'how', 'on', 'in', 'at', 'to',
  'for', 'of', 'with', 'about', 'from', 'by', 'as', 'and', 'or',
  'but', 'if', 'then', 'than', 'so', 'such', 'can', 'could', 'would',
  'should', 'will', 'shall', 'may', 'might', 'must', 'am', 's', 't',
  'just', 'really', 'most', 'more', 'best', 'favorite', 'favourite',
  'like', 'prefer', 'think', 'feel', 'choose', 'pick',
  'qotd', 'astralyxpvp', 'astralyx', 'pvp', 'minecraft', 'mc', 'server',
]);

function normalizeQuestion(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/^qotd\s*#\s*\d+\s*:?\s*/i, '')
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function questionKeywords(text) {
  const normalized = normalizeQuestion(text);
  if (!normalized) return new Set();
  return new Set(
    normalized
      .split(' ')
      .filter(word => word.length > 1 && !QUESTION_STOP_WORDS.has(word)),
  );
}

function isSameOrSimilarQuestion(a, b) {
  const normalizedA = normalizeQuestion(a);
  const normalizedB = normalizeQuestion(b);
  if (!normalizedA || !normalizedB) return false;
  if (normalizedA === normalizedB) return true;

  const keywordsA = questionKeywords(a);
  const keywordsB = questionKeywords(b);
  if (!keywordsA.size || !keywordsB.size) return false;

  let intersection = 0;
  for (const word of keywordsA) {
    if (keywordsB.has(word)) intersection += 1;
  }
  const union = new Set([...keywordsA, ...keywordsB]).size;
  const jaccard = intersection / union;
  const overlap = intersection / Math.min(keywordsA.size, keywordsB.size);
  return jaccard >= 0.5 || overlap >= 0.8;
}

function mergePollHistory(...lists) {
  const byQuestion = new Map();

  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      if (!entry || typeof entry.question !== 'string') continue;
      const key = normalizeQuestion(entry.question);
      if (!key) continue;

      const existing = byQuestion.get(key);
      if (!existing || String(entry.date || '') > String(existing.date || '')) {
        byQuestion.set(key, {
          question: String(entry.question).trim(),
          answers: Array.isArray(entry.answers)
            ? entry.answers.filter(answer => typeof answer === 'string').slice(0, 10)
            : [],
          date: entry.date || null,
          pollNumber: entry.pollNumber || existing?.pollNumber || null,
          source: entry.source || existing?.source || null,
        });
      }
    }
  }

  return [...byQuestion.values()]
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
    .slice(-RECENT_POLL_LIMIT);
}

async function readStoredPollHistory(env) {
  try {
    const raw = await env.LAXMI_KV.get(KV_RECENT_POLLS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[qotd] history read failed:', err.message);
    return [];
  }
}

async function savePollHistory(env, history) {
  try {
    await env.LAXMI_KV.put(KV_RECENT_POLLS, JSON.stringify(history.slice(-RECENT_POLL_LIMIT)));
  } catch (err) {
    console.error('[qotd] history write failed:', err.message);
  }
}

async function fetchRecentDiscordPolls(env, limit = 100) {
  try {
    const res = await fetch(`${DISCORD_API}/channels/${QOTD_CHANNEL_ID}/messages?limit=${limit}`, {
      headers: { Authorization: `Bot ${env.DISCORD_TOKEN}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[qotd] history fetch HTTP ${res.status}: ${body.slice(0, 300)}`);
      return [];
    }

    const messages = await res.json();
    return (Array.isArray(messages) ? messages : [])
      .filter(message => message?.poll?.question?.text)
      .map(message => ({
        question: message.poll.question.text,
        answers: (message.poll.answers || [])
          .map(answer => answer?.poll_media?.text)
          .filter(Boolean),
        date: message.timestamp || null,
      }))
      .reverse();
  } catch (err) {
    console.error('[qotd] history fetch failed:', err.message);
    return [];
  }
}

async function getRecentPollHistory(env, { refresh = false } = {}) {
  const stored = await readStoredPollHistory(env);
  const shouldRefresh = refresh || stored.length < Math.min(RECENT_POLL_LIMIT, 10);
  const fromDiscord = shouldRefresh ? await fetchRecentDiscordPolls(env) : [];
  const merged = mergePollHistory(stored, fromDiscord);

  if (fromDiscord.length > 0 && merged.length !== stored.length) {
    await savePollHistory(env, merged);
  }
  if (merged.length === 0) {
    console.warn('[qotd] no recent poll history available; duplicate prevention is limited');
  }
  return merged;
}

function formatRecentQuestions(history) {
  if (!Array.isArray(history) || history.length === 0) return '';

  const list = history
    .slice(-RECENT_POLL_LIMIT)
    .reverse()
    .map((entry, index) => {
      const options = Array.isArray(entry.answers)
        ? entry.answers
          .filter(answer => typeof answer === 'string' && answer.trim())
          .slice(0, 6)
          .join('; ')
        : '';
      return `${index + 1}. ${entry.question}${options ? ` (options: ${options})` : ''}`;
    })
    .join('\n');

  return `\n\nRECENT QOTD QUESTIONS (already used — do NOT repeat, rephrase, or pick the same topic/answer themes):\n${list}`;
}

function sanitizeAnswers(answers) {
  if (!Array.isArray(answers)) return [];

  return answers
    .map(raw => {
      if (typeof raw === 'string') return { emoji: '', text: raw };
      if (raw && typeof raw === 'object' && typeof raw.text === 'string') {
        return { emoji: typeof raw.emoji === 'string' ? raw.emoji : '', text: raw.text };
      }
      return null;
    })
    .filter(a => a && a.text.trim())
    .slice(0, 10)
    .map(a => {
      let text = a.text.trim();
      let emoji = a.emoji.trim();

      // Some models (e.g. gpt-oss) return emojis inside the text with an empty emoji field.
      if (!emoji) {
        const match = text.match(LEADING_EMOJI);
        if (match) {
          emoji = match[1];
          text = text.slice(match[0].length).trim();
        }
      }

      return {
        emoji: emoji ? emoji.slice(0, 8) : '⚪',
        text: text.slice(0, 55),
      };
    })
    .filter(a => a.text);
}

function parsePollJson(raw) {
  let cleaned = String(raw).replace(/```json|```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) cleaned = match[0];

  const parsed = JSON.parse(cleaned);
  const answers = sanitizeAnswers(parsed.answers || []);
  if (!parsed.question || answers.length < 2) return null;

  const rawDuration = Number(parsed.duration_hours ?? parsed.durationHours);
  return {
    question: String(parsed.question).trim().slice(0, 300),
    answers,
    durationHours: [24, 48, 72].includes(rawDuration) ? rawDuration : 24,
  };
}

const GROQ_MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'];

async function generatePollWithGemini(env, userPrompt, temperature = 1.0) {
  const models = [
    env.GEMINI_MODEL || 'gemini-3.5-flash-lite-preview',
    'gemini-3.1-flash-lite-preview',
    'gemini-2.5-flash-lite',
  ];

  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GOOGLE_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            systemInstruction: { parts: [{ text: AI_SYSTEM_PROMPT }] },
            generationConfig: {
              temperature: Math.min(1.4, temperature),
              maxOutputTokens: 600,
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'OBJECT',
                properties: {
                  question: { type: 'STRING' },
                  answers: {
                    type: 'ARRAY',
                    items: {
                      type: 'OBJECT',
                      properties: {
                        emoji: { type: 'STRING' },
                        text: { type: 'STRING' },
                      },
                      required: ['emoji', 'text'],
                    },
                  },
                  duration_hours: { type: 'INTEGER' },
                },
                required: ['question', 'answers', 'duration_hours'],
              },
            },
          }),
        },
      );

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.error(`[qotd] ${model} HTTP ${res.status}: ${body.slice(0, 400)}`);
        continue;
      }

      const data = await res.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!raw) continue;

      const poll = parsePollJson(raw);
      if (!poll) continue;
      return { ...poll, model };
    } catch (err) {
      console.error(`[qotd] ${model} failed:`, err.message);
    }
  }

  return null;
}

async function generatePollWithGroq(env, userPrompt, temperature = 0.9) {
  if (!env.GROQ_API_KEY) return null;

  for (const model of GROQ_MODELS) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: AI_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          reasoning_effort: 'low',
          temperature: Math.min(1.4, temperature),
          max_completion_tokens: 1500,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.error(`[qotd] groq ${model} HTTP ${res.status}: ${body.slice(0, 400)}`);
        continue;
      }

      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content;
      if (!raw) continue;

      const poll = parsePollJson(raw);
      if (!poll) continue;
      return { ...poll, model };
    } catch (err) {
      console.error(`[qotd] groq ${model} failed:`, err.message);
    }
  }

  return null;
}

async function generatePollWithAI(env, pollNumber, preferredProvider, recentHistory = [], avoidQuestion = null, attempt = 0) {
  const baseTemperature = preferredProvider === 'groq' ? 0.9 : 1.0;
  const temperature = Math.min(1.4, baseTemperature + attempt * 0.15);
  const avoidNote = avoidQuestion
    ? `\n\nThe previous attempt "${avoidQuestion}" was too similar to an existing QOTD. Generate a completely different topic and angle. Do not reuse its key words.`
    : '';

  const userPrompt = `Create QOTD#${pollNumber} for ${new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })}. Pick a fresh, engaging PvP/server topic that has not been asked recently.${formatRecentQuestions(recentHistory)}${avoidNote}`;

  const providers = preferredProvider === 'groq'
    ? [generatePollWithGroq, generatePollWithGemini]
    : [generatePollWithGemini, generatePollWithGroq];

  for (const provider of providers) {
    const poll = await provider(env, userPrompt, temperature);
    if (poll) {
      return {
        question: poll.question,
        answers: poll.answers,
        durationHours: poll.durationHours,
        provider: provider === generatePollWithGroq ? 'groq' : 'gemini',
        model: poll.model,
      };
    }
  }

  return null;
}

async function generateUniquePoll(env, pollNumber, preferredProvider, history = []) {
  let avoidQuestion = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const poll = await generatePollWithAI(
      env,
      pollNumber,
      preferredProvider,
      history,
      avoidQuestion,
      attempt,
    );
    if (!poll) return null;

    const similar = history.find(entry => isSameOrSimilarQuestion(poll.question, entry.question));
    if (!similar) return poll;

    console.warn(
      `[qotd] rejected similar poll (attempt ${attempt + 1}): "${poll.question}" ~ "${similar.question}"`,
    );
    avoidQuestion = poll.question;
  }

  return null;
}

function getFallbackPoll(pollNumber, history = []) {
  const dayIndex = Math.floor(Date.now() / 86400000);
  const start = dayIndex % FALLBACK_POLLS.length;

  for (let i = 0; i < FALLBACK_POLLS.length; i += 1) {
    const base = FALLBACK_POLLS[(start + i) % FALLBACK_POLLS.length];
    const question = `QOTD#${pollNumber}: ${base.question}`;
    if (!history.some(entry => isSameOrSimilarQuestion(question, entry.question))) {
      return { question, answers: base.answers, durationHours: base.durationHours };
    }
  }

  const base = FALLBACK_POLLS[start];
  return {
    question: `QOTD#${pollNumber}: ${base.question}`,
    answers: base.answers,
    durationHours: base.durationHours,
  };
}

async function getNextPollNumber(env) {
  try {
    const raw = await env.LAXMI_KV.get(KV_COUNTER);
    const next = (raw ? parseInt(raw, 10) || 0 : 0) + 1;
    await env.LAXMI_KV.put(KV_COUNTER, String(next));
    return next;
  } catch (err) {
    console.error('[qotd] counter failed:', err.message);
    return Math.floor(Date.now() / 86400000);
  }
}

async function discordPost(path, payload, env) {
  const res = await fetch(`${DISCORD_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Discord ${path} → ${res.status} ${body.slice(0, 300)}`);
  }
  return res.json();
}

async function postPoll(channelId, poll, env) {
  return discordPost(`/channels/${channelId}/messages`, {
    poll: {
      question: { text: poll.question },
      answers: poll.answers.map(answer => ({
        poll_media: {
          text: answer.text,
          emoji: { name: answer.emoji },
        },
      })),
      duration: poll.durationHours,
      allow_multiselect: false,
      layout_type: 1,
    },
  }, env);
}

async function postRolePing(channelId, env) {
  return discordPost(`/channels/${channelId}/messages`, {
    content: `<@&${POLLS_ROLE_ID}> new poll is up — go vote! 🗳️`,
    allowed_mentions: { parse: [], roles: [POLLS_ROLE_ID] },
  }, env);
}

async function createPollThread(channelId, messageId, threadName, env) {
  return discordPost(`/channels/${channelId}/messages/${messageId}/threads`, {
    name: threadName.slice(0, 100),
    auto_archive_duration: 1440,
  }, env);
}

async function postThreadIntro(threadId, question, env) {
  return discordPost(`/channels/${threadId}/messages`, {
    content: [
      '💬 **Discussion thread**',
      '',
      'Vote on the poll, then drop your reasoning here. Keep it friendly — no arguing to the point of toxicity.',
      '',
      `> ${question}`,
    ].join('\n'),
    allowed_mentions: { parse: [] },
  }, env);
}

async function logToChannel(env, embed) {
  if (!env.LOG_CHANNEL_ID) return;
  try {
    await discordPost(`/channels/${env.LOG_CHANNEL_ID}/messages`, { embeds: [embed] }, env);
  } catch (err) {
    console.error('[qotd] log channel failed:', err.message);
  }
}

/**
 * Generate a poll without posting anything to Discord.
 */
export async function previewPoll(env, provider) {
  const raw = await env.LAXMI_KV.get(KV_COUNTER).catch(() => null);
  const nextNumber = (raw ? parseInt(raw, 10) || 0 : 0) + 1;
  const history = await getRecentPollHistory(env);
  const generated = await generateUniquePoll(env, nextNumber, provider, history);
  if (generated) return { source: generated.provider, ...generated };
  return { source: 'fallback', ...getFallbackPoll(nextNumber, history) };
}

/**
 * Generate and publish one QOTD poll.
 * @param {object} env Worker env bindings
 * @param {{ force?: boolean, skipDailyGuard?: boolean }} options
 */
export async function runPollGeneration(env, options = {}) {
  const today = new Date().toISOString().slice(0, 10);

  if (!options.force) {
    try {
      const last = await env.LAXMI_KV.get(KV_LAST_DATE);
      if (last === today) {
        return { skipped: true, reason: `QOTD already posted for ${today}` };
      }
    } catch (err) {
      console.error('[qotd] date guard failed:', err.message);
    }
  }

  const history = await getRecentPollHistory(env, { refresh: true });
  const pollNumber = await getNextPollNumber(env);
  const generated = await generateUniquePoll(env, pollNumber, undefined, history);
  let poll = generated;
  let source = 'ai';

  if (!poll) {
    poll = getFallbackPoll(pollNumber, history);
    source = 'fallback';
  } else {
    source = `${generated.provider}:${generated.model}`;
  }

  const message = await postPoll(QOTD_CHANNEL_ID, poll, env);

  await savePollHistory(env, mergePollHistory(history, [{
    question: poll.question,
    answers: poll.answers.map(answer => answer.text),
    date: new Date().toISOString(),
    pollNumber,
    source,
  }]));

  const roleMessage = await postRolePing(QOTD_CHANNEL_ID, env);
  const thread = await createPollThread(
    QOTD_CHANNEL_ID,
    message.id,
    `QOTD#${pollNumber} Discussion`,
    env,
  );
  await postThreadIntro(thread.id, poll.question, env);

  try {
    await env.LAXMI_KV.put(KV_LAST_DATE, today);
  } catch (err) {
    console.error('[qotd] failed to store date:', err.message);
  }

  await logToChannel(env, {
    title: '📊 Daily QOTD Posted',
    description: `**QOTD#${pollNumber}** published successfully.`,
    color: 0x57F287,
    fields: [
      { name: 'Question', value: poll.question.slice(0, 1024), inline: false },
      { name: 'Options', value: String(poll.answers.length), inline: true },
      { name: 'Duration', value: `${poll.durationHours}h`, inline: true },
      { name: 'Source', value: source, inline: true },
      { name: 'Poll', value: `[Jump](https://discord.com/channels/${MAIN_GUILD_ID}/${QOTD_CHANNEL_ID}/${message.id})`, inline: true },
      { name: 'Thread', value: `<#${thread.id}>`, inline: true },
    ],
    timestamp: new Date().toISOString(),
    footer: { text: 'DesiBot • AstralyxPvP' },
  });

  return {
    skipped: false,
    pollNumber,
    source,
    question: poll.question,
    answerCount: poll.answers.length,
    durationHours: poll.durationHours,
    messageId: message.id,
    roleMessageId: roleMessage.id,
    threadId: thread.id,
  };
}
