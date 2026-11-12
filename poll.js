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
7. Do not repeat generic questions like "favourite colour" unless there is a PvP twist.
8. Avoid mentioning other servers, cheat clients, or anything that breaks rules.
9. Use light desi-gamer humour when it fits, but keep it understandable for everyone.

Return JSON only.`;

const LEADING_EMOJI = /^(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)\s*/u;

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

async function generatePollWithGemini(env, userPrompt) {
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
              temperature: 1.0,
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

async function generatePollWithGroq(env, userPrompt) {
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
          temperature: 0.9,
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

async function generatePollWithAI(env, pollNumber, preferredProvider) {
  const userPrompt = `Create QOTD#${pollNumber} for ${new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })}. Pick a fresh, engaging PvP/server topic that has not been asked recently.`;

  const providers = preferredProvider === 'groq'
    ? [generatePollWithGroq, generatePollWithGemini]
    : [generatePollWithGemini, generatePollWithGroq];

  for (const provider of providers) {
    const poll = await provider(env, userPrompt);
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

function getFallbackPoll(pollNumber) {
  const dayIndex = Math.floor(Date.now() / 86400000);
  const base = FALLBACK_POLLS[dayIndex % FALLBACK_POLLS.length];
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
  const generated = await generatePollWithAI(env, nextNumber, provider);
  if (generated) return { source: generated.provider, ...generated };
  return { source: 'fallback', ...getFallbackPoll(nextNumber) };
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

  const pollNumber = await getNextPollNumber(env);
  const generated = await generatePollWithAI(env, pollNumber);
  let poll = generated;
  let source = 'ai';

  if (!poll) {
    poll = getFallbackPoll(pollNumber);
    source = 'fallback';
  } else {
    source = `${generated.provider}:${generated.model}`;
  }

  const message = await postPoll(QOTD_CHANNEL_ID, poll, env);
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
