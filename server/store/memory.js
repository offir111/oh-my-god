import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = path.join(__dirname, '..', 'store-snapshot.json');
const REGISTERED_PASSWORDS_VERSION = 2;

export const store = {
  users: new Map(),        // socketId → { username, side, score, voiceDebates, giftsReceived, lastSeen }
  queue: { believer: null, atheist: null },
  debates: new Map(),      // debateId → DebateState
  spectators: new Map(),   // debateId → Set<socketId>
  userScores: new Map(),   // username → { score, voiceDebates, giftsReceived, side }
  archivedDebates: [],     // finished debates for knowledge base
  registeredCount: 0,      // persistent total registered users count
  registeredUsernames: new Set(), // track unique usernames to avoid double-counting
  registeredPasswords: new Map(), // username -> password hash
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

export function registerUser(username, password = null, options = {}) {
  let shouldSave = false;

  if (password !== null) {
    const passwordText = String(password);
    if (passwordText.length !== 4) {
      return { ok: false, error: 'הסיסמה חייבת להיות בדיוק 4 תווים' };
    }

    const nextHash = hashPassword(passwordText);
    const existingHash = store.registeredPasswords.get(username);
    if (existingHash && existingHash !== nextHash && !options.resetPassword) {
      return { ok: false, error: 'הסיסמה אינה תואמת לשם המשתמש הזה' };
    }

    if (!existingHash || existingHash !== nextHash) {
      store.registeredPasswords.set(username, nextHash);
      shouldSave = true;
    }
  }

  if (!store.registeredUsernames.has(username)) {
    store.registeredUsernames.add(username);
    store.registeredCount = Math.max(store.registeredCount + 1, store.registeredUsernames.size);
    shouldSave = true;
  }

  if (shouldSave) saveSnapshot();

  return { ok: true, registered: store.registeredCount };
}

export function getRegisteredStats() {
  const registeredList = [...store.registeredUsernames];
  const registered = Math.max(store.registeredCount, registeredList.length, store.registeredPasswords.size);
  return { registered, registeredList };
}

export function saveSnapshot() {
  try {
    const data = {
      archivedDebates: store.archivedDebates,
      userScores: Object.fromEntries(store.userScores),
      registeredCount: store.registeredCount,
      registeredUsernames: [...store.registeredUsernames],
      registeredPasswordsVersion: REGISTERED_PASSWORDS_VERSION,
      registeredPasswords: Object.fromEntries(store.registeredPasswords),
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
    if (data.registeredPasswordsVersion === REGISTERED_PASSWORDS_VERSION && data.registeredPasswords) {
      store.registeredPasswords = new Map(Object.entries(data.registeredPasswords));
    }
    store.registeredCount = Math.max(store.registeredCount, store.registeredUsernames.size, store.registeredPasswords.size);
    console.log(`[store] Loaded ${store.archivedDebates.length} archived debates, ${store.registeredCount} registered users`);
  } catch (e) {
    console.error('[store] Failed to load snapshot:', e.message);
  }
}
