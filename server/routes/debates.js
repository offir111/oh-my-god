import express from 'express';
import { store } from '../store/memory.js';

const router = express.Router();

router.get('/', (req, res) => {
  const { page = 1, limit = 20, q } = req.query;
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  let results = store.archivedDebates;

  if (q) {
    const query = String(q).trim().toLowerCase();
    results = results.filter(d =>
      d.tags.some(t => String(t || '').toLowerCase().includes(query)) ||
      String(d.summary || '').toLowerCase().includes(query) ||
      String(d.believer?.username || '').toLowerCase().includes(query) ||
      String(d.atheist?.username || '').toLowerCase().includes(query)
    );
  }

  const total = results.length;
  const start = (pageNum - 1) * limitNum;
  const items = results.slice(start, start + limitNum).map(d => ({
    id: d.id,
    believer: { username: d.believer.username },
    atheist:  { username: d.atheist.username },
    isAI: d.isAI,
    tags: d.tags,
    summary: d.summary,
    stats: d.stats,
    archivedAt: d.archivedAt,
  }));

  res.json({ total, page: pageNum, items });
});

router.get('/live', (req, res) => {
  const live = [];
  for (const [id, debate] of store.debates.entries()) {
    if (debate.phase !== 'finished') {
      live.push({
        id,
        phase: debate.phase,
        believer: { username: debate.believer.username },
        atheist:  { username: debate.atheist.username },
        isAI: debate.isAI,
        spectators: store.spectators.get(id)?.size || 0,
        startedAt: debate.startedAt,
      });
    }
  }
  res.json(live);
});

router.get('/live/:id', (req, res) => {
  const debate = store.debates.get(req.params.id);
  if (!debate || debate.phase === 'finished') {
    return res.status(404).json({ error: 'דיון חי לא נמצא' });
  }

  res.json({
    id: debate.id,
    phase: debate.phase,
    turn: debate.turn,
    believer: { username: debate.believer.username },
    atheist: { username: debate.atheist.username },
    isAI: debate.isAI,
    aiSide: debate.aiSide,
    textMessages: debate.textMessages,
    voiceMessages: debate.voiceMessages,
    textCount: debate.textCount,
    voiceCount: debate.voiceCount,
    giftsReceived: debate.giftsReceived,
    startedAt: debate.startedAt,
  });
});

router.get('/:id', (req, res) => {
  const debate = store.archivedDebates.find(d => d.id === req.params.id);
  if (!debate) return res.status(404).json({ error: 'לא נמצא' });
  res.json(debate);
});

export default router;
