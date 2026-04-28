import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../../store/appStore.js';
import { disconnectSocket } from '../../socket.js';
import BibleModal from '../ui/BibleModal.jsx';

export default function AppHeader() {
  const user = useAppStore(s => s.user);
  const pendingUser = useAppStore(s => s.pendingUser);
  const setUser = useAppStore(s => s.setUser);
  const resetDebate = useAppStore(s => s.resetDebate);
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [bibleOpen, setBibleOpen] = useState(false);
  const [stats, setStats] = useState({ registered: 0, online: 0, registeredList: [], onlineList: [] });
  const [listOpen, setListOpen] = useState(null); // 'registered' | 'online' | null
  const menuRef = useRef();
  const listRef = useRef();

  // Show green avatar also when registered but not yet in debate
  const activeUser = user || pendingUser;

  useEffect(() => {
    const BASE = import.meta.env.VITE_API_URL || '';

    function localStats() {
      const hasUser = !!localStorage.getItem('omg_user');
      const hasPending = !!localStorage.getItem('omg_pending');
      const registered = hasUser || hasPending ? 1 : 0;
      const online = hasUser || hasPending ? 1 : 0;
      return { registered, online };
    }

    function fetchStats() {
      fetch(`${BASE}/api/stats`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { setStats(d || localStats()); })
        .catch(() => setStats(localStats()));
    }

    fetchStats();
    const t = setInterval(fetchStats, 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
      if (listRef.current && !listRef.current.contains(e.target)) setListOpen(null);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function logout() {
    disconnectSocket();
    setUser(null);
    resetDebate();
    setAvatarOpen(false);
    navigate('/');
  }

  const avatarLabel = user?.username
    ? (user.username.length <= 5 ? user.username : user.username[0])
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
          padding: 0 14px;
          z-index: 1000;
          pointer-events: none;
        }
        .app-header > * { pointer-events: all; }

        .header-dots-btn {
          width: 36px; height: 36px;
          border-radius: 50%;
          border: none;
          background: rgba(30,30,30,0.85);
          color: #fff;
          font-size: 1.4rem;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          backdrop-filter: blur(6px);
          line-height: 1;
        }
        .header-back-btn {
          width: 36px; height: 36px;
          border-radius: 50%;
          border: none;
          background: rgba(30,30,30,0.85);
          color: #fff;
          font-size: 1rem;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          backdrop-filter: blur(6px);
          line-height: 1;
          margin-right: 6px;
        }
        .header-back-btn:hover { background: rgba(60,60,60,0.9); }
        .header-dots-menu {
          position: fixed;
          top: 52px;
          right: 8px;
          left: auto;
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 12px;
          min-width: 200px;
          max-width: calc(100vw - 16px);
          overflow: hidden;
          box-shadow: 0 8px 24px rgba(0,0,0,0.8);
          direction: rtl;
          z-index: 3000;
        }
        .header-dots-menu a, .header-dots-menu button {
          display: block;
          width: 100%;
          padding: 13px 18px;
          color: #fff;
          text-decoration: none;
          font-size: 0.92rem;
          background: none;
          border: none;
          border-bottom: 1px solid #2a2a2a;
          text-align: right;
          cursor: pointer;
          font-family: Arial, sans-serif;
          box-sizing: border-box;
        }
        .header-dots-menu a:last-child { border-bottom: none; }
        .header-dots-menu a:hover, .header-dots-menu button:hover { background: #2a2a2a; }

        .header-avatar-wrap { position: relative; display: flex; flex-direction: column; align-items: center; gap: 3px; }
        .header-avatar {
          width: 36px; height: 36px;
          border-radius: 50%;
          background: #222;
          border: 2px solid #444;
          cursor: default;
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
          transition: border-color 0.3s, box-shadow 0.3s;
        }
        .header-avatar.logged-in {
          border-color: #00DD55;
          box-shadow: 0 0 10px #00DD5566;
          background: #001a0a;
          cursor: pointer;
        }
        .header-avatar svg { width: 22px; height: 22px; }
        .avatar-popup {
          position: absolute;
          top: 42px; left: 0; right: auto;
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 10px;
          padding: 8px 14px;
          white-space: nowrap;
          box-shadow: 0 6px 18px rgba(0,0,0,0.7);
          z-index: 2000;
          font-family: Arial, sans-serif;
          font-size: 0.88rem;
          color: #00DD55;
          font-weight: 700;
          direction: rtl;
        }
        .header-stats {
          display: flex;
          gap: 14px;
          align-items: center;
          direction: rtl;
          position: relative;
        }
        .header-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          line-height: 1.3;
          cursor: pointer;
          padding: 3px 6px;
          border-radius: 8px;
          transition: background 0.2s;
        }
        .header-stat:hover { background: rgba(255,255,255,0.08); }
        .header-stat-num {
          font-weight: 700;
          font-size: 0.78rem;
          color: #fff;
          font-family: Arial, sans-serif;
        }
        .header-stat-label {
          font-size: 0.58rem;
          color: #aaa;
          font-family: Arial, sans-serif;
        }
        .stats-list-popup {
          position: absolute;
          top: 44px;
          left: 50%;
          transform: translateX(-50%);
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 12px;
          min-width: 180px;
          max-height: 260px;
          overflow-y: auto;
          box-shadow: 0 8px 24px rgba(0,0,0,0.7);
          direction: rtl;
          z-index: 2000;
          padding: 8px 0;
        }
        .stats-list-title {
          padding: 8px 16px 6px;
          font-size: 0.72rem;
          color: #888;
          font-family: Arial, sans-serif;
          border-bottom: 1px solid #2a2a2a;
          margin-bottom: 4px;
        }
        .stats-list-item {
          padding: 7px 16px;
          font-size: 0.88rem;
          color: #fff;
          font-family: Arial, sans-serif;
        }
      `}</style>

      <div className="app-header">
        {/* Left side: back arrow + avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {location.pathname !== '/' && (
            <button className="header-back-btn" onClick={() => navigate(-1)} title="חזור">&#9664;</button>
          )}
          <div
            className="header-avatar-wrap"
            onMouseEnter={() => activeUser && setAvatarOpen(true)}
            onMouseLeave={() => setAvatarOpen(false)}
          >
            <div className={`header-avatar${activeUser ? ' logged-in' : ''}`}>
              <svg viewBox="0 0 24 24" fill={activeUser ? '#00DD55' : '#555'}>
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
            </div>
            {avatarOpen && activeUser && (
              <div className="avatar-popup">
                👤 {activeUser.username}
              </div>
            )}
          </div>
        </div>

        {/* Stats — center */}
        <div className="header-stats" ref={listRef}>
          <div className="header-stat" onClick={() => setListOpen(l => l === 'registered' ? null : 'registered')}>
            <span className="header-stat-num">{stats.registered}</span>
            <span className="header-stat-label">רשומים</span>
          </div>
          <div className="header-stat" onClick={() => setListOpen(l => l === 'online' ? null : 'online')}>
            <span className="header-stat-num">{stats.online}</span>
            <span className="header-stat-label">אונליין</span>
          </div>

          {listOpen && (
            <div className="stats-list-popup">
              <div className="stats-list-title">
                {listOpen === 'registered' ? `👥 נרשמו (${stats.registered})` : `🟢 אונליין (${stats.online})`}
              </div>
              {(listOpen === 'registered' ? stats.registeredList : stats.onlineList).length === 0 ? (
                <div className="stats-list-item" style={{ color: '#555' }}>אין עדיין</div>
              ) : (
                (listOpen === 'registered' ? stats.registeredList : stats.onlineList).map((name, i) => (
                  <div key={i} className="stats-list-item">👤 {name}</div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Right side: three dots menu */}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button className="header-dots-btn" onClick={() => setMenuOpen(o => !o)}>⋮</button>
          {menuOpen && (
            <div className="header-dots-menu">
              <button onClick={() => { setBibleOpen(true); setMenuOpen(false); }}
                style={{ display:'block', width:'100%', padding:'13px 18px', color:'#FFE566',
                  background:'none', border:'none', borderBottom:'1px solid #2a2a2a',
                  textAlign:'right', cursor:'pointer', fontFamily:'Arial, sans-serif', fontSize:'0.92rem' }}>
                📖 ספר התנ"ך
              </button>
              <a href="#" style={{ display:'block', padding:'13px 18px', color:'#fff',
                textDecoration:'none', fontSize:'0.92rem', borderBottom:'1px solid #2a2a2a' }}>⚙️ הגדרות</a>
              <a href="#" style={{ display:'block', padding:'13px 18px', color:'#fff',
                textDecoration:'none', fontSize:'0.92rem', borderBottom:'1px solid #2a2a2a' }}>📋 תקנון</a>
              <a href="#" style={{ display:'block', padding:'13px 18px', color:'#fff',
                textDecoration:'none', fontSize:'0.92rem' }}>✉️ צור קשר</a>
            </div>
          )}
        </div>
      </div>

      {bibleOpen && <BibleModal onClose={() => setBibleOpen(false)} />}
    </>
  );
}
