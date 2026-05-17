/**
 * virtualFeed.js
 * GET /api/virtual-feed — returns paginated virtual blog posts.
 * GET /api/virtual-feed/:username — returns posts by one virtual user.
 */

import { Router } from 'express';
import { store } from '../store/memory.js';
import { normalizeUsername } from '../store/memory.js';

const router = Router();

// GET /api/virtual-feed?limit=20&offset=0
router.get('/', (req, res) => {
  const limit  = Math.min(Math.max(parseInt(req.query.limit)  || 20, 1), 50);
  const offset = Math.max(parseInt(req.query.offset) || 0, 0);
  const posts  = store.virtualPosts.slice(offset, offset + limit);
  res.json({ posts, total: store.virtualPosts.length });
});

// GET /api/virtual-feed/user/:username
router.get('/user/:username', (req, res) => {
  const norm  = normalizeUsername(req.params.username || '');
  const posts = store.virtualPosts.filter(
    p => normalizeUsername(p.author) === norm,
  );
  res.json({ posts, total: posts.length });
});

export default router;
