import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/appStore.js';
import { disconnectSocket } from '../../socket.js';

export default function Navbar() {
  const user = useAppStore(s => s.user);
  const setUser = useAppStore(s => s.setUser);
  const resetDebate = useAppStore(s => s.resetDebate);
  const navigate = useNavigate();

  const sideLabel = user?.side === 'believer' ? 'מאמין' : 'אתאיסט';
  const sideColor = user?.side === 'believer' ? 'var(--believer)' : 'var(--atheist)';

  function logout() {
    disconnectSocket();
    setUser(null);
    resetDebate();
    navigate('/');
  }

  return (
    <nav className="navbar">
      <Link to="/lobby" className="navbar-brand">oh my GOD</Link>
      <div className="navbar-links">
        <Link to="/lobby">לובי</Link>
        <Link to="/knowledge">מאגר ידע</Link>
        <Link to="/leaderboard">טבלת מובילים</Link>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {user && (
          <div className="navbar-score">
            <span style={{ color: sideColor, fontWeight: 700, marginLeft: 6 }}>{sideLabel}</span>
            {user.username} | <span>{user.score || 0} נק׳</span>
          </div>
        )}
        <button className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: '0.85rem' }} onClick={logout}>
          יציאה
        </button>
      </div>
    </nav>
  );
}
