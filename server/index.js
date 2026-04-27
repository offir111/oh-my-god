import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { loadSnapshot, saveSnapshot, store } from './store/memory.js';
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
  cors: { origin: true, credentials: true },
  maxHttpBufferSize: 10e6, // 10 MB for audio blobs
});

app.use(cors({ origin: true }));
app.use(express.json());

app.use('/api/debates', debatesRouter);
app.use('/api/leaderboard', leaderboardRouter);

app.get('/api/health', (_, res) => res.json({ ok: true, provider: 'groq', version: 2 }));

app.get('/api/stats', (_, res) => {
  res.json({
    registered: store.userScores.size,
    online: store.users.size,
  });
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
httpServer.listen(PORT, () => {
  console.log(`[server] Running on http://localhost:${PORT}`);
  if (!process.env.GROQ_API_KEY) {
    console.warn('[server] ⚠️  GROQ_API_KEY not set — AI debates will fail');
  }
});
