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
import { loadSnapshot, saveSnapshot, store, registerUser, getRegisteredStats } from './store/memory.js';
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
  res.json({ ok: true, provider: 'groq', version: 5 }));

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
    const upstream = await fetch(raw, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept': '*/*',
        'Referer': new URL(raw).origin + '/',
        'Origin': new URL(raw).origin,
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
      const selfProxyBase = `${req.protocol}://${req.get('host')}/api/tv-proxy?url=`;

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
  const { registered, registeredList } = getRegisteredStats();
  res.json({
    registered,
    online: onlineSet.size,
    registeredList,
    onlineList: [...onlineSet],
  });
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
      },
      'bible-search',
    );

    const text = response.choices[0].message.content.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.json({ results: [] });
    const parsed = JSON.parse(jsonMatch[0]);
    res.json(parsed);
  } catch (e) {
    console.error('[bible-search] error:', e?.status, e?.message, e?.error);
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

loadSnapshot();

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
