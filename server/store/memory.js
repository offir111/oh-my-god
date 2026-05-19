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
  permanentOnlineUsernames: new Set(), // יוזרים שתמיד מוצגים כמחוברים (demo)
  /** מפתח: authorNorm|postId — הסתרה מהבלוג הציבורי (ללא מחיקה ממכשירי המשתמשים) */
  blogFeedHiddenPostKeys: new Set(),
  /** מפתח זהה — מוסתר מהפיד עד «ברור» (מודרציה זמנית) */
  blogFeedPendingReviewKeys: new Set(),
  /** כותבים שכל הפוסטים שלהם מוסתרים מהבלוג הציבורי */
  blogFeedBlockedAuthors: new Set(),
  /** נירמול שם → { text, ts } — התראת עורך על תוכן פוגעני (מוצג בפרופיל של הכותב) */
  blogAuthorNoticesByNorm: new Map(),
  /** פוסטים שנוצרו על-ידי יוזרים וירטואלים — נשמרים בסנאפשוט */
  virtualPosts: [],          // [{id, author, displayName, side, title, body, ts, readMoreUrl, isVirtual}]
  /** אינדקס round-robin — מי מפרסם הבא */
  virtualFeedNextIndex: 0,
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

function blogFeedModerationPostKey(authorNorm, postId) {
  return `${normalizeUsername(authorNorm)}|${String(postId || '').trim()}`;
}

export function getBlogFeedModerationPayload() {
  return {
    hiddenKeys: [...store.blogFeedHiddenPostKeys],
    pendingKeys: [...store.blogFeedPendingReviewKeys],
    blockedAuthors: [...store.blogFeedBlockedAuthors],
  };
}

export function hideBlogPostFromPublicFeed(author, postId) {
  const k = blogFeedModerationPostKey(author, postId);
  store.blogFeedHiddenPostKeys.add(k);
  store.blogFeedPendingReviewKeys.delete(k);
  saveSnapshot();
}

export function hideBlogPostPendingReview(author, postId) {
  store.blogFeedPendingReviewKeys.add(blogFeedModerationPostKey(author, postId));
  saveSnapshot();
}

export function clearBlogPostPendingReview(author, postId) {
  store.blogFeedPendingReviewKeys.delete(blogFeedModerationPostKey(author, postId));
  saveSnapshot();
}

export function unhideBlogPostFromPublicFeed(author, postId) {
  store.blogFeedHiddenPostKeys.delete(blogFeedModerationPostKey(author, postId));
  saveSnapshot();
}

export function blockBlogAuthorFromPublicFeed(author) {
  const n = normalizeUsername(author);
  if (!n || n === RESERVED_ADMIN_NORM) return false;
  store.blogFeedBlockedAuthors.add(n);
  saveSnapshot();
  return true;
}

export function unblockBlogAuthorFromPublicFeed(author) {
  store.blogFeedBlockedAuthors.delete(normalizeUsername(author));
  saveSnapshot();
  return true;
}

export function setBlogAuthorModerationNotice(author, text) {
  const norm = normalizeUsername(author);
  if (!norm || norm === RESERVED_ADMIN_NORM) return false;
  const t = String(text || '').trim().slice(0, 800);
  if (!t) {
    store.blogAuthorNoticesByNorm.delete(norm);
    saveSnapshot();
    return true;
  }
  store.blogAuthorNoticesByNorm.set(norm, { text: t, ts: Date.now() });
  saveSnapshot();
  return true;
}

export function getBlogAuthorNoticePayload(username) {
  const norm = normalizeUsername(username);
  const row = store.blogAuthorNoticesByNorm.get(norm);
  if (!row || !row.text) return { text: '', ts: 0 };
  return { text: String(row.text), ts: Number(row.ts) || 0 };
}

/**
 * רישום נרשמים הוא צובר קבוע (append-only): מי שנוסף ל־registeredUsernames או ל־registeredPasswords
 * לא נמחק מהרישום בשום זרימה תקינה — רק חסימת משתמש שונה מסירה מהמערכת הפעילה, לא מהצובר כאן.
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
    .map(norm => {
      const scores = store.userScores.get(norm) || {};
      return {
        username: norm === RESERVED_ADMIN_NORM ? 'OMG' : norm,
        normalized: norm,
        blocked: store.blockedNormUsernames.has(norm),
        note: store.adminNotesByNorm.get(norm) || '',
        score: scores.score || 0,
        voiceDebates: scores.voiceDebates || 0,
        giftsReceived: scores.giftsReceived || 0,
        side: scores.side || '',
      };
    })
    .sort((a, b) => (b.score - a.score) || a.normalized.localeCompare(b.normalized, 'he'));
}

export function deleteUser(username) {
  const norm = normalizeUsername(username);
  if (!norm || norm === RESERVED_ADMIN_NORM) return false;
  store.registeredUsernames.delete(norm);
  store.registeredPasswords.delete(norm);
  store.userScores.delete(norm);
  store.adminNotesByNorm.delete(norm);
  store.blockedNormUsernames.delete(norm);
  store.permanentOnlineUsernames.delete(norm);
  store.registeredCount = Math.max(store.registeredUsernames.size, store.registeredPasswords.size);
  saveSnapshot();
  return true;
}

/**
 * אפס כניסה של משתמש — מוחק סיסמה ומסיר מרשימת הרשומים.
 * פותר בעיית כניסה כפולה (אפליקציה + דפדפן). הניקוד נשמר.
 */
export function resetUserLogin(username) {
  const norm = normalizeUsername(username);
  if (!norm || norm === RESERVED_ADMIN_NORM) return false;
  store.registeredPasswords.delete(norm);
  store.registeredUsernames.delete(norm);
  store.registeredCount = Math.max(store.registeredUsernames.size, store.registeredPasswords.size);
  saveSnapshot();
  return true;
}

export function resetUserScore(username) {
  const norm = normalizeUsername(username);
  if (!norm || norm === RESERVED_ADMIN_NORM) return false;
  if (store.userScores.has(norm)) {
    const profile = store.userScores.get(norm);
    profile.score = 0;
    profile.voiceDebates = 0;
    profile.giftsReceived = 0;
    saveSnapshot();
  }
  return true;
}

export function deleteArchivedDebate(debateId) {
  const idx = store.archivedDebates.findIndex(d => d.id === debateId);
  if (idx === -1) return false;
  store.archivedDebates.splice(idx, 1);
  saveSnapshot();
  return true;
}

export function getArchivedDebatesAdmin() {
  return [...store.archivedDebates].reverse().slice(0, 200).map(d => ({
    id: d.id,
    believer: d.believer?.username || '',
    atheist: d.atheist?.username || '',
    isAI: d.isAI || false,
    startedAt: d.startedAt || 0,
    finishedAt: d.finishedAt || 0,
    messageCount: (d.textMessages?.length || 0) + (d.voiceMessages?.length || 0),
    summary: d.summary || '',
    tags: d.tags || [],
  }));
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

/** יוזרי דמו שהוסרו מהמוצר — נמחקים מסנאפשוט בכל עליית שרת */
const RETIRED_VIRTUAL_USER_NORMS = [normalizeUsername('דוד_אמסלם')].filter(Boolean);

export function purgeRetiredVirtualUsers() {
  let changed = false;
  for (const norm of RETIRED_VIRTUAL_USER_NORMS) {
    if (!norm || norm === RESERVED_ADMIN_NORM) continue;
    if (store.permanentOnlineUsernames.delete(norm)) changed = true;
    if (store.registeredUsernames.delete(norm)) changed = true;
    if (store.registeredPasswords.delete(norm)) changed = true;
    if (store.userScores.delete(norm)) changed = true;
    if (store.adminNotesByNorm.delete(norm)) changed = true;
    for (const k of [...store.userScores.keys()]) {
      if (normalizeUsername(k) === norm) {
        store.userScores.delete(k);
        changed = true;
      }
    }
  }
  if (changed) {
    store.registeredCount = Math.max(store.registeredUsernames.size, store.registeredPasswords.size);
    saveSnapshot();
    console.log('[store] purgeRetiredVirtualUsers: removed retired demo user(s) from snapshot');
  }
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
    store.registeredCount = Math.max(store.registeredCount, allRegisteredNorms().size);
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
      permanentOnlineUsernames: [...store.permanentOnlineUsernames],
      blogFeedHiddenPostKeys: [...store.blogFeedHiddenPostKeys],
      blogFeedPendingReviewKeys: [...store.blogFeedPendingReviewKeys],
      blogFeedBlockedAuthors: [...store.blogFeedBlockedAuthors],
      blogAuthorNoticesByNorm: Object.fromEntries(store.blogAuthorNoticesByNorm),
      virtualPosts: store.virtualPosts,
      virtualFeedNextIndex: store.virtualFeedNextIndex,
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
    if (Array.isArray(data.permanentOnlineUsernames)) {
      store.permanentOnlineUsernames = new Set(data.permanentOnlineUsernames.map(normalizeUsername).filter(Boolean));
    }
    if (Array.isArray(data.blogFeedHiddenPostKeys)) {
      store.blogFeedHiddenPostKeys = new Set(data.blogFeedHiddenPostKeys.filter(x => typeof x === 'string' && x.includes('|')));
    }
    if (Array.isArray(data.blogFeedPendingReviewKeys)) {
      store.blogFeedPendingReviewKeys = new Set(data.blogFeedPendingReviewKeys.filter(x => typeof x === 'string' && x.includes('|')));
    }
    if (Array.isArray(data.blogFeedBlockedAuthors)) {
      store.blogFeedBlockedAuthors = new Set(data.blogFeedBlockedAuthors.map(normalizeUsername).filter(Boolean));
    }
    if (data.blogAuthorNoticesByNorm && typeof data.blogAuthorNoticesByNorm === 'object') {
      const m = new Map();
      for (const [k, v] of Object.entries(data.blogAuthorNoticesByNorm)) {
        const norm = normalizeUsername(k);
        if (!norm) continue;
        if (v && typeof v === 'object' && typeof v.text === 'string') {
          m.set(norm, { text: String(v.text).slice(0, 800), ts: Number(v.ts) || 0 });
        } else if (typeof v === 'string') {
          m.set(norm, { text: String(v).slice(0, 800), ts: 0 });
        }
      }
      store.blogAuthorNoticesByNorm = m;
    }

    if (Array.isArray(data.virtualPosts)) {
      store.virtualPosts = data.virtualPosts.filter(p => p && p.id && p.author);
    }
    if (typeof data.virtualFeedNextIndex === 'number') {
      store.virtualFeedNextIndex = data.virtualFeedNextIndex;
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
