import express from 'express';
import {
  getAdminUserList,
  setUserBlocked,
  setAdminNote,
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

router.get('/verify', (req, res) => {
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m || !verifyAdminToken(m[1])) {
    return res.status(401).json({ ok: false });
  }
  res.json({ ok: true });
});

export default router;
