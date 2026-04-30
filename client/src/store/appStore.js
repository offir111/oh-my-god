import { create } from 'zustand';

const LS_USER = 'omg_user';
const LS_PENDING = 'omg_pending';

function readStoredUser() {
  try {
    const raw = localStorage.getItem(LS_USER);
    if (!raw) return null;
    const u = JSON.parse(raw);
    if (u && typeof u.username === 'string' && u.username.length >= 2 && (u.side === 'believer' || u.side === 'atheist')) {
      return {
        username: u.username,
        side: u.side,
        score: typeof u.score === 'number' ? u.score : 0,
        voiceDebates: typeof u.voiceDebates === 'number' ? u.voiceDebates : 0,
        giftsReceived: typeof u.giftsReceived === 'number' ? u.giftsReceived : 0,
        humanDebates: typeof u.humanDebates === 'number' ? u.humanDebates : 0,
        aiDebates: typeof u.aiDebates === 'number' ? u.aiDebates : 0,
      };
    }
  } catch { /* ignore */ }
  return null;
}

function readStoredPending() {
  try {
    const raw = localStorage.getItem(LS_PENDING);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p && typeof p.username === 'string' && p.username.length >= 2) return { username: p.username };
  } catch { /* ignore */ }
  return null;
}

function persistFullUser(user) {
  if (user) localStorage.setItem(LS_USER, JSON.stringify(user));
  else localStorage.removeItem(LS_USER);
}

function persistPending(pending) {
  if (pending) localStorage.setItem(LS_PENDING, JSON.stringify(pending));
  else localStorage.removeItem(LS_PENDING);
}

const initialUser = readStoredUser();
const initialPending = initialUser ? null : readStoredPending();

export const useAppStore = create((set) => ({
  user: initialUser,
  pendingUser: initialPending,
  debateId: null,
  debate: null,
  gifts: [],
  spectatorCount: 0,
  streamingMessage: null,

  setStreamingMessage: (msg) => set({ streamingMessage: msg }),
  appendStreamingChunk: (chunk) => set(s => ({
    streamingMessage: s.streamingMessage
      ? { ...s.streamingMessage, content: (s.streamingMessage.content || '') + chunk }
      : s.streamingMessage,
  })),
  clearStreamingMessage: () => set({ streamingMessage: null }),

  setPendingUser: (pendingUser) => {
    if (pendingUser) {
      persistPending(pendingUser);
      persistFullUser(null);
      set({ pendingUser, user: null });
    } else {
      persistPending(null);
      set({ pendingUser: null });
    }
  },

  setUser: (user) => {
    if (user) {
      persistFullUser(user);
      persistPending(null);
      set({ user, pendingUser: null });
    } else {
      persistFullUser(null);
      persistPending(null);
      set({ user: null, pendingUser: null });
    }
  },

  setDebate: (debate) => set({ debate, debateId: debate?.id || null }),

  setDebateId: (debateId) => set({ debateId }),

  addTextMessage: (msg) => set(s => ({
    debate: s.debate ? {
      ...s.debate,
      textMessages: [...(s.debate.textMessages || []), msg],
      textCount: {
        ...s.debate.textCount,
        [msg.side]: (s.debate.textCount?.[msg.side] || 0) + 1,
      },
    } : s.debate,
  })),

  addVoiceMessage: (msg) => set(s => ({
    debate: s.debate ? {
      ...s.debate,
      voiceMessages: [...(s.debate.voiceMessages || []), msg],
      voiceCount: {
        ...s.debate.voiceCount,
        [msg.side]: (s.debate.voiceCount?.[msg.side] || 0) + 1,
      },
    } : s.debate,
  })),

  setPhase: (phase) => set(s => ({
    debate: s.debate ? { ...s.debate, phase } : s.debate,
  })),

  setTurn: (turn) => set(s => ({
    debate: s.debate ? { ...s.debate, turn } : s.debate,
  })),

  updateScore: (newScore) => set(s => {
    const nextUser = s.user ? { ...s.user, score: newScore } : s.user;
    if (nextUser) persistFullUser(nextUser);
    return { user: nextUser };
  }),

  setSpectatorCount: (count) => set({ spectatorCount: count }),

  addGift: (gift) => set(s => ({ gifts: [...s.gifts, { ...gift, uid: Math.random() }] })),
  removeGift: (uid) => set(s => ({ gifts: s.gifts.filter(g => g.uid !== uid) })),

  resetDebate: () => set({ debate: null, debateId: null, gifts: [], spectatorCount: 0 }),
}));

/** משחזר user מהדפדפן אם ה־store ריק — חובה לפני setPendingUser שמוחק את omg_user */
export function rehydrateUserIfNeeded() {
  const store = useAppStore.getState();
  const existing = store.user;
  if (existing?.username && (existing.side === 'believer' || existing.side === 'atheist')) {
    return existing;
  }
  const fromLs = readStoredUser();
  if (fromLs) {
    store.setUser(fromLs);
    return fromLs;
  }
  return null;
}
