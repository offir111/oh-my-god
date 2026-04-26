import express from 'express';
import { store } from '../store/memory.js';

const router = express.Router();

router.get('/', (req, res) => {
  const entries = Array.from(store.userScores.entries()).map(([username, data]) => ({
    username,
    score: data.score || 0,
    voiceDebates: data.voiceDebates || 0,
    giftsReceived: data.giftsReceived || 0,
    qualityScore: (data.voiceDebates || 0) * 3 + (data.giftsReceived || 0),
    side: data.side || 'believer',
  }));

  entries.sort((a, b) => b.score - a.score || b.qualityScore - a.qualityScore);
  res.json(entries.slice(0, 20));
});

export default router;
