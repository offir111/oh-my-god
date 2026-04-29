import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAppStore } from '../../store/appStore.js';

function navClass({ isActive }) {
  return 'navbar-link' + (isActive ? ' navbar-link--active' : '');
}

export default function Navbar() {
  const user = useAppStore(s => s.user);
  const location = useLocation();

  /** בדף הבית (/login) אין צורך בשורת הניווט המלאה */
  if (location.pathname === '/login') return null;

  /** מאגר ידע: רק כפתור דף הבית הופיע כאן; חזרה לדף הבית דרך הלוגו בכותרת */
  if (location.pathname.startsWith('/knowledge')) return null;

  const sideLabel = user?.side === 'believer' ? 'מאמין' : 'אתאיסט';
  const sideColor = user?.side === 'believer' ? 'var(--believer)' : 'var(--atheist)';

  return (
    <nav className="navbar" aria-label="ניווט ראשי">
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="navbar-score" aria-live="polite">
          <span style={{ color: sideColor, fontWeight: 700, marginLeft: 6 }}>{sideLabel}</span>
          {user.username} | <span>{user.score || 0} נק׳</span>
        </div>
      </div>
    </nav>
  );
}
