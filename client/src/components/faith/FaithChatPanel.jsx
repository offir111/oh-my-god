import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/appStore.js';
import {
  acquireFaithChatConnection,
  ensureFaithChatConnected,
  releaseFaithChatConnection,
  faithSocket,
} from '../../socketFaith.js';
import UserAvatarSlot from '../ui/UserAvatarSlot.jsx';
import { normalizeProfileUsername, getCageAvatarDataUrlForDisplayName } from '../../lib/cageUserProfile.js';

const DISPLAY_NAME_KEY = 'faith_chat_display_name';
const PREFS_KEY = 'faith_chat_prefs';
const FAITH_BLOCKED_NORMS_KEY = 'faith_chat_blocked_norms_v1';
const FAITH_MUTED_NORMS_KEY = 'faith_chat_muted_norms_v1';
/** מטמון הודעות ציבוריות במכשיר — נשאר אחרי יציאה מהדף / ניתוק סוקט */
const PUBLIC_MESSAGES_STORAGE_KEY = 'faith_chat_public_messages_v1';
const MAX_STORED_PUBLIC = 300;
const DM_SLOT_COUNT = 6;

/* ── שמירת מצב שיחות פרטיות — שחזור תוך 5 דקות ── */
const DM_SESSION_KEY = 'faith_chat_dm_session_v1';
const DM_SESSION_TTL = 5 * 60 * 1000;

function saveDmSession(dmSlots) {
  try {
    const slots = dmSlots.map(s =>
      s.partner && s.messages.length
        ? { name: s.partner.name, messages: s.messages.slice(-100) }
        : null,
    );
    if (slots.every(s => !s)) { localStorage.removeItem(DM_SESSION_KEY); return; }
    localStorage.setItem(DM_SESSION_KEY, JSON.stringify({ savedAt: Date.now(), slots }));
  } catch { /* quota */ }
}

function loadDmSession() {
  try {
    const raw = localStorage.getItem(DM_SESSION_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d?.savedAt || Date.now() - d.savedAt > DM_SESSION_TTL) return null;
    return d;
  } catch { return null; }
}

function emptyDmSlotsFromSession() {
  const session = loadDmSession();
  if (!session) return emptyDmSlots();
  return (session.slots || []).map((s, i) => {
    if (!s || i >= DM_SLOT_COUNT) return { partner: null, messages: [], roomId: null, roomReady: false };
    return { partner: { socketId: `hist:${s.name}`, name: s.name }, messages: s.messages || [], roomId: null, roomReady: false, restored: true };
  }).slice(0, DM_SLOT_COUNT);
}
/** כותרת חדר כללי — כמו «הכלוב» */
const GENERAL_ROOM_LABEL = 'כללי';

/** חזרה מפרופיל «הכלוב» לצ׳אט אמונה (BrowserRouter ו־HashRouter) */
const PROFILE_RETURN_TO_FAITH_CHAT = '/faith#chat';

/** צבע טקסט יוצא ברירת־מחדל כמו `--text` (ללא הבהרות מיותרות לשרת) */
const OUTGOING_DEFAULT_COLOR = '#f4f4f8';

const CAGE_EMOJI_GRID = [
  '😎', '😠', '😉', '😘', '😀', '😁',
  '😢', '😴', '🤔', '😋', '😍', '😮',
  '😤', '😇', '🙃', '😏', '💜', '❤️',
  '👠', '🍺', '🌹', '🍷', '💋', '🐷',
  '👍', '👎', '🔥', '✨', '🎵', '💤',
];

/** סט צבעי טקסט יוצא — תואם לפלטת האפליקציה (--text, gold, believer, atheist, accent…) */
const OUTGOING_COLOR_CHOICES = [
  OUTGOING_DEFAULT_COLOR,
  '#fbbf24',
  '#f43f5e',
  '#10b981',
  '#818cf8',
  '#fdba74',
  '#fda4af',
  '#34d399',
];

/** מפתח מודרציה לצ׳אט — אופציונלי; זהה ל־FAITH_CHAT_MOD_SECRET בשרת (≥8 תווים). בלי זה ניתן עדיין להיגדר מנהל בשרת עם FAITH_CHAT_MOD_USERNAME (משתמש מחובר). */
const FAITH_CHAT_MOD_SECRET_CLIENT =
  typeof import.meta.env.VITE_FAITH_CHAT_MOD_SECRET === 'string'
    ? import.meta.env.VITE_FAITH_CHAT_MOD_SECRET.trim()
    : '';

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

const ORIT_VIRTUAL =
  FAITH_VIRTUAL_USERS.find(v => v.socketId === '__faith_virt_orit__') ?? FAITH_VIRTUAL_USERS[0];

/** אחרי «שם : טקסט» — מתאימים תשובה לטקסט שאחרי הנקודתיים */
function faithPublicMessageBodyForReply(raw) {
  const t = String(raw || '').trim();
  if (!t) return '';
  const ix = t.indexOf(':');
  if (ix < 0) return t;
  const rest = t.slice(ix + 1).trim();
  return rest || t;
}

/**
 * תשובת אורית·AI לציבור — קודם התאמה לברכות ושיח קצר; אחרת null (יבחר מ־VIRT_REPLY_POOL).
 */
function smartVirtPublicReply(userMessageText) {
  const full = String(userMessageText || '').trim();
  const body = faithPublicMessageBodyForReply(full);
  const compact = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const b = compact(body);
  const f = compact(full);
  if (!b && !f) return null;

  const has = (re) => re.test(b) || re.test(f);

  if (has(/בוקר\s*טוב/)) return 'בוקר טוב 🙂';
  if (has(/בוקר\s*אור/)) return 'בוקר אור 🙂';
  if (has(/צהריים\s*טובים/)) return 'צהריים טובים 🙂';
  if (has(/ערב\s*טוב/)) return 'ערב טוב 🙂';
  if (has(/לילה\s*טוב/)) return 'לילה טוב 🙂';
  if (has(/שבת\s+שלום/)) return 'שבת שלום 🙂';
  if (has(/מה\s+שלומך/)) return 'שלום 🙂 אצלי בסדר, תודה — ואצלך?';
  if (has(/מה\s+נשמע/) || has(/מה\s+קורה/) || has(/מה\s+המצב/))
    return 'הכל טוב פה, תודה 🙂 ואצלך?';
  if (/^(שלום|היי|הי)(\s*[!.?…]*)?$/.test(b) || /^(שלום|היי|הי)(\s*[!.?…]*)?$/.test(f) || has(/^אהלן/))
    return 'שלום 🙂';
  if (has(/תודה|תודה רבה|תודה לך/) && (b.length < 48 || f.length < 48)) return 'בכיף 🙂';
  if (has(/סליחה/)) return 'בסדר גמור, אין בעיה 🙂';
  if (has(/מזל\s*טוב/)) return 'מזל טוב! שמח בשמחתכם 🙂';
  if (has(/חג\s*שמח/)) return 'חג שמח 🙂';
  if (has(/כיף|נחמד|יפה/) && (b.length < 35 || f.length < 35)) return 'כיף לשמוע 🙂';

  return null;
}

function emptyDmSlots() {
  return Array.from({ length: DM_SLOT_COUNT }, () => ({
    partner: null,
    messages: [],
    roomId: null,
    roomReady: false,
  }));
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
      .filter(m => m.kind !== 'system')
      .sort((a, b) => (a.ts || 0) - (b.ts || 0))
      .slice(-MAX_STORED_PUBLIC);
  } catch {
    return [];
  }
}

function persistPublicMessagesToStorage(messages) {
  try {
    const trimmed = messages.filter(m => m.kind !== 'system').slice(-MAX_STORED_PUBLIC);
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
      showJoinLeave: p.showJoinLeave !== false,
      soundNewConversation: !!p.soundNewConversation,
      soundNewMessagePublic: !!p.soundNewMessagePublic,
      hideBlockedUsers: !!p.hideBlockedUsers,
      showRadioUpdates: p.showRadioUpdates !== false,
    };
  } catch {
    return {
      soundOn: true,
      showTimestamps: true,
      enterSends: true,
      showOnlineAvatars: true,
      showJoinLeave: true,
      soundNewConversation: false,
      soundNewMessagePublic: false,
      hideBlockedUsers: false,
      showRadioUpdates: true,
    };
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

/** נרמול טקסט לחיפוש שמות בנוכחים */
function faithPresenceFoldText(s) {
  const t = String(s || '').trim().toLowerCase();
  try {
    return t.normalize('NFC');
  } catch {
    return t;
  }
}

function readFaithNormSet(key) {
  try {
    const a = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(a)) return new Set();
    return new Set(a.map(x => normalizeProfileUsername(x)).filter(Boolean));
  } catch {
    return new Set();
  }
}

function persistFaithNormSet(key, set) {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
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

function resolveFaithChatLineAvatarUrl(m) {
  if (m && typeof m.avatarUrl === 'string' && m.avatarUrl.trim()) return m.avatarUrl.trim();
  const fromCage = getCageAvatarDataUrlForDisplayName(m?.displayName);
  return fromCage || undefined;
}

export default function FaithChatPanel() {
  const navigate = useNavigate();
  const user = useAppStore(s => s.user);
  const pendingUser = useAppStore(s => s.pendingUser);
  const defaultName = user?.username || pendingUser?.username || '';
  const hasLoginChatName = Boolean(String(defaultName || '').trim());

  const [prefs, setPrefs] = useState(readPrefs);
  /** תפריט הגדרות מתוך כפתור גלגל השיניים (כמו בהכלוב) */
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [generalSubView, setGeneralSubView] = useState('conversation'); // 'presence' | 'conversation'

  /** חיפוש שם ברשימת נוכחים (טאב נוכחים) — הדגשת שורה תואמת */
  const [presenceSearchQuery, setPresenceSearchQuery] = useState('');
  /** בחדר הכללי: נוכחים / שיחה */
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [composerToolFocus, setComposerToolFocus] = useState(null); // 'settings'|'emoji'|'color'|'lock'|null
  /** חסום פניות פרטיות אליך — מסונכרן לשרת */
  const [blockIncomingPm, setBlockIncomingPm] = useState(false);
  /** צבע טקסט יוצא (ציבורי + פרטי) */
  const [outgoingColor, setOutgoingColor] = useState(OUTGOING_DEFAULT_COLOR);
  /** טאב פרטי: יש תשובה חדשה מהצד השני והטאב לא פעיל */
  const [privateTabAlerts, setPrivateTabAlerts] = useState(() => ({}));
  /** מי כותב לפי socketId הצד שכנגד */
  const [typingPartners, setTypingPartners] = useState({});

  /** חסימה / השתקה לפי שם מוצג מנורמל — מקומי במכשיר */
  const [blockedNorms, setBlockedNorms] = useState(() => readFaithNormSet(FAITH_BLOCKED_NORMS_KEY));
  const [mutedNorms, setMutedNorms] = useState(() => readFaithNormSet(FAITH_MUTED_NORMS_KEY));
  /** תפריט הקשר ברשימת נוכחים — { rect, targetUser } */
  const [presenceMenu, setPresenceMenu] = useState(null);
  const presenceSheetLeaveTimerRef = useRef(null);
  const presenceSheetPointerInsideRef = useRef(false);
  const presenceMenuPinnedRef = useRef(false);

  const blockedNormsRef = useRef(blockedNorms);
  blockedNormsRef.current = blockedNorms;

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
  /** אינדקס החריץ (0..DM_SLOT_COUNT-1) עם שיחת DM לשרת; כלחריץ מחזיק רשומה */
  const [dmSlots, setDmSlots] = useState(emptyDmSlotsFromSession);
  /** 'public' | slotIndex — «כללי» או טאב פרטי */
  const [activePanel, setActivePanel] = useState('public');

  const [draftPublic, setDraftPublic] = useState('');
  const [draftDm, setDraftDm] = useState('');

  const [outgoingToast, setOutgoingToast] = useState(null);
  const [errorToast, setErrorToast] = useState(null);
  const [joinedLobby, setJoinedLobby] = useState(false);
  /** מנהל צ׳אט — מאושר מהשרת */
  const [faithChatModerator, setFaithChatModerator] = useState(false);

  /** דמו ויזואלי: אורית «כותבת» ללא שליחת טקסט — דקה מרגע ההתחברות לצ׳אט */
  const [showOritTypingDemo, setShowOritTypingDemo] = useState(false);

  const listScrollRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const virtualReplyTimerRef = useRef(null);
  const oritTypingDemoTimerRef = useRef(null);
  /** ממתין ל־connect כדי להריץ FAITH_CHAT_JOIN אחרי לחיצה לפני שהסוקט מוכן */
  const faithPendingJoinOnConnectRef = useRef(null);
  /** נשאר true אחרי «התחבר לצ׳אט» — אחרי ניתוק/חיבור מחדש של הרשת מחזירים למצב בצ׳אט בלי לחיצה חוזרת */
  const wantFaithLobbyRef = useRef(false);
  /**
   * מרוץ: FAITH_DM_OPENED לעיתים מגיע לפני ש־setDmSlots מהפתיחה נכנס ל־prev —
   * בלי ref, onDmOpened בוחר חריץ ריק אחר ו־roomReady נשאר false בטאב הנכון → שליחה חסומה.
   */
  const pendingPrivateDmOpenRef = useRef(null);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const displayNameRef = useRef(displayName);
  displayNameRef.current = displayName;
  const activePanelRef = useRef('public');
  activePanelRef.current = activePanel;

  function clearOutboundPrivateDmStateForPartner(partnerSocketId) {
    if (typeof partnerSocketId !== 'string') return;
    if (pendingPrivateDmOpenRef.current?.targetSocketId === partnerSocketId) {
      pendingPrivateDmOpenRef.current = null;
    }
    setDmSlots(prev => {
      const ix = prev.findIndex(s => s.partner?.socketId === partnerSocketId);
      const ap = activePanelRef.current;
      if (ix >= 0 && typeof ap === 'number' && ap === ix) {
        queueMicrotask(() => setActivePanel('public'));
      }
      if (ix < 0) return prev;
      const next = [...prev];
      next[ix] = { partner: null, messages: [], roomId: null, roomReady: false };
      return next;
    });
    setPrivateTabAlerts(prev => {
      const next = { ...prev };
      delete next[partnerSocketId];
      return next;
    });
    setTypingPartners(prev => {
      const next = { ...prev };
      delete next[partnerSocketId];
      return next;
    });
  }

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
      if (wantFaithLobbyRef.current && faithSocket.connected) {
        const st = useAppStore.getState();
        const login = String(st.user?.username || st.pendingUser?.username || '').trim().slice(0, 40);
        const name = (login || String(displayNameRef.current || '').trim()).slice(0, 40);
        if (name) {
          const modSecretOk = FAITH_CHAT_MOD_SECRET_CLIENT.length >= 8;
          faithSocket.emit('FAITH_CHAT_JOIN', {
            displayName: name,
            ...(login ? { moderatorLoginUsername: login } : {}),
            ...(modSecretOk ? { moderatorSecret: FAITH_CHAT_MOD_SECRET_CLIENT } : {}),
          });
          setJoinedLobby(true);
        }
      }
    }

    function onSocketDisconnect() {
      saveDmSession(dmSlotsLatestRef.current);
      if (faithPendingJoinOnConnectRef.current) {
        faithSocket.off('connect', faithPendingJoinOnConnectRef.current);
        faithPendingJoinOnConnectRef.current = null;
      }
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
      setFaithChatModerator(false);
      setActivePanel('public');
      setOnlineUsers([]);
      setPrivateTabAlerts({});
      setTypingPartners({});
      setBlockIncomingPm(false);
      pendingPrivateDmOpenRef.current = null;
      setDmSlots(emptyDmSlotsFromSession());
    }

    function onSocketId({ socketId }) {
      setMySocketId(socketId);
    }

    function onPresence({ users }) {
      setOnlineUsers(Array.isArray(users) ? users : []);
    }

    function onPublicHistory({ messages }) {
      if (!Array.isArray(messages)) return;
      const valid = messages.filter(m => {
        if (!m?.id || typeof m.ts !== 'number') return false;
        if (m.kind === 'system' && typeof m.systemType === 'string' && typeof m.text === 'string')
          return true;
        return typeof m.text === 'string';
      });
      setPublicMessages(prev => {
        const byId = new Map();
        valid.forEach(m => byId.set(m.id, m));
        prev.forEach(m => {
          if (m.kind === 'system' && !byId.has(m.id)) byId.set(m.id, m);
          else if (!byId.has(m.id)) byId.set(m.id, m);
        });
        return [...byId.values()]
          .sort((a, b) => (a.ts || 0) - (b.ts || 0))
          .slice(-300);
      });
    }

    function onPublicDeleted({ messageId }) {
      if (typeof messageId !== 'string') return;
      setPublicMessages(prev => prev.filter(m => m.id !== messageId));
    }

    function onDmMessageDeleted({ messageId }) {
      if (typeof messageId !== 'string') return;
      setDmSlots(prev =>
        prev.map(slot => ({
          ...slot,
          messages: slot.messages.filter(m => m.id !== messageId),
        })),
      );
    }

    function onModeratorStatus({ active }) {
      setFaithChatModerator(!!active);
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
      if (payload.fromSocketId !== sid && prefsRef.current.soundNewMessagePublic) playSoftPing();
    }

    function onPublicSystem(payload) {
      if (
        !payload?.id ||
        payload.kind !== 'system' ||
        typeof payload.systemType !== 'string' ||
        typeof payload.text !== 'string'
      )
        return;
      setPublicMessages(prev => {
        if (prev.some(m => m.id === payload.id)) return prev;
        return [...prev.slice(-299), payload];
      });
    }

    function onDmMsg(payload) {
      if (!payload?.id || typeof payload.text !== 'string') return;
      const myId = faithSocket.id;
      const roomId = typeof payload.roomId === 'string' ? payload.roomId : null;

      setDmSlots(prev => {
        let ix = roomId ? prev.findIndex(s => s.roomId === roomId) : -1;
        if (ix < 0 && payload.fromSocketId && myId && payload.fromSocketId !== myId) {
          ix = prev.findIndex(s => s.partner?.socketId === payload.fromSocketId);
        }
        if (ix < 0 && roomId && payload.fromSocketId === myId) {
          ix = prev.findIndex(s => s.roomId === roomId);
        }
        if (ix < 0) return prev;
        const s = prev[ix];
        if (!s?.partner) return prev;

        const fromPartner = payload.fromSocketId && payload.fromSocketId !== myId;
        if (fromPartner) {
          const ap = activePanelRef.current;
          if (typeof ap !== 'number' || ap !== ix) {
            queueMicrotask(() =>
              setPrivateTabAlerts(p => ({ ...p, [payload.fromSocketId]: true })),
            );
          }
        }

        const next = [...prev];
        next[ix] = { ...s, messages: [...s.messages.slice(-400), payload] };
        return next;
      });

      if (payload.fromSocketId && payload.fromSocketId !== myId && prefsRef.current.soundOn) {
        playSoftPing();
      }
    }

    function onDmOpened({ partnerSocketId, partnerName, roomId }) {
      const rid = typeof roomId === 'string' && roomId.startsWith('faith-dm:') ? roomId : null;
      const pend = pendingPrivateDmOpenRef.current;
      const pendingIx =
        pend?.targetSocketId === partnerSocketId &&
        typeof pend.slotIndex === 'number' &&
        pend.slotIndex >= 0 &&
        pend.slotIndex < DM_SLOT_COUNT
          ? pend.slotIndex
          : null;
      setDmSlots(prev => {
        let ix = prev.findIndex(s => s.partner?.socketId === partnerSocketId);
        if (ix < 0 && pendingIx != null) ix = pendingIx;
        if (ix < 0) ix = prev.findIndex(s => !s.partner);
        if (ix < 0) ix = DM_SLOT_COUNT - 1;
        const next = [...prev];
        const existing = next[ix];
        const samePartner = existing.partner?.socketId === partnerSocketId;
        const restoredSameName = existing.restored && existing.partner?.name === partnerName;
        next[ix] = {
          partner: { socketId: partnerSocketId, name: partnerName },
          messages: (samePartner || restoredSameName) ? existing.messages : [],
          roomId: rid ?? existing.roomId,
          roomReady: true,
        };
        return next;
      });
      if (pend?.targetSocketId === partnerSocketId) pendingPrivateDmOpenRef.current = null;
      setTypingPartners(prev => {
        const n = { ...prev };
        delete n[partnerSocketId];
        return n;
      });
    }

    function onDmEnded({ reason, partnerSocketId }) {
      if (typeof partnerSocketId !== 'string') return;
      clearOutboundPrivateDmStateForPartner(partnerSocketId);
      if (reason === 'self_left' || reason === 'lobby_left') return;
      if (reason === 'partner_disconnected') setErrorToast('הצד השני התנתק מהשיחה');
      else if (reason === 'partner_left') setErrorToast('הצד השני סיים את השיחה הפרטית');
      setTimeout(() => setErrorToast(null), 5000);
    }

    function onError({ message, targetSocketId }) {
      if (typeof targetSocketId === 'string') {
        const pendSnap = pendingPrivateDmOpenRef.current;
        if (pendSnap?.targetSocketId === targetSocketId) {
          pendingPrivateDmOpenRef.current = null;
        }
        setDmSlots(prev => {
          let ix = prev.findIndex(s => s.partner?.socketId === targetSocketId && !s.roomReady);
          if (ix < 0 && pendSnap?.targetSocketId === targetSocketId) ix = pendSnap.slotIndex;
          if (ix < 0) return prev;
          const next = [...prev];
          next[ix] = { partner: null, messages: [], roomId: null, roomReady: false };
          const ap = activePanelRef.current;
          if (typeof ap === 'number' && ap === ix) queueMicrotask(() => setActivePanel('public'));
          return next;
        });
      }
      setErrorToast(message || 'שגיאה');
      setTimeout(() => setErrorToast(null), 5000);
    }

    function onDmTyping({ fromSocketId, typing }) {
      if (typeof fromSocketId !== 'string') return;
      setTypingPartners(prev => ({ ...prev, [fromSocketId]: !!typing }));
    }

    faithSocket.on('connect', onConnect);
    faithSocket.on('disconnect', onSocketDisconnect);
    faithSocket.on('FAITH_SOCKET_ID', onSocketId);
    faithSocket.on('FAITH_PRESENCE_LIST', onPresence);
    faithSocket.on('FAITH_PUBLIC_HISTORY', onPublicHistory);
    faithSocket.on('FAITH_CHAT_MESSAGE', onPublicMsg);
    faithSocket.on('FAITH_CHAT_SYSTEM', onPublicSystem);
    faithSocket.on('FAITH_DM_MESSAGE', onDmMsg);
    faithSocket.on('FAITH_DM_OPENED', onDmOpened);
    faithSocket.on('FAITH_DM_ENDED', onDmEnded);
    faithSocket.on('FAITH_DM_ERROR', onError);
    faithSocket.on('FAITH_DM_TYPING', onDmTyping);
    faithSocket.on('FAITH_MODERATOR_STATUS', onModeratorStatus);
    faithSocket.on('FAITH_PUBLIC_MESSAGE_DELETED', onPublicDeleted);
    faithSocket.on('FAITH_DM_MESSAGE_DELETED', onDmMessageDeleted);

    if (faithSocket.connected) onConnect();

    return () => {
      if (faithPendingJoinOnConnectRef.current) {
        faithSocket.off('connect', faithPendingJoinOnConnectRef.current);
        faithPendingJoinOnConnectRef.current = null;
      }
      if (faithSocket.connected) faithSocket.emit('FAITH_PUBLIC_UNWATCH');
      faithSocket.off('connect', onConnect);
      faithSocket.off('disconnect', onSocketDisconnect);
      faithSocket.off('FAITH_SOCKET_ID', onSocketId);
      faithSocket.off('FAITH_PRESENCE_LIST', onPresence);
      faithSocket.off('FAITH_PUBLIC_HISTORY', onPublicHistory);
      faithSocket.off('FAITH_CHAT_MESSAGE', onPublicMsg);
      faithSocket.off('FAITH_CHAT_SYSTEM', onPublicSystem);
      faithSocket.off('FAITH_DM_MESSAGE', onDmMsg);
      faithSocket.off('FAITH_DM_OPENED', onDmOpened);
      faithSocket.off('FAITH_DM_ENDED', onDmEnded);
      faithSocket.off('FAITH_DM_ERROR', onError);
      faithSocket.off('FAITH_DM_TYPING', onDmTyping);
      faithSocket.off('FAITH_MODERATOR_STATUS', onModeratorStatus);
      faithSocket.off('FAITH_PUBLIC_MESSAGE_DELETED', onPublicDeleted);
      faithSocket.off('FAITH_DM_MESSAGE_DELETED', onDmMessageDeleted);
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

  /** חסימת פניות פרטיות נשמרת בשקע לאורך החיבור */
  useEffect(() => {
    if (!joinedLobby || !faithSocket.connected) return undefined;
    faithSocket.emit('FAITH_BLOCK_INCOMING_PM', { block: !!blockIncomingPm });
    return undefined;
  }, [blockIncomingPm, joinedLobby, chatConnected]);

  /** עדכון ref לכל קריאה — ללא מחזורי תלות בקבצים */
  const dmSlotsLatestRef = useRef(dmSlots);
  dmSlotsLatestRef.current = dmSlots;

  const dmModerationRoomId = useMemo(() => {
    if (typeof activePanel !== 'number') return null;
    return dmSlots[activePanel]?.roomId ?? null;
  }, [activePanel, dmSlots]);

  const othersOnline = useMemo(
    () => onlineUsers.filter(u => u.socketId !== mySocketId),
    [onlineUsers, mySocketId],
  );

  const othersOnlineFiltered = useMemo(
    () => othersOnline.filter(u => !blockedNorms.has(normalizeProfileUsername(u.displayName))),
    [othersOnline, blockedNorms],
  );

  const othersOnlineWithVirtual = useMemo(() => {
    if (!joinedLobby) return othersOnlineFiltered;
    const virt = FAITH_VIRTUAL_USERS.map((v) => ({
      socketId: v.socketId,
      displayName: v.displayName,
      joinedAt: 0,
      virtual: true,
    }));
    return [...othersOnlineFiltered, ...virt];
  }, [joinedLobby, othersOnlineFiltered]);

  /** לתצוגת גלריית נוכחים — משתמשים חסומים מוסרים */
  const presenceListUsers = useMemo(
    () =>
      othersOnlineWithVirtual.filter(u => !blockedNorms.has(normalizeProfileUsername(u.displayName))),
    [othersOnlineWithVirtual, blockedNorms],
  );

  const presenceSearchNeedle = useMemo(
    () => faithPresenceFoldText(presenceSearchQuery),
    [presenceSearchQuery],
  );

  /**
   * סדר שורות נוכחים: בלי חיפוש — את/ה ראשון, אחר כך כולם לפי השרת.
   * עם חיפוש ויש התאמות — כל המתאימים למעלה (מיקום התאמה בשם, אז א״ב עברית); שאר הרשימה — **בסדר המקורי**.
   * עם חיפוש בלי התאמה — לא ממיינים (לא מערבבים את הרשימה).
   */
  const presenceRenderList = useMemo(() => {
    const entries = [];
    if (mySocketId) {
      entries.push({
        kind: 'self',
        socketId: mySocketId,
        displayName: String(effectiveChatName || '').trim() || 'אורח',
      });
    }
    for (const u of presenceListUsers) {
      entries.push({
        kind: 'other',
        socketId: u.socketId,
        displayName: u.displayName,
        user: u,
      });
    }
    const needle = presenceSearchNeedle;
    if (!needle) return entries;

    const fold = faithPresenceFoldText;
    const hits = name => fold(name).includes(needle);
    const idx = name => fold(name).indexOf(needle);

    const matches = entries.filter(e => hits(e.displayName));
    if (matches.length === 0) return entries;

    const matchesSorted = [...matches].sort((a, b) => {
      const ia = idx(a.displayName);
      const ib = idx(b.displayName);
      if (ia !== ib) return ia - ib;
      try {
        return String(a.displayName).localeCompare(String(b.displayName), 'he');
      } catch {
        return String(a.displayName).localeCompare(String(b.displayName));
      }
    });
    const matchIds = new Set(matchesSorted.map(e => e.socketId));
    const rest = entries.filter(e => !matchIds.has(e.socketId));
    return [...matchesSorted, ...rest];
  }, [mySocketId, effectiveChatName, presenceListUsers, presenceSearchNeedle]);

  /** שורת הדגשה — הראשון ברשימה הממוינת שמתאים לחיפוש */
  const presenceSearchHighlightSocketId = useMemo(() => {
    if (!presenceSearchNeedle) return null;
    for (const e of presenceRenderList) {
      if (faithPresenceFoldText(e.displayName).includes(presenceSearchNeedle)) return e.socketId;
    }
    return null;
  }, [presenceSearchNeedle, presenceRenderList]);

  useEffect(() => {
    const el = listScrollRef.current;
    if (!el) return;
    if (activePanel === 'public' && generalSubView === 'presence') return;
    el.scrollTop = el.scrollHeight;
  }, [publicMessages, dmSlots, activePanel, typingPartners, showOritTypingDemo, generalSubView]);

  useEffect(() => {
    if (generalSubView !== 'presence') setPresenceSearchQuery('');
  }, [generalSubView]);

  useEffect(() => {
    if (generalSubView !== 'presence') return;
    const root = listScrollRef.current;
    if (!root || !presenceSearchNeedle || !presenceSearchHighlightSocketId) return;
    const id = presenceSearchHighlightSocketId;
    const rid = window.requestAnimationFrame(() => {
      try {
        const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id.replace(/"/g, '\\"');
        const target = root.querySelector(`[data-presence-sid="${escaped}"]`);
        target?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } catch {
        /* ignore */
      }
    });
    return () => window.cancelAnimationFrame(rid);
  }, [generalSubView, presenceSearchNeedle, presenceSearchHighlightSocketId]);

  const privateSlotsFull = useMemo(() => dmSlots.every(s => !!s.partner), [dmSlots]);
  /** מונה מחוברים כפי שנראה אצלך (לא כולל חסומים) */
  const totalPresentCount =
    typeof mySocketId === 'string' && mySocketId
      ? presenceListUsers.length + 1
      : presenceListUsers.length + (joinedLobby ? 1 : 0);

  const isPrivatePanel = activePanel !== 'public';
  const activePrivateSlot = isPrivatePanel ? dmSlots[activePanel] : null;
  const sid = faithSocket.id || mySocketId || '';
  const privatePanelSynced =
    isPrivatePanel &&
    typeof activePanel === 'number' &&
    Boolean(activePrivateSlot?.partner) &&
    !!activePrivateSlot.roomReady;
  /** שדה כתיבה פרטי — גם לפני אישור השרת, כדי שמי שפתח את השיחה יוכל להקליד בחופשיות */
  const privateComposeVisible =
    isPrivatePanel &&
    typeof activePanel === 'number' &&
    Boolean(activePrivateSlot?.partner);
  const dmChannelReady = privatePanelSynced;

  function privateTabIsAwaiting(slotIndex) {
    const slot = dmSlots[slotIndex];
    if (!slot?.partner) return false;
    const typingHere = !!typingPartners[slot.partner.socketId];
    const last = slot.messages[slot.messages.length - 1];
    const lastFromMe = last && last.fromSocketId === sid;
    return !typingHere && !!lastFromMe;
  }

  function privateTabNeedsReplyGlow(partnerSocketId) {
    return !!privateTabAlerts[partnerSocketId];
  }

  function selectPanel(next) {
    setActivePanel(next);
    if (next === 'public') setGeneralSubView('conversation');
    if (typeof next !== 'number') return;
    const pid = dmSlotsLatestRef.current[next]?.partner?.socketId;
    if (!pid) return;
    setPrivateTabAlerts(prev => {
      if (!prev[pid]) return prev;
      const n = { ...prev };
      delete n[pid];
      return n;
    });
  }

  const joinLobby = useCallback(() => {
    const login = String(user?.username || pendingUser?.username || '').trim().slice(0, 40);
    const name = (login || String(displayNameRef.current || '').trim()).slice(0, 40);
    if (!name) return;

    const runJoin = () => {
      if (!faithSocket.connected) return;
      if (faithPendingJoinOnConnectRef.current) {
        faithSocket.off('connect', faithPendingJoinOnConnectRef.current);
        faithPendingJoinOnConnectRef.current = null;
      }
      setDisplayName(name);
      persistDisplayName(name);
      const modSecretOk = FAITH_CHAT_MOD_SECRET_CLIENT.length >= 8;
      faithSocket.emit('FAITH_CHAT_JOIN', {
        displayName: name,
        ...(login ? { moderatorLoginUsername: login } : {}),
        ...(modSecretOk ? { moderatorSecret: FAITH_CHAT_MOD_SECRET_CLIENT } : {}),
      });
      wantFaithLobbyRef.current = true;
      setJoinedLobby(true);
    };

    if (faithSocket.connected) {
      runJoin();
      return;
    }
    if (faithPendingJoinOnConnectRef.current) return;
    const onReady = () => {
      faithPendingJoinOnConnectRef.current = null;
      runJoin();
    };
    faithPendingJoinOnConnectRef.current = onReady;
    faithSocket.once('connect', onReady);
    ensureFaithChatConnected();
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
    saveDmSession(dmSlotsLatestRef.current);
    faithSocket.emit('FAITH_CHAT_LEAVE');
    wantFaithLobbyRef.current = false;
    pendingPrivateDmOpenRef.current = null;
    setJoinedLobby(false);
    setFaithChatModerator(false);
    setActivePanel('public');
    setPrivateTabAlerts({});
    setTypingPartners({});
    setBlockIncomingPm(false);
    setDmSlots(emptyDmSlotsFromSession());
  }, []);

  const deletePublicMessageAsModerator = useCallback(
    (messageId, previewText) => {
      if (!faithChatModerator || !faithSocket.connected || typeof messageId !== 'string') return;
      const raw = typeof previewText === 'string' ? previewText.trim() : '';
      const truncated = raw.slice(0, 80).replace(/\s+/g, ' ');
      const detail = raw ? `\n«${truncated}${raw.length > 80 ? '…' : ''}»` : '';
      if (!window.confirm(`למחוק את ההודעה מהצ׳אט הציבורי אצל כל המשתמשים?\nלא ניתן לבטל.${detail}`))
        return;
      faithSocket.emit('FAITH_MODERATOR_DELETE_PUBLIC', { messageId });
    },
    [faithChatModerator],
  );

  const deleteDmMessageAsModerator = useCallback(
    (messageId, previewText) => {
      if (!faithChatModerator || !faithSocket.connected || typeof messageId !== 'string' || !dmModerationRoomId) return;
      const raw = typeof previewText === 'string' ? previewText.trim() : '';
      const truncated = raw.slice(0, 80).replace(/\s+/g, ' ');
      const detail = raw ? `\n«${truncated}${raw.length > 80 ? '…' : ''}»` : '';
      if (!window.confirm(`למחוק את ההודעה מהשיחה הפרטית אצל שני הצדדים?\nלא ניתן לבטל.${detail}`))
        return;
      faithSocket.emit('FAITH_MODERATOR_DELETE_DM', { messageId, roomId: dmModerationRoomId });
    },
    [faithChatModerator, dmModerationRoomId],
  );

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
        ...(outgoingColor !== OUTGOING_DEFAULT_COLOR ? { color: outgoingColor } : {}),
      },
    ]);
    faithSocket.emit('FAITH_CHAT_MESSAGE', {
      text,
      ...(outgoingColor !== OUTGOING_DEFAULT_COLOR ? { color: outgoingColor } : {}),
    });
    setDraftPublic('');

    if (virtualReplyTimerRef.current) {
      clearTimeout(virtualReplyTimerRef.current);
      virtualReplyTimerRef.current = null;
    }
    virtualReplyTimerRef.current = setTimeout(() => {
      virtualReplyTimerRef.current = null;
      const smart = smartVirtPublicReply(text);
      const replyText =
        smart ?? VIRT_REPLY_POOL[Math.floor(Math.random() * VIRT_REPLY_POOL.length)];
      if (prefsRef.current.soundOn) playSoftPing();
      setPublicMessages(prev => [
        ...prev.slice(-299),
        {
          id: `virt-reply-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
          fromSocketId: ORIT_VIRTUAL.socketId,
          displayName: `${ORIT_VIRTUAL.displayName} · AI`,
          text: replyText,
          ts: Date.now(),
        },
      ]);
    }, 1600 + Math.random() * 2400);
  }, [draftPublic, joinedLobby, mySocketId, outgoingColor]);

  const sendDm = useCallback(() => {
    const text = draftDm.trim();
    const ap = activePanelRef.current;
    if (!text || !faithSocket.connected || typeof ap !== 'number' || !joinedLobby) return;
    const slot = dmSlotsLatestRef.current[ap];
    if (!slot?.partner?.socketId || !slot.roomReady) return;
    faithSocket.emit('FAITH_DM_MESSAGE', {
      text,
      partnerSocketId: slot.partner.socketId,
      ...(outgoingColor !== OUTGOING_DEFAULT_COLOR ? { color: outgoingColor } : {}),
    });
    setDraftDm('');
    faithSocket.emit('FAITH_DM_TYPING', { typing: false, partnerSocketId: slot.partner.socketId });
  }, [draftDm, joinedLobby, outgoingColor]);

  const openPrivateConversationFromUser = useCallback(
    u => {
      if (!joinedLobby || !chatConnected || u.virtual) return;
      if (u.socketId === mySocketId) return;
      const pn = normalizeProfileUsername(u.displayName);
      if (blockedNormsRef.current.has(pn)) {
        setErrorToast('המשתמש חסום אצלך — לא ניתן לפתוח שיחה פרטית.');
        setTimeout(() => setErrorToast(null), 4800);
        return;
      }
      /* סלוט שחזור עם אותו שם — מועדף כדי לשמר היסטוריה */
      const restoredIx = dmSlotsLatestRef.current.findIndex(
        s => s.restored && s.partner?.name === u.displayName,
      );
      const hasOpenSlot = dmSlotsLatestRef.current.some(s => !s.partner || s.restored);
      if (!hasOpenSlot) {
        setErrorToast(`כל ${DM_SLOT_COUNT} מקומות השיחות הפרטיות תפוסים — סגרו טאב לפני שמוסיפים.`);
        setTimeout(() => setErrorToast(null), 5000);
        return;
      }
      const preIx = restoredIx >= 0 ? restoredIx : dmSlotsLatestRef.current.findIndex(s => !s.partner);
      const slotIx = preIx < 0 ? DM_SLOT_COUNT - 1 : preIx;
      pendingPrivateDmOpenRef.current = { targetSocketId: u.socketId, slotIndex: slotIx };
      setDmSlots(prev => {
        let ix = restoredIx >= 0 ? restoredIx : prev.findIndex(s => !s.partner);
        if (ix < 0) ix = DM_SLOT_COUNT - 1;
        if (ix !== slotIx) pendingPrivateDmOpenRef.current = { targetSocketId: u.socketId, slotIndex: ix };
        const partner = { socketId: u.socketId, name: u.displayName };
        setActivePanel(ix);
        const next = [...prev];
        const existingMessages = prev[ix]?.restored ? prev[ix].messages : [];
        next[ix] = { partner: { ...partner }, messages: existingMessages, roomId: null, roomReady: false };
        return next;
      });
      faithSocket.emit('FAITH_DM_OPEN', { targetSocketId: u.socketId });
    },
    [joinedLobby, chatConnected, mySocketId],
  );

  const closePrivateDmFromTab = useCallback(e => {
    e.preventDefault();
    e.stopPropagation();
    const partnerSocketId = e.currentTarget?.getAttribute?.('data-partner-socket');
    if (typeof partnerSocketId !== 'string' || !partnerSocketId) return;
    const slot = dmSlotsLatestRef.current.find(s => s.partner?.socketId === partnerSocketId);
    if (!slot) return;
    if (!slot.roomReady) clearOutboundPrivateDmStateForPartner(partnerSocketId);
    else faithSocket.emit('FAITH_DM_LEAVE', { partnerSocketId });
  }, []);

  const closeAllDmSlotsForNorm = useCallback(norm => {
    const toClearSocketIds = [];
    dmSlotsLatestRef.current.forEach(slot => {
      if (!slot.partner || normalizeProfileUsername(slot.partner.name) !== norm) return;
      toClearSocketIds.push(slot.partner.socketId);
      if (!slot.roomReady) clearOutboundPrivateDmStateForPartner(slot.partner.socketId);
      else if (faithSocket.connected) faithSocket.emit('FAITH_DM_LEAVE', { partnerSocketId: slot.partner.socketId });
    });
    if (toClearSocketIds.length) {
      setPrivateTabAlerts(prev => {
        const next = { ...prev };
        toClearSocketIds.forEach(id => {
          delete next[id];
        });
        return next;
      });
      setTypingPartners(prev => {
        const next = { ...prev };
        toClearSocketIds.forEach(id => {
          delete next[id];
        });
        return next;
      });
    }
    setDmSlots(prev =>
      prev.map(slot =>
        slot.partner && normalizeProfileUsername(slot.partner.name) === norm
          ? { partner: null, messages: [], roomId: null, roomReady: false }
          : slot,
      ),
    );
  }, []);

  const persistBlocked = useCallback(next => {
    setBlockedNorms(next);
    persistFaithNormSet(FAITH_BLOCKED_NORMS_KEY, next);
  }, []);

  const persistMuted = useCallback(next => {
    setMutedNorms(next);
    persistFaithNormSet(FAITH_MUTED_NORMS_KEY, next);
  }, []);

  const addBlockedFromMenu = useCallback(
    displayNameRaw => {
      const norm = normalizeProfileUsername(displayNameRaw);
      if (!norm) return;
      persistBlocked(prev => {
        const n = new Set(prev);
        n.add(norm);
        return n;
      });
      persistMuted(prev => {
        const m = new Set(prev);
        m.delete(norm);
        return m;
      });
      closeAllDmSlotsForNorm(norm);
      presenceMenuPinnedRef.current = false;
      setPresenceMenu(null);
      setErrorToast('המשתמש נחסם אצלך בצ\'אט (מקומי במכשיר).');
      setTimeout(() => setErrorToast(null), 4200);
    },
    [closeAllDmSlotsForNorm, persistBlocked, persistMuted],
  );

  const removeBlockedNorm = useCallback(
    norm => {
      persistBlocked(prev => {
        const n = new Set(prev);
        n.delete(norm);
        return n;
      });
    },
    [persistBlocked],
  );

  const toggleMutedFromMenu = useCallback(
    displayNameRaw => {
      const norm = normalizeProfileUsername(displayNameRaw);
      if (!norm) return;
      persistMuted(prev => {
        const m = new Set(prev);
        if (m.has(norm)) m.delete(norm);
        else m.add(norm);
        return m;
      });
      presenceMenuPinnedRef.current = false;
      setPresenceMenu(null);
    },
    [persistMuted],
  );

  const openPresenceUserMenu = useCallback((e, targetUser, mode) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const top = Math.max(4, rect.bottom + 8);
    const anchorRight = typeof window !== 'undefined' ? window.innerWidth - rect.right : 0;
    setPresenceMenu(prev => {
      if (prev?.targetUser?.socketId === targetUser?.socketId) return prev;
      return { top, anchorRight, targetUser, mode };
    });
  }, []);

  const clickPresenceUserMenu = useCallback((e, targetUser, mode) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const top = Math.max(4, rect.bottom + 8);
    const anchorRight = typeof window !== 'undefined' ? window.innerWidth - rect.right : 0;
    setPresenceMenu(prev => {
      if (prev?.targetUser?.socketId === targetUser?.socketId) {
        if (presenceMenuPinnedRef.current) {
          // כבר פינד — לחיצה שנייה סוגרת
          presenceMenuPinnedRef.current = false;
          return null;
        }
        // תפריט פתוח ממעבר עכבר — פין בלי לזוז
        presenceMenuPinnedRef.current = true;
        return prev;
      }
      // יוזר אחר — פתח פינד
      presenceMenuPinnedRef.current = true;
      return { top, anchorRight, targetUser, mode };
    });
  }, []);

  const clearPresenceSheetLeaveTimer = useCallback(() => {
    if (presenceSheetLeaveTimerRef.current != null) {
      window.clearTimeout(presenceSheetLeaveTimerRef.current);
      presenceSheetLeaveTimerRef.current = null;
    }
  }, []);

  const onPresenceSheetPointerEnter = useCallback(() => {
    presenceSheetPointerInsideRef.current = true;
    clearPresenceSheetLeaveTimer();
    /* ברגע שהעכבר בתוך החלונית — התפריט לא ייסגר מ־mouseleave על השם */
    presenceMenuPinnedRef.current = true;
  }, [clearPresenceSheetLeaveTimer]);

  const onPresenceSheetPointerLeave = useCallback(() => {
    presenceSheetPointerInsideRef.current = false;
    clearPresenceSheetLeaveTimer();
    if (presenceMenuPinnedRef.current) return;
    presenceSheetLeaveTimerRef.current = window.setTimeout(() => {
      presenceSheetLeaveTimerRef.current = null;
      presenceMenuPinnedRef.current = false;
      setPresenceMenu(null);
    }, 900);
  }, [clearPresenceSheetLeaveTimer]);

  useEffect(() => {
    if (!presenceMenu) return undefined;
    function onKey(ev) {
      if (ev.key === 'Escape') {
        clearPresenceSheetLeaveTimer();
        presenceMenuPinnedRef.current = false;
        setPresenceMenu(null);
      }
    }
    function onDown(ev) {
      if (ev.target.closest?.('.cage-presence-ctx-sheet')) return;
      clearPresenceSheetLeaveTimer();
      presenceMenuPinnedRef.current = false;
      setPresenceMenu(null);
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown, true);
    };
  }, [presenceMenu, clearPresenceSheetLeaveTimer]);

  useEffect(
    () => () => {
      clearPresenceSheetLeaveTimer();
    },
    [clearPresenceSheetLeaveTimer],
  );

  const emitTypingDm = useCallback(typing => {
    const ap = activePanelRef.current;
    if (typeof ap !== 'number') return;
    const slot = dmSlotsLatestRef.current[ap];
    if (!slot?.roomReady || !slot.partner) return;
    faithSocket.emit('FAITH_DM_TYPING', { typing, partnerSocketId: slot.partner.socketId });
  }, []);

  const onDmDraftChange = useCallback(e => {
    setDraftDm(e.target.value);
    const ap = activePanelRef.current;
    if (typeof ap !== 'number') return;
    const slot = dmSlotsLatestRef.current[ap];
    if (!slot?.roomReady || !slot.partner) return;
    emitTypingDm(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => emitTypingDm(false), 1800);
  }, [emitTypingDm]);

  const publicConversationList = useMemo(
    () =>
      publicMessages
        .filter(m => m.kind !== 'system' || prefs.showJoinLeave)
        .filter(m => {
          if (m.kind === 'system') return true;
          const n = normalizeProfileUsername(m.displayName);
          if (blockedNorms.has(n)) return false;
          if (mutedNorms.has(n)) return false;
          return true;
        }),
    [publicMessages, prefs.showJoinLeave, blockedNorms, mutedNorms],
  );

  return (
    <>
      <style>{`
        /* עיצוב בשורת מאמרי צ׳אט מקצועי (כלוב/דומים) — פסים וסרגל כלים תחתון */
        .fcp-root { max-width: 560px; margin: 12px auto 0; padding: 0 8px 24px; direction: rtl; font-family: var(--font-sans, Rubik, system-ui, sans-serif); }
        .cage-chat-frame {
          border: 1px solid var(--border-strong);
          border-radius: 16px;
          background: linear-gradient(
            165deg,
            rgba(99, 102, 241, 0.07),
            rgba(15, 23, 42, 0.42)
          );
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.06),
            0 10px 36px rgba(0, 0, 0, 0.22);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          min-height: min(72vh, 640px);
        }
        .cage-room-bar {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
          padding: 6px 8px;
          background: linear-gradient(135deg, rgba(99,102,241,0.95), rgba(79,70,229,0.78));
          border-bottom: 1px solid var(--border);
          color: #fff;
          direction: rtl;
          font-size: 0.76rem;
          font-weight: 800;
        }
        .cage-room-bar-spacer {
          flex: 1 1 auto;
          min-width: 6px;
        }
        .cage-room-x {
          order: unset;
          flex-shrink: 0;
          align-self: center;
          margin-inline-start: 2px;
          border: none;
          background: transparent;
          color: #fff;
          font-size: 1.05rem;
          font-weight: 900;
          line-height: 1;
          padding: 4px 8px;
          cursor: pointer;
        }
        .cage-room-toggle {
          display: inline-flex;
          gap: 0;
          border: 1px solid rgba(255,255,255,0.35);
          border-radius: 4px;
          overflow: hidden;
        }
        .cage-room-toggle button {
          border: none;
          background: transparent;
          color: rgba(255,255,255,0.9);
          font-weight: 800;
          font-size: 0.68rem;
          padding: 5px 10px;
          cursor: pointer;
          font-family: inherit;
        }
        .cage-room-toggle button.on {
          background: rgba(0,0,0,0.28);
          color: #fff;
        }
        .cage-room-title {
          flex: 0 1 auto;
          font-weight: 900;
          white-space: normal;
          overflow: visible;
          text-overflow: unset;
          max-width: min(48%, min(260px, 46vw));
          text-align: right;
          direction: rtl;
          line-height: 1.25;
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          justify-content: flex-end;
          gap: 4px 6px;
        }
        .cage-room-title__name { font-weight: 900; font-size: 0.78rem; }
        .cage-room-title__sep { opacity: 0.8; font-weight: 700; font-size: 0.72rem; }
        .cage-room-title__count {
          font-size: 0.66rem;
          font-weight: 800;
          opacity: 0.92;
          color: rgba(255,255,255,0.94);
          white-space: nowrap;
        }
        .fcp-channel-tab .cage-gen-tab-count {
          font-weight: 800;
          opacity: 0.88;
          font-size: 0.61rem;
        }
        .fcp-msg-list.cage-striped {
          background-color: var(--card);
          background-image: repeating-linear-gradient(
            to bottom,
            var(--card) 0px,
            var(--card) 34px,
            var(--card2) 34px,
            var(--card2) 35px
          );
          padding: 0;
          flex: 1;
          min-height: 200px;
        }
        .cage-msg-row-strip {
          min-height: 35px;
          padding: 2px 8px 4px;
          border-bottom: 1px solid var(--border);
          box-sizing: border-box;
          display: flex;
          align-items: flex-start;
          direction: rtl;
          gap: 8px;
        }
        .cage-msg-row-strip:last-child { border-bottom: none; }
        .cage-msg-time {
          flex: 0 0 44px;
          font-size: 0.61rem;
          color: var(--muted);
          font-weight: 700;
          padding-top: 3px;
        }
        .cage-msg-main {
          flex: 1;
          min-width: 0;
          text-align: right;
          font-size: 0.8rem;
          line-height: 1.3;
          color: var(--text);
        }
        .cage-msg-user { font-weight: 900; margin-inline-start: 4px; }
        .cage-msg-user-accent { color: var(--gold); font-weight: 900; margin-inline-start: 4px; }
        .cage-avatar-mini {
          width: 26px;
          height: 26px;
          flex-shrink: 0;
          background: var(--card-hover);
          border: 1px solid var(--border-strong);
          object-fit: cover;
        }
        .cage-chat-system-row {
          min-height: 28px;
          padding: 3px 10px 5px;
          border-bottom: 1px dashed rgba(255,255,255,0.06);
          text-align: center;
          direction: rtl;
          font-size: 0.7rem;
          font-style: italic;
          color: var(--muted);
          line-height: 1.35;
          font-family: var(--font-sans);
        }
        .cage-presence-row {
          min-height: 35px;
          padding: 3px 8px;
          display: flex;
          align-items: center;
          direction: rtl;
          gap: 8px;
          border-bottom: 1px solid var(--border);
          cursor: pointer;
          /* מכסה את פסי cage-striped מאחורי השם — בלי «צל»/דהיון ויזואלי */
          background: var(--card);
        }
        /* «את/ה» — בלי רקע ירוק קבוע; הירוק עובר לפי חיפוש או ברירת מחדל */
        .cage-presence-row--me {
          box-shadow: inset 3px 0 0 rgba(16, 185, 129, 0.4);
        }
        /* שורה מודגשת: ברירת מחדל = את/ה; בזמן חיפוש = המשתמש שנמצא */
        .cage-presence-row.cage-presence-row--presence-focus {
          background: rgba(16, 185, 129, 0.16) !important;
          box-shadow:
            inset 3px 0 0 rgba(16, 185, 129, 0.55),
            inset 0 0 0 1px rgba(52, 211, 153, 0.42) !important;
        }
        .cage-presence-search-row {
          position: sticky;
          top: 0;
          z-index: 3;
          padding: 6px 8px 8px;
          background: var(--card);
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .cage-presence-search-input {
          width: 100%;
          box-sizing: border-box;
          padding: 8px 10px;
          border-radius: 10px;
          border: 1px solid var(--border-strong);
          background: rgba(15, 23, 42, 0.55);
          color: var(--text);
          font-size: 0.8rem;
          font-weight: 650;
          font-family: var(--font-sans);
          direction: rtl;
          text-align: right;
        }
        .cage-presence-search-input::placeholder {
          color: var(--muted);
          font-weight: 600;
        }
        .cage-presence-search-input:focus {
          outline: none;
          border-color: rgba(52, 211, 153, 0.45);
          box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.15);
        }
        .cage-presence-row:hover:not([disabled]):not(.cage-presence-row--inactive) { filter: brightness(1.04); }
        .cage-presence-row[disabled],
        .cage-presence-row--inactive {
          cursor: default;
        }
        .cage-presence-name {
          flex: 1;
          text-align: right;
          font-weight: 900;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          border: none;
          background: transparent;
          font-family: var(--font-sans);
          cursor: inherit;
          padding: 0;
          font-size: 0.78rem;
          color: #fdba74;
          text-shadow: none;
        }
        .cage-presence-row--me .cage-presence-name,
        .cage-presence-row--me .cage-presence-profile-hit {
          color: #fdba74;
          font-weight: 900;
        }
        .cage-presence-meta {
          font-size: 0.62rem;
          color: var(--muted);
          white-space: nowrap;
          font-family: var(--font-sans);
          font-weight: 600;
        }
        .cage-presence-split {
          cursor: default;
          display: flex !important;
          flex-direction: row;
          align-items: center;
          justify-content: flex-start;
          gap: 10px;
          width: 100%;
          box-sizing: border-box;
        }
        .cage-presence-profile-hit {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: flex-start;
          gap: 7px;
          text-align: right;
          cursor: pointer;
          font-weight: 900;
          font-size: 0.78rem;
          border: none;
          background: transparent;
          font-family: var(--font-sans);
          padding: 0;
          color: #fdba74;
          text-shadow: none;
          -webkit-font-smoothing: antialiased;
          transition: color 0.15s ease;
          overflow: hidden;
        }
        .cage-presence-profile-name-text {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-align: right;
          font-weight: 900;
          text-shadow: none;
          color: inherit;
        }
        .cage-presence-profile-hit:hover {
          text-decoration: underline;
          text-underline-offset: 2px;
          text-decoration-color: rgba(254, 215, 170, 0.75);
          color: #ffe4b5;
        }
        .cage-presence-dm-hit {
          flex-shrink: 0;
          padding: 4px 10px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border-strong);
          background: rgba(255,255,255,0.06);
          color: var(--text-secondary);
          font-size: 0.65rem;
          font-weight: 700;
          cursor: pointer;
          font-family: var(--font-sans);
          letter-spacing: 0.02em;
          transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
        }
        .cage-presence-dm-hit:hover:not(:disabled) {
          border-color: rgba(99, 102, 241, 0.45);
          background: rgba(99, 102, 241, 0.12);
          color: var(--text);
        }
        .cage-presence-dm-hit:disabled { opacity: 0.4; cursor: not-allowed; }
        .cage-presence-ctx-sheet {
          position: fixed;
          z-index: 10060;
          min-width: 220px;
          max-width: min(92vw, 280px);
          border-radius: 14px;
          border: 1px solid rgba(99, 102, 241, 0.35);
          background: linear-gradient(165deg, rgba(30, 27, 75, 0.98), rgba(15, 23, 42, 0.97));
          box-shadow:
            0 4px 6px rgba(0, 0, 0, 0.18),
            0 18px 40px rgba(0, 0, 0, 0.45),
            inset 0 1px 0 rgba(255, 255, 255, 0.06);
          direction: rtl;
          padding: 0;
          /* גשר מעל הפער בין השם לחלונית — מקל על מעבר העכבר בלי לסגור את התפריט */
          padding-top: 18px;
          margin-top: -18px;
          overflow: hidden;
          font-family: var(--font-sans);
          text-align: right;
          box-sizing: border-box;
        }
        .cage-presence-ctx-head {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px 11px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(0, 0, 0, 0.2);
        }
        .cage-presence-ctx-avatar {
          width: 42px;
          height: 42px;
          flex-shrink: 0;
          border-radius: 50%;
          background: linear-gradient(145deg, rgba(129, 140, 248, 0.55), rgba(67, 56, 202, 0.85));
          border: 1px solid rgba(255, 255, 255, 0.14);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2);
        }
        .cage-presence-ctx-head-text {
          min-width: 0;
          flex: 1;
        }
        .cage-presence-ctx-head-name {
          font-size: 0.92rem;
          font-weight: 800;
          color: var(--text);
          line-height: 1.25;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .cage-presence-ctx-head-sub {
          margin-top: 3px;
          font-size: 0.68rem;
          font-weight: 600;
          color: var(--muted);
          letter-spacing: 0.02em;
        }
        .cage-presence-ctx-actions {
          padding: 6px 0 4px;
        }
        .cage-presence-ctx-item {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: flex-start;
          gap: 10px;
          width: 100%;
          padding: 10px 14px;
          border: none;
          background: transparent;
          color: var(--text);
          font-size: 0.84rem;
          font-weight: 650;
          cursor: pointer;
          text-align: right;
          font-family: inherit;
          transition: background 0.12s ease, color 0.12s ease;
        }
        .cage-presence-ctx-item:first-of-type {
          padding-top: 11px;
        }
        .cage-presence-ctx-item:hover:not(:disabled) {
          background: rgba(99, 102, 241, 0.14);
        }
        .cage-presence-ctx-item:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .cage-presence-ctx-item--lead {
          font-weight: 800;
          color: rgba(224, 231, 255, 0.98);
        }
        .cage-presence-ctx-item--lead:hover:not(:disabled) {
          background: rgba(99, 102, 241, 0.22);
        }
        .cage-presence-ctx-item__icon {
          flex-shrink: 0;
          width: 1.65rem;
          text-align: center;
          font-size: 1.05rem;
          line-height: 1;
          opacity: 0.95;
        }
        .cage-presence-ctx-item__label {
          flex: 1;
          min-width: 0;
          text-align: right;
        }
        .cage-presence-ctx-item.cage-presence-ctx-danger {
          color: #fecaca;
          font-weight: 800;
        }
        .cage-presence-ctx-item.cage-presence-ctx-danger:hover:not(:disabled) {
          background: rgba(244, 63, 94, 0.18);
          color: #fff;
        }
        .cage-presence-ctx-divider {
          height: 1px;
          margin: 4px 10px;
          background: rgba(255, 255, 255, 0.07);
        }
        .cage-presence-ctx-sheet .cage-presence-ctx-muted {
          color: var(--muted);
          font-size: 0.64rem;
          padding: 6px 14px 11px;
          line-height: 1.45;
          margin: 0;
          font-weight: 600;
        }
        .cage-compose-bar {
          display: flex;
          flex-direction: row;
          align-items: stretch;
          background: var(--surface);
          border-top: 1px solid var(--border-strong);
          direction: ltr;
          overflow: visible;
        }
        .cage-toolbar-icons {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 2px;
          padding: 4px;
          flex-shrink: 0;
          border-inline-end: 1px solid var(--border-strong);
          overflow: visible;
        }
        .cage-tool-btn {
          width: 36px;
          height: 36px;
          border: 1px solid transparent;
          border-radius: 4px;
          background: transparent;
          color: var(--text-secondary);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          overflow: visible;
        }
        .cage-tool-btn:hover { background: rgba(255,255,255,0.06); }
        .cage-tool-btn.on { border-color: rgba(251,191,36,0.35); }
        .cage-tool-btn svg {
          display: block;
          overflow: visible;
          flex-shrink: 0;
        }
        .cage-input-wrap {
          flex: 1;
          min-width: 0;
          padding: 4px;
          direction: rtl;
          display: flex;
          gap: 4px;
          align-items: center;
        }
        .cage-input-wrap textarea {
          flex: 1;
          min-height: 36px;
          max-height: 88px;
          resize: none;
          border-radius: 10px;
          border: 1px solid var(--border-strong);
          background: var(--card2);
          font-size: 0.8rem;
          padding: 6px 8px;
          text-align: right;
          font-family: inherit;
          color: var(--text);
        }
        .cage-send-cage {
          padding: 0 10px;
          font-weight: 900;
          font-size: 0.68rem;
          border-radius: 8px;
          border: 1px solid rgba(255, 148, 148, 1);
          background-color: #ff1d1d;
          background-image: linear-gradient(to bottom, rgba(255, 255, 255, 0.22) 0%, transparent 45%);
          color: #fff;
          cursor: pointer;
          flex-shrink: 0;
          font-family: inherit;
          box-shadow:
            var(--shadow-xs),
            0 2px 18px rgba(255, 24, 24, 0.58),
            inset 0 1px 0 rgba(255, 255, 255, 0.35);
        }
        .cage-send-cage:disabled { opacity: 0.45; cursor: not-allowed; }
        .cage-footer-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          align-items: center;
          padding: 6px 6px 8px;
          background: rgba(14,14,20,0.94);
          border-top: 1px solid var(--border);
          direction: rtl;
        }
        .cage-tab {
          padding: 4px 8px;
          min-height: 28px;
          font-size: 0.62rem;
          font-weight: 800;
          border: 1px solid var(--border-strong);
          background: var(--card2);
          color: var(--text);
          cursor: pointer;
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-family: inherit;
        }
        .cage-tab--general.active {
          outline: 2px solid rgba(99,102,241,0.55);
          outline-offset: -1px;
        }
        .cage-tab--private-slot { display: inline-flex; align-items: stretch; gap: 0; padding: 0; border: none; background: transparent; }
        .cage-tab--private-slot .cage-tab-hit {
          margin: 0;
          flex: 1;
        }
        .cage-tab--private-slot .cage-tab-hit.active-outline-green {
          outline: 2px solid var(--atheist);
          outline-offset: -1px;
        }
        .cage-tab--private-slot .cage-tab-hit.reply-alert-bg {
          background: linear-gradient(175deg, rgba(244, 63, 94, 0.88), rgba(62, 14, 22, 0.96));
          border-color: rgba(255,255,255,0.22);
          color: #fff;
          box-shadow: 0 0 20px var(--believer-glow);
        }
        .cage-tab-x {
          width: 26px;
          padding: 0;
          margin: 0;
          border: 1px solid rgba(255,255,255,0.35);
          background: rgba(220,220,220,0.1);
          color: #fff;
          cursor: pointer;
          font-weight: 900;
          font-size: 0.85rem;
          line-height: 1;
        }
        .cage-emoji-panel {
          position: absolute;
          bottom: calc(100% + 6px);
          left: 0;
          direction: rtl;
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 2px;
          padding: 8px;
          background: var(--card2);
          border: 1px solid var(--border-strong);
          z-index: 50;
          width: min(280px, 92vw);
          box-shadow: var(--shadow-md);
        }
        .cage-emoji-panel button {
          border: none;
          background: rgba(255,255,255,0.06);
          font-size: 1.2rem;
          padding: 6px;
          cursor: pointer;
          border-radius: var(--radius-sm);
        }
        .cage-color-pop {
          position: absolute;
          bottom: calc(100% + 6px);
          left: 0;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          padding: 8px;
          background: var(--card);
          border: 1px solid var(--border-strong);
          z-index: 50;
          max-width: 200px;
        }
        .cage-color-swatch {
          width: 22px;
          height: 22px;
          border-radius: 3px;
          border: 2px solid var(--border-strong);
          cursor: pointer;
          padding: 0;
        }
        .cage-color-swatch.on { outline: 2px solid var(--gold); outline-offset: 1px; }
        .cage-settings-pop {
          position: absolute;
          bottom: calc(100% + 6px);
          left: 0;
          min-width: 268px;
          max-width: 92vw;
          background: var(--card);
          border: 1px solid var(--border-strong);
          z-index: 60;
          padding: 8px 0;
          box-shadow: var(--shadow-lg);
          direction: rtl;
        }
        .cage-settings-pop label {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          flex-direction: row-reverse;
          gap: 10px;
          padding: 8px 12px;
          font-size: 0.72rem;
          color: var(--text-secondary);
          cursor: pointer;
          border-bottom: 1px solid var(--border);
          margin: 0;
        }
        .cage-settings-pop label:last-child { border-bottom: none; }
        .cage-pop-anchor { position: relative; overflow: visible; }
        .fcp-main.cage-shell {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: min(380px, 52vh);
          background: transparent;
          border-radius: 0;
        }
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
        .fcp-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--muted); }
        .fcp-dot.on { background: var(--atheist); box-shadow: 0 0 8px var(--atheist-glow); }
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
        .fcp-channel-tab-slot {
          display: inline-flex;
          align-items: center;
          gap: 1px;
          padding: 1px 2px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          max-width: 122px;
        }
        .fcp-channel-tab-slot.active {
          background: rgba(99,102,241,0.35);
          border-color: rgba(129,140,248,0.5);
        }
        .fcp-channel-tab-slot.active .fcp-channel-tab-hit {
          color: #eef2ff;
        }
        .fcp-channel-tab-slot--await .fcp-channel-tab-hit {
          color: #f87171;
          font-weight: 900;
        }
        .fcp-channel-tab-hit--reply {
          background: linear-gradient(175deg, rgba(244, 63, 94, 0.88), rgba(62, 14, 22, 0.96)) !important;
          border: 1px solid rgba(255,255,255,0.12) !important;
          color: #fff !important;
          box-shadow: 0 0 14px var(--believer-glow);
        }
        .fcp-channel-tab-hit {
          flex: 1;
          min-width: 0;
          padding: 2px 4px;
          border: none;
          border-radius: 6px;
          background: transparent;
          font-family: inherit;
          font-size: 0.66rem;
          font-weight: 800;
          color: rgba(226,232,240,0.88);
          cursor: pointer;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-align: right;
        }
        .fcp-channel-tab-x {
          flex-shrink: 0;
          width: 18px;
          height: 18px;
          padding: 0;
          line-height: 1;
          border: none;
          border-radius: 5px;
          background: rgba(248,113,113,0.15);
          color: #fca5a5;
          font-size: 0.85rem;
          font-weight: 900;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .fcp-channel-tab-x:hover {
          background: rgba(248,113,113,0.35);
          color: #fff;
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
        .fcp-msg-article {
          position: relative;
          align-self: stretch;
        }
        .fcp-mod-delete {
          position: absolute;
          top: 3px;
          inset-inline-start: 3px;
          z-index: 2;
          width: 26px;
          height: 26px;
          padding: 0;
          border: none;
          border-radius: 6px;
          font-size: 1rem;
          line-height: 1;
          font-weight: 800;
          cursor: pointer;
          color: rgba(254,226,226,0.95);
          background: rgba(244,63,94,0.28);
          opacity: 0;
          transition: opacity 0.12s ease, background 0.12s ease;
        }
        .fcp-msg-article:hover .fcp-mod-delete,
        .fcp-msg-article:focus-within .fcp-mod-delete {
          opacity: 1;
        }
        .fcp-mod-delete:hover {
          background: rgba(244,63,94,0.55);
          color: #fff;
        }
        @media (max-width: 820px) {
          .fcp-mod-delete {
            opacity: 0.65;
          }
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
        .fcp-msg-linehead {
          display: flex;
          flex-direction: row;
          align-items: flex-start;
          justify-content: flex-start;
          gap: 7px;
          direction: rtl;
          width: 100%;
          min-width: 0;
        }
        .fcp-msg-line-main {
          flex: 1;
          min-width: 0;
          text-align: right;
          line-height: 1.28;
        }
        .fcp-msg-user {
          font-size: 0.74rem;
          font-weight: 800;
          color: rgba(165,180,252,0.98);
          text-shadow: none;
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
          padding-top: 6px;
          padding-bottom: 8px;
          padding-inline-start: 8px;
          padding-inline-end: 0;
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
          border: 1px solid rgba(255, 148, 148, 1);
          font-weight: 900;
          font-size: 0.7rem;
          cursor: pointer;
          background-color: #ff1d1d;
          background-image: linear-gradient(to bottom, rgba(255, 255, 255, 0.2) 0%, transparent 45%);
          color: #fff;
          flex-shrink: 0;
          align-self: center;
          box-shadow: 0 2px 16px rgba(255, 24, 24, 0.55), inset 0 1px 0 rgba(255,255,255,0.32);
          white-space: nowrap;
          transition: background 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease, filter 0.12s ease;
        }
        .fcp-send:hover:not(:disabled) {
          filter: brightness(1.05);
        }
        .fcp-send:active:not(:disabled) {
          filter: none;
          border-color: rgba(248, 113, 113, 0.45);
          background: linear-gradient(165deg, #ef4444 0%, #b91c1c 100%);
          box-shadow: 0 2px 8px rgba(220,38,38,0.35), inset 0 1px 0 rgba(255,255,255,0.12);
        }
        .fcp-send:disabled { opacity: 0.45; cursor: not-allowed; }
        .fcp-compose-gear {
          flex-shrink: 0;
          order: 99;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 25px;
          height: 25px;
          padding: 0;
          margin-inline-end: -6px;
          border-radius: 7px;
          border: 1px solid var(--border-strong);
          background: rgba(255,255,255,0.06);
          color: rgba(226,232,240,0.88);
          cursor: pointer;
        }
        .fcp-compose-gear:hover { background: rgba(255,255,255,0.12); }
        .fcp-compose-gear svg { display: block; }
        .fcp-compose-gear[aria-expanded="true"] {
          border-color: rgba(52,211,153,0.45);
          color: #a7f3d0;
        }
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
        .fcp-count { font-size: 0.68rem; color: var(--atheist); font-weight: 800; }
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
        .fcp-user-dm-hit {
          display: block;
          width: 100%;
          text-align: right;
          padding: 0;
          margin: 0;
          border: none;
          background: none;
          font-weight: 800;
          font-size: 0.72rem;
          line-height: 1.2;
          color: var(--text);
          cursor: pointer;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-family: inherit;
        }
        .fcp-user-dm-hit:hover:not(:disabled) {
          color: #a7f3d0;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .fcp-user-dm-hit:disabled,
        .fcp-user-dm-hit--off { opacity: 0.42; cursor: not-allowed; text-decoration: none; }
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
          border: 1px solid rgba(52, 211, 153, 0.55);
          background: linear-gradient(165deg, #10b981, #059669 55%, #047857);
          color: #ecfdf5;
          font-size: 1.02rem;
          font-weight: 900;
          cursor: pointer;
          box-shadow: none;
        }
        .fcp-connect-btn:hover:not(:disabled) {
          filter: brightness(1.06);
        }
        .fcp-connect-btn:disabled {
          opacity: 0.42;
          cursor: not-allowed;
          filter: none;
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
            padding-top: 6px;
            padding-bottom: 7px;
            padding-inline-start: 5px;
            padding-inline-end: 0;
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
              התנתקות
            </button>
          ) : null}
        </div>


        {!joinedLobby && (
          <div className="fcp-join-gate">
            <button
              type="button"
              className="fcp-connect-btn"
              onClick={joinLobby}
              disabled={!effectiveChatName}
            >
              התחבר לצ׳אט
            </button>
            {!hasLoginChatName && !effectiveChatName ? (
              <p className="fcp-note-hint" style={{ marginTop: 14 }}>נא למלא שם לפני ההתחברות.</p>
            ) : null}
          </div>
        )}

        {joinedLobby && (
          <>
            {hasLoginChatName && (
              <div className="fcp-connected-above-chat">
                <span className="fcp-name-readonly">
                  <span>מחובר:</span>
                  <strong dir="auto">{effectiveChatName}</strong>
                </span>
              </div>
            )}

            <div className="fcp-grid fcp-grid--solo">
              <div className="fcp-main cage-shell">
                <div className="cage-room-bar">
                  <div
                    className="cage-room-title"
                    dir="auto"
                    title={
                      activePanel === 'public'
                        ? `חדר ציבורי «${GENERAL_ROOM_LABEL}» — ${totalPresentCount} משתמשים מחוברים כעת`
                        : ''
                    }
                  >
                    {activePanel === 'public' ? (
                      <>
                        <span className="cage-room-title__name">{GENERAL_ROOM_LABEL}</span>
                        <span className="cage-room-title__sep">·</span>
                        <span className="cage-room-title__count">{totalPresentCount} מחוברים</span>
                      </>
                    ) : (
                      <span className="cage-room-title__name">{activePrivateSlot?.partner?.name || GENERAL_ROOM_LABEL}</span>
                    )}
                  </div>
                  <div className="cage-room-bar-spacer" aria-hidden />
                  <div className="cage-room-toggle">
                    <button
                      type="button"
                      className={activePanel === 'public' && generalSubView === 'conversation' ? 'on' : ''}
                      onClick={() => { selectPanel('public'); setGeneralSubView('conversation'); }}
                    >
                      שיחה
                    </button>
                    <button
                      type="button"
                      className={activePanel === 'public' && generalSubView === 'presence' ? 'on' : ''}
                      onClick={() => { selectPanel('public'); setGeneralSubView('presence'); }}
                    >
                      נוכחים
                    </button>
                  </div>
                  <button
                    type="button"
                    className="cage-room-x"
                    onClick={() => {
                      if (typeof activePanel === 'number') selectPanel('public');
                      else leaveLobby();
                    }}
                    aria-label={
                      typeof activePanel === 'number' ? 'חזרה לצ׳אט כללי' : 'יציאה והתנתקות מצ׳אט האמונה'
                    }
                    title={
                      typeof activePanel === 'number' ? 'חזרה לצ׳אט הכללי' : 'סגירה והתנתקות מהצ׳אט'
                    }
                  >
                    ×
                  </button>
                </div>
                <div
                  className="fcp-msg-list cage-striped"
                  ref={listScrollRef}
                  style={{ flex: 1, minHeight: 200, maxHeight: 'min(48vh, 440px)', overflowY: 'auto' }}
                >
                  {activePanel === 'public' ? (
                    generalSubView === 'presence' ? (
                      <>
                        <div className="cage-presence-search-row">
                          <input
                            id="cage-presence-search"
                            type="text"
                            inputMode="search"
                            enterKeyHint="search"
                            dir="rtl"
                            value={presenceSearchQuery}
                            onChange={e => setPresenceSearchQuery(e.currentTarget.value)}
                            placeholder="חיפוש לפי שם משתמש…"
                            aria-label="חיפוש משתמש ברשימת הנוכחים"
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                            className="cage-presence-search-input"
                          />
                        </div>
                        {presenceRenderList.map(entry => {
                          const isFocus =
                            (!presenceSearchNeedle && entry.kind === 'self') ||
                            (presenceSearchNeedle && presenceSearchHighlightSocketId === entry.socketId);
                          if (entry.kind === 'self') {
                            return (
                              <div
                                key={entry.socketId}
                                data-presence-sid={entry.socketId}
                                className={`cage-presence-row cage-presence-row--me cage-presence-split${
                                  isFocus ? ' cage-presence-row--presence-focus' : ''
                                }`}
                              >
                                <button
                                  type="button"
                                  className="cage-presence-profile-hit"
                                  onClick={e =>
                                    openPresenceUserMenu(e, {
                                      displayName: effectiveChatName || 'אורח',
                                      socketId: mySocketId,
                                      virtual: false,
                                    }, 'self')
                                  }
                                >
                                  <UserAvatarSlot
                                    size="sm"
                                    displayName={effectiveChatName || 'אורח'}
                                    avatarUrl={getCageAvatarDataUrlForDisplayName(effectiveChatName || 'אורח') || undefined}
                                  />
                                  <span className="cage-presence-profile-name-text">
                                    {effectiveChatName || 'אורח'}
                                  </span>
                                </button>
                                <span className="cage-presence-meta">את/ה · נוכחים</span>
                              </div>
                            );
                          }
                          const u = entry.user;
                          return (
                            <div
                              key={entry.socketId}
                              data-presence-sid={entry.socketId}
                              className={`cage-presence-row cage-presence-split${
                                !chatConnected || privateSlotsFull || u.virtual ? ' cage-presence-row--inactive' : ''
                              }${isFocus ? ' cage-presence-row--presence-focus' : ''}`}
                            >
                              <button
                                type="button"
                                className="cage-presence-profile-hit"
                                dir="auto"
                                onClick={e => clickPresenceUserMenu(e, u, 'other')}
                                onMouseEnter={e => { clearPresenceSheetLeaveTimer(); openPresenceUserMenu(e, u, 'other'); }}
                                onMouseLeave={() => onPresenceSheetPointerLeave()}
                              >
                                <UserAvatarSlot
                                  size="sm"
                                  displayName={u.displayName}
                                  avatarUrl={getCageAvatarDataUrlForDisplayName(u.displayName) || undefined}
                                />
                                <span className="cage-presence-profile-name-text" dir="auto">
                                  {u.displayName}
                                  {mutedNorms.has(normalizeProfileUsername(u.displayName)) ? (
                                    <span style={{ color: 'var(--muted)', fontWeight: 650, fontSize: '0.65rem' }}>
                                      {' '}
                                      · מושתק
                                    </span>
                                  ) : null}
                                </span>
                              </button>
                              <button
                                type="button"
                                className="cage-presence-dm-hit"
                                disabled={!chatConnected || privateSlotsFull || u.virtual}
                                onClick={() => openPrivateConversationFromUser(u)}
                              >
                                {u.virtual ? 'דמו' : privateSlotsFull ? 'מלא' : 'שיחה'}
                              </button>
                            </div>
                          );
                        })}
                      </>
                    ) : publicConversationList.length === 0 ? (
                      <div className="fcp-placeholder">
                        אין עדיין תוכן בצ&apos;אט הציבורי. שלחו הודעה — או חזרו לטאב «נוכחים» ובחרו מי לפתוח עמו בשיחה פרטית.
                      </div>
                    ) : (
                      <>
                        {publicConversationList.map((m) => {
                            if (m.kind === 'system') {
                              return (
                                <div key={m.id} className="cage-chat-system-row" role="status">
                                  {m.text}
                                </div>
                              );
                            }
                            const mine =
                              m.fromSocketId === mySocketId ||
                              (!!faithSocket.id && m.fromSocketId === faithSocket.id);
                            return (
                            <article key={m.id} className="fcp-msg-article">
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
                                  <div className="fcp-msg-linehead">
                                    <UserAvatarSlot
                                      size="chat"
                                      displayName={m.displayName}
                                      avatarUrl={resolveFaithChatLineAvatarUrl(m)}
                                    />
                                    <div className="fcp-msg-line-main">
                                      <span className="fcp-msg-user">
                                        {m.displayName}
                                        {mine ? ' (את/ה)' : ''}
                                        {' : '}
                                      </span>
                                      <span
                                        className="fcp-msg-text fcp-msg-inline"
                                        style={m.color ? { color: m.color } : undefined}
                                      >
                                        {m.text}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              {faithChatModerator ? (
                                <button
                                  type="button"
                                  className="fcp-mod-delete"
                                  aria-label={`מחיקת הודעת ציבור מהצ׳אט (מנהל): ${m.displayName}`}
                                  title="מחיקה מהציבור לכולם (מנהל)"
                                  onClick={e => {
                                    e.preventDefault();
                                    deletePublicMessageAsModerator(m.id, `${m.displayName}: ${m.text}`);
                                  }}
                                >
                                  ×
                                </button>
                              ) : null}
                            </article>
                            );
                          })}
                        {showOritTypingDemo ? (
                          <div className="fcp-public-typing-demo" aria-live="polite">
                            <div className="fcp-msg-linehead">
                              <UserAvatarSlot
                                size="chat"
                                displayName="אורית"
                                avatarUrl={getCageAvatarDataUrlForDisplayName('אורית') || undefined}
                              />
                              <div className="fcp-msg-line-main">
                                <span className="fcp-msg-user">אורית · </span>
                                <span className="fcp-public-typing-label">כותבת</span>
                                <span className="fcp-typing-dots" aria-hidden="true">
                                  <span>.</span>
                                  <span>.</span>
                                  <span>.</span>
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </>
                    )
                  ) : activePrivateSlot?.partner ? (
                    <>
                      {activePrivateSlot.messages.length === 0 ? (
                        <div className="fcp-placeholder">
                          שיחה פרטית עם {activePrivateSlot.partner.name}. ההודעות שלך מגיעות אליו מיד — אפשר לכתוב בשורה מתחת לטאבים.
                        </div>
                      ) : (
                        activePrivateSlot.messages.map(m => {
                          const mine = m.fromSocketId === sid;
                          return (
                            <article key={m.id} className="fcp-msg-article">
                              <div
                                className={`fcp-msg${mine ? ' mine' : ''}${prefs.showTimestamps ? '' : ' fcp-msg--no-time'}`}
                              >
                                <span className="fcp-msg-time-in" aria-hidden={!prefs.showTimestamps}>
                                  {prefs.showTimestamps && m.ts
                                    ? new Date(m.ts).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
                                    : ''}
                                </span>
                                <div className="fcp-msg-block">
                                  <div className="fcp-msg-linehead">
                                    <UserAvatarSlot
                                      size="chat"
                                      displayName={m.displayName}
                                      avatarUrl={resolveFaithChatLineAvatarUrl(m)}
                                    />
                                    <div className="fcp-msg-line-main">
                                      <span className="fcp-msg-user">
                                        {m.displayName}
                                        {mine ? ' (את/ה)' : ''}
                                        {' - '}
                                      </span>
                                      <span
                                        className="fcp-msg-text fcp-msg-inline"
                                        style={m.color ? { color: m.color } : undefined}
                                      >
                                        {m.text}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              {faithChatModerator && dmModerationRoomId ? (
                                <button
                                  type="button"
                                  className="fcp-mod-delete"
                                  aria-label={`מחיקת הודעה פרטית (מנהל): ${m.displayName}`}
                                  title="מחיקה מהשיחה הפרטית אצל שני הצדדים (מנהל)"
                                  onClick={e => {
                                    e.preventDefault();
                                    deleteDmMessageAsModerator(m.id, `${m.displayName}: ${m.text}`);
                                  }}
                                >
                                  ×
                                </button>
                              ) : null}
                            </article>
                          );
                        })
                      )}
                      {dmChannelReady &&
                        activePrivateSlot?.partner?.socketId &&
                        typingPartners[activePrivateSlot.partner.socketId] && (
                        <div className="fcp-typing">{activePrivateSlot.partner.name} כותב/ת…</div>
                      )}
                    </>
                  ) : (
                    <div className="fcp-placeholder" style={{ lineHeight: 1.55 }}>
                      מקום לשיחה פרטית. לחיצה על שם ברשימה פותחת שיחה — שם המשתמש יופיע בטאב.
                    </div>
                  )}
                </div>

                <div className="fcp-channel-tabs" role="tablist" aria-label="ערוצי צ׳אט">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activePanel === 'public'}
                    className={`fcp-channel-tab cage-gen-tab${activePanel === 'public' ? ' active' : ''}`}
                    onClick={() => selectPanel('public')}
                    title={
                      joinedLobby
                        ? `חדר ציבורי «${GENERAL_ROOM_LABEL}», ${totalPresentCount} משתמשים מחוברים`
                        : GENERAL_ROOM_LABEL
                    }
                  >
                    כללי
                    {joinedLobby ? (
                      <span className="cage-gen-tab-count" aria-hidden>
                        {' '}
                        · {totalPresentCount}
                      </span>
                    ) : null}
                  </button>
                  {dmSlots.map((slot, i) => {
                    const label = slot.partner
                      ? (slot.partner.name.length > 13 ? `${slot.partner.name.slice(0, 12)}…` : slot.partner.name)
                      : 'פרטי';
                    const awaiting = privateTabIsAwaiting(i);
                    const replyAlert =
                      slot.partner && privateTabNeedsReplyGlow(slot.partner.socketId);
                    const showClose = !!slot.partner;
                    return (
                      <div
                        key={i}
                        className={`fcp-channel-tab-slot${activePanel === i ? ' active' : ''}${awaiting ? ' fcp-channel-tab-slot--await' : ''}${replyAlert ? ' fcp-channel-tab-slot--reply' : ''}`}
                        role="presentation"
                      >
                        <button
                          type="button"
                          role="tab"
                          aria-selected={activePanel === i}
                          className={`fcp-channel-tab-hit${replyAlert ? ' fcp-channel-tab-hit--reply' : ''}`}
                          title={
                            slot.partner
                              ? replyAlert
                                ? 'הגיעה תשובה — לחצו כדי לקרוא'
                                : awaiting
                                  ? 'ממתין לתגובה'
                                  : slot.partner.name
                              : `חריץ פרטי ${i + 1}`
                          }
                          onClick={() => selectPanel(i)}
                        >
                          {label}
                        </button>
                        {showClose ? (
                          <button
                            type="button"
                            className="fcp-channel-tab-x"
                            data-partner-socket={slot.partner.socketId}
                            onClick={closePrivateDmFromTab}
                            title="סגירת השיחה"
                            aria-label="סגירת השיחה הפרטית"
                          >
                            ×
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                <div className="cage-compose-bar">
                  <div className="cage-toolbar-icons">
                    <div className="cage-pop-anchor">
                      <button
                        type="button"
                        className={`cage-tool-btn${composerToolFocus === 'settings' && settingsOpen ? ' on' : ''}`}
                        onClick={() => {
                          setComposerToolFocus('settings');
                          setEmojiPickerOpen(false);
                          setColorPickerOpen(false);
                          setSettingsOpen(o => !o);
                        }}
                        aria-expanded={settingsOpen}
                        aria-label="הגדרות"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="-2.5 -2.5 29 29" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.89 2.89l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-3-3l-.06-.06a1.65 1.65 0 0 0-.33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82 2 2 0 1 1 3-3l.06-.06a1.65 1.65 0 0 0 1.82-.33 1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33 2 2 0 1 1 3 3z" />
                        </svg>
                      </button>
                      {settingsOpen ? (
                        <div className="cage-settings-pop">
                          <label>
                            <input type="checkbox" checked={prefs.showJoinLeave} onChange={e => updatePrefs({ showJoinLeave: e.target.checked })} />
                            הצג הצטרפות ועזיבה בצ&apos;אט «כללי»
                          </label>
                          <label>
                            <input type="checkbox" checked={prefs.soundNewConversation} onChange={e => updatePrefs({ soundNewConversation: e.target.checked })} />
                            השמע צליל שיחה חדשה
                          </label>
                          <label>
                            <input type="checkbox" checked={prefs.soundNewMessagePublic} onChange={e => updatePrefs({ soundNewMessagePublic: e.target.checked })} />
                            השמע צליל הודעה חדשה
                          </label>
                          <label>
                            <input type="checkbox" checked={prefs.hideBlockedUsers} onChange={e => updatePrefs({ hideBlockedUsers: e.target.checked })} />
                            הסתר משתמשים שחסמתי
                          </label>
                          <label>
                            <input type="checkbox" checked={prefs.showRadioUpdates} onChange={e => updatePrefs({ showRadioUpdates: e.target.checked })} />
                            הצג עדכונים מהרדיו
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
                            <input type="checkbox" checked={prefs.soundOn} onChange={e => updatePrefs({ soundOn: e.target.checked })} />
                            צליל בהודעה פרטית נכנסת
                          </label>
                          {blockedNorms.size > 0 ? (
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 6, paddingTop: 8 }}>
                              <p style={{ fontSize: '0.68rem', color: 'rgba(226,232,240,0.78)', margin: '0 12px 8px', fontWeight: 700 }}>
                                משתמשים חסומים במכשיר
                              </p>
                              {[...blockedNorms].map(norm => (
                                <button
                                  key={norm}
                                  type="button"
                                  style={{
                                    display: 'block',
                                    width: '100%',
                                    textAlign: 'right',
                                    padding: '7px 12px',
                                    border: 'none',
                                    background: 'transparent',
                                    color: '#fecaca',
                                    fontSize: '0.72rem',
                                    cursor: 'pointer',
                                    fontFamily: 'inherit',
                                  }}
                                  onClick={() => removeBlockedNorm(norm)}
                                >
                                  הסר חסימה ({norm})
                                </button>
                              ))}
                            </div>
                          ) : null}
                          {faithChatModerator ? (
                            <p className="fcp-note-hint" style={{ padding: '6px 12px', margin: 0, color: 'var(--atheist)', fontWeight: 700 }}>
                              מנהל צ׳אט פעיל: × בהודעה (בריחוף עכבר) — מחק לכולם.
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <div className="cage-pop-anchor">
                      <button
                        type="button"
                        className={`cage-tool-btn${emojiPickerOpen ? ' on' : ''}`}
                        onClick={() => {
                          setEmojiPickerOpen(e => !e);
                          setColorPickerOpen(false);
                          setSettingsOpen(false);
                          setComposerToolFocus('emoji');
                        }}
                        aria-label="סמיילים"
                      >
                        😊
                      </button>
                      {emojiPickerOpen ? (
                        <div className="cage-emoji-panel">
                          {CAGE_EMOJI_GRID.map(em => (
                            <button key={em} type="button" onClick={() => {
                              const isPub = activePanelRef.current === 'public';
                              if (isPub) setDraftPublic(prev => `${prev}${em}`);
                              else setDraftDm(prev => `${prev}${em}`);
                              setEmojiPickerOpen(false);
                            }}
                            >
                              {em}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="cage-pop-anchor">
                      <button
                        type="button"
                        className={`cage-tool-btn${colorPickerOpen ? ' on' : ''}`}
                        onClick={() => {
                          setColorPickerOpen(c => !c);
                          setEmojiPickerOpen(false);
                          setSettingsOpen(false);
                          setComposerToolFocus('color');
                        }}
                        aria-label="צבע טקסט"
                      >
                        ✎
                      </button>
                      {colorPickerOpen ? (
                        <div className="cage-color-pop">
                          {OUTGOING_COLOR_CHOICES.map(c => (
                            <button
                              key={c}
                              type="button"
                              title={c}
                              className={`cage-color-swatch${outgoingColor === c ? ' on' : ''}`}
                              style={{ background: c }}
                              onClick={() => {
                                setOutgoingColor(c);
                                setColorPickerOpen(false);
                              }}
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className={`cage-tool-btn${blockIncomingPm ? ' on' : ''}`}
                      onClick={() => setBlockIncomingPm(b => !b)}
                      title={
                        blockIncomingPm
                          ? 'פניות פרטיות נעולות — אחרים לא יכולים לפתוח אליך שיחה. לחיצה פותחת שוב.'
                          : 'פניות פרטיות פתוחות — אחרים יכולים לפתוח אליך שיחה. לחיצה נועלת מפניות.'
                      }
                      aria-pressed={blockIncomingPm}
                      aria-label={
                        blockIncomingPm ? 'מנעול סגור — חסום פניות פרטיות נכנסות' : 'מנעול פתוח — אפשר פניות פרטיות נכנסות'
                      }
                    >
                      {blockIncomingPm ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M16.5 10.5V6.75a4.5 4.5 0 00-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H5.25a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25zm6-9.375a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0z" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M13.5 10.5V6.75a4.5 4.5 0 019 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <div className="cage-input-wrap">
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
                            placeholder="הקלד כאן…"
                            maxLength={2000}
                            disabled={!chatConnected}
                            rows={2}
                            style={{ color: outgoingColor }}
                          />
                          <button type="button" className="cage-send-cage" onClick={sendPublic} disabled={!chatConnected || !draftPublic.trim()}>
                            שלח
                          </button>
                        </>
                      ) : (
                        <p className="fcp-note-hint" style={{ margin: 0, padding: '6px', lineHeight: 1.45, flex: 1 }}>
                          ממתינים לחיבור לשרת…
                        </p>
                      )
                    ) : privateComposeVisible ? (
                      <>
                        <textarea
                          value={draftDm}
                          onChange={onDmDraftChange}
                          onKeyDown={e => {
                            if (!prefs.enterSends) return;
                            if (e.key === 'Enter' && !e.shiftKey && activePrivateSlot?.roomReady) {
                              e.preventDefault();
                              sendDm();
                            }
                          }}
                          placeholder={
                            activePrivateSlot?.roomReady
                              ? `ל־${activePrivateSlot.partner.name}…`
                              : `מחבר שיחה ל־${activePrivateSlot.partner.name}… אפשר להקליד מראש`
                          }
                          maxLength={2000}
                          disabled={!chatConnected}
                          rows={2}
                          style={{ color: outgoingColor }}
                        />
                        <button
                          type="button"
                          className="cage-send-cage"
                          onClick={sendDm}
                          disabled={!chatConnected || !draftDm.trim() || !activePrivateSlot?.roomReady}
                          title={!activePrivateSlot?.roomReady ? 'ממתין לחיבור השיחה — רגע אחד' : undefined}
                        >
                          שלח
                        </button>
                      </>
                    ) : (
                      <p className="fcp-note-hint" style={{ margin: 0, padding: '6px', flex: 1 }}>
                        בחרו טאב פרטי, או בשורת הנוכחים לחצו על «שיחה», או פתחו תפריט ליד השם.
                      </p>
                    )}
                  </div>
                </div>
              </div>
        </div>
          </>
        )}

        {outgoingToast && <div className="fcp-toast">{outgoingToast}</div>}
        {errorToast && <div className="fcp-toast err">{errorToast}</div>}
      </div>

      {presenceMenu && typeof document !== 'undefined'
        ? createPortal(
            (() => {
              const ctxName =
                String(presenceMenu.targetUser?.displayName || '').trim() || 'אורח';
              return (
            <div
              className="cage-presence-ctx-sheet"
              role="menu"
              onPointerEnter={onPresenceSheetPointerEnter}
              onPointerLeave={onPresenceSheetPointerLeave}
              style={{
                top: presenceMenu.top,
                right: Math.max(8, presenceMenu.anchorRight),
                left: 'auto',
              }}
            >
              <div className="cage-presence-ctx-head">
                <div className="cage-presence-ctx-avatar" aria-hidden />
                <div className="cage-presence-ctx-head-text">
                  <div className="cage-presence-ctx-head-name" dir="auto">
                    {ctxName}
                  </div>
                  <div className="cage-presence-ctx-head-sub">
                    {presenceMenu.mode === 'self'
                      ? 'הפרופיל שלך · בחדר הכללי'
                      : 'משתמש בחדר הכללי'}
                  </div>
                </div>
              </div>
              <div className="cage-presence-ctx-actions">
              {presenceMenu.mode === 'self' ? (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    className="cage-presence-ctx-item cage-presence-ctx-item--lead"
                    onClick={() => {
                      setPresenceMenu(null);
                      navigate(
                        `/profile/${encodeURIComponent(ctxName)}?returnTo=${encodeURIComponent(PROFILE_RETURN_TO_FAITH_CHAT)}`,
                      );
                    }}
                  >
                    <span className="cage-presence-ctx-item__icon" aria-hidden>👤</span>
                    <span className="cage-presence-ctx-item__label">פרופיל</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    className="cage-presence-ctx-item cage-presence-ctx-item--lead"
                    onClick={() => {
                      if (!ctxName) return;
                      setPresenceMenu(null);
                      navigate(
                        `/profile/${encodeURIComponent(ctxName)}?returnTo=${encodeURIComponent(PROFILE_RETURN_TO_FAITH_CHAT)}`,
                      );
                    }}
                  >
                    <span className="cage-presence-ctx-item__icon" aria-hidden>👤</span>
                    <span className="cage-presence-ctx-item__label">פרופיל</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="cage-presence-ctx-item"
                    title="שיחה פרטית"
                    aria-label="שיחה פרטית"
                    disabled={
                      !chatConnected ||
                      privateSlotsFull ||
                      presenceMenu.targetUser?.virtual ||
                      presenceMenu.targetUser?.socketId === mySocketId
                    }
                    onClick={() => {
                      presenceMenuPinnedRef.current = false;
                      openPrivateConversationFromUser(presenceMenu.targetUser);
                      setPresenceMenu(null);
                    }}
                  >
                    <span className="cage-presence-ctx-item__icon" aria-hidden>💬</span>
                    <span className="cage-presence-ctx-item__label">שיחה פרטית</span>
                  </button>
                  <div className="cage-presence-ctx-divider" aria-hidden />
                  <button
                    type="button"
                    role="menuitem"
                    className="cage-presence-ctx-item"
                    title={
                      mutedNorms.has(normalizeProfileUsername(presenceMenu.targetUser?.displayName))
                        ? 'הפסק השתקה בצ׳אט הכללי'
                        : 'השתקה בצ׳אט הכללי — לא תוצגנה הודעות מאותו שם'
                    }
                    aria-label={
                      mutedNorms.has(normalizeProfileUsername(presenceMenu.targetUser?.displayName))
                        ? 'הפסק השתקה בציבור'
                        : 'השתקה בציבור'
                    }
                    onClick={() => toggleMutedFromMenu(presenceMenu.targetUser?.displayName)}
                  >
                    <span className="cage-presence-ctx-item__icon" aria-hidden>
                      {mutedNorms.has(normalizeProfileUsername(presenceMenu.targetUser?.displayName))
                        ? '🔔'
                        : '🔕'}
                    </span>
                    <span className="cage-presence-ctx-item__label">
                      {mutedNorms.has(normalizeProfileUsername(presenceMenu.targetUser?.displayName))
                        ? 'בטל השתקה'
                        : 'השתקה'}
                    </span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="cage-presence-ctx-item cage-presence-ctx-danger"
                    title="חסימה במכשיר — סגירת פרטי והסתרה מרשימת השיחה"
                    aria-label="חסימה במכשיר"
                    onClick={() => addBlockedFromMenu(presenceMenu.targetUser?.displayName)}
                  >
                    <span className="cage-presence-ctx-item__icon" aria-hidden>⛔</span>
                    <span className="cage-presence-ctx-item__label">חסום</span>
                  </button>
                </>
              )}
              </div>
              <p className="cage-presence-ctx-muted">
                {presenceMenu.mode === 'self'
                  ? 'לא ניתן להשתיק או לחסום את עצמך.'
                  : 'השתקה וחסום נשמרים אצלך. חסום — סוגר פרטי ומסתיר מטאב «שיחה».'}
              </p>
            </div>
              );
            })(),
            document.body,
          )
        : null}
    </>
  );
}
