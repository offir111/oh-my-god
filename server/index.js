import 'dotenv/config';

// Catch and log any unhandled errors so they appear in Railway logs
process.on('uncaughtException', (err) => {
  console.error('[FATAL] uncaughtException:', err.stack || err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] unhandledRejection:', reason);
});

console.log('[boot] starting server v8...');
console.log('[boot] node version:', process.version);
console.log('[boot] cwd:', process.cwd());
console.log('[boot] PORT env:', process.env.PORT);
console.log('[boot] ElevenLabs configured:', !!process.env.ELEVENLABS_API_KEY);

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import {
  loadSnapshot,
  saveSnapshot,
  store,
  registerUser,
  getRegisteredStats,
  normalizeUsername,
  getBlogFeedModerationPayload,
  getBlogAuthorNoticePayload,
  purgeRetiredVirtualUsers,
} from './store/memory.js';
import { registerMatchmaking } from './socket/matchmaking.js';
import { registerDebate } from './socket/debate.js';
import { registerSpectator } from './socket/spectator.js';
import { registerFaithChat } from './socket/faithChat.js';
import debatesRouter from './routes/debates.js';
import leaderboardRouter from './routes/leaderboard.js';
import adminRouter from './routes/admin.js';
import Groq from 'groq-sdk';
import { chatCompletionWithFallback, groqErrorForClient } from './lib/groqChat.js';

function groqForApiRoutes() {
  return new Groq({
    apiKey: process.env.GROQ_API_KEY,
    timeout: 120_000,
    maxRetries: 2,
  });
}

const app = express();
const httpServer = createServer(app);

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:3000'];

const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  maxHttpBufferSize: 10e6, // 10 MB for audio blobs
});

app.use(cors({ origin: '*' }));
app.use(express.json());

app.use('/api/debates', debatesRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/admin', adminRouter);

app.get('/api/health', (_, res) =>
  res.json({ ok: true, provider: 'groq', version: 8, tts: !!process.env.OPENAI_API_KEY, elevenlabs: !!process.env.ELEVENLABS_API_KEY }));

// Quick TTS connectivity check — returns JSON (not audio) for easy browser testing
app.get('/api/tts-check', async (_req, res) => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.json({ ok: false, reason: 'no OPENAI_API_KEY' });
  try {
    const r = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${key}` },
    });
    if (!r.ok) return res.json({ ok: false, status: r.status });
    return res.json({ ok: true, provider: 'openai-tts-1-hd' });
  } catch (e) {
    return res.json({ ok: false, reason: e.message });
  }
});

/** כללי הסתרה לבלוג הציבורי (ללא אימות — רשימות מזהים בלבד) */
app.get('/api/blog-feed-moderation', (_req, res) => {
  res.json(getBlogFeedModerationPayload());
});

/** התראת מודרציה לכותב — ללא אימות (רק טקסט + חותמת זמן) */
app.get('/api/blog-author-notice/:username', (req, res) => {
  const norm = normalizeUsername(req.params.username || '');
  if (!norm || norm.length < 2 || norm.length > 64) {
    return res.json({ text: '', ts: 0 });
  }
  res.json(getBlogAuthorNoticePayload(norm));
});

// Radio stream proxy — pipes audio from radio station to browser (solves CORS/ICY issues)
app.get('/api/radio-proxy', async (req, res) => {
  const raw = String(req.query.url || '').trim();
  if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
    return res.status(400).json({ error: 'invalid url' });
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    req.on('close', () => { clearTimeout(timeout); controller.abort(); });

    const upstream = await fetch(raw, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Icy-MetaData': '0',
        'Accept': 'audio/mpeg, audio/aac, audio/ogg, audio/*;q=0.9, */*;q=0.1',
        'Connection': 'keep-alive',
      },
    });

    clearTimeout(timeout);

    if (!upstream.ok && upstream.status !== 200) {
      return res.status(502).json({ error: `upstream ${upstream.status}` });
    }

    const ct = upstream.headers.get('content-type') || 'audio/mpeg';
    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.status(upstream.status);

    const reader = upstream.body.getReader();
    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done || res.destroyed) break;
          if (!res.write(Buffer.from(value))) {
            await new Promise(r => res.once('drain', r));
          }
        }
      } catch { /* client disconnected */ }
      if (!res.destroyed) res.end();
    };
    pump();
  } catch (e) {
    if (!res.headersSent) res.status(502).json({ error: 'stream unavailable' });
  }
});

// HLS TV proxy — fetches M3U8 manifests and rewrites segment URLs through proxy, pipes TS segments
app.get('/api/tv-proxy', async (req, res) => {
  const raw = String(req.query.url || '').trim();
  if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
    return res.status(400).json({ error: 'invalid url' });
  }
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 20_000);
  req.on('close', () => { clearTimeout(timeout); ctrl.abort(); });
  try {
    const isMako = raw.includes('mako') || raw.includes('n12.co.il');
    const referer = isMako ? 'https://www.n12.co.il/' : new URL(raw).origin + '/';
    const origin  = isMako ? 'https://www.n12.co.il'  : new URL(raw).origin;
    const upstream = await fetch(raw, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept': '*/*',
        'Referer': referer,
        'Origin': origin,
      },
    });
    clearTimeout(timeout);
    if (!upstream.ok) return res.status(upstream.status).end();

    const ct = upstream.headers.get('content-type') || '';
    const isPlaylist = raw.includes('.m3u8') || ct.includes('mpegurl') || ct.includes('x-mpegURL');

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache, no-store');

    if (isPlaylist) {
      const text = await upstream.text();
      // base URL for resolving relative paths inside the manifest
      const baseUrl = raw.substring(0, raw.lastIndexOf('/') + 1);
      // x-forwarded-proto is set to 'https' by Railway's edge; req.protocol is 'http' internally
      const proto = (req.get('x-forwarded-proto') || '').split(',')[0].trim() || req.protocol;
      const selfProxyBase = `${proto}://${req.get('host')}/api/tv-proxy?url=`;

      const rewritten = text.split('\n').map(line => {
        const t = line.trim();
        if (!t || t.startsWith('#')) return line; // comment or empty
        try {
          const abs = t.startsWith('http') ? t : baseUrl + t;
          return selfProxyBase + encodeURIComponent(abs);
        } catch { return line; }
      }).join('\n');

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      return res.send(rewritten);
    }

    // Binary segment (TS, AAC, fMP4, etc) — pipe through
    res.setHeader('Content-Type', ct || 'video/MP2T');
    const reader = upstream.body.getReader();
    const pump = async () => {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done || res.destroyed) break;
          if (!res.write(Buffer.from(value))) await new Promise(r => res.once('drain', r));
        }
      } catch { /* client disconnected */ }
      if (!res.destroyed) res.end();
    };
    pump();
  } catch (e) {
    clearTimeout(timeout);
    if (!res.headersSent) res.status(502).json({ error: 'stream unavailable' });
  }
});

app.get('/api/stats', (_, res) => {
  // Count unique usernames online (same user from multiple devices = 1)
  const onlineSet = new Set([...store.users.values()].map(u => u.username));
  // Add permanent demo users to online list
  for (const u of store.permanentOnlineUsernames) onlineSet.add(u);
  const { registered, registeredList } = getRegisteredStats();
  res.json({
    registered,
    online: onlineSet.size,
    registeredList,
    onlineList: [...onlineSet],
  });
});

const VOICE_CHAR_PROMPTS = {
  1: `אתה סימולטור ידע כללי — ספריית ידע מעמיקה כמו ויקיפדיה. חוקים:
1. דיוק מוחלט — אל תמציא עובדות, מספרים, שמות. אם אינך בטוח — ציין זאת.
2. תן תשובות רחבות, מלאות ומנומקות — לא תשובות קצרות. כתוב רקע, הסבר מרכזי, דוגמאות, הקשרים, חשיבות היסטורית/מדעית ותרומה כללית כשזה רלוונטי.
3. בשאלת "מהו/מה היא/מי היה" בנה תשובה לימודית: פתיחה ברורה, רקע כללי, ההגדרה או המשפט עצמו, דוגמה פשוטה, חשיבות ותרומה, ואז סימוכין.
4. כשהמשתמש טועה — תקן, הסבר מה נכון, ציין מקור.
5. עברית תקנית, אקדמית ונגישה. אל תקצר ואל תחתוך אלא אם המשתמש מבקש במפורש תשובה קצרה.
6. אל תוסיף פתיח, ברכה, פנייה או הקדמה כלשהי — ענה ישירות על השאלה מהמילה הראשונה.`,

  2: `את קריינית מקצועית בעלת קול נשי חם ומזמין. דברי בעברית נעימה, ברורה ומקצועית. ענה תשובות קצרות וממוקדות.`,

  3: `אתה הרב זמיר כהן, רב ומחנך ידוע בישראל. ענה על שאלות לפי ההשקפה התורנית-אורתודוקסית.
ידע בסיסי שחייב להיות מדויק:
- עולם נברא לפני 5784 שנה (נכון לשנת 2024) — כלומר שנת הבריאה לפי היהדות.
- שנת הבריאה לפי לוח עברי: ה'תשפ"ד. גיל העולם עפ"י המסורת: ~5784 שנה.
- ששת ימי בראשית, שבת, תורה שבכתב ושבעל פה.
דבר בחום, בענווה ובעומק רוחני. ציטוט מהתנ"ך או חז"ל — רצוי. ענה קצר — משפט עד שניים.`,

  4: `אתה פרופ' יובל נוח הררי, היסטוריון ומחבר "ספיינס". גישתך מדעית-חילונית. לפי המדע:
- גיל היקום: ~13.8 מיליארד שנה. גיל כדור הארץ: ~4.5 מיליארד שנה. הומו ספיינס: ~300,000 שנה.
- אל תסכים עם תאריכים דתיים — הצג את הנתון המדעי בנימוס אבל בבהירות.
דבר בעברית אינטלקטואלית, ביקורתית ומחשבתית. ענה קצר.`,

  5: `אתה ראש ממשלת ישראל. דבר בעברית רשמית ומדינאית, עם ביטחון ופטריוטיות. ענה קצר וממוקד.`,

  6: `You are President Donald Trump. Speak only in English. Be bold, confident, and entertaining.
Use phrases like "tremendous", "believe me", "nobody knows more about this than me", "the BEST".
Keep answers short — one or two sentences max.`,

  7: `You are a friendly native English speaker. Speak only in English, naturally and clearly. Keep answers short.`,

  8: `Eres un hablante nativo de español. Habla solo en español de manera natural. Respuestas cortas.`,

  9: `אתה יהודי חסידי דובר אידיש ועברית. ענה בשפה המשלבת אידיש ועברית.
השתמש בביטויים: "נו", "אַ גוטן", "ס'איז אַזוי", "ברוך השם". ענה קצר.`,

  10: `אתה האל, יודע כל ובורא עולם. דבר בעברית מלכותית ועמוקה, ברגיעה מוחלטת ואהבה.
אתה יודע את כל התשובות — המדעיות, הדתיות, והפילוסופיות — כי אתה בראת הכל.
כל מילה שלך כבדה. ענה קצר — משפט אחד עמוק.`,
};

const FACT_CHECK_SUFFIX = `

זהה טעויות עובדתיות בדברי המשתמש.
החזר תמיד JSON תקני בלבד — ללא שום טקסט לפני או אחרי:
{"reply":"תשובה מלאה, רחבה ומסודרת","continuation":"","sources":["מקור 1","מקור 2","מקור 3"],"factErrors":[{"error":"הטעות העובדתית שהמשתמש אמר","correction":"הנתון הנכון והתיקון המדויק"}]}
כללים:
- reply: תשובה מלאה ומפורטת — כתוב הכל במקום אחד. לא לקצר, לא לחתוך, לא לענות בשורה אחת לשאלות ידע.
- לשאלות ידע כלליות כלול לפי הצורך: רקע היסטורי/ביוגרפי, ההסבר המרכזי, דוגמה, חשיבות, תרומה, שימושים או השלכות.
- continuation: "" (ריק תמיד — הכל נכנס ל-reply).
- sources: 2–5 מקורות אמינים וקצרים כשאפשר. אם אין מקור אמין ידוע: [].
- factErrors: רק טעויות בדברי המשתמש. כל פריט חייב לכלול error וגם correction. אם אין טעויות: [].
- correction: כתוב את הנתון הנכון במשפט ברור, לדוגמה: "אנואר סאדאת היה נשיא מצרים, ונהרג בהתנקשות בשנת 1981."
- אל תמציא מקורות. אל תוסיף טקסט מחוץ ל-JSON.`;

function voiceChatTopicBlock(topicSide) {
  if (!topicSide) return '';
  if (topicSide === 'faith') {
    return `

הקשר נושא (נבחר על ידי המשתמש): הדגש על אמונה, דת, אלוהות ותנ"ך — שיחה עניינית ומכבדת.`;
  }
  if (topicSide === 'science') {
    return `

הקשר נושא (נבחר על ידי המשתמש): הדגש על מדע, אבולוציה, מפץ גדול ואתאיזם — שיחה מבוססת ידע.`;
  }
  if (topicSide.startsWith('קובץ:')) {
    const lines = topicSide.split('\n');
    const filename = lines[0].replace('קובץ:', '').trim();
    const content = lines.slice(1).join('\n').trim();
    return `

חומר לימוד שהמשתמש העלה (קובץ: "${filename}"):
${content ? content.slice(0, 1800) : '(תוכן לא זמין)'}

תפקידך כסימולטור: בחן את המשתמש על החומר הנ"ל. שאל שאלות ממוקדות על התוכן, בדוק הבנה, תן הסברים קצרים כשנדרש.`;
  }
  return `

נושא שנבחר: "${topicSide}"
תפקידך כסימולטור ידע: אם המשתמש שואל שאלה — ענה בהרחבה בסגנון מורה מקצועי עם רקע, הסבר, דוגמה וסימוכין כשאפשר. אם אתה מוביל את השיחה — שאל שאלה אחת בכל פעם.`;
}

function voiceChatModeBlock(conversationMode, bootstrapAiQuestion) {
  if (conversationMode === 'user_questions') {
    return `

מצב שיחה: המשתמש שואל שאלות ואתה עונה. תן תשובה מלאה ורחבה כשזו שאלת ידע; שאל שאלת הבהרה רק אם אי אפשר לענות בלי מידע נוסף.`;
  }
  if (conversationMode === 'ai_questions') {
    if (bootstrapAiQuestion) {
      return `

מצב שיחה: אתה מוביל בשאלות. זו פתיחת הסיבוב — אין עדיין תשובה מהמשתמש. שאל שאלה ראשונה אחת קצרה ובהירה בלבד, בלי הקדמות ארוכות.`;
    }
    return `

מצב שיחה: אתה מוביל בשאלות. קודם התייחס בקצרה לתשובת המשתמש (משפט אחד), ואז שאל שאלה חדשה אחת בלבד.`;
  }
  return `

מצב שיחה: שיחה חופשית דו-צדדית — אפשר להרחיב, להגיב ולשאול. כשנשאלת שאלה לימודית, ענה בהרחבה עם רקע וידע כללי.`;
}

app.post('/api/ai-voice-chat', async (req, res) => {
  const {
    userText,
    history,
    characterId,
    conversationMode = 'free',
    topicSide = null,
    bootstrapAiQuestion = false,
  } = req.body || {};

  const isAiLeadBootstrap = Boolean(bootstrapAiQuestion) && conversationMode === 'ai_questions';
  const trimmedUser = typeof userText === 'string' ? userText.trim() : '';
  if (!trimmedUser && !isAiLeadBootstrap) {
    return res.status(400).json({
      error: 'לא נשלח טקסט מהמשתמש. במצב «AI שואל» ודאו שסימנתם שאלת פתיחה, או הקליטו שוב.',
      code: 'MISSING_USER_TEXT',
    });
  }

  const charBase = VOICE_CHAR_PROMPTS[characterId] || VOICE_CHAR_PROMPTS[1];
  const systemPrompt = charBase
    + voiceChatTopicBlock(topicSide)
    + voiceChatModeBlock(conversationMode, isAiLeadBootstrap)
    + FACT_CHECK_SUFFIX;

  const historyMessages = Array.isArray(history) ? history.slice(-8).map(m => ({
    role: m.from === 'user' ? 'user' : 'assistant',
    content: m.text,
  })) : [];

  const lastUserContent = isAiLeadBootstrap
    ? '(עדיין אין תשובה מהמשתמש — זה תורך לשאול את שאלת הפתיחה בלבד.)'
    : trimmedUser;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...historyMessages,
    { role: 'user', content: lastUserContent },
  ];

  try {
    const HEBREW_CHAR_IDS = [1, 2, 3, 4, 5, 9, 10];
    const isHebrew = HEBREW_CHAR_IDS.includes(Number(characterId));
    const isSimulator = Number(characterId) === 1;
    let response;
    if (isHebrew) {
      response = await chatCompletionWithFallback(
        groqForApiRoutes(),
        { max_tokens: isSimulator ? 1200 : 200, messages },
        'ai-voice-chat'
      );
    } else {
      const voiceGroq = new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: 45_000, maxRetries: 1 });
      response = await voiceGroq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages,
        max_tokens: 900,
        temperature: 0.7,
      });
    }
    const raw = response.choices?.[0]?.message?.content?.trim() || '';

    let reply = 'מצטער, לא הצלחתי לענות.';
    let continuation = '';
    let sources = [];
    let factErrors = [];
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.reply) reply = String(parsed.reply);
        if (parsed.continuation && typeof parsed.continuation === 'string') continuation = parsed.continuation.trim();
        if (Array.isArray(parsed.sources)) sources = parsed.sources.filter(s => typeof s === 'string' && s.trim()).slice(0, 5);
        if (Array.isArray(parsed.factErrors)) {
          factErrors = parsed.factErrors
            .map(e => {
              if (typeof e === 'string') {
                const text = e.trim();
                return text ? { error: text, correction: '' } : null;
              }
              if (e && typeof e === 'object') {
                const error = String(e.error || e.text || e.mistake || '').trim();
                const correction = String(e.correction || e.correct || e.fix || '').trim();
                return error ? { error, correction } : null;
              }
              return null;
            })
            .filter(Boolean);
        }
      } else {
        reply = raw || reply;
      }
    } catch {
      reply = raw || reply;
    }

    res.json({ reply, continuation, sources, factErrors });
  } catch (e) {
    const ge = groqErrorForClient(e);
    res.status(500).json({ error: ge.error, code: ge.code, detail: ge.detail });
  }
});

// ElevenLabs TTS — eleven_multilingual_v2 supports Hebrew
const ELEVENLABS_VOICE_MAP = {
  1:  '3gRjssTCTqbHGck8mIv7', // קריין גברי
  2:  'nuVtpPA1A7SQPqVRggLF', // קריינית נשית — אורית
  3:  'mNltV315CbDeheQKBRaG', // הרב זמיר כהן — משה
  4:  'mNltV315CbDeheQKBRaG', // הררי — משה
  5:  'mNltV315CbDeheQKBRaG', // ראש ממשלה — משה
  6:  'yoZ06aMxZJJ28mfd3POQ', // טראמפ — Sam (raspy, assertive)
  7:  'ErXwobaYiN019PkySvjV', // דובר אנגלית — Antoni
  8:  'ErXwobaYiN019PkySvjV', // דובר ספרדית — Antoni (multilingual)
  9:  'VR6AewLTigWG4xSOukaG', // דובר אידיש — Arnold
  10: 'mNltV315CbDeheQKBRaG', // אלוהים — משה
};

app.post('/api/elevenlabs-tts', async (req, res) => {
  const { text, characterId, lang } = req.body || {};
  if (!text || typeof text !== 'string') return res.status(400).json({ error: 'missing text' });

  const apiKey = 'sk_82f7f6de950fcbcc9cc54e1108e7b330ebd2e88f4897dee9';
  const voiceId = ELEVENLABS_VOICE_MAP[characterId] || 'pNInz6obpgDQGcFmaJgB';

  try {
    const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text.slice(0, 1000),
        model_id: 'eleven_v3',
        language_code: 'he',
        voice_settings: { stability: 0.5, similarity_boost: 0.75, use_speaker_boost: true, speed: 1.2 },
      }),
    });
    if (!upstream.ok) {
      const err = await upstream.text().catch(() => '');
      console.error('[elevenlabs-tts] error', upstream.status, err.slice(0, 200));
      return res.status(502).json({ error: 'ElevenLabs upstream error' });
    }
    const buf = await upstream.arrayBuffer();
    res.set('Content-Type', 'audio/mpeg');
    res.set('Cache-Control', 'no-store');
    res.send(Buffer.from(buf));
  } catch (e) {
    console.error('[elevenlabs-tts] error', e.message);
    res.status(500).json({ error: 'ElevenLabs TTS error' });
  }
});

// OpenAI TTS voice per character — onyx/echo/fable for males, nova/shimmer for females
const OPENAI_VOICE_MAP = {
  1:  'onyx',    // קריין גברי — עמוק ורהוט
  2:  'nova',    // קריינית נשית
  3:  'onyx',    // הרב זמיר כהן
  4:  'fable',   // הררי — אנליטי
  5:  'echo',    // ראש ממשלה
  6:  'onyx',    // טראמפ — en-US
  7:  'echo',    // דובר אנגלית
  8:  'fable',   // דובר ספרדית
  9:  'onyx',    // דובר אידיש
  10: 'onyx',    // אלוהים — כבד ורציני
};

app.post('/api/tts', async (req, res) => {
  const { text, characterId } = req.body || {};
  if (!text || typeof text !== 'string') return res.status(400).json({ error: 'missing text' });

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) return res.status(503).json({ error: 'TTS not configured' });

  const voice = OPENAI_VOICE_MAP[characterId] || 'onyx';

  try {
    const upstream = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1-hd',
        input: text.slice(0, 500),
        voice,
      }),
    });
    if (!upstream.ok) {
      const err = await upstream.text().catch(() => '');
      console.error('[tts] OpenAI error', upstream.status, err.slice(0, 200));
      return res.status(502).json({ error: 'TTS upstream error' });
    }
    const buf = await upstream.arrayBuffer();
    res.set('Content-Type', 'audio/mpeg');
    res.set('Cache-Control', 'no-store');
    res.send(Buffer.from(buf));
  } catch (e) {
    console.error('[tts] error', e.message);
    res.status(500).json({ error: 'TTS error' });
  }
});

// Groq Whisper transcription — receives raw audio binary, returns { transcript: string }
app.post('/api/transcribe', express.raw({ type: '*/*', limit: '25mb' }), async (req, res) => {
  if (!req.body || !req.body.length) return res.status(400).json({ error: 'no audio' });
  const lang = String(req.query.lang || 'he').replace(/[^a-z-]/g, '').split('-')[0] || 'he';
  const contentType = String(req.headers['content-type'] || 'audio/webm');
  const ext = contentType.includes('mp4') ? 'audio.m4a' : contentType.includes('ogg') ? 'audio.ogg' : 'audio.webm';

  try {
    const formData = new FormData();
    formData.append('file', new Blob([req.body], { type: contentType }), ext);
    formData.append('model', 'whisper-large-v3');
    formData.append('language', lang);

    const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
      body: formData,
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      console.error('[transcribe] Groq error', r.status, errText.slice(0, 200));
      return res.status(502).json({ error: 'transcription failed', status: r.status });
    }
    const data = await r.json();
    res.json({ transcript: data.text || '' });
  } catch (e) {
    console.error('[transcribe] error', e.message);
    res.status(500).json({ error: 'transcription error' });
  }
});

app.get('/api/users/:username/stats', (req, res) => {
  const username = String(req.params.username || '').trim();
  if (!username) return res.status(400).json({ error: 'missing username' });

  const profile = store.userScores.get(username) || {};
  const archivedByUser = store.archivedDebates.filter(d =>
    d?.believer?.username === username || d?.atheist?.username === username
  );
  const humanDebates = archivedByUser.filter(d => !d.isAI).length;
  const aiDebates = archivedByUser.filter(d => d.isAI).length;
  const liveAppearances = archivedByUser.filter(d => d?.phases?.voice?.messages?.length > 0).length;

  res.json({
    username,
    score: profile.score || 0,
    likesReceived: profile.score || 0,
    giftsReceived: profile.giftsReceived || 0,
    voiceDebates: profile.voiceDebates || 0,
    humanDebates,
    aiDebates,
    liveAppearances,
    archivedDebates: archivedByUser.length,
    side: profile.side || 'believer',
  });
});

/** רישום שם משתמש (אחרי טופס הרישום בלקוח) — מעדכן רשומים; idempotent לפי שם */
app.post('/api/register', (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  const resetPassword = req.body?.resetPassword === true;
  if (username.length < 2 || username.length > 64) {
    return res.status(400).json({ error: 'invalid username' });
  }
  const result = registerUser(username, password, { resetPassword });
  if (!result.ok) return res.status(409).json({ error: result.error });
  res.json({ ok: true, registered: getRegisteredStats().registered });
});

// Bible search via Groq AI
app.post('/api/bible-search', async (req, res) => {
  const { query } = req.body;
  if (!query?.trim()) return res.status(400).json({ error: 'missing query' });
  if (!process.env.GROQ_API_KEY) {
    console.warn('[bible-search] GROQ_API_KEY missing');
    return res.status(503).json({
      error: 'שירות ה־AI לא זמין כרגע',
      code: 'GROQ_API_KEY_MISSING',
    });
  }

  try {
    const response = await chatCompletionWithFallback(
      groqForApiRoutes(),
      {
        max_tokens: 200,
        messages: [
          {
            role: 'system',
            content: `אתה עוזר ידע כללי ומומחה תנ"ך. ענה בעברית על כל שאלה — לא משנה הנושא. ללא markdown. ללא פתיח. קפוץ ישירות לתשובה.`,
          },
          { role: 'user', content: query },
        ],
      },
      'bible-search',
    );

    const explanation = response.choices[0].message.content.trim();
    res.json({ explanation, results: [] });
  } catch (e) {
    console.error('[bible-search] error:', e?.status, e?.message, e?.error);
    const { error, code, detail } = groqErrorForClient(e);
    const payload = { error, code };
    if (process.env.DEBUG_GROQ === '1' && detail) payload.detail = detail;
    res.status(503).json(payload);
  }
});

// Kabbalah search via Groq AI
app.post('/api/kabbalah-search', async (req, res) => {
  const { query } = req.body;
  if (!query?.trim()) return res.status(400).json({ error: 'missing query' });
  if (!process.env.GROQ_API_KEY) {
    console.warn('[kabbalah-search] GROQ_API_KEY missing');
    return res.status(503).json({ error: 'שירות ה־AI לא זמין כרגע', code: 'GROQ_API_KEY_MISSING' });
  }
  try {
    const response = await chatCompletionWithFallback(
      groqForApiRoutes(),
      {
        max_tokens: 200,
        messages: [
          {
            role: 'system',
            content: `אתה עוזר ידע כללי ומומחה קבלה יהודית. ענה בעברית על כל שאלה — לא משנה הנושא. ללא markdown. ללא פתיח. קפוץ ישירות לתשובה.`,
          },
          { role: 'user', content: query },
        ],
      },
      'kabbalah-search',
    );
    const explanation = response.choices[0].message.content.trim();
    res.json({ explanation, results: [] });
  } catch (e) {
    console.error('[kabbalah-search] error:', e?.status, e?.message, e?.error);
    const { error, code, detail } = groqErrorForClient(e);
    const payload = { error, code };
    if (process.env.DEBUG_GROQ === '1' && detail) payload.detail = detail;
    res.status(503).json(payload);
  }
});

// Zohar search via Groq AI
app.post('/api/zohar-search', async (req, res) => {
  const { query } = req.body;
  if (!query?.trim()) return res.status(400).json({ error: 'missing query' });
  if (!process.env.GROQ_API_KEY) {
    return res.status(503).json({ error: 'שירות ה־AI לא זמין כרגע', code: 'GROQ_API_KEY_MISSING' });
  }
  try {
    const response = await chatCompletionWithFallback(
      groqForApiRoutes(),
      {
        max_tokens: 200,
        messages: [
          {
            role: 'system',
            content: `אתה עוזר ידע כללי ומומחה ספר הזוהר. ענה בעברית על כל שאלה — לא משנה הנושא. ללא markdown. ללא פתיח. קפוץ ישירות לתשובה.`,
          },
          { role: 'user', content: query },
        ],
      },
      'zohar-search',
    );
    const explanation = response.choices[0].message.content.trim();
    res.json({ explanation, results: [] });
  } catch (e) {
    console.error('[zohar-search] error:', e?.status, e?.message, e?.error);
    const { error, code, detail } = groqErrorForClient(e);
    const payload = { error, code };
    if (process.env.DEBUG_GROQ === '1' && detail) payload.detail = detail;
    res.status(503).json(payload);
  }
});

// Science / Evolution search — returns { explanation, results }
app.post('/api/science-search', async (req, res) => {
  const { query } = req.body;
  if (!query?.trim()) return res.status(400).json({ error: 'missing query' });
  if (!process.env.GROQ_API_KEY) {
    return res.status(503).json({ error: 'שירות ה־AI לא זמין כרגע', code: 'GROQ_API_KEY_MISSING' });
  }
  try {
    const response = await chatCompletionWithFallback(
      groqForApiRoutes(),
      {
        max_tokens: 200,
        messages: [
          {
            role: 'system',
            content: `אתה עוזר ידע כללי ומדען מנוסה. ענה בעברית על כל שאלה — לא משנה הנושא. ללא markdown. ללא פתיח. קפוץ ישירות לתשובה.`,
          },
          { role: 'user', content: query },
        ],
      },
      'science-search',
    );
    const explanation = response.choices[0].message.content.trim();
    res.json({ explanation, results: [] });
  } catch (e) {
    console.error('[science-search] error:', e?.status, e?.message);
    const { error, code, detail } = groqErrorForClient(e);
    const payload = { error, code };
    if (process.env.DEBUG_GROQ === '1' && detail) payload.detail = detail;
    res.status(503).json(payload);
  }
});

/** תשובת AI במאגר ידע — שאלה חופשית; התשובה מוצגת בלוח מתחת לטאבים */
app.post('/api/knowledge-ask', async (req, res) => {
  const question = String(req.body?.question ?? '').trim();
  if (!question) return res.status(400).json({ error: 'חסרה שאלה' });
  if (question.length > 6000) return res.status(400).json({ error: 'השאלה ארוכה מדי' });

  if (!process.env.GROQ_API_KEY) {
    console.warn('[knowledge-ask] GROQ_API_KEY missing');
    return res.status(503).json({
      error: 'שירות ה־AI לא זמין כרגע (חסר מפתח GROQ)',
      code: 'GROQ_API_KEY_MISSING',
    });
  }

  try {
    const response = await chatCompletionWithFallback(
      groqForApiRoutes(),
      {
        max_tokens: 1600,
        messages: [
          {
            role: 'system',
            content: `אתה עוזר ידע כללי. השב בעברית בלבד — ניתן לשאול על כל נושא (מדע, היסטוריה, טכנולוגיה, תרבות, פילוסופיה ועוד).

כללים:
1. תשובה ברורה ומסודרת; פסקאות קצרות כשנדרש.
2. ניטרלי ומכובד; בנושאים רגישים הצג גונים שונים בלי להטיף.
3. בלי markdown (#, **); טקסט רגיל בלבד.
4. אם חסר מידע — ציין זאת בקצרה.`,
          },
          { role: 'user', content: question },
        ],
      },
      'knowledge-ask',
    );

    const answer = response.choices[0]?.message?.content?.trim();
    if (!answer) return res.status(502).json({ error: 'לא התקבלה תשובה מהשרת' });
    res.json({ answer });
  } catch (e) {
    console.error('[knowledge-ask]', e?.status, e?.message, e?.error);
    const { error, code, detail } = groqErrorForClient(e);
    const payload = { error, code };
    if (process.env.DEBUG_GROQ === '1' && detail) payload.detail = detail;
    res.status(503).json(payload);
  }
});

// Admin: manually set registered count (one-time use)
app.post('/api/admin/set-count', express.json(), (req, res) => {
  const { count, usernames } = req.body;
  if (count) store.registeredCount = count;
  if (usernames) usernames.forEach(u => store.registeredUsernames.add(u));
  store.registeredCount = Math.max(store.registeredCount, store.registeredUsernames.size);
  saveSnapshot();
  res.json({ ok: true, registeredCount: getRegisteredStats().registered });
});

// Admin: set permanent online demo users
app.post('/api/admin/set-permanent-online', express.json(), (req, res) => {
  const { usernames } = req.body;
  if (!Array.isArray(usernames)) return res.status(400).json({ error: 'usernames must be array' });
  store.permanentOnlineUsernames = new Set(usernames.map(u => String(u).trim()).filter(Boolean));
  saveSnapshot();
  res.json({ ok: true, permanentOnline: [...store.permanentOnlineUsernames] });
});

loadSnapshot();
purgeRetiredVirtualUsers();

// Seed demo users — always present after any restart
const DEMO_USERS = [
  { username: 'אברהם_כהן',  password: 'av12' },
  { username: 'יצחק_לוי',   password: 'yt34' },
  { username: 'יעקב_מזרחי', password: 'yv56' },
  { username: 'משה_פרץ',    password: 'ms78' },
  { username: 'שלמה_ביטון', password: 'sh12' },
  { username: 'אלון_שמיר',  password: 'al34' },
  { username: 'ניר_גולן',   password: 'nr56' },
  { username: 'ירון_אבידן', password: 'yr78' },
  { username: 'גיל_שפירא',  password: 'gl90' },
  { username: 'שרה_כהן',    password: 'sr12' },
  { username: 'רבקה_לוי',   password: 'rb34' },
  { username: 'מיכל_אברהם', password: 'mk56' },
];
(function seedDemoUsers() {
  let changed = false;
  for (const { username, password } of DEMO_USERS) {
    const result = registerUser(username, password, {});
    if (result.ok) changed = true;
    store.permanentOnlineUsernames.add(normalizeUsername(username));
  }
  if (changed) saveSnapshot();
})();

registerMatchmaking(io);
registerDebate(io);
registerSpectator(io);
registerFaithChat(io);

setInterval(saveSnapshot, 60_000);

process.on('SIGINT', () => {
  console.log('\n[server] Saving snapshot before exit...');
  saveSnapshot();
  process.exit(0);
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] ✅✅✅ LIVE ON 0.0.0.0:${PORT} — STREAMING & TURN FIX DEPLOYED`);
  console.log(`[server] NODE_ENV=${process.env.NODE_ENV || 'development'}`);
  if (!process.env.GROQ_API_KEY) {
    console.warn('[server] ⚠️  GROQ_API_KEY not set — AI debates will fail');
  } else {
    console.log('[server] ✅ GROQ_API_KEY is set');
  }
});
