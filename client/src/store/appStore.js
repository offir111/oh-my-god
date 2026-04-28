import { create } from 'zustand';

export const useAppStore = create((set, get) => ({
  user: null, // never auto-load from storage — always require fresh login
  pendingUser: null, // set after registration before side selection
  debateId: null,
  debate: null,
  gifts: [],
  spectatorCount: 0,
  streamingMessage: null, // { side, content, isAI: true }

  setStreamingMessage: (msg) => set({ streamingMessage: msg }),
  appendStreamingChunk: (chunk) => set(s => ({
    streamingMessage: s.streamingMessage
      ? { ...s.streamingMessage, content: (s.streamingMessage.content || '') + chunk }
      : s.streamingMessage,
  })),
  clearStreamingMessage: () => set({ streamingMessage: null }),

  setPendingUser: (pendingUser) => set({ pendingUser }),

  setUser: (user) => {
    // no localStorage persistence — fresh login every session
    set({ user, pendingUser: null });
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

  updateScore: (newScore) => set(s => ({
    user: s.user ? { ...s.user, score: newScore } : s.user,
  })),

  setSpectatorCount: (count) => set({ spectatorCount: count }),

  addGift: (gift) => set(s => ({ gifts: [...s.gifts, { ...gift, uid: Math.random() }] })),
  removeGift: (uid) => set(s => ({ gifts: s.gifts.filter(g => g.uid !== uid) })),

  resetDebate: () => set({ debate: null, debateId: null, gifts: [], spectatorCount: 0 }),
}));
