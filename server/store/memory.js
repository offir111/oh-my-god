import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { getOmgAdminPassword, isOmgAdminConfigured } from '../lib/adminConfig.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = path.join(__dirname, '..', 'store-snapshot.json');
const REGISTERED_PASSWORDS_VERSION = 3;

/** מפתח ייחודי לשם משתמש: trim + אותיות קטנות (ללא כפילות Offir/offir) */
export function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

const RESERVED_ADMIN_NORM = 'omg';

export const store = {
  users: new Map(),        // socketId → { username, side, score, voiceDebates, giftsReceived, lastSeen }
  queue: { believer: null, atheist: null },
  debates: new Map(),      // debateId → DebateState
  spectators: new Map(),   // debateId → Set<socketId>
  userScores: new Map(),   // username → { score, voiceDebates, giftsReceived, side }
  archivedDebates: [],     // finished debates for knowledge base
  registeredCount: 0,      // persistent total registered users count
  registeredUsernames: new Set(), // שמות רשומים — נירמול בלבד
  registeredPasswords: new Map(), // נירמול שם → password hash
  blockedNormUsernames: new Set(),
  adminNotesByNorm: new Map(), // נירמול → הערת מנהל (אזהרה / פנימי)
  topicCounts: new Map(),   // topicId → מספר אזכורים בהודעות טקסט (אדם + AI)
};

export function createDebateState(debateId, believer, atheist, isAI = false, aiSide = null) {
  return {
    id: debateId,
    believer,
    atheist,
    isAI,
    aiSide,
    isAITurn: false,
    phase: 'text',
    turn: 'believer',
    textMessages: [],
    voiceMessages: [],
    textCount: { believer: 0, atheist: 0 },
    voiceCount: { believer: 0, atheist: 0 },
    giftsReceived: { believer: 0, atheist: 0 },
    spectatorPeak: 0,
    startedAt: Date.now(),
    finishedAt: null,
    tags: [],
    summary: '',
  };
}

export function getUserSide(store, socketId) {
  return store.users.get(socketId)?.side;
}

export function isValidTurn(debate, socketId, store) {
  const user = store.users.get(socketId);
  if (!user) return false;
  return debate.turn === user.side;
}

export function advanceTurn(debate) {
  debate.turn = debate.turn === 'believer' ? 'atheist' : 'believer';
}

export function getSocketIdBySide(debate, side) {
  return side === 'believer' ? debate.believer.socketId : debate.atheist.socketId;
}

export function updateUserScore(store, username, delta, options = {}) {
  if (!store.userScores.has(username)) {
    store.userScores.set(username, { score: 0, voiceDebates: 0, giftsReceived: 0, side: options.side || 'believer' });
  }
  const profile = store.userScores.get(username);
  profile.score += delta;
  if (options.voiceDebate) profile.voiceDebates += 1;
  if (options.gift) profile.giftsReceived += 1;
  if (options.side) profile.side = options.side;
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password)).digest('hex');
}

export function isUsernameBlocked(username) {
  return store.blockedNormUsernames.has(normalizeUsername(username));
}

export function setUserBlocked(username, blocked) {
  const norm = normalizeUsername(username);
  if (!norm || norm === RESERVED_ADMIN_NORM) return false;
  if (blocked) store.blockedNormUsernames.add(norm);
  else store.blockedNormUsernames.delete(norm);
  saveSnapshot();
  return true;
}

export function setAdminNote(username, note) {
  const norm = normalizeUsername(username);
  if (!norm) return false;
  const t = String(note || '').trim().slice(0, 500);
  if (t) store.adminNotesByNorm.set(norm, t);
  else store.adminNotesByNorm.delete(norm);
  saveSnapshot();
  return true;
}

/**
 * כל מי שהוגדר כרשום: סט השמות המצטבר + כל מפתח ב־registeredPasswords (מי שנרשם בטופס).
 * לא מסירים שמות בעת ניתוק / יציאה — רק איחוד ושמירה לצמיחת רשימה.
 */
function allRegisteredNorms() {
  const out = new Set();
  for (const n of store.registeredUsernames) {
    const norm = normalizeUsername(n);
    if (norm.length >= 2 && norm.length <= 64) out.add(norm);
  }
  for (const k of store.registeredPasswords.keys()) {
    const norm = normalizeUsername(k);
    if (norm.length >= 2 && norm.length <= 64) out.add(norm);
  }
  return out;
}

/** לפני שמירה: כל בעל סיסמה נשאר ב־registeredUsernames (אין יציאה מהרשימה) */
function mergePasswordsIntoRegisteredSet() {
  let changed = false;
  for (const k of store.registeredPasswords.keys()) {
    const norm = normalizeUsername(k);
    if (norm.length < 2 || norm.length > 64) continue;
    if (!store.registeredUsernames.has(norm)) {
      store.registeredUsernames.add(norm);
      changed = true;
    }
  }
  store.registeredCount = Math.max(store.registeredCount, store.registeredUsernames.size);
  return changed;
}

export function getAdminUserList() {
  return [...allRegisteredNorms()]
    .map(norm => ({
      username: norm === RESERVED_ADMIN_NORM ? 'OMG' : norm,
      normalized: norm,
      blocked: store.blockedNormUsernames.has(norm),
      note: store.adminNotesByNorm.get(norm) || '',
    }))
    .sort((a, b) => a.normalized.localeCompare(b.normalized, 'he'));
}

/** רישום דרך סוקט בלבד — מעלה ספירה בלי אימות סיסמה (הרשמה המלאה דרך /api/register) */
export function registerUserFromSocket(username) {
  const norm = normalizeUsername(username);
  if (norm.length < 2 || norm.length > 64) return;
  if (store.blockedNormUsernames.has(norm)) return;
  if (!store.registeredUsernames.has(norm)) {
    store.registeredUsernames.add(norm);
    store.registeredCount = Math.max(store.registeredCount + 1, store.registeredUsernames.size);
    saveSnapshot();
  }
}

/** תאימות: קריאות ישנות עם סיסמה null — זהה ל־registerUserFromSocket */
export function registerUser(username, password = null, options = {}) {
  if (password === null) {
    registerUserFromSocket(username);
    return { ok: true, registered: store.registeredCount };
  }

  const norm = normalizeUsername(username);
  if (norm.length < 2 || norm.length > 64) {
    return { ok: false, error: 'שם משתמש לא תקין' };
  }

  if (store.blockedNormUsernames.has(norm)) {
    return { ok: false, error: 'החשבון חסום. לפרטים ניתן לפנות דרך «צור קשר».' };
  }

  let shouldSave = false;
  const passwordText = String(password);
  const isAdminAccount = norm === RESERVED_ADMIN_NORM;

  if (isAdminAccount) {
    if (!isOmgAdminConfigured()) {
      return { ok: false, error: 'רישום מנהל אינו מוגדר בשרת' };
    }
    if (passwordText.length !== 8) {
      return { ok: false, error: 'לרישום מנהל נדרשת סיסמה של 8 תווים' };
    }
    if (passwordText !== getOmgAdminPassword()) {
      return { ok: false, error: 'הסיסמה אינה תואמת לשם המשתמש הזה' };
    }
  } else if (passwordText.length !== 4) {
    return { ok: false, error: 'הסיסמה חייבת להיות בדיוק 4 תווים' };
  }

  const nextHash = hashPassword(passwordText);
  const existingHash = store.registeredPasswords.get(norm);
  if (existingHash && existingHash !== nextHash && !options.resetPassword) {
    return { ok: false, error: 'הסיסמה אינה תואמת לשם המשתמש הזה' };
  }

  if (!existingHash || existingHash !== nextHash) {
    store.registeredPasswords.set(norm, nextHash);
    shouldSave = true;
  }

  if (!store.registeredUsernames.has(norm)) {
    store.registeredUsernames.add(norm);
    store.registeredCount = Math.max(store.registeredCount + 1, store.registeredUsernames.size);
    shouldSave = true;
  }

  if (shouldSave) saveSnapshot();

  return { ok: true, registered: store.registeredCount };
}

export function getRegisteredStats() {
  const all = allRegisteredNorms();
  const registeredList = [...all]
    .filter(n => n !== RESERVED_ADMIN_NORM)
    .sort((a, b) => a.localeCompare(b, 'he'));
  const hasAdmin = all.has(RESERVED_ADMIN_NORM);
  const registered = Math.max(
    registeredList.length,
    store.registeredCount - (hasAdmin ? 1 : 0),
    all.size - (hasAdmin ? 1 : 0),
  );
  return { registered, registeredList };
}

export function saveSnapshot() {
  try {
    mergePasswordsIntoRegisteredSet();
    const data = {
      archivedDebates: store.archivedDebates,
      userScores: Object.fromEntries(store.userScores),
      registeredCount: store.registeredCount,
      registeredUsernames: [...store.registeredUsernames],
      registeredPasswordsVersion: REGISTERED_PASSWORDS_VERSION,
      registeredPasswords: Object.fromEntries(store.registeredPasswords),
      blockedNormUsernames: [...store.blockedNormUsernames],
      adminNotesByNorm: Object.fromEntries(store.adminNotesByNorm),
      topicCounts: Object.fromEntries(store.topicCounts),
      savedAt: new Date().toISOString(),
    };
    fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('[store] Failed to save snapshot:', e.message);
  }
}

export function loadSnapshot() {
  try {
    if (!fs.existsSync(SNAPSHOT_PATH)) return;
    const data = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
    if (data.archivedDebates) store.archivedDebates = data.archivedDebates;
    if (data.userScores) {
      for (const [k, v] of Object.entries(data.userScores)) {
        store.userScores.set(k, v);
      }
    }
    if (typeof data.registeredCount === 'number') store.registeredCount = data.registeredCount;
    if (data.registeredUsernames) {
      store.registeredUsernames = new Set(data.registeredUsernames);
    }
    if (data.registeredPasswords && typeof data.registeredPasswords === 'object') {
      store.registeredPasswords = new Map(Object.entries(data.registeredPasswords));
    }
    if (Array.isArray(data.blockedNormUsernames)) {
      store.blockedNormUsernames = new Set(data.blockedNormUsernames.map(normalizeUsername).filter(Boolean));
    }
    if (data.adminNotesByNorm && typeof data.adminNotesByNorm === 'object') {
      store.adminNotesByNorm = new Map(
        Object.entries(data.adminNotesByNorm).map(([k, v]) => [normalizeUsername(k), String(v).slice(0, 500)]),
      );
    }
    if (data.topicCounts && typeof data.topicCounts === 'object') {
      store.topicCounts = new Map(Object.entries(data.topicCounts).map(([k, v]) => [k, Number(v) || 0]));
    }

    const nu = new Set(
      [...store.registeredUsernames].map(normalizeUsername).filter(n => n.length >= 2 && n.length <= 64),
    );
    const npm = new Map();
    for (const [k, v] of store.registeredPasswords) {
      const n = normalizeUsername(k);
      if (n.length >= 2 && n.length <= 64 && !npm.has(n)) npm.set(n, v);
    }
    store.registeredUsernames = nu;
    store.registeredPasswords = npm;
    const merged = mergePasswordsIntoRegisteredSet();
    store.registeredCount = Math.max(store.registeredCount, store.registeredUsernames.size, store.registeredPasswords.size);
    if (merged) saveSnapshot();

    console.log(`[store] Loaded ${store.archivedDebates.length} archived debates, ${store.registeredCount} registered users`);
  } catch (e) {
    console.error('[store] Failed to load snapshot:', e.message);
  }
}
