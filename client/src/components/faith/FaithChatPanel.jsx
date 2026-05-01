import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useAppStore } from '../../store/appStore.js';
import { acquireFaithChatConnection, releaseFaithChatConnection, faithSocket } from '../../socketFaith.js';

const DISPLAY_NAME_KEY = 'faith_chat_display_name';
const PREFS_KEY = 'faith_chat_prefs';
/** מטמון הודעות ציבוריות במכשיר — נשאר אחרי יציאה מהדף / ניתוק סוקט */
const PUBLIC_MESSAGES_STORAGE_KEY = 'faith_chat_public_messages_v1';
const MAX_STORED_PUBLIC = 300;
const DM_SLOT_COUNT = 3;

/** משתמשי דמו ברשימת מחוברים + בצ׳אט הציבורי (תגובות AI מסומנות בשם) */
/** מזהה זרע נפרד לפתיחת אורית — כדי להחליף טקסט ישן במטמון */
const ORIT_OPENING_SEED_ID = 'faith-virt-seed-orit-opening-v3';

function virtSeedMessageId(v) {
  return v.socketId === '__faith_virt_orit__' ? ORIT_OPENING_SEED_ID : `faith-virt-seed-${v.socketId}`;
}

function isRemovedVirtSeedChatMessage(m) {
  if (m.id === 'faith-virt-seed-orit-followup') return true;
  if (m.id === 'faith-virt-seed-__faith_virt_orit__') return true;
  if (/^faith-virt-seed-\d+$/.test(m.id)) return true;
  return false;
}

const FAITH_VIRTUAL_USERS = [
  {
    socketId: '__faith_virt_orit__',
    displayName: 'אורית',
    firstMessage: 'זו אפליקציה חדשה כמה נחמד..',
  },
  {
    socketId: '__faith_virt_matan__',
    displayName: 'מתן',
    firstMessage: 'יש הזדמנות להכיר אנשים חדשים.',
  },
  {
    socketId: '__faith_virt_elhanan__',
    displayName: 'אלחנן',
    firstMessage:
      'עוד מעט אני צריך לצאת, בטוח אחזור שוב — יצאתי ללא התראה אז נתראה אחר כך...',
  },
];

const VIRT_REPLY_POOL = [
  'נחמד לראות עוד מישהו כאן.',
  'מסכים, אפשר באמת להתיידד פה.',
  'תודה על השיתוף, מעניין לשמוע.',
  'ברוך הבא, תרגישו חופשי לכתוב.',
  'יש כאן אווירה טובה.',
  'כיף שהאפליקציה מתמלאת אנשים.',
];

function emptyDmSlots() {
  return Array.from({ length: DM_SLOT_COUNT }, () => ({ partner: null, messages: [] }));
}

function readCachedPublicMessages() {
  try {
    const raw = localStorage.getItem(PUBLIC_MESSAGES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((m) => m?.id && typeof m.text === 'string')
      .filter((m) => !isRemovedVirtSeedChatMessage(m))
      .sort((a, b) => (a.ts || 0) - (b.ts || 0))
      .slice(-MAX_STORED_PUBLIC);
  } catch {
    return [];
  }
}

function persistPublicMessagesToStorage(messages) {
  try {
    const trimmed = messages.slice(-MAX_STORED_PUBLIC);
    localStorage.setItem(PUBLIC_MESSAGES_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    /* quota / private mode */
  }
}

function readPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    const p = raw ? JSON.parse(raw) : {};
    return {
      soundOn: p.soundOn !== false,
      showTimestamps: p.showTimestamps !== false,
      enterSends: p.enterSends !== false,
      showOnlineAvatars: p.showOnlineAvatars !== false,
    };
  } catch {
    return { soundOn: true, showTimestamps: true, enterSends: true, showOnlineAvatars: true };
  }
}

function savePrefs(p) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

function readStoredDisplayName() {
  try {
    const v = localStorage.getItem(DISPLAY_NAME_KEY);
    if (typeof v === 'string' && v.trim()) return v.trim().slice(0, 40);
  } catch {
    /* ignore */
  }
  return '';
}

function persistDisplayName(name) {
  try {
    if (name.trim()) localStorage.setItem(DISPLAY_NAME_KEY, name.trim().slice(0, 40));
    else localStorage.removeItem(DISPLAY_NAME_KEY);
  } catch {
    /* ignore */
  }
}

function playSoftPing() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 784;
    g.gain.value = 0.06;
    o.start();
    setTimeout(() => {
      try {
        o.stop();
        ctx.close();
      } catch {
        /* ignore */
      }
    }, 100);
  } catch {
    /* ignore */
  }
}

export default function FaithChatPanel() {
  const user = useAppStore(s => s.user);
  const pendingUser = useAppStore(s => s.pendingUser);
  const defaultName = user?.username || pendingUser?.username || '';
  const hasLoginChatName = Boolean(String(defaultName || '').trim());

  const [prefs, setPrefs] = useState(readPrefs);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [displayName, setDisplayName] = useState(() => readStoredDisplayName() || defaultName || '');

  const effectiveChatName = useMemo(() => {
    const login = String(defaultName || '').trim().slice(0, 40);
    if (login) return login;
    return String(displayName || '').trim().slice(0, 40);
  }, [defaultName, displayName]);
  const [mySocketId, setMySocketId] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [chatConnected, setChatConnected] = useState(false);

  const [publicMessages, setPublicMessages] = useState(readCachedPublicMessages);
  const [dmPartner, setDmPartner] = useState(null);
  /** אינדקס החריץ (0..2) שבו פעילה כרגע שיחה פרטית מול השרת — לרוב אחד בלבד */
  const [liveDmSlotIndex, setLiveDmSlotIndex] = useState(null);
  const [dmSlots, setDmSlots] = useState(emptyDmSlots);
  /** 'public' | 0 | 1 | 2 — איזו לשונית מוצגת */
  const [activePanel, setActivePanel] = useState('public');
  const [partnerTyping, setPartnerTyping] = useState(false);

  const [draftPublic, setDraftPublic] = useState('');
  const [draftDm, setDraftDm] = useState('');
  const [draftDmRequestNote, setDraftDmRequestNote] = useState('');

  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingToast, setOutgoingToast] = useState(null);
  const [errorToast, setErrorToast] = useState(null);
  const [joinedLobby, setJoinedLobby] = useState(false);
  /** דמו ויזואלי: אורית «כותבת» ללא שליחת טקסט — דקה מרגע ההתחברות לצ׳אט */
  const [showOritTypingDemo, setShowOritTypingDemo] = useState(false);

  const listScrollRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const virtualReplyTimerRef = useRef(null);
  const oritTypingDemoTimerRef = useRef(null);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const displayNameRef = useRef(displayName);
  displayNameRef.current = displayName;
  const liveDmSlotIndexRef = useRef(null);
  liveDmSlotIndexRef.current = liveDmSlotIndex;
  const activePanelRef = useRef('public');
  activePanelRef.current = activePanel;

  useEffect(() => {
    const login = String(user?.username || pendingUser?.username || '').trim().slice(0, 40);
    if (login) {
      setDisplayName(login);
      persistDisplayName(login);
    }
  }, [user?.username, pendingUser?.username]);

  useEffect(() => {
    persistPublicMessagesToStorage(publicMessages);
  }, [publicMessages]);

  const updatePrefs = useCallback(patch => {
    setPrefs(prev => {
      const next = { ...prev, ...patch };
      savePrefs(next);
      return next;
    });
  }, []);

  useEffect(() => {
    acquireFaithChatConnection();

    function onConnect() {
      setChatConnected(true);
      if (faithSocket.id) setMySocketId(faithSocket.id);
      faithSocket.emit('FAITH_PUBLIC_WATCH');
    }

    function onSocketDisconnect() {
      if (virtualReplyTimerRef.current) {
        clearTimeout(virtualReplyTimerRef.current);
        virtualReplyTimerRef.current = null;
      }
      if (oritTypingDemoTimerRef.current) {
        clearTimeout(oritTypingDemoTimerRef.current);
        oritTypingDemoTimerRef.current = null;
      }
      setShowOritTypingDemo(false);
      setChatConnected(false);
      setJoinedLobby(false);
      setActivePanel('public');
      setOnlineUsers([]);
      setIncomingRequests([]);
      setDmPartner(null);
      setLiveDmSlotIndex(null);
      liveDmSlotIndexRef.current = null;
      setDmSlots(emptyDmSlots());
    }

    function onSocketId({ socketId }) {
      setMySocketId(socketId);
    }

    function onPresence({ users }) {
      setOnlineUsers(Array.isArray(users) ? users : []);
    }

    function onPublicHistory({ messages }) {
      if (!Array.isArray(messages)) return;
      const valid = messages.filter(m => m?.id && typeof m.text === 'string');
      setPublicMessages(prev => {
        const byId = new Map();
        valid.forEach(m => byId.set(m.id, m));
        prev.forEach(m => {
          if (!byId.has(m.id)) byId.set(m.id, m);
        });
        return [...byId.values()]
          .sort((a, b) => (a.ts || 0) - (b.ts || 0))
          .slice(-300);
      });
    }

    function onPublicMsg(payload) {
      if (!payload?.id || typeof payload.text !== 'string') return;
      const sid = faithSocket.id;
      setPublicMessages(prev => {
        if (prev.some(m => m.id === payload.id)) return prev;
        const withoutStaleLocal = prev.filter(m => {
          if (!String(m.id).startsWith('local-')) return true;
          if (m.text !== payload.text) return true;
          if (m.fromSocketId === payload.fromSocketId) return false;
          if (
            sid &&
            payload.fromSocketId === sid &&
            (m.fromSocketId === sid || m.fromSocketId === 'pending' || m.fromSocketId === '')
          ) {
            return false;
          }
          return true;
        });
        return [...withoutStaleLocal.slice(-300), payload];
      });
    }

    function onDmMsg(payload) {
      if (!payload?.id || typeof payload.text !== 'string') return;
      const ix = liveDmSlotIndexRef.current;
      if (ix === null || ix === undefined) return;
      setDmSlots(prev => {
        const next = [...prev];
        const s = next[ix];
        if (!s?.partner) return prev;
        next[ix] = { ...s, messages: [...s.messages.slice(-400), payload] };
        return next;
      });
      if (prefsRef.current.soundOn && payload.fromSocketId !== faithSocket.id) playSoftPing();
    }

    function onIncomingRequest(req) {
      if (!req?.fromSocketId || !req?.fromName) return;
      setIncomingRequests(prev => [...prev.filter(r => r.fromSocketId !== req.fromSocketId), req]);
      if (prefsRef.current.soundOn) playSoftPing();
    }

    function onRequestSent({ targetName }) {
      setOutgoingToast(`נשלחה בקשה ל־${targetName || 'משתמש'}`);
      setTimeout(() => setOutgoingToast(null), 4000);
    }

    function onDmOpened({ partnerSocketId, partnerName }) {
      setDmSlots(prev => {
        let ix = prev.findIndex(s => !s.partner);
        if (ix < 0) ix = DM_SLOT_COUNT - 1;
        liveDmSlotIndexRef.current = ix;
        setLiveDmSlotIndex(ix);
        setActivePanel(ix);
        const next = [...prev];
        next[ix] = { partner: { socketId: partnerSocketId, name: partnerName }, messages: [] };
        return next;
      });
      setDmPartner({ socketId: partnerSocketId, name: partnerName });
      setPartnerTyping(false);
    }

    function onDmEnded({ reason }) {
      const ix = liveDmSlotIndexRef.current;
      setDmSlots(prev => {
        if (ix === null || ix === undefined) return prev;
        const next = [...prev];
        next[ix] = { partner: null, messages: [] };
        return next;
      });
      liveDmSlotIndexRef.current = null;
      setLiveDmSlotIndex(null);
      setDmPartner(null);
      setPartnerTyping(false);
      setActivePanel('public');
      if (reason === 'self_left' || reason === 'lobby_left') return;
      if (reason === 'partner_disconnected') setErrorToast('הצד השני התנתק מהשיחה');
      else if (reason === 'partner_left') setErrorToast('הצד השני סיים את השיחה הפרטית');
      setTimeout(() => setErrorToast(null), 5000);
    }

    function onRejected({ byName }) {
      setErrorToast(`${byName || 'משתמש'} דחה את בקשת השיחה`);
      setTimeout(() => setErrorToast(null), 5000);
    }

    function onError({ message }) {
      setErrorToast(message || 'שגיאה');
      setTimeout(() => setErrorToast(null), 5000);
    }

    function onDmTyping({ typing }) {
      setPartnerTyping(!!typing);
    }

    faithSocket.on('connect', onConnect);
    faithSocket.on('disconnect', onSocketDisconnect);
    faithSocket.on('FAITH_SOCKET_ID', onSocketId);
    faithSocket.on('FAITH_PRESENCE_LIST', onPresence);
    faithSocket.on('FAITH_PUBLIC_HISTORY', onPublicHistory);
    faithSocket.on('FAITH_CHAT_MESSAGE', onPublicMsg);
    faithSocket.on('FAITH_DM_MESSAGE', onDmMsg);
    faithSocket.on('FAITH_DM_REQUEST_INCOMING', onIncomingRequest);
    faithSocket.on('FAITH_DM_REQUEST_SENT', onRequestSent);
    faithSocket.on('FAITH_DM_OPENED', onDmOpened);
    faithSocket.on('FAITH_DM_ENDED', onDmEnded);
    faithSocket.on('FAITH_DM_REJECTED', onRejected);
    faithSocket.on('FAITH_DM_ERROR', onError);
    faithSocket.on('FAITH_DM_TYPING', onDmTyping);

    if (faithSocket.connected) onConnect();

    return () => {
      if (faithSocket.connected) faithSocket.emit('FAITH_PUBLIC_UNWATCH');
      faithSocket.off('connect', onConnect);
      faithSocket.off('disconnect', onSocketDisconnect);
      faithSocket.off('FAITH_SOCKET_ID', onSocketId);
      faithSocket.off('FAITH_PRESENCE_LIST', onPresence);
      faithSocket.off('FAITH_PUBLIC_HISTORY', onPublicHistory);
      faithSocket.off('FAITH_CHAT_MESSAGE', onPublicMsg);
      faithSocket.off('FAITH_DM_MESSAGE', onDmMsg);
      faithSocket.off('FAITH_DM_REQUEST_INCOMING', onIncomingRequest);
      faithSocket.off('FAITH_DM_REQUEST_SENT', onRequestSent);
      faithSocket.off('FAITH_DM_OPENED', onDmOpened);
      faithSocket.off('FAITH_DM_ENDED', onDmEnded);
      faithSocket.off('FAITH_DM_REJECTED', onRejected);
      faithSocket.off('FAITH_DM_ERROR', onError);
      faithSocket.off('FAITH_DM_TYPING', onDmTyping);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (virtualReplyTimerRef.current) {
        clearTimeout(virtualReplyTimerRef.current);
        virtualReplyTimerRef.current = null;
      }
      if (oritTypingDemoTimerRef.current) {
        clearTimeout(oritTypingDemoTimerRef.current);
        oritTypingDemoTimerRef.current = null;
      }
      releaseFaithChatConnection();
    };
  }, []);

  useEffect(() => {
    if (!joinedLobby) {
      setShowOritTypingDemo(false);
      if (oritTypingDemoTimerRef.current) {
        clearTimeout(oritTypingDemoTimerRef.current);
        oritTypingDemoTimerRef.current = null;
      }
      return;
    }
    setShowOritTypingDemo(true);
    if (oritTypingDemoTimerRef.current) clearTimeout(oritTypingDemoTimerRef.current);
    oritTypingDemoTimerRef.current = window.setTimeout(() => {
      setShowOritTypingDemo(false);
      oritTypingDemoTimerRef.current = null;
    }, 60_000);
    return () => {
      if (oritTypingDemoTimerRef.current) {
        clearTimeout(oritTypingDemoTimerRef.current);
        oritTypingDemoTimerRef.current = null;
      }
    };
  }, [joinedLobby]);

  useEffect(() => {
    if (!joinedLobby) return;
    setPublicMessages((prev) => {
      const withoutStaleVirtChat = prev.filter((m) => !isRemovedVirtSeedChatMessage(m));

      const seedIds = FAITH_VIRTUAL_USERS.map((v) => virtSeedMessageId(v));
      const needsStandardSeeds = !seedIds.every((id) => withoutStaleVirtChat.some((m) => m.id === id));
      if (!needsStandardSeeds) return withoutStaleVirtChat;

      const oldestTs =
        withoutStaleVirtChat.length > 0
          ? Math.min(...withoutStaleVirtChat.map((m) => (typeof m.ts === 'number' ? m.ts : Date.now())))
          : Date.now();
      const baseTs = oldestTs - 5000 - FAITH_VIRTUAL_USERS.length * 800;
      const seeds = FAITH_VIRTUAL_USERS.map((v, i) => ({
        id: virtSeedMessageId(v),
        fromSocketId: v.socketId,
        displayName: v.displayName,
        text: v.firstMessage,
        ts: baseTs + i * 750,
      }));
      const merged = [...withoutStaleVirtChat];
      for (const s of seeds) {
        if (!merged.some((m) => m.id === s.id)) merged.push(s);
      }
      return merged.sort((a, b) => (a.ts || 0) - (b.ts || 0)).slice(-300);
    });
  }, [joinedLobby]);

  useEffect(() => {
    if (!joinedLobby || !chatConnected || !faithSocket.connected) return;
    const name = displayName.trim() || 'אורח';
    faithSocket.emit('FAITH_UPDATE_DISPLAY_NAME', { displayName: name });
    persistDisplayName(name);
  }, [displayName, chatConnected, joinedLobby]);

  useEffect(() => {
    const el = listScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [publicMessages, dmSlots, activePanel, partnerTyping, showOritTypingDemo]);

  const othersOnline = useMemo(
    () => onlineUsers.filter(u => u.socketId !== mySocketId),
    [onlineUsers, mySocketId],
  );

  const othersOnlineWithVirtual = useMemo(() => {
    if (!joinedLobby) return othersOnline;
    const virt = FAITH_VIRTUAL_USERS.map((v) => ({
      socketId: v.socketId,
      displayName: v.displayName,
      joinedAt: 0,
      virtual: true,
    }));
    return [...othersOnline, ...virt];
  }, [joinedLobby, othersOnline]);

  const isPrivatePanel = activePanel !== 'public';
  const activePrivateSlot = isPrivatePanel ? dmSlots[activePanel] : null;
  const viewingLivePrivate =
    isPrivatePanel &&
    liveDmSlotIndex === activePanel &&
    Boolean(dmPartner) &&
    activePrivateSlot?.partner &&
    dmPartner.socketId === activePrivateSlot.partner.socketId;

  const joinLobby = useCallback(() => {
    const login = String(user?.username || pendingUser?.username || '').trim().slice(0, 40);
    const name = (login || String(displayNameRef.current || '').trim()).slice(0, 40);
    if (!name || !faithSocket.connected) return;
    setDisplayName(name);
    persistDisplayName(name);
    faithSocket.emit('FAITH_CHAT_JOIN', { displayName: name });
    setJoinedLobby(true);
  }, [user?.username, pendingUser?.username]);

  const leaveLobby = useCallback(() => {
    if (virtualReplyTimerRef.current) {
      clearTimeout(virtualReplyTimerRef.current);
      virtualReplyTimerRef.current = null;
    }
    if (oritTypingDemoTimerRef.current) {
      clearTimeout(oritTypingDemoTimerRef.current);
      oritTypingDemoTimerRef.current = null;
    }
    setShowOritTypingDemo(false);
    faithSocket.emit('FAITH_CHAT_LEAVE');
    setJoinedLobby(false);
    setActivePanel('public');
    setDmPartner(null);
    setLiveDmSlotIndex(null);
    liveDmSlotIndexRef.current = null;
    setDmSlots(emptyDmSlots());
    setIncomingRequests([]);
  }, []);

  const sendPublic = useCallback(() => {
    const text = draftPublic.trim();
    if (!text || !faithSocket.connected || !joinedLobby) return;
    const fromId = faithSocket.id || mySocketId || '';
    setPublicMessages(prev => [
      ...prev.slice(-300),
      {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        fromSocketId: fromId || 'pending',
        displayName: (displayNameRef.current || '').trim() || 'אורח',
        text,
        ts: Date.now(),
      },
    ]);
    faithSocket.emit('FAITH_CHAT_MESSAGE', { text });
    setDraftPublic('');

    if (virtualReplyTimerRef.current) {
      clearTimeout(virtualReplyTimerRef.current);
      virtualReplyTimerRef.current = null;
    }
    virtualReplyTimerRef.current = setTimeout(() => {
      virtualReplyTimerRef.current = null;
      const pick = FAITH_VIRTUAL_USERS[Math.floor(Math.random() * FAITH_VIRTUAL_USERS.length)];
      const replyText = VIRT_REPLY_POOL[Math.floor(Math.random() * VIRT_REPLY_POOL.length)];
      if (prefsRef.current.soundOn) playSoftPing();
      setPublicMessages(prev => [
        ...prev.slice(-299),
        {
          id: `virt-reply-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
          fromSocketId: pick.socketId,
          displayName: `${pick.displayName} · AI`,
          text: replyText,
          ts: Date.now(),
        },
      ]);
    }, 1600 + Math.random() * 2400);
  }, [draftPublic, joinedLobby, mySocketId]);

  const sendDm = useCallback(() => {
    const text = draftDm.trim();
    if (!text || !faithSocket.connected || !dmPartner || !joinedLobby) return;
    if (liveDmSlotIndexRef.current !== activePanelRef.current) return;
    faithSocket.emit('FAITH_DM_MESSAGE', { text });
    setDraftDm('');
    faithSocket.emit('FAITH_DM_TYPING', { typing: false });
  }, [draftDm, dmPartner, joinedLobby]);

  const requestDm = useCallback((targetSocketId) => {
    if (!joinedLobby) return;
    const note = draftDmRequestNote.trim();
    faithSocket.emit('FAITH_DM_REQUEST', { targetSocketId, note: note || undefined });
    setDraftDmRequestNote('');
  }, [draftDmRequestNote, joinedLobby]);

  const respondDm = useCallback((accept, fromSocketId) => {
    faithSocket.emit('FAITH_DM_RESPOND', { accept, fromSocketId });
    setIncomingRequests(prev => prev.filter(r => r.fromSocketId !== fromSocketId));
  }, []);

  const leaveDm = useCallback(() => {
    faithSocket.emit('FAITH_DM_LEAVE');
  }, []);

  const emitTypingDm = useCallback((typing) => {
    if (!dmPartner || liveDmSlotIndexRef.current !== activePanelRef.current) return;
    faithSocket.emit('FAITH_DM_TYPING', { typing });
  }, [dmPartner]);

  const onDmDraftChange = useCallback((e) => {
    setDraftDm(e.target.value);
    if (!dmPartner || liveDmSlotIndexRef.current !== activePanelRef.current) return;
    emitTypingDm(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => emitTypingDm(false), 1800);
  }, [dmPartner, emitTypingDm]);

  return (
    <>
      <style>{`
        .fcp-root { max-width: 1080px; margin: 12px auto 0; padding: 0 10px 24px; direction: rtl; }
        .fcp-grid {
          display: grid;
          grid-template-columns: minmax(168px, 200px) minmax(0, 1fr);
          gap: 10px;
          align-items: stretch;
        }
        .fcp-grid--solo {
          grid-template-columns: minmax(0, 1fr);
        }
        .fcp-topbar {
          grid-column: 1 / -1;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px 10px;
          margin-bottom: 2px;
        }
        .fcp-status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.7rem;
          font-weight: 700;
          color: var(--muted);
        }
        .fcp-dot { width: 7px; height: 7px; border-radius: 50%; background: #64748b; }
        .fcp-dot.on { background: #34d399; box-shadow: 0 0 8px rgba(52,211,153,0.4); }
        .fcp-name-field {
          display: flex;
          align-items: center;
          gap: 6px;
          flex: 1;
          min-width: 140px;
        }
        .fcp-name-field label { font-size: 0.7rem; color: var(--muted); font-weight: 700; white-space: nowrap; }
        .fcp-name-field input {
          flex: 1;
          min-width: 96px;
          padding: 5px 9px;
          border-radius: 9px;
          border: 1px solid var(--border-strong);
          background: rgba(10,10,16,0.55);
          color: var(--text);
          font-size: 0.78rem;
          text-align: right;
        }
        .fcp-name-field input:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }
        .fcp-name-readonly {
          display: flex;
          align-items: center;
          gap: 4px;
          flex: 1;
          min-width: 96px;
          font-size: 0.74rem;
          color: rgba(226, 232, 240, 0.88);
          padding: 2px 0;
        }
        .fcp-name-readonly strong { color: #a7f3d0; font-weight: 800; }
        .fcp-connected-above-chat {
          display: none;
          align-items: center;
          gap: 8px;
          padding: 8px 11px;
          margin-bottom: 10px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.04);
          direction: rtl;
        }
        .fcp-btn-ghost {
          padding: 5px 10px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.05);
          color: var(--text);
          font-size: 0.72rem;
          font-weight: 700;
          cursor: pointer;
        }
        .fcp-btn-ghost:hover { background: rgba(255,255,255,0.1); }
        .fcp-settings {
          grid-column: 1 / -1;
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 12px 14px;
          background: rgba(255,255,255,0.03);
          margin-bottom: 8px;
        }
        .fcp-settings h4 { margin: 0 0 10px; font-size: 0.82rem; color: var(--muted); }
        .fcp-settings label { display: flex; align-items: center; gap: 8px; font-size: 0.82rem; margin-bottom: 8px; cursor: pointer; }
        .fcp-main {
          border: 1px solid var(--border);
          border-radius: 12px;
          background: rgba(255,255,255,0.025);
          display: flex;
          flex-direction: column;
          min-height: 380px;
          overflow: hidden;
          min-width: 0;
        }
        .fcp-channel-tabs {
          display: flex;
          flex-direction: row;
          flex-wrap: wrap;
          align-items: center;
          justify-content: flex-start;
          gap: 5px;
          padding: 5px 8px 6px;
          border-top: 1px solid var(--border);
          background: rgba(0,0,0,0.18);
          direction: rtl;
        }
        .fcp-channel-tab {
          padding: 3px 9px;
          min-height: 26px;
          border-radius: 7px;
          font-size: 0.66rem;
          font-weight: 800;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: rgba(226,232,240,0.88);
          cursor: pointer;
          max-width: 104px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .fcp-channel-tab:disabled { opacity: 0.5; cursor: default; }
        .fcp-channel-tab.active {
          background: rgba(99,102,241,0.35);
          border-color: rgba(129,140,248,0.5);
          color: #eef2ff;
        }
        .fcp-leave-dm-tab {
          margin-inline-start: auto;
          padding: 3px 9px;
          min-height: 26px;
          border-radius: 7px;
          border: 1px solid rgba(248,113,113,0.4);
          background: rgba(248,113,113,0.12);
          color: #fecaca;
          font-size: 0.64rem;
          font-weight: 800;
          cursor: pointer;
          flex-shrink: 0;
        }
        .fcp-channel-tabs {
          padding: 10px 14px;
          background: rgba(99,102,241,0.15);
          border-bottom: 1px solid rgba(99,102,241,0.25);
          font-size: 0.82rem;
        }
        .fcp-banner-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; justify-content: space-between; }
        .fcp-banner-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .fcp-banner-actions button {
          padding: 6px 12px;
          border-radius: 8px;
          border: none;
          font-weight: 800;
          font-size: 0.78rem;
          cursor: pointer;
        }
        .fcp-accept { background: #10b981; color: #fff; }
        .fcp-reject { background: rgba(248,113,113,0.25); color: #fecaca; }
        .fcp-msg-list {
          flex: 1;
          overflow-y: auto;
          padding: 12px 12px 12px 0;
          min-height: 260px;
          max-height: min(48vh, 440px);
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .fcp-msg {
          display: flex;
          flex-direction: row;
          align-items: flex-start;
          direction: ltr;
          gap: 8px;
          width: 100%;
          min-width: 0;
          max-width: none;
          align-self: stretch;
          padding: 5px 9px;
          border-radius: 0 8px 8px 0;
          background: rgba(0,0,0,0.2);
          border: 1px solid rgba(255,255,255,0.06);
          border-left: none;
          box-sizing: border-box;
        }
        .fcp-msg.mine {
          border: 1px solid rgba(255,255,255,0.08);
          border-left: none;
          background: rgba(0,0,0,0.22);
          box-shadow: inset 4mm 0 0 0 rgba(99,102,241,0.82);
        }
        .fcp-msg-time-in {
          flex: 0 0 2.75rem;
          width: 2.75rem;
          text-align: center;
          font-size: 0.62rem;
          color: var(--muted);
          font-weight: 700;
          line-height: 1.2;
          padding-top: 3px;
          opacity: 0.9;
          box-sizing: border-box;
          border-inline-end: 1px solid rgba(255,255,255,0.08);
          margin-inline-end: 2px;
        }
        .fcp-msg--no-time {
          gap: 0;
        }
        .fcp-msg--no-time .fcp-msg-time-in {
          display: none;
        }
        .fcp-msg-block {
          flex: 1;
          min-width: 0;
          direction: rtl;
          text-align: right;
        }
        .fcp-msg-user {
          font-size: 0.74rem;
          font-weight: 800;
          color: #a5f3fc;
          text-shadow: 0 0 14px rgba(103,232,249,0.28);
          margin-inline-end: 0;
          white-space: nowrap;
        }
        .fcp-msg-text {
          font-size: 0.86rem;
          line-height: 1.2;
          white-space: pre-wrap;
          word-break: break-word;
          color: var(--text);
        }
        .fcp-msg-inline {
          display: inline;
        }
        .fcp-typing { font-size: 0.76rem; color: var(--muted); font-style: italic; padding: 0 12px 8px; }
        .fcp-public-typing-demo {
          padding: 6px 12px 10px;
          direction: rtl;
          text-align: right;
          border-radius: 0 8px 8px 0;
          margin-inline-start: 0;
          background: rgba(0,0,0,0.18);
          border: 1px solid rgba(255,255,255,0.06);
          border-left: none;
          align-self: stretch;
          width: 100%;
          box-sizing: border-box;
        }
        .fcp-public-typing-demo .fcp-msg-user {
          font-style: normal;
        }
        .fcp-public-typing-label {
          font-size: 0.76rem;
          color: var(--muted);
          font-style: italic;
          font-weight: 650;
        }
        .fcp-typing-dots {
          display: inline-flex;
          gap: 2px;
          margin-inline-start: 4px;
          font-weight: 900;
          letter-spacing: 0.06em;
          color: rgba(167, 243, 208, 0.85);
          vertical-align: baseline;
        }
        .fcp-typing-dots span {
          animation: fcpTypingDot 1.25s ease-in-out infinite;
          opacity: 0.35;
        }
        .fcp-typing-dots span:nth-child(1) { animation-delay: 0s; }
        .fcp-typing-dots span:nth-child(2) { animation-delay: 0.2s; }
        .fcp-typing-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes fcpTypingDot {
          0%, 100% { opacity: 0.28; transform: translateY(0); }
          40% { opacity: 1; transform: translateY(-2px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .fcp-typing-dots span {
            animation: none !important;
            opacity: 0.85;
          }
        }
        .fcp-compose {
          display: flex;
          gap: 8px;
          padding: 6px 8px 8px;
          border-top: 1px solid var(--border);
          align-items: center;
        }
        .fcp-compose textarea {
          flex: 1;
          min-width: 0;
          min-height: 30px;
          max-height: 76px;
          padding: 5px 10px;
          border-radius: 10px;
          border: 1px solid var(--border-strong);
          background: var(--card2);
          color: var(--text);
          font-size: 0.78rem;
          line-height: 1.25;
          resize: none;
          text-align: right;
          max-width: min(100%, 480px);
        }
        .fcp-send {
          padding: 5px 11px;
          border-radius: 8px;
          border: 1px solid rgba(248,113,113,0.45);
          font-weight: 900;
          font-size: 0.7rem;
          cursor: pointer;
          background: linear-gradient(165deg, #ef4444 0%, #b91c1c 100%);
          color: #fff;
          flex-shrink: 0;
          align-self: center;
          box-shadow: 0 2px 8px rgba(220,38,38,0.35);
          white-space: nowrap;
        }
        .fcp-send:disabled { opacity: 0.45; cursor: not-allowed; }
        .fcp-sidebar {
          border: 1px solid var(--border);
          border-radius: 12px;
          background: rgba(255,255,255,0.03);
          display: flex;
          flex-direction: column;
          max-height: 100%;
          min-width: 0;
        }
        .fcp-side-title {
          padding: 7px 10px;
          font-weight: 900;
          font-size: 0.76rem;
          border-bottom: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 6px;
        }
        .fcp-count { font-size: 0.68rem; color: #34d399; font-weight: 800; }
        .fcp-user-list {
          overflow-y: auto;
          flex: 1;
          padding: 4px;
          max-height: min(65vh, 720px);
          min-height: 120px;
        }
        .fcp-user-row {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 3px 5px;
          border-radius: 7px;
          border: 1px solid transparent;
          margin-bottom: 2px;
        }
        .fcp-user-row:hover { background: rgba(255,255,255,0.05); }
        .fcp-avatar {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: linear-gradient(145deg, #6366f1, #a855f7);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 0.62rem;
          color: #fff;
          flex-shrink: 0;
        }
        .fcp-user-meta { flex: 1; min-width: 0; }
        .fcp-user-name {
          font-weight: 800;
          font-size: 0.72rem;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .fcp-user-you { font-size: 0.62rem; color: var(--muted); font-weight: 700; }
        .fcp-user-sub { display: none; }
        .fcp-ping-btn {
          padding: 3px 7px;
          border-radius: 6px;
          border: 1px solid var(--border-strong);
          background: rgba(16,185,129,0.15);
          color: #a7f3d0;
          font-weight: 800;
          font-size: 0.65rem;
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .fcp-ping-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .fcp-note-wrap { padding: 5px 8px 7px; border-bottom: 1px solid var(--border); }
        .fcp-note-wrap textarea {
          width: 100%;
          box-sizing: border-box;
          min-height: 34px;
          padding: 5px 8px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: rgba(0,0,0,0.2);
          color: var(--text);
          font-size: 0.74rem;
          text-align: right;
          resize: vertical;
        }
        .fcp-note-hint { font-size: 0.62rem; color: var(--muted); margin-top: 4px; line-height: 1.35; }
        .fcp-toast {
          position: fixed;
          bottom: 22px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 8000;
          padding: 12px 20px;
          border-radius: 12px;
          background: rgba(15,23,42,0.94);
          border: 1px solid var(--border-strong);
          color: #e2e8f0;
          font-size: 0.84rem;
          font-weight: 650;
          max-width: min(92vw, 420px);
          text-align: center;
          box-shadow: 0 20px 50px rgba(0,0,0,0.45);
        }
        .fcp-toast.err { border-color: rgba(248,113,113,0.5); color: #fecaca; }
        .fcp-placeholder { text-align: center; color: var(--muted); padding: 40px 16px; font-size: 0.86rem; line-height: 1.55; }
        .fcp-join-gate {
          border: 1px solid var(--border);
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          padding: 32px 22px;
          text-align: center;
          max-width: 480px;
          margin: 20px auto 32px;
        }
        .fcp-join-gate p {
          margin: 0 0 20px;
          font-size: 0.9rem;
          line-height: 1.6;
          color: rgba(226,232,240,0.9);
        }
        .fcp-connect-btn {
          width: 100%;
          max-width: 320px;
          padding: 16px 24px;
          border-radius: 14px;
          border: 1px solid rgba(16,185,129,0.45);
          background: linear-gradient(165deg, rgba(16,185,129,0.55), rgba(5,80,60,0.85));
          color: #ecfdf5;
          font-size: 1.02rem;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 12px 36px rgba(16,185,129,0.2);
        }
        .fcp-connect-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          box-shadow: none;
        }
        .fcp-disconnect-btn {
          padding: 5px 10px;
          border-radius: 8px;
          border: 1px solid rgba(248,113,113,0.35);
          background: rgba(248,113,113,0.12);
          color: #fecaca;
          font-size: 0.72rem;
          font-weight: 800;
          cursor: pointer;
        }
        .fcp-user-row--me {
          border: 1px solid rgba(52,211,153,0.35);
          background: rgba(16,185,129,0.08);
          padding: 3px 5px;
        }
        @media (max-width: 820px) {
          .fcp-root {
            display: flex;
            flex-direction: column;
            align-items: stretch;
          }
          .fcp-connected-above-chat {
            display: flex;
            flex-shrink: 0;
          }
          .fcp-topbar .fcp-name-field--mobile-under-chat-strip {
            display: none !important;
          }
          .fcp-grid {
            grid-template-columns: 1fr;
            align-items: start;
          }
          .fcp-grid--solo { grid-template-columns: 1fr; }
          /* רשימת מחוברים למעלה — אחרת נדחקת מתחת לאזור הצ׳אט הארוך ולא רואים אותה */
          .fcp-sidebar { order: 1; max-height: none; width: 100%; min-height: 0; flex-shrink: 0; }
          .fcp-main { order: 2; min-height: min(380px, 52vh); }
          .fcp-user-list {
            max-height: min(36vh, 280px);
            min-height: 140px;
            flex: 0 1 auto;
          }
          .fcp-msg-list {
            max-height: min(42vh, 380px);
            min-height: 180px;
          }
          .fcp-compose {
            gap: 5px;
            padding: 6px 5px 7px;
          }
          .fcp-compose textarea {
            max-width: none;
            flex: 1 1 0%;
            padding: 6px 9px;
          }
          .fcp-send {
            padding: 5px 7px;
            font-size: 0.66rem;
            border-radius: 7px;
            line-height: 1.15;
            min-height: 30px;
          }
        }
      `}</style>

      <div className="fcp-root">
        <div className="fcp-topbar">
          <div className="fcp-status">
            <span className={`fcp-dot${chatConnected ? ' on' : ''}`} aria-hidden />
            {chatConnected
              ? joinedLobby
                ? 'בצ׳אט'
                : 'מחובר לשרת — לחצו «התחבר לצ׳אט» למטה'
              : 'מתחבר לשרת…'}
          </div>
          <div
            className={
              joinedLobby && hasLoginChatName
                ? 'fcp-name-field fcp-name-field--mobile-under-chat-strip'
                : 'fcp-name-field'
            }
          >
            {hasLoginChatName ? (
              <span className="fcp-name-readonly">
                <span>מחובר:</span>
                <strong dir="auto">{effectiveChatName}</strong>
              </span>
            ) : (
              <>
                <label htmlFor="fcp-display">שם מוצג</label>
                <input
                  id="fcp-display"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value.slice(0, 40))}
                  placeholder="למשל: אורח"
                  maxLength={40}
                  autoComplete="nickname"
                  disabled={joinedLobby}
                />
              </>
            )}
          </div>
          {joinedLobby ? (
            <button type="button" className="fcp-disconnect-btn" onClick={leaveLobby}>
              התנתק מצ׳אט
            </button>
          ) : null}
          <button type="button" className="fcp-btn-ghost" onClick={() => setSettingsOpen(o => !o)}>
            הגדרות צ׳אט
          </button>
        </div>

        {settingsOpen && (
          <div className="fcp-settings">
            <h4>העדפות</h4>
            <label>
              <input type="checkbox" checked={prefs.soundOn} onChange={e => updatePrefs({ soundOn: e.target.checked })} />
              צליל קצר בעת הודעה פרטית או בקשת שיחה
            </label>
            <label>
              <input type="checkbox" checked={prefs.showTimestamps} onChange={e => updatePrefs({ showTimestamps: e.target.checked })} />
              הצגת שעה ליד הודעות
            </label>
            <label>
              <input type="checkbox" checked={prefs.enterSends} onChange={e => updatePrefs({ enterSends: e.target.checked })} />
              Enter שולח (Shift+Enter לשורה חדשה)
            </label>
            <label>
              <input type="checkbox" checked={prefs.showOnlineAvatars} onChange={e => updatePrefs({ showOnlineAvatars: e.target.checked })} />
              אות ראשונה בצבע ליד כל מחובר
            </label>
            <p className="fcp-note-hint" style={{ margin: '8px 0 0' }}>
              שני הצדדים נכנסים ל«דת ואמונה» ← צ׳אט, לוחצים «התחבר לצ׳אט», ואז לוחצים «שיחה» ליד השם. לקבלת הבקשה יש לאשר.
            </p>
          </div>
        )}

        {!joinedLobby && (
          <div className="fcp-join-gate">
            <button
              type="button"
              className="fcp-connect-btn"
              onClick={joinLobby}
              disabled={!chatConnected || !effectiveChatName}
            >
              התחבר לצ׳אט
            </button>
            {!hasLoginChatName && !effectiveChatName && chatConnected ? (
              <p className="fcp-note-hint" style={{ marginTop: 14 }}>נא למלא שם לפני ההתחברות.</p>
            ) : null}
          </div>
        )}

        {joinedLobby && (
          <>
            {incomingRequests.length > 0 && (
              <div className="fcp-banner">
                {incomingRequests.map(req => (
                  <div key={req.requestId || req.fromSocketId} className="fcp-banner-row" style={{ marginBottom: incomingRequests.length > 1 ? 10 : 0 }}>
                    <span>
                      <strong>{req.fromName}</strong>
                      {' מבקש שיחה פרטית'}
                      {req.note ? ` — «${req.note}»` : ''}
                    </span>
                    <div className="fcp-banner-actions">
                      <button type="button" className="fcp-accept" onClick={() => respondDm(true, req.fromSocketId)}>אשר</button>
                      <button type="button" className="fcp-reject" onClick={() => respondDm(false, req.fromSocketId)}>דחה</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {hasLoginChatName && (
              <div className="fcp-connected-above-chat">
                <span className="fcp-name-readonly">
                  <span>מחובר:</span>
                  <strong dir="auto">{effectiveChatName}</strong>
                </span>
              </div>
            )}

            <div className="fcp-grid">
              <aside className="fcp-sidebar" aria-label="מחוברים כעת">
                <div className="fcp-side-title">
                  מחוברים עכשיו
                  <span className="fcp-count">{othersOnlineWithVirtual.length + 1}</span>
                </div>
                <div className="fcp-note-wrap">
                  <textarea
                    value={draftDmRequestNote}
                    onChange={e => setDraftDmRequestNote(e.target.value.slice(0, 240))}
                    maxLength={240}
                    aria-label="הערה לבקשת שיחה פרטית"
                  />
                </div>
                <div className="fcp-user-list">
                  {mySocketId && (
                    <div className="fcp-user-row fcp-user-row--me">
                      {prefs.showOnlineAvatars ? (
                        <div className="fcp-avatar">{(displayName.trim() || 'א')[0]}</div>
                      ) : (
                        <div className="fcp-avatar" style={{ background: '#334155', fontSize: '0.55rem' }}>אני</div>
                      )}
                      <div className="fcp-user-meta">
                        <div className="fcp-user-name" title={displayName.trim() || 'אורח'}>
                          {displayName.trim() || 'אורח'}
                          <span className="fcp-user-you"> · את/ה</span>
                        </div>
                      </div>
                    </div>
                  )}
                  {othersOnlineWithVirtual.map(u => (
                      <div key={u.socketId} className="fcp-user-row">
                        {prefs.showOnlineAvatars ? (
                          <div className="fcp-avatar">{u.displayName?.[0] || '?'}</div>
                        ) : (
                          <div className="fcp-avatar" style={{ background: '#475569', fontSize: '0.55rem' }}>●</div>
                        )}
                        <div className="fcp-user-meta">
                          <div className="fcp-user-name" title={u.displayName}>{u.displayName}</div>
                        </div>
                        <button
                          type="button"
                          className="fcp-ping-btn"
                          disabled={!chatConnected || !!dmPartner || u.virtual}
                          onClick={() => requestDm(u.socketId)}
                          title={
                            u.virtual
                              ? 'דמו בלבד — אין שיחה פרטית'
                              : dmPartner
                                ? 'סיים שיחה נוכחית לפני בקשה חדשה'
                                : 'שלח בקשת שיחה פרטית'
                          }
                        >
                          שיחה
                        </button>
                      </div>
                  ))}
                </div>
              </aside>

              <div className="fcp-main">
                <div className="fcp-msg-list" ref={listScrollRef}>
                  {activePanel === 'public' ? (
                    publicMessages.length === 0 ? (
                      <div className="fcp-placeholder">
                        אין עדיין הודעות בצ׳אט הציבורי. התחילו בשליחת הודעה — או פתחו שיחה פרטית דרך הרשימה מימין.
                      </div>
                    ) : (
                      <>
                        {publicMessages.map((m) => {
                          const mine =
                            m.fromSocketId === mySocketId ||
                            (!!faithSocket.id && m.fromSocketId === faithSocket.id);
                          return (
                            <article key={m.id}>
                              <div
                                className={`fcp-msg${mine ? ' mine' : ''}${prefs.showTimestamps ? '' : ' fcp-msg--no-time'}`}
                              >
                                <span className="fcp-msg-time-in" aria-hidden={!prefs.showTimestamps}>
                                  {prefs.showTimestamps && m.ts
                                    ? new Date(m.ts).toLocaleTimeString('he-IL', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })
                                    : ''}
                                </span>
                                <div className="fcp-msg-block">
                                  <span className="fcp-msg-user">
                                    {m.displayName}
                                    {mine ? ' (את/ה)' : ''}
                                    {' - '}
                                  </span>
                                  <span className="fcp-msg-text fcp-msg-inline">{m.text}</span>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                        {showOritTypingDemo ? (
                          <div className="fcp-public-typing-demo" aria-live="polite">
                            <span className="fcp-msg-user">אורית · </span>
                            <span className="fcp-public-typing-label">כותבת</span>
                            <span className="fcp-typing-dots" aria-hidden="true">
                              <span>.</span>
                              <span>.</span>
                              <span>.</span>
                            </span>
                          </div>
                        ) : null}
                      </>
                    )
                  ) : activePrivateSlot?.partner ? (
                    <>
                      {activePrivateSlot.messages.length === 0 ? (
                        <div className="fcp-placeholder">שיחה פרטית עם {activePrivateSlot.partner.name}. ההודעות כאן מוצגות רק לשניכם.</div>
                      ) : (
                        activePrivateSlot.messages.map(m => {
                          const mine = m.fromSocketId === mySocketId;
                          return (
                            <article key={m.id}>
                              <div
                                className={`fcp-msg${mine ? ' mine' : ''}${prefs.showTimestamps ? '' : ' fcp-msg--no-time'}`}
                              >
                                <span className="fcp-msg-time-in" aria-hidden={!prefs.showTimestamps}>
                                  {prefs.showTimestamps && m.ts
                                    ? new Date(m.ts).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
                                    : ''}
                                </span>
                                <div className="fcp-msg-block">
                                  <span className="fcp-msg-user">
                                    {m.displayName}
                                    {mine ? ' (את/ה)' : ''}
                                    {' - '}
                                  </span>
                                  <span className="fcp-msg-text fcp-msg-inline">{m.text}</span>
                                </div>
                              </div>
                            </article>
                          );
                        })
                      )}
                      {viewingLivePrivate && partnerTyping && (
                        <div className="fcp-typing">{activePrivateSlot.partner.name} כותב/ת…</div>
                      )}
                    </>
                  ) : (
                    <div className="fcp-placeholder" style={{ lineHeight: 1.55 }}>
                      מקום לשיחה פרטית. לחצו «שיחה» ליד משתמש ברשימה — כשהוא מאשר, השם יופיע בטאב «פרטי» כאן.
                    </div>
                  )}
                </div>

                <div className="fcp-channel-tabs" role="tablist" aria-label="ערוצי צ׳אט">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activePanel === 'public'}
                    className={`fcp-channel-tab${activePanel === 'public' ? ' active' : ''}`}
                    onClick={() => setActivePanel('public')}
                  >
                    ציבורי
                  </button>
                  {dmSlots.map((slot, i) => {
                    const label = slot.partner
                      ? (slot.partner.name.length > 13 ? `${slot.partner.name.slice(0, 12)}…` : slot.partner.name)
                      : 'פרטי';
                    return (
                      <button
                        key={i}
                        type="button"
                        role="tab"
                        aria-selected={activePanel === i}
                        className={`fcp-channel-tab${activePanel === i ? ' active' : ''}`}
                        title={slot.partner ? slot.partner.name : `מקום פרטי ${i + 1}`}
                        onClick={() => setActivePanel(i)}
                      >
                        {label}
                      </button>
                    );
                  })}
                  {viewingLivePrivate ? (
                    <button type="button" className="fcp-leave-dm-tab" onClick={leaveDm}>
                      סיום שיחה
                    </button>
                  ) : null}
                </div>

                <div className="fcp-compose">
                  {activePanel === 'public' ? (
                    chatConnected ? (
                      <>
                        <textarea
                          value={draftPublic}
                          onChange={e => setDraftPublic(e.target.value)}
                          onKeyDown={e => {
                            if (!prefs.enterSends) return;
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              sendPublic();
                            }
                          }}
                          placeholder="הודעה לכולם…"
                          maxLength={2000}
                          disabled={!chatConnected}
                          rows={2}
                        />
                        <button type="button" className="fcp-send" onClick={sendPublic} disabled={!chatConnected || !draftPublic.trim()}>
                          שלח
                        </button>
                      </>
                    ) : (
                      <p className="fcp-note-hint" style={{ margin: 0, padding: '6px 0', lineHeight: 1.5 }}>
                        ממתינים לחיבור לשרת…
                      </p>
                    )
                  ) : viewingLivePrivate ? (
                    <>
                      <textarea
                        value={draftDm}
                        onChange={onDmDraftChange}
                        onKeyDown={e => {
                          if (!prefs.enterSends) return;
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendDm();
                          }
                        }}
                        placeholder={
                          activePrivateSlot?.partner
                            ? `הודעה פרטית ל־${activePrivateSlot.partner.name}…`
                            : 'הודעה פרטית…'
                        }
                        maxLength={2000}
                        disabled={!chatConnected}
                        rows={2}
                      />
                      <button type="button" className="fcp-send" onClick={sendDm} disabled={!chatConnected || !draftDm.trim()}>
                        שלח
                      </button>
                    </>
                  ) : (
                    <p className="fcp-note-hint" style={{ margin: 0, padding: '4px 0', flex: 1 }}>
                      אין שיחה פרטית פעילה במקום הזה. בחרו טאב «ציבורי» או שלחו בקשת «שיחה» מהרשימה.
                    </p>
                  )}
                </div>
              </div>
        </div>
          </>
        )}

        {outgoingToast && <div className="fcp-toast">{outgoingToast}</div>}
        {errorToast && <div className="fcp-toast err">{errorToast}</div>}
      </div>
    </>
  );
}
