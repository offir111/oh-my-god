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
  ytTvUrl: null,
  /** שורת מיני רדיו+יוטיוב — מוצגת רק אחרי פתיחה מהתפריט */
  miniMediaBarOpen: false,
  miniMediaBarFocus: null,
  /** אחרי openMiniMediaBar(..., { play: true }) — MiniRadioBar מפעיל את התחנה ומאפס */
  miniMediaBarPlayOnOpen: null,
  /** פאנל פודקאסט LIVE מתחת לכותרת — נפתח מהתפריט */
  headerPodcastPanelOpen: false,

  setStreamingMessage: (msg) => set({ streamingMessage: msg }),
  openMiniMediaBar: (focus, opts) =>
    set({
      miniMediaBarOpen: true,
      miniMediaBarFocus: focus === 'youtube' ? 'youtube' : 'radio',
      miniMediaBarPlayOnOpen:
        opts?.play === true ? (focus === 'youtube' ? 'youtube' : 'radio') : null,
    }),
  /** החלפת מצב בשורת המיני — תמיד רדיו או יוטיוב, לא שניהם */
  setMiniMediaBarFocus: (focus, opts) =>
    set({
      miniMediaBarOpen: true,
      miniMediaBarFocus: focus === 'youtube' ? 'youtube' : 'radio',
      miniMediaBarPlayOnOpen:
        opts?.play === true ? (focus === 'youtube' ? 'youtube' : 'radio') : null,
    }),
  closeMiniMediaBar: () =>
    set({ miniMediaBarOpen: false, miniMediaBarFocus: null, miniMediaBarPlayOnOpen: null }),
  toggleHeaderPodcastPanel: () =>
    set(s => ({ headerPodcastPanelOpen: !s.headerPodcastPanelOpen })),
  openHeaderPodcastPanel: () => set({ headerPodcastPanelOpen: true }),
  closeHeaderPodcastPanel: () => set({ headerPodcastPanelOpen: false }),
  setYtTvUrl: (url) => set({ ytTvUrl: url }),
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
      set({ pendingUser, user: null, headerPodcastPanelOpen: false });
    } else {
      persistPending(null);
      set({
        pendingUser: null,
        miniMediaBarOpen: false,
        miniMediaBarFocus: null,
        miniMediaBarPlayOnOpen: null,
        headerPodcastPanelOpen: false,
      });
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
      set({
        user: null,
        pendingUser: null,
        miniMediaBarOpen: false,
        miniMediaBarFocus: null,
        miniMediaBarPlayOnOpen: null,
        headerPodcastPanelOpen: false,
      });
    }
  },

  setDebate: (debate) => set({ debate, debateId: debate?.id || null }),

  setDebateId: (debateId) => set({ debateId }),

  addTextMessage: (msg) => set(s => {
    if (!s.debate) return {};
    const list = s.debate.textMessages || [];
    /** כפילות מ־AI_STREAM_END + TEXT_MESSAGE_RECEIVED (חותמות זמן שונות לפעמים) */
    if (
      msg.isAI &&
      list.some(
        m =>
          m.isAI &&
          m.side === msg.side &&
          m.content === msg.content,
      )
    ) {
      return {};
    }
    return {
      debate: {
        ...s.debate,
        textMessages: [...list, msg],
        textCount: {
          ...s.debate.textCount,
          [msg.side]: (s.debate.textCount?.[msg.side] || 0) + 1,
        },
      },
    };
  }),

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

  resetDebate: () => set({
    debate: null,
    debateId: null,
    gifts: [],
    spectatorCount: 0,
    streamingMessage: null,
  }),
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
