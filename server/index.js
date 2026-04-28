import 'dotenv/config';

// Catch and log any unhandled errors so they appear in Railway logs
process.on('uncaughtException', (err) => {
  console.error('[FATAL] uncaughtException:', err.stack || err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] unhandledRejection:', reason);
});

console.log('[boot] starting server...');
console.log('[boot] node version:', process.version);
console.log('[boot] cwd:', process.cwd());
console.log('[boot] PORT env:', process.env.PORT);

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { loadSnapshot, saveSnapshot, store, registerUser } from './store/memory.js';
import { registerMatchmaking } from './socket/matchmaking.js';
import { registerDebate } from './socket/debate.js';
import { registerSpectator } from './socket/spectator.js';
import debatesRouter from './routes/debates.js';
import leaderboardRouter from './routes/leaderboard.js';

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

app.get('/api/health', (_, res) => res.json({ ok: true, provider: 'groq', version: 2 }));

app.get('/api/stats', (_, res) => {
  // Count unique usernames online (same user from multiple devices = 1)
  const onlineSet = new Set([...store.users.values()].map(u => u.username));
  res.json({
    registered: store.registeredCount,
    online: onlineSet.size,
    registeredList: [...store.registeredUsernames],
    onlineList: [...onlineSet],
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
  res.json({ ok: true, registered: store.registeredCount });
});

// Bible search via Groq AI
app.post('/api/bible-search', async (req, res) => {
  const { query } = req.body;
  if (!query?.trim()) return res.status(400).json({ error: 'missing query' });

  try {
    const Groq = (await import('groq-sdk')).default;
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 800,
      messages: [
        {
          role: 'system',
          content: `אתה מומחה בתנ"ך. כשמשתמש שואל על פסוק, נושא או מילה — מצא את הפסוקים הרלוונטיים ביותר מהתנ"ך.

פורמט התשובה — JSON בלבד, ללא טקסט נוסף:
{
  "results": [
    { "ref": "שם הספר פרק:פסוק", "text": "הטקסט המלא של הפסוק בעברית", "context": "הסבר קצר של הרלוונטיות" },
    ...
  ]
}

חוקים:
- עד 5 תוצאות
- פסוקים בעברית מקראית מדויקת
- רלוונטיות גבוהה לשאילתה
- ref בפורמט: "בראשית א:א" או "תהילים כג:א"`,
        },
        { role: 'user', content: query },
      ],
    });

    const text = response.choices[0].message.content.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.json({ results: [] });
    const parsed = JSON.parse(jsonMatch[0]);
    res.json(parsed);
  } catch (e) {
    console.error('[bible-search] error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Admin: manually set registered count (one-time use)
app.post('/api/admin/set-count', express.json(), (req, res) => {
  const { count, usernames } = req.body;
  if (count) store.registeredCount = count;
  if (usernames) usernames.forEach(u => store.registeredUsernames.add(u));
  saveSnapshot();
  res.json({ ok: true, registeredCount: store.registeredCount });
});

loadSnapshot();

registerMatchmaking(io);
registerDebate(io);
registerSpectator(io);

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
