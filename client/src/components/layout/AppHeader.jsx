import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAppStore } from '../../store/appStore.js';
import { disconnectSocket } from '../../socket.js';
import BibleModal from '../ui/BibleModal.jsx';

export default function AppHeader() {
  const user = useAppStore(s => s.user);
  const pendingUser = useAppStore(s => s.pendingUser);
  const setUser = useAppStore(s => s.setUser);
  const setPendingUser = useAppStore(s => s.setPendingUser);
  const resetDebate = useAppStore(s => s.resetDebate);
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [bibleOpen, setBibleOpen] = useState(false);
  const [stats, setStats] = useState({ registered: 0, online: 0, registeredList: [], onlineList: [] });
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
      const registered = hasUser || hasPending ? 1 : 0;
      const online = hasUser || hasPending ? 1 : 0;
      return { registered, online, registeredList: [], onlineList: [] };
    }

    fetch(`${BASE}/api/stats`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setStats(d || localStats()); })
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

  /** דף הכניסה — תמיד /login (גם כשמחוברים) */
  function goAppHome() {
    setMenuOpen(false);
    setListOpen(null);
    setOnlineModalOpen(false);
    setAvatarMenuOpen(false);
    navigate('/login');
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
          height: 52px;
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

        .header-dots-btn {
          width: 38px; height: 38px;
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
          background: none;
          border: none;
          cursor: pointer;
          font-family: var(--font-sans, Rubik, sans-serif);
          font-size: 0.88rem;
          font-weight: 800;
          letter-spacing: 0.05em;
          color: var(--text, #fff);
          padding: 6px 10px;
          border-radius: 10px;
          transition: opacity 0.2s, background 0.2s, transform 0.12s;
          white-space: nowrap;
          pointer-events: all;
        }
        .header-app-brand:hover {
          background: rgba(255,255,255,0.08);
          opacity: 0.95;
        }
        .header-app-brand:active { transform: scale(0.98); }
        .header-app-brand:focus-visible {
          outline: 2px solid var(--accent, #6366f1);
          outline-offset: 2px;
        }
        .header-back-btn {
          width: 38px; height: 38px;
          border-radius: 50%;
          border: 1px solid var(--border, rgba(255,255,255,0.1));
          background: rgba(255,255,255,0.05);
          color: var(--text, #fff);
          font-size: 1rem;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          line-height: 1;
          margin-right: 6px;
          transition: background 0.2s, border-color 0.2s;
        }
        .header-back-btn:hover {
          background: rgba(255,255,255,0.1);
          border-color: rgba(255,255,255,0.2);
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
          border-radius: 50%;
          background: var(--card2, #1a1a24);
          border: 2px solid var(--border-strong, rgba(255,255,255,0.14));
          cursor: default;
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
          transition: border-color 0.3s, box-shadow 0.3s, transform 0.2s;
        }
        .header-avatar.logged-in {
          border-color: var(--atheist, #00c853);
          box-shadow: 0 0 16px var(--atheist-glow, rgba(0,200,83,0.35));
          background: rgba(0, 200, 83, 0.08);
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
        .header-avatar svg { width: 22px; height: 22px; }
        .header-avatar-initial {
          font-size: clamp(0.62rem, 2.8vw, 0.78rem);
          font-weight: 800;
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
        .header-avatar.logged-in .header-avatar-initial { color: var(--atheist, #00c853); }
        .header-avatar.logged-in.header-avatar--pending .header-avatar-initial { color: var(--gold, #fbbf24); }
        /* תפריט משתמש — מתחת לעיגול, פנימה (ימין מיושר ל־wrap ב־RTL) */
        .header-user-menu {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          left: auto;
          min-width: 200px;
          max-width: min(280px, calc(100vw - 24px));
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
          font-size: 0.88rem;
          font-weight: 700;
          color: var(--text, #fff);
          padding: 4px 8px 10px;
          border-bottom: 1px solid var(--border, rgba(255,255,255,0.08));
          margin-bottom: 8px;
          word-break: break-word;
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
          direction: rtl;
          position: relative;
        }
        .header-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
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
        {/* Left side: back arrow + avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {location.pathname !== '/' && (
            <button className="header-back-btn" onClick={() => navigate(-1)} title="חזור">&#9664;</button>
          )}
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
        <div className="header-stats" ref={listRef}>
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

        {/* Right: מותג (דף הבית) + תפריט נקודות */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button type="button" className="header-app-brand" onClick={goAppHome} aria-label="דף הכניסה">
            oh my GOD
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
