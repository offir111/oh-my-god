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

function buildSystemPrompt(side) {
  const topic = side === 'believer'
    ? 'קיום אלוהים — הצג את הטיעונים המרכזיים התומכים באמונה'
    : 'קיום אלוהים — הצג את הטיעונים המרכזיים הסוקרים את הספקנות והאתאיזם';

  return `אתה AI שמנחה דיון פילוסופי בעברית בנושא: ${topic}.

חוקים מחייבים:
1. כתוב אך ורק בעברית
2. כתוב מנקודת מבט ניטרלית ואנליטית — לא בגוף ראשון, לא "אני מאמין" או "אני חושב"
3. הצג טיעונים עובדתיים, פילוסופיים והיסטוריים בצורה מעמיקה ומפורטת
4. התייחס לדברי המשתמש וסתור או הרחב אותם בצורה ענינית
5. עד 50 מילים בלבד — תשובה תמציתית ומנומקת, סיים משפט שלם
6. ללא markdown, ללא כותרות, ללא נקודות — פסקאות רציפות בלבד
7. אל תפתח ב"הנה" או "בוודאי" — קפוץ ישירות לטיעון המנומק

דוגמה לסגנון: "הטיעון האונטולוגי קורס כי קיום אינו תכונה לוגית — כך הפריך קאנט את אנסלם במאה ה-18. הפילוסוף הגרמני טען שמהעובדה שניתן להעלות על הדעת ישות מושלמת, אין להסיק שהיא בהכרח קיימת במציאות, שכן קיום הוא עובדה אמפירית ולא הכרחיות לוגית."`;
}

export async function getAIResponse({ side, history, phase }) {
  const systemPrompt = buildSystemPrompt(side);
  const messages = formatHistory(history, side);

  console.log(`[groq] calling API — side=${side} phase=${phase} historyLen=${history.length}`);
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

export async function streamAIResponse({ side, history, phase }, onChunk) {
  const systemPrompt = buildSystemPrompt(side);
  const messages = formatHistory(history, side);

  console.log(`[groq] STREAM START — side=${side} phase=${phase} historyLen=${history.length}`);
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
