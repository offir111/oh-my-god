import crypto from 'crypto';
import { getOmgAdminPassword } from './adminConfig.js';

/** ארוך — המנהל נשאר מחובר עד התנתקות ידנית; האסימון מתעדכן בכל התחברות מחדש */
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

function adminSecret() {
  const session = process.env.OMG_ADMIN_SESSION_SECRET;
  if (typeof session === 'string' && session.length >= 8) return session;
  return getOmgAdminPassword();
}

export function createAdminToken() {
  const secret = adminSecret();
  if (!secret || String(secret).length < 8) return null;
  const exp = Date.now() + TTL_MS;
  const payload = Buffer.from(JSON.stringify({ exp, admin: true }), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyAdminToken(token) {
  if (!token || typeof token !== 'string') return false;
  const secret = adminSecret();
  if (!secret || String(secret).length < 8) return false;
  const i = token.lastIndexOf('.');
  if (i === -1) return false;
  const payload = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    if (!crypto.timingSafeEqual(a, b)) return false;
  } catch {
    return false;
  }
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof exp === 'number' && exp > Date.now();
  } catch {
    return false;
  }
}

export function adminAuthMiddleware(req, res, next) {
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m || !verifyAdminToken(m[1])) {
    return res.status(401).json({ error: 'נדרשת התחברות מנהל' });
  }
  next();
}
