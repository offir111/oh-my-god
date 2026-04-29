import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAppStore } from '../../store/appStore.js';
import { disconnectSocket } from '../../socket.js';
import BibleModal from '../ui/BibleModal.jsx';

const STATS_CACHE_KEY = 'omg_stats_cache';
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
  const setUser = useAppStore(s => s.setUser);
  const setPendingUser = useAppStore(s => s.setPendingUser);
  const resetDebate = useAppStore(s => s.resetDebate);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [bibleOpen, setBibleOpen] = useState(false);
  const [stats, setStats] = useState({ registered: 0, online: 0, registeredList: [], onlineList: [] });
  const [profileStats, setProfileStats] = useState(null);
  const [listOpen, setListOpen] = useState(null); // 'registered' | null — רשומים רק למנהל
  const [onlineModalOpen, setOnlineModalOpen] = useState(false);
  const menuRef = useRef();
  const listRef = useRef();
  const avatarWrapRef = useRef();

  const statsAdminUsername = (import.meta.env.VITE_STATS_ADMIN_USERNAME || '').trim();
  const canSeeRegistered = Boolean(statsAdminUsername && user?.username === statsAdminUsername);

  // Show green avatar also when registered but not yet in debate
  const activeUser = user || pendingUser;

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

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
      if (listRef.current && !listRef.current.contains(e.target)) setListOpen(null);
      if (avatarWrapRef.current && !avatarWrapRef.current.contains(e.target)) setAvatarMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e) {
      if (e.key === 'Escape') setMenuOpen(false);
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
    if (!canSeeRegistered) setListOpen(null);
  }, [canSeeRegistered]);

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
    disconnectSocket();
    setUser(null);
    resetDebate();
    setAvatarMenuOpen(false);
    navigate('/login');
  }

  function abortPendingRegistration() {
    setPendingUser(null);
    setAvatarMenuOpen(false);
    navigate('/login');
  }

  /** דף הבית — דף ההרשמה ובחירת הצד; לא מנתק מהחשבון */
  function goAppHome() {
    setMenuOpen(false);
    setListOpen(null);
    setOnlineModalOpen(false);
    setAvatarMenuOpen(false);
    navigate('/login', { state: { homeResetAt: Date.now() } });
  }

  function openLivrChat() {
    setAvatarMenuOpen(false);
    navigate('/livr');
  }

  const nick = user?.username || pendingUser?.username;
  const avatarLabel = nick
    ? (nick.length <= 5 ? nick : nick.charAt(0))
    : null;

  return (
    <>
      <style>{`
        .app-header {
          position: fixed;
          top: 0; left: 0; right: 0;
          height: 58px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          z-index: 1000;
          overflow: visible;
          pointer-events: none;
          background: rgba(7, 7, 12, 0.72);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          border-bottom: 1px solid var(--border, rgba(255,255,255,0.08));
          box-shadow: 0 4px 24px rgba(0,0,0,0.25);
        }
        .app-header > * { pointer-events: all; }
        .header-zone {
          min-height: 52px;
          height: auto;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .header-dots-btn {
          width: 38px; height: 38px;
          box-sizing: border-box;
          border-radius: 50%;
          border: 1px solid var(--border, rgba(255,255,255,0.1));
          background: rgba(255,255,255,0.05);
          color: var(--text, #fff);
          font-size: 1.35rem;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          line-height: 1;
          transition: background 0.2s, border-color 0.2s, transform 0.12s;
        }
        .header-dots-btn:hover {
          background: rgba(255,255,255,0.1);
          border-color: rgba(255,255,255,0.18);
        }
        .header-dots-btn:active { transform: scale(0.95); }
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
          pointer-events: all;
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
        /* RTL: הכפתור בקצה המסך השמאלי; right:0 גרם לתפריט להימתח שמאלה (מחוץ למסך) — left:0 פותח לתוך הדף */
        .header-dots-menu {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          right: auto;
          background: rgba(18, 18, 26, 0.96);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid var(--border-strong, rgba(255,255,255,0.14));
          border-radius: 14px;
          min-width: 210px;
          max-width: min(280px, calc(100vw - 32px));
          overflow: hidden;
          box-shadow: 0 16px 48px rgba(0,0,0,0.55);
          direction: rtl;
          z-index: 3000;
        }
        .header-dots-menu a, .header-dots-menu button {
          display: block;
          width: 100%;
          padding: 14px 18px;
          color: var(--text, #fff);
          text-decoration: none;
          font-size: 0.9rem;
          font-weight: 600;
          background: none;
          border: none;
          border-bottom: 1px solid var(--border, rgba(255,255,255,0.08));
          text-align: right;
          cursor: pointer;
          font-family: var(--font-sans, Rubik, sans-serif);
          box-sizing: border-box;
          transition: background 0.15s;
        }
        .header-dots-menu a:last-child { border-bottom: none; }
        .header-dots-menu a:hover, .header-dots-menu button:hover {
          background: rgba(255,255,255,0.06);
        }
        .header-menu-bible {
          color: var(--gold, #fbbf24) !important;
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
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--text, #fff);
          padding: 4px 8px 6px;
          word-break: break-word;
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
        .header-stats {
          display: flex;
          gap: 10px;
          align-items: center;
          height: 38px;
          direction: rtl;
          position: relative;
        }
        .header-stats.header-zone {
          position: relative;
        }
        .header-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 38px;
          box-sizing: border-box;
          line-height: 1.25;
          cursor: pointer;
          padding: 6px 12px;
          border-radius: 12px;
          transition: background 0.2s;
          border: 1px solid transparent;
        }
        .header-stat:hover {
          background: rgba(255,255,255,0.06);
          border-color: var(--border, rgba(255,255,255,0.08));
        }
        button.header-stat {
          font: inherit;
          color: inherit;
          background: none;
        }
        .header-stat--disabled {
          cursor: not-allowed;
          opacity: 0.48;
          pointer-events: none;
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
        .stats-list-popup {
          position: absolute;
          top: 48px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(18, 18, 26, 0.98);
          backdrop-filter: blur(14px);
          border: 1px solid var(--border-strong, rgba(255,255,255,0.14));
          border-radius: 14px;
          min-width: 200px;
          max-height: 280px;
          overflow-y: auto;
          box-shadow: 0 16px 48px rgba(0,0,0,0.55);
          direction: rtl;
          z-index: 2000;
          padding: 8px 0;
        }
        .stats-list-title {
          padding: 10px 16px 8px;
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--muted, #8a8a9a);
          border-bottom: 1px solid var(--border, rgba(255,255,255,0.08));
          margin-bottom: 4px;
          letter-spacing: 0.04em;
        }
        .stats-list-item {
          padding: 9px 16px;
          font-size: 0.88rem;
          color: var(--text, #fff);
          font-weight: 500;
        }
      `}</style>

      <div className="app-header">
        {/* Right side: avatar */}
        <div className="header-zone header-zone--user">
          <div className="header-avatar-wrap" ref={avatarWrapRef}>
            {activeUser ? (
              <button
                type="button"
                className={`header-avatar logged-in${pendingUser && !user ? ' header-avatar--pending' : ''}`}
                onClick={() => setAvatarMenuOpen(o => !o)}
                aria-haspopup="true"
                aria-expanded={avatarMenuOpen}
                aria-label="תפריט משתמש והתנתקות"
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
              <div className="header-avatar">
                <svg viewBox="0 0 24 24" fill="#5c5c6c">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                </svg>
              </div>
            )}
            {avatarMenuOpen && activeUser && (
              <div className="header-user-menu" role="menu">
                <div className="header-user-menu-name" dir="auto">👤 {activeUser.username}</div>
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

        {/* Stats — center */}
        <div className="header-zone header-zone--stats header-stats" ref={listRef}>
          {canSeeRegistered ? (
            <button
              type="button"
              className="header-stat"
              onClick={() => {
                setOnlineModalOpen(false);
                setListOpen(l => l === 'registered' ? null : 'registered');
              }}
            >
              <span className="header-stat-num">{stats.registered}</span>
              <span className="header-stat-label">רשומים</span>
            </button>
          ) : (
            <div
              className="header-stat header-stat--disabled"
              title="רשימת נרשמים זמינה למנהל המערכת בלבד"
              aria-label="רשומים — לא זמין"
            >
              <span className="header-stat-num">{stats.registered}</span>
              <span className="header-stat-label">רשומים</span>
            </div>
          )}
          <button
            type="button"
            className="header-stat"
            onClick={() => {
              setListOpen(null);
              setOnlineModalOpen(true);
              loadStats();
            }}
          >
            <span className="header-stat-num">{stats.online}</span>
            <span className="header-stat-label">אונליין</span>
          </button>

          {listOpen === 'registered' && canSeeRegistered && (
            <div className="stats-list-popup">
              <div className="stats-list-title">
                {`👥 נרשמו (${stats.registered})`}
              </div>
              {stats.registeredList.length === 0 ? (
                <div className="stats-list-item" style={{ color: 'var(--muted)' }}>אין עדיין</div>
              ) : (
                stats.registeredList.map((name, i) => (
                  <div key={i} className="stats-list-item">👤 {name}</div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Left: מותג (דף הבית) + תפריט נקודות */}
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
          <div ref={menuRef} className="header-dots-wrap" style={{ position: 'relative' }}>
          <button
            type="button"
            className="header-dots-btn"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="תפריט"
            aria-haspopup="true"
            aria-expanded={menuOpen}
          >
            ⋮
          </button>
          {menuOpen && (
            <div className="header-dots-menu" role="menu">
              <button type="button" className="header-menu-bible" onClick={() => { setBibleOpen(true); setMenuOpen(false); }}>
                📖 ספר התנ״ך
              </button>
              <Link to="/settings" onClick={() => setMenuOpen(false)}>⚙️ הגדרות</Link>
              <Link to="/terms" onClick={() => setMenuOpen(false)}>📋 תקנון</Link>
              <Link to="/contact" onClick={() => setMenuOpen(false)}>✉️ צור קשר</Link>
            </div>
          )}
          </div>
        </div>
      </div>

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
