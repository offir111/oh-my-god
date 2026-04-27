import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = path.join(__dirname, '..', 'store-snapshot.json');

export const store = {
  users: new Map(),        // socketId → { username, side, score, voiceDebates, giftsReceived, lastSeen }
  queue: { believer: null, atheist: null },
  debates: new Map(),      // debateId → DebateState
  spectators: new Map(),   // debateId → Set<socketId>
  userScores: new Map(),   // username → { score, voiceDebates, giftsReceived, side }
  archivedDebates: [],     // finished debates for knowledge base
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

export function saveSnapshot() {
  try {
    const data = {
      archivedDebates: store.archivedDebates,
      userScores: Object.fromEntries(store.userScores),
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
    console.log(`[store] Loaded ${store.archivedDebates.length} archived debates`);
  } catch (e) {
    console.error('[store] Failed to load snapshot:', e.message);
  }
}
