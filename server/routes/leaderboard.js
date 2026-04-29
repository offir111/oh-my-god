import express from 'express';
import { store } from '../store/memory.js';
import { TOPIC_DEFINITIONS } from '../lib/topicTracking.js';

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

  const topics = TOPIC_DEFINITIONS.map(({ id, label }) => ({
    id,
    label,
    count: store.topicCounts.get(id) || 0,
  })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'he'));

  res.json({
    leaders: entries.slice(0, 20),
    topics,
  });
});

export default router;
