import express from 'express';
import {
  getAdminUserList,
  setUserBlocked,
  setAdminNote,
  hideBlogPostFromPublicFeed,
  unhideBlogPostFromPublicFeed,
  hideBlogPostPendingReview,
  clearBlogPostPendingReview,
  blockBlogAuthorFromPublicFeed,
  unblockBlogAuthorFromPublicFeed,
  getBlogFeedModerationPayload,
  setBlogAuthorModerationNotice,
  deleteUser,
  resetUserScore,
  deleteArchivedDebate,
  getArchivedDebatesAdmin,
} from '../store/memory.js';
import { createAdminToken, verifyAdminToken, adminAuthMiddleware } from '../lib/adminToken.js';
import { getOmgAdminPassword, isOmgAdminConfigured } from '../lib/adminConfig.js';

const router = express.Router();

router.post('/login', express.json(), (req, res) => {
  const password = String(req.body?.password || '');
  if (!isOmgAdminConfigured()) {
    return res.status(503).json({ error: 'התחברות מנהל אינה מוגדרת בשרת (הגדרו OMG_ADMIN_PASSWORD — 8 תווים)' });
  }
  const adminPw = getOmgAdminPassword();
  if (password !== adminPw) {
    return res.status(401).json({ error: 'סיסמה שגויה' });
  }
  const token = createAdminToken();
  if (!token) {
    return res.status(503).json({ error: 'לא ניתן להפיק אסימון מנהל' });
  }
  res.json({ ok: true, token, username: 'OMG' });
});

router.get('/users', adminAuthMiddleware, (_req, res) => {
  res.json({ users: getAdminUserList() });
});

router.post('/block', adminAuthMiddleware, express.json(), (req, res) => {
  const username = String(req.body?.username || '').trim();
  const blocked = req.body?.blocked === true;
  if (!username) return res.status(400).json({ error: 'חסר שם משתמש' });
  if (!setUserBlocked(username, blocked)) {
    return res.status(400).json({ error: 'לא ניתן לעדכן חסימה לשם זה' });
  }
  res.json({ ok: true, users: getAdminUserList() });
});

router.post('/note', adminAuthMiddleware, express.json(), (req, res) => {
  const username = String(req.body?.username || '').trim();
  const note = req.body?.note ?? '';
  if (!username) return res.status(400).json({ error: 'חסר שם משתמש' });
  if (!setAdminNote(username, note)) {
    return res.status(400).json({ error: 'לא ניתן לשמור הערה' });
  }
  res.json({ ok: true, users: getAdminUserList() });
});

router.delete('/users/:username', adminAuthMiddleware, (req, res) => {
  const username = String(req.params.username || '').trim();
  if (!username) return res.status(400).json({ error: 'חסר שם משתמש' });
  if (!deleteUser(username)) {
    return res.status(400).json({ error: 'לא ניתן למחוק משתמש זה' });
  }
  res.json({ ok: true, users: getAdminUserList() });
});

router.post('/reset-score', adminAuthMiddleware, express.json(), (req, res) => {
  const username = String(req.body?.username || '').trim();
  if (!username) return res.status(400).json({ error: 'חסר שם משתמש' });
  resetUserScore(username);
  res.json({ ok: true, users: getAdminUserList() });
});

router.get('/debates', adminAuthMiddleware, (_req, res) => {
  res.json({ debates: getArchivedDebatesAdmin() });
});

router.delete('/debates/:id', adminAuthMiddleware, (req, res) => {
  const debateId = String(req.params.id || '').trim();
  if (!debateId) return res.status(400).json({ error: 'חסר מזהה דיון' });
  if (!deleteArchivedDebate(debateId)) {
    return res.status(404).json({ error: 'דיון לא נמצא' });
  }
  res.json({ ok: true });
});

router.get('/verify', (req, res) => {
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m || !verifyAdminToken(m[1])) {
    return res.status(401).json({ ok: false });
  }
  res.json({ ok: true });
});

/** בלוג ציבורי — מודרציה (אגרגט מ־localStorage בלקוח + סינון לפי כללים אלה בשרת) */
router.get('/blog-feed/status', adminAuthMiddleware, (_req, res) => {
  res.json(getBlogFeedModerationPayload());
});

router.post('/blog-feed/hide', adminAuthMiddleware, express.json(), (req, res) => {
  const author = String(req.body?.author || '').trim();
  const postId = String(req.body?.postId || '').trim();
  if (!author || !postId) return res.status(400).json({ error: 'חסר author או postId' });
  hideBlogPostFromPublicFeed(author, postId);
  res.json({ ok: true, ...getBlogFeedModerationPayload() });
});

router.post('/blog-feed/unhide', adminAuthMiddleware, express.json(), (req, res) => {
  const author = String(req.body?.author || '').trim();
  const postId = String(req.body?.postId || '').trim();
  if (!author || !postId) return res.status(400).json({ error: 'חסר author או postId' });
  unhideBlogPostFromPublicFeed(author, postId);
  res.json({ ok: true, ...getBlogFeedModerationPayload() });
});

router.post('/blog-feed/block-author', adminAuthMiddleware, express.json(), (req, res) => {
  const author = String(req.body?.author || '').trim();
  if (!author) return res.status(400).json({ error: 'חסר author' });
  if (!blockBlogAuthorFromPublicFeed(author)) {
    return res.status(400).json({ error: 'לא ניתן לחסום כותב זה' });
  }
  res.json({ ok: true, ...getBlogFeedModerationPayload() });
});

router.post('/blog-feed/unblock-author', adminAuthMiddleware, express.json(), (req, res) => {
  const author = String(req.body?.author || '').trim();
  if (!author) return res.status(400).json({ error: 'חסר author' });
  unblockBlogAuthorFromPublicFeed(author);
  res.json({ ok: true, ...getBlogFeedModerationPayload() });
});

router.post('/blog-feed/hide-pending', adminAuthMiddleware, express.json(), (req, res) => {
  const author = String(req.body?.author || '').trim();
  const postId = String(req.body?.postId || '').trim();
  if (!author || !postId) return res.status(400).json({ error: 'חסר author או postId' });
  hideBlogPostPendingReview(author, postId);
  res.json({ ok: true, ...getBlogFeedModerationPayload() });
});

router.post('/blog-feed/clear-pending', adminAuthMiddleware, express.json(), (req, res) => {
  const author = String(req.body?.author || '').trim();
  const postId = String(req.body?.postId || '').trim();
  if (!author || !postId) return res.status(400).json({ error: 'חסר author או postId' });
  clearBlogPostPendingReview(author, postId);
  res.json({ ok: true, ...getBlogFeedModerationPayload() });
});

/** התראה לכותב — מוצג בפרופיל שלו כשהוא נכנס */
router.post('/blog-feed/author-notice', adminAuthMiddleware, express.json(), (req, res) => {
  const author = String(req.body?.author || '').trim();
  const text = String(req.body?.text ?? '');
  if (!author) return res.status(400).json({ error: 'חסר author' });
  if (!setBlogAuthorModerationNotice(author, text)) {
    return res.status(400).json({ error: 'לא ניתן לשמור התראה' });
  }
  res.json({ ok: true });
});

export default router;
