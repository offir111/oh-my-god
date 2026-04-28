import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/appStore.js';

function navClass({ isActive }) {
  return 'navbar-link' + (isActive ? ' navbar-link--active' : '');
}

export default function Navbar() {
  const user = useAppStore(s => s.user);
  const navigate = useNavigate();
  const location = useLocation();
  const homeOnly = location.pathname.startsWith('/knowledge');

  const sideLabel = user?.side === 'believer' ? 'מאמין' : 'אתאיסט';
  const sideColor = user?.side === 'believer' ? 'var(--believer)' : 'var(--atheist)';

  /** דף הבית — לא מנתק מהחשבון (התנתקות מלאה רק מעיגול המשתמש) */
  function goHome() {
    navigate('/login', { state: { homeResetAt: Date.now() } });
  }

  return (
    <nav className="navbar" aria-label="ניווט ראשי">
      {!homeOnly && (
        <div className="navbar-links">
          <NavLink to="/lobby" end className={navClass}>
            לובי
          </NavLink>
          <NavLink to="/knowledge" className={navClass}>
            מאגר ידע
          </NavLink>
          <NavLink to="/leaderboard" className={navClass}>
            טבלת מובילים
          </NavLink>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginInlineStart: homeOnly ? 'auto' : undefined }}>
        {user && !homeOnly && (
          <div className="navbar-score" aria-live="polite">
            <span style={{ color: sideColor, fontWeight: 700, marginLeft: 6 }}>{sideLabel}</span>
            {user.username} | <span>{user.score || 0} נק׳</span>
          </div>
        )}
        <button
          type="button"
          className="btn btn-ghost"
          style={{ padding: '8px 16px', fontSize: '0.84rem' }}
          onClick={goHome}
          title="מעבר לדף הבית (נשארים מחוברים)"
        >
          דף הבית
        </button>
      </div>
    </nav>
  );
}
