import React, { useRef, useState, useEffect, useLayoutEffect, useMemo } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAppStore, rehydrateUserIfNeeded } from '../store/appStore.js';
import { connectSocket, socket } from '../socket.js';
import { getApiBaseUrl } from '../lib/apiBaseUrl.js';

/**
 * ════════════════════════════════════════════════════════════════════════
 * ✅  דמויות דף הכניסה — PNG עם רקע שקוף (תוקן סופית!)
 * ════════════════════════════════════════════════════════════════════════
 *
 * הקבצים:  public/login/atheist-einstein.png
 *           public/login/believer-two-haredim.png
 *
 * שניהם PNG עם רקע שקוף לחלוטין — הרקע הלבן הוסר ב-scripts/remove-bg.mjs.
 * בגלל זה אין צורך ב-mix-blend-mode בכלל, ואין "קופסא לבנה" סביב הדמויות.
 *
 * ⚠️  אל תחזיר לפורמט JPEG! הרקע הלבן יחזור ויגרום לקופסא לבנה על הפאנל.
 * ⚠️  אם רוצים לשנות תמונות — להריץ: node scripts/remove-bg.mjs
 *
 * PANEL_IMG_STAMP — מספר גרסה לאחסון מטמון בלבד.
 */
const PANEL_IMG_STAMP = 'login-panels-png-transparent-v7-20260430';

const LOGIN_USERNAME_KEY = 'omg_login_username';
const LOGIN_PASSWORD_PREFIX = 'omg_login_password:';
const STATS_CACHE_KEY = 'omg_stats_cache';

function readStoredLoginUsername() {
  try {
    const savedUsername = localStorage.getItem(LOGIN_USERNAME_KEY);
    if (typeof savedUsername === 'string') return savedUsername;

    const storedUser = JSON.parse(localStorage.getItem('omg_user') || 'null');
    if (typeof storedUser?.username === 'string') return storedUser.username;
  } catch {
    // Ignore malformed localStorage values.
  }
  return '';
}

function persistLoginUsername(value) {
  try {
    if (value) localStorage.setItem(LOGIN_USERNAME_KEY, value);
    else localStorage.removeItem(LOGIN_USERNAME_KEY);
  } catch {
    // Local storage may be unavailable in private or restricted browser modes.
  }
}

function getPasswordStorageKey(username) {
  return `${LOGIN_PASSWORD_PREFIX}${username.trim().toLowerCase()}`;
}

function readStoredLoginPassword(username) {
  try {
    return localStorage.getItem(getPasswordStorageKey(username));
  } catch {
    return null;
  }
}

function persistLoginPassword(username, password) {
  try {
    localStorage.setItem(getPasswordStorageKey(username), password);
  } catch {
    // Local storage may be unavailable in private or restricted browser modes.
  }
}

function cacheRegisteredCount(count) {
  try {
    const current = JSON.parse(localStorage.getItem(STATS_CACHE_KEY) || 'null') || {};
    localStorage.setItem(STATS_CACHE_KEY, JSON.stringify({
      ...current,
      registered: Math.max(Number(current.registered) || 0, Number(count) || 0),
    }));
  } catch {
    // Stats cache is only a display fallback.
  }
}

function readLoginResume() {
  try {
    const raw = localStorage.getItem('omg_pending');
    if (!raw) return { registered: null, username: readStoredLoginUsername(), side: null };
    const p = JSON.parse(raw);
    if (!p?.username) return { registered: null, username: readStoredLoginUsername(), side: null };
    return { registered: null, username: p.username, side: null };
  } catch {
    return { registered: null, username: readStoredLoginUsername(), side: null };
  }
}

const EINSTEIN_SPARKLES = [
  { x: -42, y: -54, s: 0.74 }, { x: -22, y: -66, s: 0.58 }, { x: 4, y: -62, s: 0.82 }, { x: 34, y: -52, s: 0.62 },
  { x: -58, y: -26, s: 0.68 }, { x: -30, y: -32, s: 0.52 }, { x: 25, y: -34, s: 0.72 }, { x: 54, y: -18, s: 0.56 },
  { x: -62, y: 6, s: 0.62 }, { x: -34, y: 2, s: 0.84 }, { x: 18, y: 0, s: 0.64 }, { x: 60, y: 10, s: 0.76 },
  { x: -50, y: 40, s: 0.54 }, { x: -18, y: 30, s: 0.7 }, { x: 12, y: 42, s: 0.56 }, { x: 46, y: 34, s: 0.66 },
  { x: -35, y: 70, s: 0.78 }, { x: -4, y: 64, s: 0.6 }, { x: 28, y: 72, s: 0.7 }, { x: 58, y: 58, s: 0.52 },
];

const TITLE_WAVE_CHARS = ['o', 'h', ' ', 'm', 'y', ' ', 'G', 'O', 'D'];
const SUBTITLE_WAVE_CHARS = Array.from('אמונה ודת VS אתאיזם ומדע');

/** עוצמת כתום עד ~90% — 10% ערבוב עם לבן (דף כניסה + צור קשר) */
const ORANGE_STRENGTH = 0.9;

function orangeWaveRgb(intensity) {
  const r0 = Math.round(250 + 5 * intensity);
  const g0 = Math.round(100 + 55 * intensity);
  const b0 = Math.round(20 + 35 * intensity);
  const w = 1 - ORANGE_STRENGTH;
  return `rgb(${Math.round(r0 * ORANGE_STRENGTH + 255 * w)}, ${Math.round(g0 * ORANGE_STRENGTH + 255 * w)}, ${Math.round(b0 * ORANGE_STRENGTH + 255 * w)})`;
}

function orangeGlowAlpha(a) {
  return Math.round(a * ORANGE_STRENGTH * 1000) / 1000;
}

export default function LoginPage() {
  const panelImgUrls = useMemo(() => {
    const root = import.meta.env.BASE_URL || '/';
    const v = import.meta.env.DEV ? `dev-${Date.now()}` : PANEL_IMG_STAMP;
    return {
      believer: `${root}login/believer-two-haredim.png?v=${v}`,
      atheist: `${root}login/atheist-einstein.png?v=${v}`,
    };
  }, []);

  const loginInit = readLoginResume();
  const [username, setUsername] = useState(loginInit.username);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [selectedSide, setSelectedSide] = useState(loginInit.side);
  const [aiLoading, setAiLoading] = useState(false);
  const [registered, setRegistered] = useState(loginInit.registered);
  const [homeAnimationRun, setHomeAnimationRun] = useState(0);
  const currentUser = useAppStore(s => s.user);
  const setUser = useAppStore(s => s.setUser);
  const setPendingUser = useAppStore(s => s.setPendingUser);
  const pendingUser = useAppStore(s => s.pendingUser);
  const setDebate = useAppStore(s => s.setDebate);
  const navigate = useNavigate();
  const location = useLocation();
  const matchFoundHandlerRef = useRef(null);
  const matchErrorHandlerRef = useRef(null);
  const aiTimeoutRef = useRef(null);
  const aiAbortRef = useRef(false);
  /** בריפוי דף הבית — הסרת connect שנותר מזרימת AI */
  const aiConnectSendRef = useRef(null);
  /** שם פעיל לפאנלים ול-AI גם כש־registered אופס אחרי לוגו ויש רק currentUser או טקט בשדות */
  const sessionUsername =
    registered?.username?.trim()
    || currentUser?.username?.trim()
    || (username.trim() ? username.trim() : undefined);
  const shouldPlayHomePanels = homeAnimationRun > 0;

  function playHomeAnimationSequence() {
    setHomeAnimationRun(run => run + 1);
  }

  function resetHomePage() {
    rehydrateUserIfNeeded();
    aiAbortRef.current = true;
    if (aiConnectSendRef.current) {
      socket.off('connect', aiConnectSendRef.current);
      aiConnectSendRef.current = null;
    }
    if (matchFoundHandlerRef.current) {
      socket.off('MATCH_FOUND', matchFoundHandlerRef.current);
      matchFoundHandlerRef.current = null;
    }
    if (matchErrorHandlerRef.current) {
      socket.off('MATCH_ERROR', matchErrorHandlerRef.current);
      matchErrorHandlerRef.current = null;
    }
    if (aiTimeoutRef.current) {
      clearTimeout(aiTimeoutRef.current);
      aiTimeoutRef.current = null;
    }

    const activeUsername =
      useAppStore.getState().user?.username
      || readStoredLoginUsername();
    setRegistered(null);
    setSelectedSide(null);
    setAiLoading(false);
    setError('');
    setPassword('');
    setUsername(activeUsername);

    const u = useAppStore.getState().user;
    if (u?.username && (u.side === 'believer' || u.side === 'atheist')) {
      connectSocket(u.username, u.side);
    }
  }

  useEffect(() => {
    playHomeAnimationSequence();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (!params.has('homeReset')) return;
    rehydrateUserIfNeeded();
    const u = useAppStore.getState().user;
    /** מחוברים: לוגו/איפוס לא אמורים "לנקות" את המסך כאילו התנתקו — חוזים ללובי כמו לחיצת בית אמיתית */
    if (u?.username && (u.side === 'believer' || u.side === 'atheist')) {
      navigate(`/lobby?homeTap=${encodeURIComponent(String(Date.now()))}`, { replace: true });
      return;
    }
    resetHomePage();
    navigate('/login', { replace: true });
  }, [location.search, navigate]);

  /** מחוברים שמגיעים ל־/login בלי לוגו — חוזים ללובי; עם ?logo= זה דף הבית מהלוגו — נשארים במסך הכניסה */
  useLayoutEffect(() => {
    if (location.pathname !== '/login') return;
    const params = new URLSearchParams(location.search);
    if (params.has('homeReset')) return;
    if (params.has('logo')) return;
    rehydrateUserIfNeeded();
    const u = useAppStore.getState().user;
    if (u?.username && (u.side === 'believer' || u.side === 'atheist')) {
      navigate('/lobby', { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  /** חיבור סוקט מפורש אחרי הגעה עם ?logo= — מונע רגע „מנותק” בהדר ובכותרת */
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (!params.has('logo')) return;
    rehydrateUserIfNeeded();
    const u = useAppStore.getState().user;
    if (u?.username && (u.side === 'believer' || u.side === 'atheist')) {
      connectSocket(u.username, u.side);
    }
  }, [location.search]);

  useEffect(() => {
    if (currentUser) return;
    if (!pendingUser && registered) {
      setRegistered(null);
      setSelectedSide(null);
      setPassword('');
    }
  }, [currentUser, pendingUser, registered]);

  useEffect(() => () => {
    if (matchFoundHandlerRef.current) socket.off('MATCH_FOUND', matchFoundHandlerRef.current);
    if (matchErrorHandlerRef.current) socket.off('MATCH_ERROR', matchErrorHandlerRef.current);
    if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
  }, []);

  async function handleRegister() {
    const name = username.trim();
    const needPwLen = name.toLowerCase() === 'omg' ? 8 : 4;
    if (!name || name.length < 2) { setError('נא להזין שם משתמש (לפחות 2 תווים)'); return; }
    if (password.length !== needPwLen) {
      setError(needPwLen === 8 ? 'למנהל (OMG) נדרשת סיסמה של 8 תווים' : 'הסיסמה חייבת להיות בדיוק 4 תווים');
      return;
    }
    const storedPassword = readStoredLoginPassword(name);
    if (storedPassword && storedPassword !== password) {
      setError('הסיסמה אינה תואמת לשם המשתמש הזה');
      return;
    }
    setError('');

    const BASE = getApiBaseUrl();
    const isInitialPasswordSetup = !storedPassword;
    const shouldResetServerPassword = isInitialPasswordSetup || storedPassword === password;
    try {
      const res = await fetch(`${BASE}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: name, password, resetPassword: shouldResetServerPassword }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        let message = 'לא ניתן להיכנס עם הסיסמה הזו';
        if (data?.error) message = data.error;
        if (!shouldResetServerPassword) {
          setError(message);
          return;
        }
      }
      if (data?.registered) cacheRegisteredCount(data.registered);
    } catch {
      // Allow first setup locally if the registration server is temporarily unavailable.
    }

    const pending = { username: name };
    persistLoginUsername(name);
    persistLoginPassword(name, password);
    setRegistered(pending);
    playHomeAnimationSequence();
    rehydrateUserIfNeeded();
    if (!useAppStore.getState().user) setPendingUser(pending);
  }

  function handlePanelClick(side) {
    const name = sessionUsername?.trim();
    if (!name) { setError('נא להזין שם משתמש תחילה'); return; }
    setSelectedSide(side);
  }

  function handleUsernameChange(e) {
    const value = e.target.value;
    setUsername(value);
    persistLoginUsername(value.trim());
    if (value.trim().toLowerCase() !== 'omg' && password.length > 4) {
      setPassword(p => p.slice(0, 4));
    }
  }

  function handleHuman() {
    const name = sessionUsername;
    setUser({ username: name, side: selectedSide, score: 0, voiceDebates: 0, giftsReceived: 0, humanDebates: 0, aiDebates: 0 });
    connectSocket(name, selectedSide);
    navigate('/lobby');
  }

  function startAIDebate(name, side) {
    aiAbortRef.current = false;
    setUser({ username: name, side, score: 0, voiceDebates: 0, giftsReceived: 0, humanDebates: 0, aiDebates: 0 });
    setAiLoading(true);

    connectSocket(name, side);

    if (matchFoundHandlerRef.current) socket.off('MATCH_FOUND', matchFoundHandlerRef.current);
    if (matchErrorHandlerRef.current) socket.off('MATCH_ERROR', matchErrorHandlerRef.current);
    if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
    if (aiConnectSendRef.current) {
      socket.off('connect', aiConnectSendRef.current);
      aiConnectSendRef.current = null;
    }

    const onMatchFound = ({ debateId, isAI, believer, atheist, aiSide, turn }) => {
      if (aiAbortRef.current) return;
      socket.off('MATCH_ERROR', onMatchError);
      matchFoundHandlerRef.current = null;
      matchErrorHandlerRef.current = null;
      if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
      setDebate({
        id: debateId, isAI, aiSide,
        believer, atheist,
        phase: 'text', turn: turn || 'believer',
        textMessages: [], voiceMessages: [],
        textCount: { believer: 0, atheist: 0 },
        voiceCount: { believer: 0, atheist: 0 },
        giftsReceived: { believer: 0, atheist: 0 },
      });
      navigate(`/debate/${debateId}`);
    };

    const onMatchError = ({ message }) => {
      if (aiAbortRef.current) return;
      socket.off('MATCH_FOUND', onMatchFound);
      matchFoundHandlerRef.current = null;
      matchErrorHandlerRef.current = null;
      if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
      setAiLoading(false);
      setError(message || 'לא ניתן להתחיל דיון מול AI כרגע.');
    };

    matchFoundHandlerRef.current = onMatchFound;
    matchErrorHandlerRef.current = onMatchError;
    socket.once('MATCH_FOUND', onMatchFound);
    socket.once('MATCH_ERROR', onMatchError);

    // Wait for connection then emit — don't use fixed timeout
    function sendRequest() {
      if (aiAbortRef.current) return;
      socket.emit('REQUEST_AI_DEBATE', { username: name, side });
      aiConnectSendRef.current = null;
    }

    if (socket.connected) {
      sendRequest();
    } else {
      aiConnectSendRef.current = sendRequest;
      socket.once('connect', sendRequest);
      // Connection timeout after 8 seconds
      aiTimeoutRef.current = setTimeout(() => {
        if (!socket.connected) {
              aiAbortRef.current = true;
          socket.off('MATCH_FOUND', onMatchFound);
          socket.off('MATCH_ERROR', onMatchError);
          matchFoundHandlerRef.current = null;
          matchErrorHandlerRef.current = null;
          setAiLoading(false);
          setError('לא ניתן להתחבר לשרת. נסה שוב.');
        }
      }, 8000);
    }

    socket.connect();
  }

  function handleAIMode() {
    const name = sessionUsername;
    if (!name || !selectedSide) { setError('נא לבחור צד לפני התחלת דיון מול AI'); return; }
    startAIDebate(name, selectedSide);
  }

  function handleAI() {
    const name = sessionUsername;
    if (!name) { setError('נא להזין שם משתמש תחילה'); return; }
    setSelectedSide('believer');
    startAIDebate(name, 'believer');
  }

  return (
    <>
      <style>{`
        .login-page {
          min-height: calc(100vh - var(--shell-top));
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          padding: clamp(8px, 2.5vh, 22px) 16px 32px;
          background: transparent;
          gap: 16px;
          box-sizing: border-box;
          overflow-x: hidden;
          width: 100%;
        }
        .login-hero-card {
          position: relative;
          width: min(100%, 520px);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 18px;
          padding: clamp(18px, 4vw, 30px);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 28px;
          background:
            radial-gradient(circle at 50% 0%, rgba(251,191,36,0.1), transparent 34%),
            linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.035));
          box-shadow: 0 24px 70px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.08);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
        }
        .login-hero-card::before {
          content: '';
          position: absolute;
          inset: -1px;
          z-index: -1;
          border-radius: inherit;
          background: linear-gradient(135deg, rgba(244,63,94,0.32), transparent 35%, rgba(16,185,129,0.24));
          opacity: 0.75;
        }
        .login-brand-block {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }
        .login-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 12px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(0,0,0,0.22);
          color: var(--text-secondary, #b4b4c0);
          font-size: 0.78rem;
          font-weight: 700;
        }
        .ticker-wrap {
          width: 100%;
          max-width: 540px;
          border: 1px solid var(--border-strong, rgba(255,255,255,0.14));
          border-radius: 12px;
          overflow: hidden;
          padding: 6px 0;
          background: rgba(14, 14, 20, 0.55);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          direction: ltr;
          margin-bottom: 8px;
          margin-top: 0;
          flex-shrink: 0;
          box-shadow: var(--shadow-sm, 0 4px 14px rgba(0,0,0,0.35));
        }
        .ticker-inner {
          display: inline-block;
          white-space: nowrap;
          animation: ticker-scroll 60s linear infinite;
          will-change: transform;
        }
        .ticker-inner:hover {
          animation-play-state: paused;
        }
        @keyframes ticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-item {
          display: inline-block;
          color: var(--text-secondary, #b4b4c0);
          font-weight: 600;
          font-size: clamp(0.62rem, 2.2vw, 0.74rem);
          padding: 0 18px;
          direction: rtl;
          unicode-bidi: embed;
        }
        .ticker-sep {
          color: var(--muted, #8a8a9a);
          font-size: 0.55rem;
          opacity: 0.7;
        }
        .login-title {
          font-size: clamp(2.35rem, 10vw, 4.8rem);
          font-weight: 500;
          letter-spacing: 0.06em;
          word-spacing: -0.12em;
          color: var(--text, #f4f4f8);
          text-align: center;
          margin: 0;
          text-shadow: 0 2px 40px rgba(0,0,0,0.45);
        }
        .login-title-homelink {
          text-decoration: none;
          color: inherit;
          cursor: pointer;
          border: none;
          background: none;
          padding: 0;
          display: inline-block;
        }
        .login-title-homelink:focus-visible {
          outline: 2px solid var(--accent, #6366f1);
          outline-offset: 6px;
          border-radius: 12px;
        }
        /* גל כתום–לבן בתנועה איטית (כותרת + כותרת משנה) */
        .login-title-phrase {
          direction: ltr;
          unicode-bidi: embed;
        }
        .login-title-ch,
        .login-subtitle-ch {
          display: inline-block;
          color: #ffffff;
          animation: loginOrangeWhiteWave 20s linear infinite;
          animation-delay: var(--wave-delay);
        }
        .login-title-sp {
          color: #ffffff;
          display: inline-block;
          white-space: pre;
        }
        @keyframes loginOrangeWhiteWave {
          0%, 100% {
            color: #ffffff;
            text-shadow: none;
          }
          7%, 18% {
            color: var(--wave-color, #fdba74);
            text-shadow: 0 0 var(--wave-glow, 14px) rgba(251, 146, 60, var(--wave-glow-alpha, 0.432));
          }
          27% {
            color: #ffffff;
            text-shadow: none;
          }
        }
        .login-subtitle {
          color: var(--muted, #8a8a9a);
          font-size: clamp(0.86rem, 3.5vw, 1.06rem);
          font-weight: 600;
          text-align: center;
          margin: 8px 0 0;
          letter-spacing: 0.02em;
        }
        .login-subtitle-wave {
          direction: rtl;
          unicode-bidi: isolate;
        }
        .login-subtitle-ch {
          color: var(--muted, #8a8a9a);
          font-weight: 600;
        }
        .login-subtitle-ch--strong {
          font-weight: 800;
        }
        .login-input-row {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 12px;
          width: 100%;
          max-width: 390px;
          direction: rtl;
        }
        .login-input-wrap {
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex: 1;
        }
        .login-input {
          width: 100%;
          padding: 13px 15px;
          font-size: clamp(0.84rem, 3.5vw, 0.96rem);
          background: rgba(10,10,16,0.68);
          border: 1px solid var(--border-strong, rgba(255,255,255,0.14));
          border-radius: 14px;
          color: var(--text, #f4f4f8);
          text-align: center;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
        }
        .login-input:focus {
          border-color: var(--accent, #6366f1);
          box-shadow: 0 0 0 3px var(--accent-soft, rgba(99,102,241,0.25));
        }
        .login-input[type="password"] {
          direction: ltr;
          text-align: left;
          unicode-bidi: isolate;
        }
        .login-enter-btn {
          width: 60px; height: 60px;
          border-radius: 50%;
          border: 1px solid var(--border-strong, rgba(255,255,255,0.14));
          background: rgba(255,255,255,0.08);
          color: var(--text, #fff);
          font-size: 0.7rem;
          font-weight: 800;
          cursor: pointer;
          flex-shrink: 0;
          transition: background 0.25s, box-shadow 0.25s, transform 0.12s;
          display: flex; align-items: center; justify-content: center;
          text-align: center;
          line-height: 1.2;
        }
        .login-enter-btn:hover { transform: scale(1.03); }
        .login-enter-btn.ready {
          border-color: rgba(16, 185, 129, 0.35);
          background:
            radial-gradient(ellipse 125% 95% at 28% 12%, rgba(52, 211, 153, 0.48), transparent 54%),
            radial-gradient(ellipse 96% 78% at 88% 82%, rgba(4, 120, 87, 0.42), transparent 46%),
            linear-gradient(158deg, rgba(16, 185, 129, 0.92) 0%, rgba(5, 38, 28, 0.96) 100%);
          color: #ecfdf5;
          box-shadow:
            0 0 34px var(--atheist-glow, rgba(16,185,129,0.34)),
            inset 0 1px 0 rgba(255,255,255,0.14);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }
        .login-choose {
          color: var(--text, #fff);
          font-size: clamp(0.9rem, 3.5vw, 1rem);
          font-weight: 700;
          margin: 0;
          letter-spacing: 0.02em;
        }
        .login-panels {
          display: flex;
          flex-direction: row;
          align-items: stretch;
          justify-content: center;
          gap: 10px;
          width: 100%;
          max-width: 430px;
        }
        .login-panel {
          flex: 1;
          max-width: 195px;
          padding: clamp(10px, 2.4vw, 21px) clamp(7px, 1.8vw, 14px);
          border-radius: 18px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          border: 1px solid rgba(255,255,255,0.08);
          transition: transform 0.16s, box-shadow 0.2s, filter 0.2s, border-color 0.2s;
          min-width: 0;
        }
        .login-panel:hover {
          filter: brightness(1.06) saturate(1.04);
          border-color: rgba(255,255,255,0.18);
        }
        .panel-believer {
          position: relative;
          isolation: isolate;
          overflow: visible;
          background:
            radial-gradient(ellipse 118% 96% at 78% 10%, rgba(244, 63, 94, 0.52), transparent 54%),
            radial-gradient(ellipse 94% 76% at 14% 86%, rgba(127, 29, 29, 0.44), transparent 50%),
            linear-gradient(168deg, rgba(26, 14, 18, 0.94) 0%, rgba(10, 8, 14, 0.97) 100%);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border: 1px solid rgba(255, 255, 255, 0.14);
          box-shadow:
            0 0 0 1px rgba(244, 63, 94, 0.11),
            0 12px 42px rgba(0, 0, 0, 0.36),
            0 0 52px rgba(244, 63, 94, 0.16),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
          color: #fff;
        }
        .panel-believer > .panel-title,
        .panel-believer > .panel-subtitle {
          position: relative;
          z-index: 3;
        }
        .believer-dancers {
          display: block;
          position: relative;
          z-index: 5;
          transform-origin: 50% 88%;
          will-change: transform;
        }
        .believer-dancers.is-home-animating {
          animation: believerDance 1.18s ease-in-out 4s 2 both;
        }
        /*
         * ✅ PNG עם רקע שקוף — אין צורך ב-mix-blend-mode בכלל!
         * אין לשנות לפורמט JPEG — הרקע הלבן יחזור. ראה הערה בראש הקובץ.
         */
        .login-panel-figure {
          display: block;
          position: relative;
          z-index: 5;
          width: min(190px, 40vw);
          min-width: 90px;
          min-height: 90px;
          aspect-ratio: 1;
          object-fit: contain;
          margin: 0 auto;
          flex-shrink: 0;
          pointer-events: none;
          user-select: none;
          -webkit-user-drag: none;
          mix-blend-mode: normal;
          filter: drop-shadow(0 4px 12px rgba(0,0,0,0.35)) saturate(1.1);
        }
        .believer-water-ripple {
          position: absolute;
          left: 50%;
          bottom: calc(42px + 1cm);
          z-index: 1;
          width: 28px;
          height: 10px;
          border-radius: 999px;
          border: 2px solid rgba(255,255,255,0.42);
          background: radial-gradient(ellipse at center, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.08) 42%, transparent 72%);
          opacity: 0;
          pointer-events: none;
          transform: translateX(-50%) scale(0.22);
          filter: blur(0.2px);
        }
        .believer-water-ripple.is-home-animating {
          animation: believerWaterRipple 1.18s ease-out 4s 2 both;
        }
        .believer-water-ripple::after {
          content: '';
          position: absolute;
          inset: -5px -12px;
          border: 1px solid rgba(255,255,255,0.22);
          border-radius: 999px;
          opacity: 0.8;
        }
        @keyframes believerDance {
          0%, 100% {
            transform: translateY(0) rotate(0deg) scale(1);
          }
          18% {
            transform: translateY(-5px) rotate(-3deg) scale(1.03);
          }
          36% {
            transform: translateY(1px) rotate(2.5deg) scale(0.99);
          }
          56% {
            transform: translateY(-4px) rotate(3deg) scale(1.02);
          }
          76% {
            transform: translateY(1px) rotate(-2deg) scale(1);
          }
        }
        @keyframes believerWaterRipple {
          0% {
            opacity: 0;
            transform: translateX(-50%) scale(0.18);
          }
          14% {
            opacity: 0.58;
          }
          100% {
            opacity: 0;
            transform: translateX(-50%) scale(6.3);
          }
        }
        .panel-atheist {
          position: relative;
          isolation: isolate;
          overflow: visible;
          background:
            radial-gradient(ellipse 108% 90% at 24% 14%, rgba(52, 211, 153, 0.42), transparent 52%),
            radial-gradient(ellipse 92% 74% at 86% 84%, rgba(6, 95, 70, 0.4), transparent 48%),
            linear-gradient(172deg, rgba(8, 26, 22, 0.94) 0%, rgba(6, 14, 14, 0.97) 100%);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border: 1px solid rgba(255, 255, 255, 0.13);
          box-shadow:
            0 0 0 1px rgba(52, 211, 153, 0.1),
            0 12px 42px rgba(0, 0, 0, 0.32),
            0 0 48px rgba(16, 185, 129, 0.14),
            inset 0 1px 0 rgba(255, 255, 255, 0.09);
          color: #ecfdf5;
        }
        .panel-atheist > img,
        .panel-atheist > .panel-title,
        .panel-atheist > .panel-subtitle {
          position: relative;
          z-index: 5;
        }
        .einstein-sparkles {
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
        }
        .einstein-sparkle {
          position: absolute;
          left: calc(64% + 0.5cm);
          top: calc(17% + 0.5cm);
          width: calc(14px * var(--sparkle-scale));
          height: calc(14px * var(--sparkle-scale));
          opacity: 0;
          transform: translate(-50%, -50%) scale(0);
          animation: einsteinSparkleBurst 1.2s cubic-bezier(0.2, 0.8, 0.25, 1) 1 both;
          animation-delay: calc(2s + var(--sparkle-index) * 18ms);
          filter: drop-shadow(0 0 5px rgba(255,255,255,0.9));
        }
        .einstein-sparkle::before,
        .einstein-sparkle::after {
          content: '';
          position: absolute;
          inset: 0;
          background: #fff7b0;
          clip-path: polygon(50% 0, 61% 38%, 100% 50%, 61% 62%, 50% 100%, 39% 62%, 0 50%, 39% 38%);
        }
        .einstein-sparkle::after {
          transform: rotate(45deg) scale(0.62);
          background: #ffffff;
        }
        @keyframes einsteinSparkleBurst {
          0%, 100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0);
          }
          12% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.1);
          }
          58% {
            opacity: 0.95;
            transform: translate(calc(-50% + var(--sparkle-x) * 0.82), calc(-50% + var(--sparkle-y) * 0.82)) scale(1);
          }
          86% {
            opacity: 0;
            transform: translate(calc(-50% + var(--sparkle-x)), calc(-50% + var(--sparkle-y))) scale(0.18);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .einstein-sparkle,
          .believer-dancers,
          .believer-water-ripple {
            animation: none;
          }
        }
        .panel-title {
          font-size: clamp(0.78rem, 3.3vw, 1.2rem);
          font-weight: 800;
          letter-spacing: 1px;
        }
        .panel-subtitle {
          font-size: clamp(0.65rem, 2.4vw, 0.82rem);
          font-weight: 800;
          opacity: 0.95;
          margin-top: 0;
        }
        .login-vs {
          font-size: clamp(1.05rem, 4vw, 1.55rem);
          font-weight: 900;
          color: var(--text, #fff);
          text-shadow: 0 0 20px rgba(255,255,255,0.25);
          flex-shrink: 0;
          align-self: center;
          opacity: 0.95;
        }
        .ai-button {
          background: linear-gradient(180deg, #e8e8ee 0%, #a8a8b8 55%, #787890 100%);
          box-shadow: 0 4px 0 #5a5a6e, 0 10px 28px rgba(0,0,0,0.4);
          color: #0a0a0f;
          font-weight: 800;
          font-size: clamp(0.84rem, 3vw, 0.94rem);
          padding: 10px 22px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.25);
          cursor: pointer;
          letter-spacing: 0.06em;
          transition: transform 0.1s, box-shadow 0.15s, filter 0.15s;
          width: fit-content;
          text-align: center;
        }
        .ai-button:hover { filter: brightness(1.06); }
        .login-mode-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          width: 100%;
          max-width: 390px;
          padding: 16px;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 22px;
          background: rgba(0,0,0,0.16);
        }
        .login-secondary-copy {
          color: var(--text-secondary, #b4b4c0);
          font-size: 0.86rem;
          text-align: center;
          line-height: 1.55;
          margin: -4px 0 2px;
        }
        .login-links {
          display: flex;
          gap: 24px;
          justify-content: center;
          flex-wrap: wrap;
          margin-top: 18px;
          padding: 0 12px 8px;
        }
        .login-link {
          color: var(--text-secondary, #b4b4c0);
          font-size: clamp(0.82rem, 3.2vw, 0.9rem);
          text-decoration: none;
          font-weight: 600;
          padding: 8px 12px;
          border-radius: 10px;
          transition: color 0.2s, background 0.2s;
        }
        .login-link:hover {
          color: var(--gold, #fbbf24);
          background: rgba(251, 191, 36, 0.08);
        }
        .login-link-icon {
          display: inline-block;
          margin-inline-end: 5px;
          font-size: 0.95em;
          line-height: 1;
          vertical-align: -0.12em;
          opacity: 0.92;
        }
        .login-error {
          color: #f87171;
          margin-top: 8px;
          font-size: 0.88rem;
          font-weight: 600;
        }
      `}</style>

      <div className="login-page">

        <div className="ticker-wrap">
          <div className="ticker-inner">
            {[...Array(2)].map((_, rep) =>
              [
                'האם יש אלוהים?',
                'מתי נברא העולם?',
                'תאוריית המפץ הגדול',
                'העולם מסודר ולכן מחייב בורא',
                'תקופת הדינוזאורים לפני שישים מיליון שנה',
                'מתי נברא העולם עפ התנ״ך?',
                'איך עפ האבולוציה נוצר החיים הראשון מדומם — אביוגנזה',
                'האם נכון שארנבת מעלה גרה?',
                'האם נכון שאין דג שיש לו סנפיר ואין לו קשקשים?',
                'רטרו-וירוסים — הוכחה שלאדם ולקוף יש אב משותף',
                '99% מהDNA של האדם והשימפנזה זהה',
                'עפ תארוך פחמן 14 גיל היקום גדול בהרבה מ-5700 שנה כפי טענת התנ״ך',
              ].map((topic, i) => (
                <span key={`${rep}-${i}`}>
                  <span className="ticker-item">{topic}</span>
                  <span className="ticker-sep">◆</span>
                </span>
              ))
            )}
          </div>
        </div>

        <section className="login-hero-card" aria-label="דף הבית והרשמה">
          <div className="login-brand-block">
            <span className="login-status-pill">
              {currentUser ? `מחובר כ-${currentUser.username}` : registered ? `שלום ${registered.username}` : 'כניסה מהירה לדיון'}
            </span>
            <h1 className="login-title" dir="ltr">
              <Link
                to={{ pathname: '/login', search: location.search }}
                className="login-title-homelink login-title-phrase"
                aria-label="דף הכניסה"
                onClick={(e) => {
                  /** אל תנווט ל־/login בלי query — זה מוחק ?logo= ואז הפניה אוטומטית ללובי מרפרטת את הסוקט */
                  if (currentUser) {
                    e.preventDefault();
                    playHomeAnimationSequence();
                    window.scrollTo(0, 0);
                    return;
                  }
                  resetHomePage();
                  window.scrollTo(0, 0);
                }}
              >
                {TITLE_WAVE_CHARS.map((ch, index) => {
                  const intensity = 0.9 + (index / (TITLE_WAVE_CHARS.length - 1)) * 0.1;
                  return (
                    <span
                      key={`${ch}-${index}`}
                      className={ch === ' ' ? 'login-title-sp login-title-ch' : 'login-title-ch'}
                      style={{
                        '--wave-delay': `${index * 0.16}s`,
                        '--wave-color': orangeWaveRgb(intensity),
                        '--wave-glow': `${10 + 10 * intensity}px`,
                        '--wave-glow-alpha': orangeGlowAlpha(0.35 + 0.2 * intensity),
                      }}
                    >
                      {ch}
                    </span>
                  );
                })}
              </Link>
            </h1>
            <p className="login-subtitle login-subtitle-wave">
              {SUBTITLE_WAVE_CHARS.map((ch, index) => {
                const intensity = 0.9 + (index / (SUBTITLE_WAVE_CHARS.length - 1)) * 0.1;
                return (
                  <span
                    key={`${ch}-${index}`}
                    className={`login-subtitle-ch${ch === 'V' || ch === 'S' ? ' login-subtitle-ch--strong' : ''}`}
                    style={{
                      '--wave-delay': `${(TITLE_WAVE_CHARS.length + index) * 0.16}s`,
                      '--wave-color': orangeWaveRgb(intensity),
                      '--wave-glow': `${8 + 8 * intensity}px`,
                      '--wave-glow-alpha': orangeGlowAlpha(0.3 + 0.18 * intensity),
                    }}
                  >
                    {ch === ' ' ? '\u00A0' : ch}
                  </span>
                );
              })}
            </p>
          </div>

          {!registered && !currentUser ? (
            <div className="login-input-row">
              <div className="login-input-wrap">
                <input
                  className="login-input"
                  type="text"
                  placeholder="שם משתמש..."
                  value={username}
                  onChange={handleUsernameChange}
                  onKeyDown={e => e.key === 'Enter' && handleRegister()}
                  maxLength={20}
                  autoComplete="off"
                  autoFocus
                />
                <input
                  className="login-input"
                  type="password"
                  dir="ltr"
                  inputMode="text"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder={username.trim().toLowerCase() === 'omg' ? 'סיסמת מנהל (8 תווים)...' : 'סיסמה (4 תווים)...'}
                  value={password}
                  onChange={e => setPassword(username.trim().toLowerCase() === 'omg'
                    ? e.target.value.slice(0, 8)
                    : e.target.value.slice(0, 4))}
                  onKeyDown={e => e.key === 'Enter' && handleRegister()}
                  maxLength={username.trim().toLowerCase() === 'omg' ? 8 : 4}
                  autoComplete="new-password"
                />
                {error && <p className="login-error">{error}</p>}
              </div>
              <button
                className={`login-enter-btn${
                  password.length === (username.trim().toLowerCase() === 'omg' ? 8 : 4) ? ' ready' : ''
                }`}
                onClick={handleRegister}
              >
                כניסה
              </button>
            </div>
          ) : null}

          <>
          {aiLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div className="spinner" style={{ margin: '0 auto 20px' }} />
              <p style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 700 }}>🤖 מתחבר ל-AI...</p>
              <p style={{ color: '#888', fontSize: '0.9rem', marginTop: 8 }}>מכין את הדיון</p>
            </div>
          ) : !selectedSide ? (
            <>
              <p className="login-choose">בחר את הצד שלך:</p>

              <div className="login-panels">
                <button
                  className="login-panel panel-believer"
                  onClick={() => handlePanelClick('believer')}
                  onTouchStart={e => e.currentTarget.style.transform = 'translateY(4px)'}
                  onTouchEnd={e => e.currentTarget.style.transform = 'translateY(0)'}
                  onMouseDown={e => e.currentTarget.style.transform = 'translateY(4px)'}
                  onMouseUp={e => e.currentTarget.style.transform = 'translateY(0)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  {shouldPlayHomePanels && (
                    <span
                      key={`believer-ripple-${homeAnimationRun}`}
                      className="believer-water-ripple is-home-animating"
                      aria-hidden="true"
                    />
                  )}
                  <span
                    key={`believer-dancers-${homeAnimationRun}`}
                    className={`believer-dancers${shouldPlayHomePanels ? ' is-home-animating' : ''}`}
                  >
                    <img
                      src={panelImgUrls.believer}
                      alt=""
                      width={126}
                      height={126}
                      className="login-panel-figure"
                      draggable={false}
                      loading="eager"
                      decoding="async"
                    />
                  </span>
                  <div className="panel-title">מאמין</div>
                  <div className="panel-subtitle">דת</div>
                </button>

                <div className="login-vs">VS</div>

                <button
                  className="login-panel panel-atheist"
                  onClick={() => handlePanelClick('atheist')}
                  onTouchStart={e => e.currentTarget.style.transform = 'translateY(4px)'}
                  onTouchEnd={e => e.currentTarget.style.transform = 'translateY(0)'}
                  onMouseDown={e => e.currentTarget.style.transform = 'translateY(4px)'}
                  onMouseUp={e => e.currentTarget.style.transform = 'translateY(0)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  {shouldPlayHomePanels && (
                    <span key={`einstein-sparkles-${homeAnimationRun}`} className="einstein-sparkles" aria-hidden="true">
                      {EINSTEIN_SPARKLES.map((sparkle, index) => (
                        <span
                          key={`${sparkle.x}-${sparkle.y}`}
                          className="einstein-sparkle"
                          style={{
                            '--sparkle-index': index,
                            '--sparkle-x': `${sparkle.x * 3}px`,
                            '--sparkle-y': `${sparkle.y * 3}px`,
                            '--sparkle-scale': sparkle.s,
                          }}
                        />
                      ))}
                    </span>
                  )}
                  <img
                    src={panelImgUrls.atheist}
                    alt=""
                    width={126}
                    height={126}
                    className="login-panel-figure"
                    draggable={false}
                    loading="eager"
                    decoding="async"
                  />
                  <div className="panel-title">אתאיסט</div>
                  <div className="panel-subtitle">מדע</div>
                </button>
              </div>

              <button
                className="ai-button"
                onClick={handleAI}
                onTouchStart={e => e.currentTarget.style.transform = 'translateY(3px)'}
                onTouchEnd={e => e.currentTarget.style.transform = 'translateY(0)'}
                onMouseDown={e => e.currentTarget.style.transform = 'translateY(3px)'}
                onMouseUp={e => e.currentTarget.style.transform = 'translateY(0)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                כל התשובות ב AI
              </button>
            </>
          ) : (
            /* Side chosen — pick mode: human or AI */
            <div className="login-mode-card">
              <p className="login-choose" style={{ marginBottom: 0 }}>
                בחרת: <span style={{ color: selectedSide === 'believer' ? 'var(--believer)' : 'var(--atheist)', fontWeight: 900 }}>
                  {selectedSide === 'believer' ? 'מאמין' : 'אתאיסט'}
                </span>
              </p>
              <p className="login-secondary-copy">בחר חוויה: התאמה חיה מול משתמש אחר או דיון מיידי מול AI.</p>
              <button
                className={`login-panel ${selectedSide === 'believer' ? 'panel-atheist' : 'panel-believer'}`}
                style={{ width: '100%', maxWidth: '100%', padding: '18px 24px', borderRadius: 16, fontSize: '1.1rem', fontWeight: 800 }}
                onClick={handleHuman}
              >
                {selectedSide === 'believer'
                  ? 'נגד יריב אנושי (אתאיסט)'
                  : 'נגד יריב אנושי (מאמין)'}
              </button>
              <button
                className="login-panel"
                style={{ width: '100%', maxWidth: '100%', padding: '18px 24px', borderRadius: 16, fontSize: '1.1rem', fontWeight: 800,
                  background: 'linear-gradient(135deg, #f2f2f2 0%, #c6c6c6 100%)', color: '#000',
                  boxShadow: '0 6px 0 #a8a8a8, 0 10px 20px rgba(0,0,0,0.35)' }}
                onClick={handleAIMode}
              >
                נגד AI
              </button>
              <button
                style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '0.9rem', cursor: 'pointer', marginTop: 4, fontWeight: 700 }}
                onClick={() => setSelectedSide(null)}
              >
                ← חזרה לבחירת צד
              </button>
            </div>
          )}
            </>
        </section>

        <div className="login-links">
          <Link to="/faith" className="login-link" aria-label="דת ואמונה">
            <span className="login-link-icon" aria-hidden>📖</span>
            דת
          </Link>
          <Link to="/knowledge" className="login-link">📚 בעד ונגד</Link>
          <Link to="/live-events" className="login-link">🏆 רב VS מדען</Link>
        </div>
      </div>
    </>
  );
}
