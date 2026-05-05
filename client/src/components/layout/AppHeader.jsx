import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAppStore, rehydrateUserIfNeeded } from '../../store/appStore.js';
import { disconnectSocket, connectSocket } from '../../socket.js';
import BibleModal from '../ui/BibleModal.jsx';
import UserAvatarSlot from '../ui/UserAvatarSlot.jsx';
import { getCageAvatarDataUrlForDisplayName } from '../../lib/cageUserProfile.js';
import { HEADER_TICKER_TOPICS } from '../../data/headerTickerTopics.js';

/** חפיפה בין כפתור התפריט לפאנל — מניעת סגירה במעבר עכבר על רווח ריק */
const MENU_DOCK_BRIDGE_PX = 12;
/** ~1mm ב־96dpi — הקטנת מלבן התפריט כפי שביקשו */
const MENU_RECT_SHRINK_1MM_PX = 96 / 25.4;
/** הורדת התפריט כשנפתח — 3mm מתחת ל־r.bottom+2 (סה״כ מהבקשות) */
const MENU_DOCK_EXTRA_DOWN_MM_PX = 3 * MENU_RECT_SHRINK_1MM_PX;
/** הזזה שמאלה — חצי ס״מ + 1mm (ב־96dpi) */
const MENU_DOCK_SHIFT_LEFT_PX = 0.5 * (96 / 2.54) + MENU_RECT_SHRINK_1MM_PX;

const STATS_CACHE_KEY = 'omg_stats_cache';
/** נתיב לחזרה כשסוגרים צ׳אט קולי בלחיצה שנייה על אותו כפתור */
const AI_VOICE_RETURN_KEY = 'omg_ai_voice_return';
function readCachedStats() {
  try {
    const cached = JSON.parse(localStorage.getItem(STATS_CACHE_KEY) || 'null');
    if (!cached || typeof cached !== 'object') return null;
    return {
      registered: Number(cached.registered) || 0,
      online: Number(cached.online) || 0,
      registeredList: Array.isArray(cached.registeredList) ? cached.registeredList : [],
      onlineList: Array.isArray(cached.onlineList) ? cached.onlineList : [],
    };
  } catch {
    return null;
  }
}

function cacheStats(stats) {
  try {
    localStorage.setItem(STATS_CACHE_KEY, JSON.stringify({
      registered: Number(stats?.registered) || 0,
      online: Number(stats?.online) || 0,
      registeredList: Array.isArray(stats?.registeredList) ? stats.registeredList : [],
      onlineList: Array.isArray(stats?.onlineList) ? stats.onlineList : [],
    }));
  } catch {
    // Ignore storage failures; live stats will still render for this session.
  }
}

export default function AppHeader() {
  const user = useAppStore(s => s.user);
  const pendingUser = useAppStore(s => s.pendingUser);
  const ytTvUrl = useAppStore(s => s.ytTvUrl);
  const setYtTvUrl = useAppStore(s => s.setYtTvUrl);
  const miniMediaBarOpen = useAppStore(s => s.miniMediaBarOpen);
  const miniMediaBarFocus = useAppStore(s => s.miniMediaBarFocus);
  const openMiniMediaBar = useAppStore(s => s.openMiniMediaBar);
  const headerPodcastPanelOpen = useAppStore(s => s.headerPodcastPanelOpen);
  const toggleHeaderPodcastPanel = useAppStore(s => s.toggleHeaderPodcastPanel);
  const debate = useAppStore(s => s.debate);
  const setUser = useAppStore(s => s.setUser);
  const setPendingUser = useAppStore(s => s.setPendingUser);
  const resetDebate = useAppStore(s => s.resetDebate);
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  /** מיקום תפריט מצומד לכפתור (מדידת getBoundingClientRect) */
  const [menuDock, setMenuDock] = useState(null);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [bibleOpen, setBibleOpen] = useState(false);
  const [stats, setStats] = useState({ registered: 0, online: 0, registeredList: [], onlineList: [] });
  const [profileStats, setProfileStats] = useState(null);
  const [onlineModalOpen, setOnlineModalOpen] = useState(false);
  const menuRef = useRef();
  const menuPortalRef = useRef(null);
  const menuHoverCloseTimerRef = useRef(null);
  const hoverMenuOpenTimerRef = useRef(null);
  /** סנכרון ל־openMenuFromHover בלי סגירה של stale state */
  const menuOpenRef = useRef(false);
  /**
   * נפתח מ־hover: לחיצה ראשונה על הכפתור לא סוגרת (רק מבטלת את הדגל), השנייה סוגרת.
   * נפתח בלחיצה מהמצב סגור: הדגל כבוי — לחיצה הבאה סוגרת כרגיל.
   */
  const menuFirstCloseClickSuppressedRef = useRef(false);
  const avatarWrapRef = useRef();

  // Show green avatar also when registered but not yet in debate
  const activeUser = user || pendingUser;
  /** ניווט לפרופיל — כל מי שיש לו שם בסשן (מלא או pending). עריכה בדף הפרופיל נשארת למחובר מלא בלבד */
  const profileNavUsername = String(user?.username || pendingUser?.username || '').trim();
  const canOpenHeaderProfile = profileNavUsername.length >= 2;

  const loadStats = useCallback(() => {
    const BASE = import.meta.env.VITE_API_URL || '';

    function localStats() {
      const hasUser = !!localStorage.getItem('omg_user');
      const hasPending = !!localStorage.getItem('omg_pending');
      const cached = readCachedStats();
      const registered = Math.max(cached?.registered || 0, hasUser || hasPending ? 1 : 0);
      const online = hasUser || hasPending ? 1 : 0;
      return {
        registered,
        online,
        registeredList: cached?.registeredList || [],
        onlineList: cached?.onlineList || [],
      };
    }

    fetch(`${BASE}/api/stats`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const fallback = localStats();
        const next = d ? {
          registered: Math.max(Number(d.registered) || 0, fallback.registered),
          online: Number(d.online) || fallback.online,
          registeredList: Array.isArray(d.registeredList) ? d.registeredList : fallback.registeredList,
          onlineList: Array.isArray(d.onlineList) ? d.onlineList : fallback.onlineList,
        } : fallback;
        cacheStats(next);
        setStats(next);
      })
      .catch(() => setStats(localStats()));
  }, []);

  useEffect(() => {
    loadStats();
    const t = setInterval(loadStats, 15000);
    return () => clearInterval(t);
  }, [loadStats]);

  function clearMenuHoverTimer() {
    if (menuHoverCloseTimerRef.current != null) {
      clearTimeout(menuHoverCloseTimerRef.current);
      menuHoverCloseTimerRef.current = null;
    }
  }

  function cancelHoverMenuOpenTimer() {
    if (hoverMenuOpenTimerRef.current != null) {
      clearTimeout(hoverMenuOpenTimerRef.current);
      hoverMenuOpenTimerRef.current = null;
    }
  }

  const updateMenuDock = useCallback(() => {
    const wrap = menuRef.current;
    if (!wrap || typeof window === 'undefined') return;
    const r = wrap.getBoundingClientRect();
    const margin = 8;
    const vw = window.innerWidth;
    const vwUsable = vw - margin * 2;
    const width = Math.max(240, Math.round(Math.min(430 - MENU_RECT_SHRINK_1MM_PX, Math.max(240, vwUsable))));
    /* פתיחה מימין לכפתור: קצה שמאל של התפריט אחרי הכפתור, מתפרס לתוך העמוד (לא שמאלה ממנו) */
    const gapPx = 4;
    let left = Math.round(r.right + gapPx - MENU_DOCK_SHIFT_LEFT_PX);
    left = Math.max(margin, Math.min(left, vw - width - margin));
    /* מתחת לכפתור + הורדה ב־mm */
    setMenuDock({
      top: Math.round(r.bottom + 2 + MENU_DOCK_EXTRA_DOWN_MM_PX),
      left,
      width,
      bridgePx: MENU_DOCK_BRIDGE_PX,
    });
  }, []);

  /** פתיחה מעוכבת — לחיצה מהירה על הכפתור מספיקה לפתוח בלי «לחיצה ראשונה לא סוגרת» */
  const HOVER_MENU_OPEN_MS = 280;

  function openMenuFromHover() {
    clearMenuHoverTimer();
    if (menuOpenRef.current) return;
    cancelHoverMenuOpenTimer();
    hoverMenuOpenTimerRef.current = window.setTimeout(() => {
      hoverMenuOpenTimerRef.current = null;
      if (!menuOpenRef.current) {
        menuFirstCloseClickSuppressedRef.current = true;
        updateMenuDock();
        setMenuOpen(true);
      }
    }, HOVER_MENU_OPEN_MS);
  }

  function scheduleCloseMenuFromHover() {
    clearMenuHoverTimer();
    cancelHoverMenuOpenTimer();
    menuHoverCloseTimerRef.current = window.setTimeout(() => {
      menuHoverCloseTimerRef.current = null;
      setMenuOpen(false);
    }, 520);
  }

  useEffect(() => {
    function handleClick(e) {
      const t = e.target;
      if (!menuRef.current?.contains(t) && !menuPortalRef.current?.contains(t)) {
        clearMenuHoverTimer();
        cancelHoverMenuOpenTimer();
        setMenuOpen(false);
      }
      if (avatarWrapRef.current && !avatarWrapRef.current.contains(t)) setAvatarMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    menuOpenRef.current = menuOpen;
    if (!menuOpen) {
      menuFirstCloseClickSuppressedRef.current = false;
      cancelHoverMenuOpenTimer();
    }
  }, [menuOpen]);

  useLayoutEffect(() => {
    if (!menuOpen) {
      setMenuDock(null);
      return;
    }
    updateMenuDock();
    window.addEventListener('resize', updateMenuDock);
    return () => {
      window.removeEventListener('resize', updateMenuDock);
    };
  }, [menuOpen, updateMenuDock]);

  useEffect(() => () => {
    clearMenuHoverTimer();
    cancelHoverMenuOpenTimer();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e) {
      if (e.key === 'Escape') {
        clearMenuHoverTimer();
        cancelHoverMenuOpenTimer();
        setMenuOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  useEffect(() => {
    if (!onlineModalOpen) return;
    function onKey(e) {
      if (e.key === 'Escape') setOnlineModalOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onlineModalOpen]);

  useEffect(() => {
    if (!avatarMenuOpen) return;
    function onKey(e) {
      if (e.key === 'Escape') setAvatarMenuOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [avatarMenuOpen]);

  useEffect(() => {
    if (!avatarMenuOpen || !activeUser?.username) return;

    let cancelled = false;
    const BASE = import.meta.env.VITE_API_URL || '';
    fetch(`${BASE}/api/users/${encodeURIComponent(activeUser.username)}/stats`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled) return;
        setProfileStats(data || {
          score: user?.score || 0,
          likesReceived: user?.score || 0,
          giftsReceived: user?.giftsReceived || 0,
          voiceDebates: user?.voiceDebates || 0,
          humanDebates: user?.humanDebates || 0,
          aiDebates: user?.aiDebates || 0,
          liveAppearances: 0,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setProfileStats({
          score: user?.score || 0,
          likesReceived: user?.score || 0,
          giftsReceived: user?.giftsReceived || 0,
          voiceDebates: user?.voiceDebates || 0,
          humanDebates: user?.humanDebates || 0,
          aiDebates: user?.aiDebates || 0,
          liveAppearances: 0,
        });
      });

    return () => { cancelled = true; };
  }, [avatarMenuOpen, activeUser?.username, user]);

  /** התנתקות מלאה — רק מתפריט העיגול */
  function fullLogout() {
    clearMenuHoverTimer();
    cancelHoverMenuOpenTimer();
    setMenuOpen(false);
    disconnectSocket();
    setUser(null);
    resetDebate();
    setAvatarMenuOpen(false);
    navigate('/login');
  }

  function abortPendingRegistration() {
    clearMenuHoverTimer();
    cancelHoverMenuOpenTimer();
    setMenuOpen(false);
    setPendingUser(null);
    setAvatarMenuOpen(false);
    navigate('/login');
  }

  /**
   * דף הבית = מסך הכניסה (/login עם ?logo כשמחוברים). query (?homeReset / ?logo)
   * מתעדכן בראוטר גם בלי מעבר ל־URL אחר לפעמים — נשמר תאום עם LoginPage.
   */
  function goAppHome() {
    clearMenuHoverTimer();
    cancelHoverMenuOpenTimer();
    setMenuOpen(false);
    setOnlineModalOpen(false);
    setAvatarMenuOpen(false);

    const path = location.pathname;
    const fromDebate = path.startsWith('/debate');
    if (fromDebate) resetDebate();

    rehydrateUserIfNeeded();
    const sessionUser = useAppStore.getState().user;
    const hasFullSession =
      Boolean(sessionUser?.username) &&
      (sessionUser.side === 'believer' || sessionUser.side === 'atheist');

    /** כמו קישור «דף הבית» ב־SiteQuickNav — מסך כניסה; ?logo= מונע הפניה אוטומטית מהלוגין ללובי */
    navigate(hasFullSession ? '/login?logo=nav' : '/login', { replace: false });

    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.getElementById('main-content')?.scrollTo?.({ top: 0, behavior: 'smooth' });
  }

  function openLivrChat() {
    setAvatarMenuOpen(false);
    navigate('/livr');
  }

  const nick = user?.username || pendingUser?.username;
  const avatarLabel = nick
    ? (nick.length <= 5 ? nick : nick.charAt(0))
    : null;

  /** כמו SiteQuickNav — סדר עמודות: מילוי עמודה ימין ואז שמאל (grid-auto-flow: column) */
  const headerGridNavItems = useMemo(() => {
    const { pathname, hash, search } = location;
    const sp = new URLSearchParams(search);
    const chatActive = pathname === '/faith' && (hash === '#chat' || hash === '');
    const faithDedActive = pathname === '/faith' && hash === '#rabbi';
    const aiNavActive =
      (pathname === '/lobby' && sp.get('ai') === '1') ||
      (Boolean(debate?.isAI) && debate?.id && pathname === `/debate/${debate.id}`);
    const hasFullSession =
      Boolean(user?.username) && (user.side === 'believer' || user.side === 'atheist');
    const homePath = hasFullSession ? '/login?logo=nav' : '/login';
    const homeActive = pathname === '/login';

    return [
      {
        key: 'vid',
        label: 'LIVE TV',
        to: '/video-live',
        active: pathname === '/video-live' && !ytTvUrl,
        kind: 'link',
      },
      { key: 'live', label: 'רב VS מדען', to: '/live-events', active: pathname === '/live-events', kind: 'link' },
      {
        key: 'ai',
        label: 'AI',
        to: '/lobby?ai=1',
        active: aiNavActive,
        kind: !user && pendingUser?.username ? 'ai-pending' : 'link',
      },
      { key: 'know', label: 'מאגר ידע', to: '/knowledge', active: pathname === '/knowledge', kind: 'link' },
      {
        key: 'pod',
        label: 'פודקאסט LIVE',
        to: '/podcast',
        active: pathname === '/podcast' || headerPodcastPanelOpen,
        kind: 'podcast-toggle',
      },
      { key: 'blog', label: 'בלוגים', to: '/blog', active: pathname === '/blog', kind: 'link' },
      { key: 'chat', label: 'צ׳אט', to: '/faith#chat', active: chatActive, kind: 'link' },
      { key: 'faith', label: 'דת', to: '/faith#rabbi', active: faithDedActive, kind: 'link' },
      { key: 'ph', label: 'תמונות', to: '/photos', active: pathname === '/photos', kind: 'link' },
      { key: 'home', label: 'דף הבית', to: homePath, active: homeActive, kind: 'link' },
    ];
  }, [
    location.pathname,
    location.hash,
    location.search,
    user,
    pendingUser,
    debate?.id,
    debate?.isAI,
    ytTvUrl,
    headerPodcastPanelOpen,
  ]);

  const menuRadioSectionActive =
    (miniMediaBarOpen && miniMediaBarFocus === 'radio') || location.pathname === '/radio';
  const menuYtSectionActive =
    (miniMediaBarOpen && miniMediaBarFocus === 'youtube') ||
    (location.pathname === '/video-live' && Boolean(ytTvUrl));
  const menuProfileCellActive = location.pathname.startsWith('/profile/');
  const menuRegisteredActive = location.pathname === '/registered';
  const aiVoicePageActive = location.pathname === '/ai-voice';

  const toggleAiVoice = useCallback(() => {
    if (location.pathname === '/ai-voice') {
      let back = '';
      try {
        back = sessionStorage.getItem(AI_VOICE_RETURN_KEY) || '';
        sessionStorage.removeItem(AI_VOICE_RETURN_KEY);
      } catch { /* ignore */ }
      if (back) navigate(back);
      else navigate(-1);
    } else {
      const here = `${location.pathname}${location.search}${location.hash}`;
      try {
        sessionStorage.setItem(AI_VOICE_RETURN_KEY, here);
      } catch { /* ignore */ }
      navigate('/ai-voice');
    }
  }, [location.pathname, location.search, location.hash, navigate]);

  const profileMenuPath = canOpenHeaderProfile
    ? `/profile/${encodeURIComponent(profileNavUsername)}`
    : null;

  return (
    <>
      <style>{`
        .app-header-shell {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1000;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 0;
          pointer-events: none;
          box-shadow: 0 4px 24px rgba(0,0,0,0.25);
        }
        .app-header-shell > * {
          pointer-events: auto;
        }
        .app-header {
          position: relative;
          height: var(--app-header-main-h, 58px);
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-inline-start: 16px;
          padding-inline-end: 4px;
          overflow: visible;
          background: rgba(7, 7, 12, 0.72);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          border-bottom: 1px solid var(--border, rgba(255,255,255,0.08));
        }
        .app-header > * { pointer-events: all; }
        .app-header-ticker-strip {
          flex-shrink: 0;
          margin-top: var(--app-header-strips-gap, 1mm);
          display: flex;
          justify-content: center;
          align-items: stretch;
          padding-inline: var(--app-shell-gutter);
          box-sizing: border-box;
          background: transparent;
        }
        .app-header-ticker-strip__inner {
          width: 100%;
          max-width: calc(var(--login-entry-panels-max, 430px) + var(--app-header-strips-width-extra, 2cm));
          box-sizing: border-box;
          border-radius: var(--radius-sm, 10px);
          border-bottom: 1px solid var(--border, rgba(255,255,255,0.08));
          background: rgba(10, 10, 14, 0.82);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          overflow: hidden;
          display: flex;
          align-items: center;
          direction: ltr;
          padding-block: 0;
        }
        .app-header-ticker-wrap {
          overflow: hidden;
          width: 100%;
          padding: 0 2px;
          line-height: 1.2;
          font-family: var(--font-sans, 'Rubik', 'Segoe UI', system-ui, sans-serif);
          font-size: 0.78rem;
        }
        .app-header-ticker-inner {
          display: inline-block;
          white-space: nowrap;
          animation: app-header-ticker-scroll 60s linear infinite;
          will-change: transform;
        }
        /* גלילה רציפה — ללא עצירה במעבר עכבר (נשמרת הפחתת תנועה ב-globals עבור data-reduce-motion) */
        @keyframes app-header-ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .app-header-ticker-item {
          display: inline-block;
          color: var(--text-secondary, #b4b4c0);
          font-weight: 600;
          padding: 0 18px;
          line-height: 1.2;
          vertical-align: baseline;
          direction: rtl;
          unicode-bidi: embed;
        }
        .app-header-ticker-sep {
          color: var(--muted, #8a8a9a);
          font-size: 0.65rem;
          opacity: 0.7;
          font-family: inherit;
        }
        .app-header__inner {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          min-width: 0;
          width: 100%;
        }
        .header-zone {
          min-height: 52px;
          height: auto;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .header-zone--brand {
          gap: 10px;
          margin-inline-end: -2px;
          align-items: center;
          flex-shrink: 0;
          position: relative;
          z-index: 12;
        }
        .header-dots-wrap {
          margin-inline-start: 0;
          flex-shrink: 0;
        }

        /* גובה כמו .header-avatar (38px) — מלבן צר לסימטריה מול העיגול מימין */
        .header-dots-btn {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          width: 26px;
          height: 38px;
          min-width: 26px;
          min-height: 38px;
          border: 1px solid var(--border-strong, rgba(255,255,255,0.14));
          border-radius: 8px;
          background: rgba(255,255,255,0.05);
          color: var(--text, #f4f4f8);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.18s, color 0.18s, border-color 0.18s, transform 0.12s;
        }
        .header-menu-icon {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }
        .header-menu-icon__bar {
          display: block;
          width: 8px;
          height: 2px;
          flex-shrink: 0;
          border-radius: 1.5px;
          background: rgba(244, 244, 248, 0.98);
        }
        .header-dots-btn:hover {
          background: rgba(255,255,255,0.1);
          border-color: rgba(255,255,255,0.22);
        }
        .header-dots-btn:hover .header-menu-icon__bar {
          background: #fff;
        }
        .header-dots-btn:active { transform: scale(0.96); }
        .header-dots-btn--open {
          background: rgba(99,102,241,0.15);
          border-color: rgba(99,102,241,0.45);
        }
        .header-dots-btn--open .header-menu-icon__bar {
          background: #fff;
        }
        .header-dots-btn:focus-visible {
          outline: 2px solid var(--accent, #6366f1);
          outline-offset: 2px;
        }
        .header-app-brand {
          width: 96px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          gap: 1mm;
          box-sizing: border-box;
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 1px 0 3px;
          border-radius: 999px;
          transition: opacity 0.2s, filter 0.2s, transform 0.12s;
          pointer-events: auto;
          font: inherit;
          font-family: inherit;
          color: inherit;
          appearance: none;
          -webkit-appearance: none;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }
        .header-logo-watermark {
          font-size: 0.62rem;
          font-weight: 700;
          letter-spacing: 0.34em;
          color: rgba(255, 255, 255, 0.52);
          text-shadow:
            0 1px 2px rgba(0, 0, 0, 0.55),
            0 0 12px rgba(255, 255, 255, 0.18);
          user-select: none;
          pointer-events: none;
          line-height: 1;
          direction: ltr;
          unicode-bidi: isolate;
          text-transform: uppercase;
          padding-inline-start: 0.34em;
          margin: 0;
        }
        .header-app-brand:hover {
          opacity: 0.95;
          filter: brightness(1.08);
        }
        .header-app-brand:active { transform: scale(0.98); }
        .header-app-brand:focus-visible {
          outline: 2px solid var(--accent, #6366f1);
          outline-offset: 2px;
        }
        /* עוטף: הגדלה קלה + צמוד לאותיות (~מ״מ אחד בין קצה הלוגו לטקסט) */
        .header-logo-mark-wrap {
          display: flex;
          align-items: flex-end;
          justify-content: center;
          width: 94px;
          min-height: 46px;
        }
        .header-logo-mark {
          position: relative;
          width: 82px;
          height: 41px;
          overflow: visible;
          border-radius: 999px;
          isolation: isolate;
          transform: scale(1.09);
          transform-origin: 50% 100%;
          /* סנכרון אנימציית שמש + קליטת אור על כדור לבן */
          --logo-sun-cycle: 8s;
        }
        .header-logo-mark::before {
          content: '';
          position: absolute;
          inset: 3px 1px;
          border-radius: 999px;
          background:
            radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.038), transparent 48%),
            radial-gradient(ellipse at 50% 68%, rgba(0,0,0,0.23), transparent 68%);
          filter: blur(1.5px);
          z-index: 0;
        }
        .header-logo-orbit {
          position: absolute;
          left: 1px;
          right: 1px;
          top: 51%;
          height: 16px;
          border: 3px solid #ff2400;
          border-top-color: rgba(255, 36, 0, 0.58);
          border-bottom-color: #ff951a;
          border-radius: 50%;
          transform: translateY(-50%) rotate(-7deg);
          box-shadow:
            0 0 0 0.35px rgba(0,0,0,0.72),
            0 0 8px rgba(255, 36, 0, 0.45),
            0 0 14px rgba(255, 122, 0, 0.21),
            0 3px 8px rgba(0,0,0,0.21),
            inset 0 -1px 2px rgba(255,255,255,0.34);
          z-index: 3;
        }
        .header-logo-orbit::after {
          content: '';
          position: absolute;
          left: 12%;
          right: 12%;
          bottom: -2px;
          height: 2px;
          border-radius: 999px;
          background: linear-gradient(90deg, transparent, rgba(255, 149, 26, 0.92), transparent);
          filter: blur(1px);
          animation: headerOrbitFrontGold 5.2s ease-in-out infinite;
        }
        .header-logo-planet {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 32px;
          height: 32px;
          border: 2px solid rgba(255, 255, 255, 1);
          background: radial-gradient(circle at 40% 32%, rgba(255,255,255,0.18), transparent 38%);
          border-radius: 50%;
          transform: translate(-50%, -50%);
          box-shadow:
            0 0 0 0.35px rgba(0,0,0,0.74),
            0 0 6px rgba(255, 255, 255, 0.24),
            0 3px 8px rgba(0,0,0,0.22),
            inset -7px -6px 13px rgba(0,0,0,0.25),
            inset 0 0 7px rgba(255, 255, 255, 0.13);
          z-index: 2;
          overflow: hidden;
        }
        /* אור מהכדור הצהוב — נשאר בתוך עיגול הפנים (מתחת למסגרת הלבנה) */
        .header-logo-planet::before {
          content: '';
          position: absolute;
          inset: 3px;
          border-radius: 50%;
          pointer-events: none;
          z-index: 1;
          transform-origin: 28% 66%;
          mix-blend-mode: soft-light;
          background:
            radial-gradient(
              ellipse 92% 88% at 26% 68%,
              rgba(255, 248, 210, 0.82) 0%,
              rgba(255, 228, 145, 0.48) 28%,
              rgba(255, 205, 92, 0.22) 46%,
              transparent 58%
            ),
            radial-gradient(
              circle at 54% 42%,
              rgba(255, 255, 255, 0.28) 0%,
              transparent 46%
            );
          opacity: 0;
          animation: headerPlanetSunlit var(--logo-sun-cycle) linear infinite;
        }
        .header-logo-shine {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 86px;
          height: 2px;
          border-radius: 999px;
          background: linear-gradient(90deg, transparent, rgba(255, 204, 38, 0.9), transparent);
          transform: translate(-50%, -50%) rotate(-7deg);
          filter: blur(0.5px);
          pointer-events: none;
          z-index: 4;
          animation: headerLogoShineSweep 5.2s ease-in-out infinite;
        }
        @keyframes headerLogoShineSweep {
          0%, 100% {
            opacity: 0.28;
            transform: translate(-54%, -50%) rotate(-7deg) scaleX(0.62);
            filter: blur(0.5px) saturate(1.2);
          }
          38%, 58% {
            opacity: 0.92;
            transform: translate(-46%, -50%) rotate(-7deg) scaleX(1);
            filter: blur(0.5px) saturate(1.6) brightness(1.18);
          }
        }
        @keyframes headerOrbitFrontGold {
          0%, 100% {
            opacity: 0.72;
            background: linear-gradient(90deg, transparent, rgba(255, 138, 24, 0.72), transparent);
          }
          38%, 58% {
            opacity: 1;
            background: linear-gradient(90deg, transparent, rgba(255, 156, 36, 1), transparent);
          }
        }
        .header-logo-satellite {
          position: absolute;
          left: 0;
          top: 0;
          width: 10px;
          height: 10px;
          border: 2px solid rgba(255, 222, 49, 0.56);
          border-radius: 50%;
          /* תאורה קבועה עדינה — הפנים לא נשארות שחורות רוב המחזור */
          background: radial-gradient(
            circle at 50% 50%,
            rgba(255, 205, 95, 0.42) 0%,
            rgba(255, 175, 58, 0.2) 58%,
            rgba(255, 155, 45, 0.08) 78%,
            transparent 94%
          );
          isolation: isolate;
          box-shadow:
            0 0 5px rgba(255, 222, 49, 0.35),
            0 0 9px rgba(255, 153, 0, 0.15),
            inset 0 0 6px rgba(255, 195, 85, 0.45);
          pointer-events: none;
          z-index: 5;
          offset-path: ellipse(38px 6.35px at 41px 23.05px);
          offset-distance: 56%;
          offset-rotate: 0deg;
          opacity: 1;
          filter: brightness(1.08) saturate(1.04);
        }
        /* הבהוב פנימי: נפתח חזק (+50%), מתפרס על כל הכדור, נשאר 2s פתוח, מתכווץ */
        .header-logo-satellite::after {
          content: '';
          position: absolute;
          pointer-events: none;
          /* 15%–40% = 2 שניות מתוך 8s — שיא מואר ולא כהה */
          animation: headerSatelliteInnerGlow var(--logo-sun-cycle) linear infinite;
        }
        @keyframes headerSatelliteInnerGlow {
          0%, 8%, 48%, 100% {
            top: 6px;
            right: 12%;
            bottom: auto;
            left: 12%;
            width: auto;
            height: 2px;
            border-radius: 999px;
            background: linear-gradient(
              90deg,
              transparent,
              rgba(255, 200, 72, 0.92),
              rgba(255, 218, 110, 0.95),
              rgba(255, 200, 72, 0.92),
              transparent
            );
            opacity: 0.9;
            filter: blur(0.48px) saturate(1.14) brightness(1.08);
            box-shadow: 0 0 7px rgba(255, 195, 75, 0.45);
          }
          /* שיא: 2 שניות מלאות מוארות */
          15%, 40% {
            top: 1px;
            right: 1px;
            bottom: 1px;
            left: 1px;
            width: auto;
            height: auto;
            border-radius: 50%;
            background:
              radial-gradient(
                circle at 46% 40%,
                rgba(255, 252, 210, 1) 0%,
                rgba(255, 228, 130, 1) 18%,
                rgba(255, 206, 78, 0.98) 38%,
                rgba(255, 182, 52, 0.92) 58%,
                rgba(255, 158, 42, 0.78) 76%,
                rgba(255, 138, 36, 0.38) 90%,
                rgba(255, 125, 28, 0.12) 97%,
                transparent 100%
              );
            opacity: 1;
            filter: blur(0.24px) brightness(1.52) saturate(1.15);
            box-shadow:
              inset 0 0 18px rgba(255, 235, 160, 1),
              inset 0 -2px 12px rgba(255, 175, 55, 0.85),
              0 0 14px rgba(255, 205, 90, 0.82),
              0 0 22px rgba(255, 175, 55, 0.55);
          }
        }
        .header-logo-planet::after {
          content: '';
          position: absolute;
          inset: 5px 8px auto auto;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: rgba(255,255,255,0.58);
          filter: blur(2px);
          z-index: 3;
        }
        @keyframes headerPlanetSunlit {
          /* נשאר כבוי בזמן שהכדור הצהוב נפתח (עד סוף המעבר לשיא) */
          0%, 8%, 15% {
            opacity: 0;
            transform: rotate(-14deg) scale(0.92);
            filter: blur(2px) brightness(0.88);
          }
          /* תגובת האור על הלבן רק אחרי שהשמש כבר פתוחה */
          16% {
            opacity: 0.16;
            transform: rotate(-12deg) scale(0.94);
            filter: blur(1.35px) brightness(0.92);
          }
          18% {
            opacity: 0.42;
            transform: rotate(-11deg) scale(0.97);
            filter: blur(0.85px) brightness(1);
          }
          20% {
            opacity: 0.68;
            transform: rotate(-10deg) scale(1);
            filter: blur(0.35px) brightness(1.08);
          }
          22% {
            opacity: 0.84;
            transform: rotate(-10deg) scale(1.015);
            filter: blur(0px) brightness(1.14);
          }
          /* תנועת קבלת אור בזמן שהשמש בשיא */
          24% {
            opacity: 1;
            transform: rotate(-6deg) scale(1.035);
            filter: blur(0px) brightness(1.22);
          }
          31% {
            opacity: 1;
            transform: rotate(-11deg) scale(1.025);
            filter: blur(0px) brightness(1.26);
          }
          37% {
            opacity: 1;
            transform: rotate(-7deg) scale(1.04);
            filter: blur(0px) brightness(1.2);
          }
          /* ירידה עם סגירת השמש */
          40% {
            opacity: 0.94;
            transform: rotate(-9deg) scale(1.02);
            filter: blur(0px) brightness(1.14);
          }
          43% {
            opacity: 0.58;
            transform: rotate(-11deg) scale(0.98);
            filter: blur(1px) brightness(1.05);
          }
          46% {
            opacity: 0.22;
            transform: rotate(-13deg) scale(0.94);
            filter: blur(1.6px) brightness(0.95);
          }
          48%, 100% {
            opacity: 0;
            transform: rotate(-14deg) scale(0.92);
            filter: blur(2px) brightness(0.88);
          }
        }
        /* תפריט — פורטל, מצומד לכפתור; רוחב עד ~430px פחות 1mm כמו פאנלים בדף הבית */
        .header-grid-menu-backdrop--passive {
          position: fixed;
          top: var(--appheader-h, 58px);
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 11999;
          background: rgba(0, 0, 0, 0.38);
          pointer-events: none;
        }
        /* מיקום ב־JS: left = right(כפתור) + מרווח — נפתח ימינה לתוך העמוד */
        .header-grid-menu-portal {
          position: fixed;
          z-index: 12001;
          /* כמעט כל גובה המסך מתחת לכותרת — בלי גלילה ברוב המכשירים */
          max-height: calc(100vh - var(--appheader-h, 58px) - 4px - env(safe-area-inset-bottom, 0px));
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border-radius: 10px;
          box-shadow: 0 18px 48px rgba(0, 0, 0, 0.55);
          border: 1px solid rgba(255, 255, 255, 0.2);
          pointer-events: auto;
          isolation: isolate;
        }
        @supports (height: 100dvh) {
          .header-grid-menu-portal {
            max-height: calc(100dvh - var(--appheader-h, 58px) - 4px - env(safe-area-inset-bottom, 0px));
          }
        }
        .header-grid-menu {
          position: relative;
          width: 100%;
          flex: 1 1 auto;
          min-height: 0;
          max-height: 100%;
          background: #050508;
          direction: rtl;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          font-family: var(--font-sans);
          font-size: 0.78rem;
          font-weight: 400;
        }
        .header-grid-menu__scroll {
          flex: 1 1 auto;
          min-height: 0;
          overflow: visible;
          display: flex;
          flex-direction: column;
          padding: 4px 0 2px;
          box-sizing: border-box;
        }
        /* שורה עליונה: שתי משבצות ריקות + אונליין (ימין במסך — עמודה ראשונה ב־RTL) */
        .header-grid-menu__top-row {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          direction: rtl;
          border: 1px solid rgba(255, 255, 255, 0.35);
          background: #000;
        }
        .header-grid-menu__top-row .header-grid-menu__cell {
          margin: 0 0 -0.5px -0.5px;
        }
        .header-grid-menu__cell--placeholder {
          cursor: default;
          pointer-events: none;
        }
        /* צ׳אט קולי בתפריט — עיגול + «סימולטור» מימין (ltr); עיגול מוזז קצת שמאלה */
        .header-grid-menu__top-row .header-grid-menu__cell--menu-ai-call-wrap {
          align-self: center;
          justify-self: stretch;
          width: 100%;
          min-height: 0 !important;
          box-sizing: border-box !important;
          display: flex !important;
          flex-direction: row;
          direction: ltr;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 4px 6px !important;
        }
        .header-menu-ai-call-circle {
          position: relative;
          min-height: 0 !important;
          padding: 0 !important;
          margin: 0;
          display: flex !important;
          flex-direction: column !important;
          justify-content: center !important;
          align-items: center !important;
          text-align: center !important;
          box-sizing: border-box !important;
          width: calc(38px * 0.9 * 0.9 * 0.8 * 1.1) !important;
          height: calc(38px * 0.9 * 0.9 * 0.8 * 1.1) !important;
          max-width: calc(38px * 0.9 * 0.9 * 0.8 * 1.1) !important;
          max-height: calc(38px * 0.9 * 0.9 * 0.8 * 1.1) !important;
          aspect-ratio: 1 / 1;
          border-radius: 50% !important;
          flex-shrink: 0;
          transform: translateX(-6px);
        }
        .header-menu-ai-call-circle > svg {
          width: calc(1rem * 0.9 * 0.9 * 0.8 * 1.1) !important;
          height: calc(1rem * 0.9 * 0.9 * 0.8 * 1.1) !important;
        }
        .header-menu-ai-call-circle .header-ai-call-btn__label {
          font-size: 0.328rem !important;
        }
        .header-menu-ai-call-sim-text {
          font-family: var(--font-sans, Rubik, sans-serif);
          font-size: 0.72rem;
          font-weight: 800;
          color: rgba(244, 244, 248, 0.9);
          letter-spacing: 0.03em;
          white-space: nowrap;
          line-height: 1.1;
        }
        .header-grid-menu__cell--online {
          font: inherit;
          color: inherit;
          background: #000;
          justify-content: center !important;
          align-items: center !important;
          gap: 8px;
          direction: ltr;
        }
        .header-grid-menu__cell--online:hover {
          background: rgba(255, 255, 255, 0.06);
        }
        .online-led {
          display: inline-block;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #22c55e;
          flex-shrink: 0;
          animation: onlineLedPulse 1.8s ease-in-out infinite;
        }
        @keyframes onlineLedPulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 5px 1px rgba(34,197,94,0.7); }
          50%       { opacity: 0.3; box-shadow: 0 0 2px 0   rgba(34,197,94,0.2); }
        }
        .header-grid-menu__nav {
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-auto-flow: row;
          border: 1px solid rgba(255, 255, 255, 0.35);
          border-top: none;
          background: #000;
        }
        .header-grid-menu__cell {
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          text-align: right;
          padding: 7px 12px;
          min-height: 38px;
          border: 0.5px solid rgba(255, 255, 255, 0.28);
          margin: 0 0 -0.5px -0.5px;
          color: #f4f4f8;
          font-family: var(--font-sans);
          font-size: 0.78rem;
          font-weight: 400;
          text-decoration: none;
          background: #000;
          cursor: pointer;
          transition: background 0.12s, color 0.12s;
        }
        .header-grid-menu__cell:hover {
          background: rgba(255, 255, 255, 0.06);
        }
        .header-grid-menu__cell--active {
          background: rgba(99, 102, 241, 0.12);
          color: #e0e7ff;
        }
        .header-grid-menu__cell--disabled {
          opacity: 0.45;
          cursor: default;
          pointer-events: none;
        }
        .header-grid-menu__cell--tanakh {
          color: var(--gold, #fbbf24);
        }
        .header-grid-menu__secondary {
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: repeat(2, minmax(38px, auto));
          border: 1px solid rgba(255, 255, 255, 0.35);
          border-top: none;
          background: #000;
        }
        .header-grid-menu__secondary .header-grid-menu__cell {
          margin: 0 0 -0.5px -0.5px;
        }
        .header-grid-menu__media-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          border: 1px solid rgba(255, 255, 255, 0.35);
          border-top: none;
          background: #000;
        }
        .header-grid-menu__media-row .header-grid-menu__cell {
          margin: 0 0 -0.5px -0.5px;
        }
        .header-grid-menu__profile-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          border: 1px solid rgba(255, 255, 255, 0.35);
          border-top: none;
          background: #000;
        }
        .header-grid-menu__profile-row .header-grid-menu__cell {
          margin: 0 0 -0.5px -0.5px;
        }
        .header-grid-menu__logout {
          flex-shrink: 0;
          align-self: stretch;
          width: 100%;
          box-sizing: border-box;
          margin: 0;
          margin-top: 1px;
          padding: 13px 14px calc(13px + env(safe-area-inset-bottom, 0px));
          border: none;
          border-radius: 0;
          border-top: 1px solid rgba(255, 255, 255, 0.12);
          background: #dc2626;
          background-image: linear-gradient(180deg, #f87171 0%, #dc2626 38%, #b91c1c 100%);
          color: #fff;
          font-family: var(--font-sans);
          font-size: 0.78rem;
          font-weight: 700;
          line-height: 1.3;
          letter-spacing: 0.02em;
          cursor: pointer;
          box-shadow:
            0 0 0 1px rgba(127, 29, 29, 0.55),
            0 4px 18px rgba(220, 38, 38, 0.55);
          transition: background 0.15s, filter 0.15s, box-shadow 0.15s;
        }
        .header-grid-menu__logout:hover {
          background-image: linear-gradient(180deg, #fca5a5 0%, #ef4444 40%, #dc2626 100%);
          filter: brightness(1.04);
          box-shadow:
            0 0 0 1px rgba(153, 27, 27, 0.65),
            0 6px 22px rgba(239, 68, 68, 0.55);
        }
        .header-grid-menu__logout:active {
          transform: scale(0.99);
        }

        .header-avatar-wrap { position: relative; display: flex; flex-direction: column; align-items: center; gap: 3px; }
        .header-avatar {
          width: 38px; height: 38px;
          box-sizing: border-box;
          border-radius: 50%;
          background: var(--card2, #1a1a24);
          border: 2px solid var(--border-strong, rgba(255,255,255,0.14));
          cursor: default;
          display: flex; align-items: center; justify-content: center;
          overflow: visible;
          position: relative;
          transition: border-color 0.3s, box-shadow 0.3s, transform 0.2s;
        }
        .header-avatar.logged-in {
          border-color: rgba(148, 163, 184, 0.34);
          box-shadow: 0 0 10px rgba(15, 23, 42, 0.34);
          background: rgba(71, 85, 105, 0.22);
          cursor: pointer;
        }
        .header-avatar.logged-in.header-avatar--pending {
          border-color: var(--gold, #fbbf24);
          box-shadow: 0 0 14px rgba(251, 191, 36, 0.28);
          background: rgba(251, 191, 36, 0.1);
        }
        .header-avatar.logged-in:hover { transform: scale(1.04); }
        .header-avatar.logged-in.header-avatar--nav-disabled {
          cursor: default;
        }
        .header-avatar.logged-in.header-avatar--nav-disabled:hover {
          transform: none;
        }
        button.header-avatar {
          cursor: pointer;
        }
        .header-avatar:focus-visible {
          outline: 2px solid var(--accent, #6366f1);
          outline-offset: 2px;
        }
        .header-online-dot {
          position: absolute;
          left: 50%;
          bottom: 6px;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #22c55e;
          border: 1px solid rgba(7,7,12,0.92);
          box-shadow: 0 0 0 rgba(34,197,94,0.36);
          transform: translateX(-50%);
          animation: headerOnlinePulse 2.4s ease-in-out infinite;
        }
        @keyframes headerOnlinePulse {
          0%, 100% {
            opacity: 0.68;
            transform: translateX(-50%) scale(0.82);
            box-shadow: 0 0 0 0 rgba(34,197,94,0.22);
          }
          50% {
            opacity: 1;
            transform: translateX(-50%) scale(1);
            box-shadow: 0 0 0 3px rgba(34,197,94,0.07);
          }
        }
        .header-avatar svg { width: 22px; height: 22px; }
        .header-avatar-initial {
          font-size: clamp(0.58rem, 2.5vw, 0.7rem);
          font-weight: 500;
          font-family: var(--font-sans, Rubik, sans-serif);
          color: var(--text, #fff);
          line-height: 1;
          text-align: center;
          max-width: 34px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          padding: 0 2px;
        }
        .header-avatar.logged-in .header-avatar-initial { color: rgba(203,213,225,0.78); }
        .header-avatar.logged-in.header-avatar--pending .header-avatar-initial { color: var(--gold, #fbbf24); }
        /* תפריט משתמש — מתחת לעיגול, פנימה (ימין מיושר ל־wrap ב־RTL) */
        .header-user-menu {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          left: auto;
          width: min(360px, calc(100vw - 24px));
          min-width: 260px;
          box-sizing: border-box;
          background: rgba(18, 18, 26, 0.98);
          border: 1px solid var(--border-strong, rgba(255,255,255,0.14));
          border-radius: 14px;
          padding: 12px 12px 10px;
          box-shadow: 0 16px 48px rgba(0,0,0,0.55);
          z-index: 2200;
          direction: rtl;
          text-align: right;
        }
        .header-user-menu-name {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--text, #fff);
          padding: 4px 8px 6px;
          word-break: break-word;
        }
        .header-user-menu-name__text {
          flex: 1;
          min-width: 0;
        }
        .header-user-menu-sub {
          color: var(--muted, #8a8a9a);
          font-size: 0.76rem;
          font-weight: 700;
          padding: 0 8px 10px;
          border-bottom: 1px solid var(--border, rgba(255,255,255,0.08));
          margin-bottom: 8px;
        }
        .header-profile-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin: 10px 0;
        }
        .header-profile-stat {
          border: 1px solid var(--border, rgba(255,255,255,0.08));
          border-radius: 12px;
          background: rgba(255,255,255,0.045);
          padding: 10px 9px;
          min-width: 0;
        }
        .header-profile-stat strong {
          display: block;
          color: var(--text, #fff);
          font-size: 1rem;
          font-weight: 900;
          margin-bottom: 2px;
          font-variant-numeric: tabular-nums;
        }
        .header-profile-stat span {
          display: block;
          color: var(--muted, #8a8a9a);
          font-size: 0.68rem;
          font-weight: 800;
          line-height: 1.3;
        }
        .header-livr-card {
          margin: 10px 0;
          padding: 12px;
          border-radius: 14px;
          border: 1px solid rgba(99,102,241,0.35);
          background: rgba(99,102,241,0.12);
        }
        .header-livr-title {
          color: var(--text, #fff);
          font-weight: 900;
          font-size: 0.9rem;
          margin-bottom: 4px;
        }
        .header-livr-copy {
          color: var(--text-secondary, #b4b4c0);
          font-size: 0.75rem;
          line-height: 1.45;
          margin-bottom: 10px;
        }
        .header-user-menu-btn {
          display: block;
          width: 100%;
          padding: 11px 12px;
          margin-top: 6px;
          border-radius: 10px;
          border: 1px solid rgba(248, 113, 113, 0.35);
          background: rgba(248, 113, 113, 0.12);
          color: #fecaca;
          font-size: 0.86rem;
          font-weight: 700;
          font-family: var(--font-sans, Rubik, sans-serif);
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
        }
        .header-user-menu-btn:hover {
          background: rgba(248, 113, 113, 0.2);
          border-color: rgba(248, 113, 113, 0.5);
        }
        .header-user-menu-btn--primary {
          border-color: rgba(99,102,241,0.45);
          background: rgba(99,102,241,0.22);
          color: #dbeafe;
        }
        .header-user-menu-btn--primary:hover {
          border-color: rgba(99,102,241,0.7);
          background: rgba(99,102,241,0.32);
        }
        .header-user-menu-btn--muted {
          border-color: var(--border, rgba(255,255,255,0.12));
          background: rgba(255,255,255,0.06);
          color: var(--text-secondary, #b4b4c0);
        }
        .header-user-menu-btn--muted:hover {
          background: rgba(255,255,255,0.1);
          border-color: var(--border-strong, rgba(255,255,255,0.18));
        }
        .online-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 4500;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px 16px;
          background: rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          direction: rtl;
        }
        .online-modal-panel {
          width: 100%;
          max-width: 420px;
          max-height: min(72vh, 520px);
          display: flex;
          flex-direction: column;
          background: linear-gradient(165deg, rgba(255,255,255,0.06) 0%, transparent 42%), var(--card, #12121a);
          border: 1px solid var(--border-strong, rgba(255,255,255,0.14));
          border-radius: 18px;
          box-shadow: 0 24px 64px rgba(0,0,0,0.65);
          overflow: hidden;
        }
        .online-modal-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 16px 18px;
          border-bottom: 1px solid var(--border, rgba(255,255,255,0.08));
        }
        .online-modal-title {
          font-size: 1.05rem;
          font-weight: 800;
          color: var(--text, #fff);
          margin: 0;
        }
        .online-modal-close {
          flex-shrink: 0;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: 1px solid var(--border, rgba(255,255,255,0.12));
          background: rgba(255,255,255,0.06);
          color: var(--text, #fff);
          font-size: 1.25rem;
          line-height: 1;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .online-modal-close:hover {
          background: rgba(255,255,255,0.1);
        }
        .online-modal-sub {
          padding: 8px 18px 12px;
          font-size: 0.82rem;
          color: var(--muted, #8a8a9a);
          font-weight: 600;
        }
        .online-modal-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px 12px 18px;
        }
        .online-modal-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          border-radius: 12px;
          margin-bottom: 6px;
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--border, rgba(255,255,255,0.06));
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--text, #fff);
        }
        .online-modal-row:last-child { margin-bottom: 0; }
        .online-modal-empty {
          text-align: center;
          padding: 28px 16px;
          color: var(--muted, #8a8a9a);
          font-size: 0.92rem;
        }
        .header-stat-num {
          font-family: var(--font-sans, 'Rubik', 'Segoe UI', system-ui, sans-serif);
          font-weight: 800;
          font-size: 0.85rem;
          color: var(--text, #fff);
          font-variant-numeric: tabular-nums;
        }
        .header-stat-label {
          font-size: 0.62rem;
          font-weight: 600;
          color: var(--muted, #8a8a9a);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        /* עיגול צ׳אט קולי — לבן חזק (מסגרת/זוהר/טלפון/AI); ירוק במעבר עכבר / פוקוס / בעמוד השיחה */
        .header-ai-call-btn {
          flex-direction: column !important;
          gap: 1px !important;
          color: #ffffff !important;
          border-color: rgba(255, 255, 255, 0.55) !important;
          background: var(--bg, #07070c) !important;
          box-shadow:
            0 0 14px rgba(255, 255, 255, 0.22),
            0 2px 10px rgba(0, 0, 0, 0.4),
            inset 0 0 0 1px rgba(255, 255, 255, 0.14) !important;
          cursor: pointer !important;
          transition: border-color 0.18s, background 0.18s, box-shadow 0.18s, transform 0.12s, color 0.18s !important;
        }
        .header-ai-call-btn:hover,
        .header-ai-call-btn--active,
        .header-ai-call-btn:focus-visible {
          color: #22c55e !important;
          border-color: rgba(34, 197, 94, 0.85) !important;
          background: rgba(34, 197, 94, 0.14) !important;
          box-shadow: 0 0 10px rgba(34, 197, 94, 0.45), inset 0 0 6px rgba(34, 197, 94, 0.12) !important;
        }
        .header-ai-call-btn:hover {
          border-color: #22c55e !important;
          background: rgba(34, 197, 94, 0.22) !important;
          box-shadow: 0 0 18px rgba(34, 197, 94, 0.7), inset 0 0 8px rgba(34, 197, 94, 0.18) !important;
          transform: scale(1.06) !important;
        }
        .header-ai-call-btn--active:not(:hover) {
          transform: none !important;
        }
        .header-ai-call-btn:active { transform: scale(0.96) !important; }
        .header-ai-call-btn__icon {
          font-size: 1rem;
          line-height: 1;
          display: block;
        }
        .header-ai-call-btn > svg {
          filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.5));
        }
        .header-ai-call-btn:hover > svg,
        .header-ai-call-btn--active > svg,
        .header-ai-call-btn:focus-visible > svg {
          filter: drop-shadow(0 0 7px rgba(34, 197, 94, 0.65));
        }
        .header-ai-call-btn__label {
          font-size: 0.46rem;
          font-weight: 900;
          letter-spacing: 0.1em;
          color: #ffffff;
          line-height: 1;
          display: block;
          text-shadow: 0 0 6px rgba(255, 255, 255, 0.35);
        }
        .header-ai-call-btn:hover .header-ai-call-btn__label,
        .header-ai-call-btn--active .header-ai-call-btn__label,
        .header-ai-call-btn:focus-visible .header-ai-call-btn__label {
          color: #ffffff !important;
        }
      `}</style>

      <div className="app-header-shell">
      <div className="app-header">
        <div className="app-header__inner">
        {/* Right side: avatar + AI call button */}
        <div className="header-zone header-zone--user">
          {/* כפתור שיחה קולית עם AI — שמאל לאוואטר */}
          <button
            type="button"
            className={`header-avatar header-ai-call-btn${aiVoicePageActive ? ' header-ai-call-btn--active' : ''}`}
            onClick={toggleAiVoice}
            aria-label={aiVoicePageActive ? 'סגור צ׳אט קולי' : 'צ׳אט קולי עם AI'}
            title={aiVoicePageActive ? 'סגור את צ׳אט קולי' : 'שיחה קולית עם AI'}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" style={{ width: '1rem', height: '1rem', display: 'block' }}>
              <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" />
            </svg>
            <span className="header-ai-call-btn__label" aria-hidden="true">AI</span>
          </button>
          <div className="header-avatar-wrap" ref={avatarWrapRef}>
            {activeUser ? (
              canOpenHeaderProfile ? (
                <button
                  type="button"
                  className={`header-avatar logged-in${pendingUser && !user ? ' header-avatar--pending' : ''}`}
                  onClick={() => {
                    if (profileNavUsername) navigate(`/profile/${encodeURIComponent(profileNavUsername)}`);
                  }}
                  aria-label="פרופיל משתמש"
                  title={pendingUser && !user ? 'פרופיל (השלם הרשמה כדי לערוך)' : undefined}
                >
                  {avatarLabel ? (
                    <span className="header-avatar-initial" dir="auto">{avatarLabel}</span>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="#5c5c6c">
                      <circle cx="12" cy="8" r="4" />
                      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                    </svg>
                  )}
                  <span className="header-online-dot" aria-hidden="true" />
                </button>
              ) : (
                <div
                  className="header-avatar logged-in header-avatar--nav-disabled"
                  aria-label="אין שם משתמש לניווט לפרופיל"
                  title="התחבר או בחר שם משתמש"
                >
                  {avatarLabel ? (
                    <span className="header-avatar-initial" dir="auto">{avatarLabel}</span>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="#5c5c6c">
                      <circle cx="12" cy="8" r="4" />
                      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                    </svg>
                  )}
                  <span className="header-online-dot" aria-hidden="true" />
                </div>
              )
            ) : (
              <div className="header-avatar">
                <svg viewBox="0 0 24 24" fill="#5c5c6c">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                </svg>
              </div>
            )}
            {avatarMenuOpen && activeUser && (
              <div className="header-user-menu" role="menu">
                <div className="header-user-menu-name" dir="auto">
                  <UserAvatarSlot
                    size="sm"
                    displayName={activeUser.username}
                    avatarUrl={getCageAvatarDataUrlForDisplayName(activeUser.username) || undefined}
                  />
                  <span className="header-user-menu-name__text">{activeUser.username}</span>
                </div>
                <div className="header-user-menu-sub">
                  {user ? 'כרטיס משתמש ונתוני פעילות' : 'רישום בתהליך'}
                </div>
                <div className="header-profile-grid" aria-label="נתוני משתמש">
                  <div className="header-profile-stat">
                    <strong>{profileStats?.humanDebates ?? user?.humanDebates ?? 0}</strong>
                    <span>שיחות מול משתמשים</span>
                  </div>
                  <div className="header-profile-stat">
                    <strong>{profileStats?.likesReceived ?? user?.score ?? 0}</strong>
                    <span>לייקים / ניקוד</span>
                  </div>
                  <div className="header-profile-stat">
                    <strong>{profileStats?.giftsReceived ?? user?.giftsReceived ?? 0}</strong>
                    <span>מתנות שקיבל</span>
                  </div>
                  <div className="header-profile-stat">
                    <strong>{profileStats?.voiceDebates ?? user?.voiceDebates ?? 0}</strong>
                    <span>שיחות קול / לייב</span>
                  </div>
                  <div className="header-profile-stat">
                    <strong>{profileStats?.aiDebates ?? user?.aiDebates ?? 0}</strong>
                    <span>דיונים מול AI</span>
                  </div>
                  <div className="header-profile-stat">
                    <strong>{profileStats?.liveAppearances ?? 0}</strong>
                    <span>הופעות LIVE</span>
                  </div>
                </div>
                {user && (
                  <div className="header-livr-card">
                    <div className="header-livr-title">צ׳אט LIVE</div>
                    <div className="header-livr-copy">
                      פתח חדר לייב עם מצלמה, דיבור מול קהל והשתתפות צופים בשיחה.
                    </div>
                    <button type="button" className="header-user-menu-btn header-user-menu-btn--primary" role="menuitem" onClick={openLivrChat}>
                      פתח שיחת LIVE
                    </button>
                  </div>
                )}
                {user ? (
                  <button type="button" className="header-user-menu-btn" role="menuitem" onClick={fullLogout}>
                    התנתק מהחשבון
                  </button>
                ) : (
                  <button type="button" className="header-user-menu-btn header-user-menu-btn--muted" role="menuitem" onClick={abortPendingRegistration}>
                    התנתק
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RTL: אזור לוגו + תפריט — בקצה הנגדי לאווטאר */}
        <div className="header-zone header-zone--brand">
          <button type="button" className="header-app-brand" onClick={goAppHome} aria-label="דף הבית">
            <span className="header-logo-mark-wrap">
              <span className="header-logo-mark" aria-hidden="true">
                <span className="header-logo-orbit" />
                <span className="header-logo-planet" />
                <span className="header-logo-shine" />
                <span className="header-logo-satellite" />
              </span>
            </span>
            <span className="header-logo-watermark" aria-hidden="true">O M G</span>
          </button>
          <div
            ref={menuRef}
            className="header-dots-wrap"
            style={{ position: 'relative' }}
            onMouseEnter={openMenuFromHover}
            onMouseLeave={scheduleCloseMenuFromHover}
          >
            <button
              type="button"
              className={'header-dots-btn' + (menuOpen ? ' header-dots-btn--open' : '')}
              onClick={() => {
                clearMenuHoverTimer();
                if (!menuOpen) {
                  cancelHoverMenuOpenTimer();
                  menuFirstCloseClickSuppressedRef.current = false;
                  updateMenuDock();
                  setMenuOpen(true);
                  return;
                }
                if (menuFirstCloseClickSuppressedRef.current) {
                  menuFirstCloseClickSuppressedRef.current = false;
                  return;
                }
                setMenuOpen(false);
              }}
              aria-label="תפריט"
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
            >
              <span className="header-menu-icon" aria-hidden="true">
                <span className="header-menu-icon__bar" />
                <span className="header-menu-icon__bar" />
                <span className="header-menu-icon__bar" />
              </span>
            </button>
          </div>
        </div>
        </div>
      </div>
      <div className="app-header-ticker-strip" aria-label="נושאים מוצגים">
        <div className="app-header-ticker-strip__inner">
          <div className="app-header-ticker-wrap">
            <div className="app-header-ticker-inner">
              {[...Array(2)].flatMap((_, rep) =>
                HEADER_TICKER_TOPICS.map((topic, i) => (
                  <span key={`t-${rep}-${i}`}>
                    <span className="app-header-ticker-item">{topic}</span>
                    <span className="app-header-ticker-sep">◆</span>
                  </span>
                )),
              )}
            </div>
          </div>
        </div>
      </div>
      </div>

      {menuOpen && menuDock
        && createPortal(
          <>
            <div className="header-grid-menu-backdrop header-grid-menu-backdrop--passive" aria-hidden />
            <div
              ref={menuPortalRef}
              className="header-grid-menu-portal"
              style={{
                top: menuDock.top,
                left: menuDock.left,
                width: menuDock.width,
                paddingTop: menuDock.bridgePx ?? MENU_DOCK_BRIDGE_PX,
                boxSizing: 'border-box',
              }}
              onMouseEnter={openMenuFromHover}
              onMouseLeave={scheduleCloseMenuFromHover}
            >
            <div
              className="header-grid-menu"
              role="dialog"
              aria-modal="true"
              aria-label="תפריט ניווט"
            >
              <div className="header-grid-menu__scroll">
              <div className="header-grid-menu__top-row" role="group" aria-label="שורה עליונה">
                <button
                  type="button"
                  className="header-grid-menu__cell header-grid-menu__cell--online"
                  aria-label={`גולשים מחוברים כרגע: ${stats.online}`}
                  onClick={() => {
                    setOnlineModalOpen(true);
                    loadStats();
                    setMenuOpen(false);
                  }}
                >
                  <span className="online-led" aria-hidden="true" />
                  <span className="header-stat-num">{stats.online}</span>
                </button>
                <Link
                  className="header-grid-menu__cell header-grid-menu__cell--online"
                  to="/registered"
                  aria-label={`סה״כ רשומים: ${stats.registered}`}
                  onClick={() => setMenuOpen(false)}
                  style={{ textDecoration: 'none' }}
                >
                  <span className="header-stat-num">{stats.registered}</span>
                  <span className="header-stat-label" style={{ marginRight: 4 }}>רשומים</span>
                </Link>
                <div className="header-grid-menu__cell header-grid-menu__cell--menu-ai-call-wrap">
                  <button
                    type="button"
                    className={`header-menu-ai-call-circle header-avatar header-ai-call-btn${aiVoicePageActive ? ' header-ai-call-btn--active' : ''}`}
                    onClick={() => {
                      toggleAiVoice();
                      setMenuOpen(false);
                    }}
                    aria-label={aiVoicePageActive ? 'סגור צ׳אט קולי' : 'צ׳אט קולי עם AI'}
                    title={aiVoicePageActive ? 'סגור את צ׳אט קולי' : 'שיחה קולית עם AI'}
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" style={{ display: 'block' }}>
                      <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" />
                    </svg>
                    <span className="header-ai-call-btn__label" aria-hidden="true">AI</span>
                  </button>
                  <span className="header-menu-ai-call-sim-text" aria-hidden="true">סימולטור</span>
                </div>
              </div>
              <div className="header-grid-menu__nav">
                {headerGridNavItems.map(item => {
                  const cls =
                    'header-grid-menu__cell'
                    + (item.active ? ' header-grid-menu__cell--active' : '')
                    + (item.kind === 'disabled' ? ' header-grid-menu__cell--disabled' : '');
                  if (item.kind === 'disabled') {
                    return (
                      <span key={item.key} className={cls}>{item.label}</span>
                    );
                  }
                  if (item.kind === 'ai-pending') {
                    return (
                      <Link
                        key={item.key}
                        className={cls}
                        to="/login"
                        state={{ autoAI: true }}
                        onClick={() => setMenuOpen(false)}
                      >
                        {item.label}
                      </Link>
                    );
                  }
                  if (item.kind === 'podcast-toggle') {
                    return (
                      <button
                        key={item.key}
                        type="button"
                        className={cls}
                        onClick={() => {
                          toggleHeaderPodcastPanel();
                          setMenuOpen(false);
                        }}
                      >
                        {item.label}
                      </button>
                    );
                  }
                  return (
                    <Link
                      key={item.key}
                      className={cls}
                      to={item.to}
                      state={item.key === 'vid' ? { tvLiveDefault: true } : undefined}
                      onClick={() => {
                        if (item.key === 'vid') setYtTvUrl(null);
                        setMenuOpen(false);
                      }}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
              <div className="header-grid-menu__profile-row" role="group" aria-label="פרופיל ורשומים">
                {profileMenuPath ? (
                  <Link
                    className={`header-grid-menu__cell${menuProfileCellActive ? ' header-grid-menu__cell--active' : ''}`}
                    to={profileMenuPath}
                    onClick={() => setMenuOpen(false)}
                  >
                    פרופיל
                  </Link>
                ) : (
                  <span className="header-grid-menu__cell header-grid-menu__cell--disabled">פרופיל</span>
                )}
                <Link
                  className={`header-grid-menu__cell${menuRegisteredActive ? ' header-grid-menu__cell--active' : ''}`}
                  to="/registered"
                  onClick={() => setMenuOpen(false)}
                >
                  רשומים
                </Link>
              </div>
              <div className="header-grid-menu__secondary">
                <Link className="header-grid-menu__cell" to="/contact" onClick={() => setMenuOpen(false)}>צור קשר</Link>
                <Link className="header-grid-menu__cell" to="/settings" onClick={() => setMenuOpen(false)}>הגדרות</Link>
                <Link className="header-grid-menu__cell" to="/terms" onClick={() => setMenuOpen(false)}>תקנון</Link>
                <button
                  type="button"
                  className="header-grid-menu__cell header-grid-menu__cell--tanakh"
                  onClick={() => { setBibleOpen(true); setMenuOpen(false); }}
                >
                  תנ״ך
                </button>
              </div>
              <div className="header-grid-menu__media-row" role="group" aria-label="רדיו ו־YouTube">
                <button
                  type="button"
                  className={`header-grid-menu__cell${menuRadioSectionActive ? ' header-grid-menu__cell--active' : ''}`}
                  onClick={() => {
                    openMiniMediaBar('radio', { play: true });
                    setMenuOpen(false);
                  }}
                >
                  רדיו
                </button>
                <button
                  type="button"
                  className={`header-grid-menu__cell${menuYtSectionActive ? ' header-grid-menu__cell--active' : ''}`}
                  onClick={() => {
                    openMiniMediaBar('youtube', { play: true });
                    setMenuOpen(false);
                  }}
                >
                  נגן YouTube
                </button>
              </div>
              </div>
              <button
                type="button"
                className="header-grid-menu__logout"
                onClick={() => {
                  if (user) fullLogout();
                  else if (pendingUser) abortPendingRegistration();
                  else {
                    setMenuOpen(false);
                    navigate('/login');
                  }
                }}
              >
                התנתקות
              </button>
            </div>
            </div>
          </>,
          document.body,
        )}

      {bibleOpen && <BibleModal onClose={() => setBibleOpen(false)} />}

      {onlineModalOpen && (
        <div
          className="online-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="online-modal-title"
          onClick={() => setOnlineModalOpen(false)}
        >
          <div className="online-modal-panel" onClick={e => e.stopPropagation()}>
            <div className="online-modal-head">
              <h2 id="online-modal-title" className="online-modal-title">גולשים עכשיו</h2>
              <button
                type="button"
                className="online-modal-close"
                onClick={() => setOnlineModalOpen(false)}
                aria-label="סגור"
              >
                ×
              </button>
            </div>
            <p className="online-modal-sub">
              משתמשים מחוברים לשרת כרגע ({stats.online})
            </p>
            <div className="online-modal-list">
              {stats.onlineList.length === 0 ? (
                <div className="online-modal-empty">אין גולשים מחוברים כרגע</div>
              ) : (
                stats.onlineList.map((name, i) => (
                  <div key={`${name}-${i}`} className="online-modal-row" dir="auto">
                    <span aria-hidden>🟢</span>
                    <span>{name}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
