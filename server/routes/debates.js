import express from 'express';
import { store } from '../store/memory.js';

const router = express.Router();

router.get('/', (req, res) => {
  const { page = 1, limit = 20, q } = req.query;
  let results = store.archivedDebates;

  if (q) {
    const query = q.toLowerCase();
    results = results.filter(d =>
      d.tags.some(t => t.includes(q)) ||
      d.summary.includes(q) ||
      d.believer.username.includes(q) ||
      d.atheist.username.includes(q)
    );
  }

  const total = results.length;
  const start = (page - 1) * limit;
  const items = results.slice(start, start + Number(limit)).map(d => ({
    id: d.id,
    believer: { username: d.believer.username },
    atheist:  { username: d.atheist.username },
    isAI: d.isAI,
    tags: d.tags,
    summary: d.summary,
    stats: d.stats,
    archivedAt: d.archivedAt,
  }));

  res.json({ total, page: Number(page), items });
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

router.get('/:id', (req, res) => {
  const debate = store.archivedDebates.find(d => d.id === req.params.id);
  if (!debate) return res.status(404).json({ error: 'לא נמצא' });
  res.json(debate);
});

export default router;
