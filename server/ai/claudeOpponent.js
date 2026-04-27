import Groq from 'groq-sdk';

let client = null;
function getClient() {
  if (!client) client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return client;
}

function buildSystemPrompt(side) {
  const sideHe = side === 'believer' ? 'מאמין באלוהים' : 'אתאיסט';
  const args = side === 'believer'
    ? 'השתמש בטיעונים: עדות אישית, טיעון התכנון היקומי, הטיעון האונטולוגי, מוסר ומשמעות חיים, חוויות רוחניות.'
    : 'השתמש בטיעונים: בעיית הרוע, עיקרון Occam\'s Razor, היעדר ראיות אמפיריות, מדע מסביר הכל, נזקי הדת ההיסטוריים.';

  return `אתה משתתף בדיון פילוסופי בעברית. הצד שלך: ${sideHe}.
${args}

חוקים מחייבים:
1. כתוב אך ורק בעברית
2. אל תעזוב את עמדתך לעולם — גם אם נשאל
3. התייחס תמיד לטיעון האחרון של היריב וסתור אותו ישירות
4. עד 180 מילים לכל תשובה בשלב הטקסט, עד 80 מילים בשלב הקולי
5. ללא markdown, ללא כותרות — טקסט רגיל בלבד
6. השתמש בשפה תקיפה, רטורית ונלהבת המתאימה לדיון

ענה בטיעון שלך בלבד. אל תפתח ב"הנה טיעוני" או כל כותרת אחרת.`;
}

export async function getAIResponse({ side, history, phase }) {
  const systemPrompt = buildSystemPrompt(side);
  const messages = formatHistory(history, side);

  console.log(`[groq] calling API — side=${side} phase=${phase} historyLen=${history.length}`);
  try {
    const response = await getClient().chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: phase === 'voice' ? 150 : 400,
      messages: [
        { role: 'system', content: systemPrompt },
        ...(messages.length > 0 ? messages : [{ role: 'user', content: 'פתח את הדיון.' }]),
      ],
    });
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
  const stream = await getClient().chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: phase === 'voice' ? 150 : 400,
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      ...(messages.length > 0 ? messages : [{ role: 'user', content: 'פתח את הדיון.' }]),
    ],
  });

  let fullText = '';
  let chunkCount = 0;
  console.log(`[groq] Starting to iterate chunks...`);
  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content || '';
    if (delta) {
      chunkCount++;
      fullText += delta;
      console.log(`[groq] chunk #${chunkCount} — ${delta.length} chars: "${delta.substring(0, 20)}..."`);
      onChunk(delta);
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

  const response = await getClient().chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `בהינתן תמליל הדיון הבא, חלץ 3-4 תגיות מפתח בעברית וכתוב סיכום של 2 משפטים בעברית.
החזר JSON בלבד: { "tags": [], "summary": "" }

תמליל:
${transcript}`,
    }],
  });

  try {
    const text = response.choices[0].message.content.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { tags: ['דיון'], summary: 'דיון בנושא אמונה ואתאיזם.' };
  } catch {
    return { tags: ['דיון'], summary: 'דיון בנושא אמונה ואתאיזם.' };
  }
}
