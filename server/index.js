import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { loadSnapshot, saveSnapshot } from './store/memory.js';
import { registerMatchmaking } from './socket/matchmaking.js';
import { registerDebate } from './socket/debate.js';
import { registerSpectator } from './socket/spectator.js';
import debatesRouter from './routes/debates.js';
import leaderboardRouter from './routes/leaderboard.js';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: ['http://localhost:5173', 'http://localhost:3000'], credentials: true },
  maxHttpBufferSize: 10e6, // 10 MB for audio blobs
});

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000'] }));
app.use(express.json());

app.use('/api/debates', debatesRouter);
app.use('/api/leaderboard', leaderboardRouter);

app.get('/api/health', (_, res) => res.json({ ok: true }));

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
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('[server] ⚠️  ANTHROPIC_API_KEY not set — AI debates will fail');
  }
});
