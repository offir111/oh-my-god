import Groq from 'groq-sdk';
import { chatCompletionWithFallback, streamCompletionWithFallback } from '../lib/groqChat.js';

let client = null;
function getClient() {
  if (!client) {
    client = new Groq({
      apiKey: process.env.GROQ_API_KEY,
      timeout: 120_000,
      maxRetries: 2,
    });
  }
  return client;
}

/**
 * Builds the system prompt for the AI opponent.
 * @param {string} side - 'believer' | 'atheist'
 * @param {object|null} virtualUser - optional virtual user persona from virtualUsers.js
 * @param {boolean} isIntro - if true, ask the AI to introduce itself first
 */
function buildSystemPrompt(side, virtualUser = null, isIntro = false) {
  if (virtualUser?.systemPrompt) {
    const introLine = isIntro
      ? '\nבהודעה הראשונה: הצג את עצמך בחמימות (שם, גיל, עיר, עיסוק) ואז פתח את הדיון. עד 65 מילים.'
      : '';
    return `${virtualUser.systemPrompt}${introLine}

חוקי דיון:
1. כתוב בעברית טבעית
2. התייחס לדברי המשתמש ישירות
3. עד 60 מילים — תשובה תמציתית, סיים משפט שלם
4. ללא markdown, ללא כותרות
5. אל תפתח ב"הנה" או "בוודאי"`;
  }

  const persona = side === 'believer'
    ? 'אתה בן שיח מאמין — מגן על ערכי אמונה ודת בשיחה'
    : 'אתה בן שיח חילוני — מגן על השקפת עולם מדעית ורציונלית בשיחה';

  return `${persona}.

הנחיות:
1. כתוב בעברית
2. התייחס לדברי המשתמש בצורה ענינית וישירה
3. ענה על כל שאלה או נושא שהמשתמש מעלה — שיחה חופשית
4. עד 50 מילים בלבד — תשובה תמציתית, סיים משפט שלם
5. ללא markdown, ללא כותרות — טקסט רציף בלבד
6. אל תפתח ב"הנה" או "בוודאי" — קפוץ ישירות לתגובה`;
}

export async function getAIResponse({ side, history, phase, virtualUser = null }) {
  const isIntro = history.length === 0 && !!virtualUser;
  const systemPrompt = buildSystemPrompt(side, virtualUser, isIntro);
  const messages = formatHistory(history, side);

  const logName = virtualUser ? virtualUser.username : side;
  console.log(`[groq] calling API — persona=${logName} phase=${phase} historyLen=${history.length}`);
  try {
    const response = await chatCompletionWithFallback(
      getClient(),
      {
        max_tokens: 200,
        messages: [
          { role: 'system', content: systemPrompt },
          ...(messages.length > 0 ? messages : [{ role: 'user', content: 'פתח את הדיון.' }]),
        ],
      },
      'groq-turn',
    );
    const text = response.choices[0].message.content.trim();
    console.log(`[groq] response OK — ${text.slice(0, 60)}...`);
    return text;
  } catch (e) {
    console.error('[groq] API error:', e.status, e.message);
    throw e;
  }
}

export async function streamAIResponse({ side, history, phase, virtualUser = null }, onChunk) {
  const isIntro = history.length === 0 && !!virtualUser;
  const systemPrompt = buildSystemPrompt(side, virtualUser, isIntro);
  const messages = formatHistory(history, side);

  const logName = virtualUser ? virtualUser.username : side;
  console.log(`[groq] STREAM START — persona=${logName} phase=${phase} historyLen=${history.length}`);
  const stream = await streamCompletionWithFallback(
    getClient(),
    {
      max_tokens: 200,
      messages: [
        { role: 'system', content: systemPrompt },
        ...(messages.length > 0 ? messages : [{ role: 'user', content: 'פתח את הדיון.' }]),
      ],
    },
    'groq-stream',
  );
  let fullText = '';
  let chunkCount = 0;
  console.log(`[groq] Starting to iterate chunks...`);
  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content || '';
    if (delta) {
      chunkCount++;
      fullText += delta;
      console.log(`[groq] chunk #${chunkCount} — ${delta.length} chars: "${delta.substring(0, 20)}..."`);
      await onChunk(delta);
    }
  }
  console.log(`[groq] stream FINISHED — ${chunkCount} chunks, ${fullText.length} total chars`);
  return fullText.trim();
}

function formatHistory(messages, aiSide) {
  return messages.map(m => ({
    role: m.side === aiSide ? 'assistant' : 'user',
    content: m.content || `[הודעה קולית - ${m.duration || '?'} שניות]`,
  }));
}

export async function generateDebateSummary(messages) {
  const transcript = messages
    .map(m => `${m.side === 'believer' ? 'מאמין' : 'אתאיסט'}: ${m.content || '[הודעה קולית]'}`)
    .join('\n');

  const response = await chatCompletionWithFallback(
    getClient(),
    {
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `בהינתן תמליל הדיון הבא, חלץ 3-4 תגיות מפתח בעברית וכתוב סיכום של 2 משפטים בעברית.
החזר JSON בלבד: { "tags": [], "summary": "" }

תמליל:
${transcript}`,
      }],
    },
    'groq-summary',
  );

  try {
    const text = response.choices[0].message.content.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { tags: ['דיון'], summary: 'דיון בנושא אמונה ואתאיזם.' };
  } catch {
    return { tags: ['דיון'], summary: 'דיון בנושא אמונה ואתאיזם.' };
  }
}
