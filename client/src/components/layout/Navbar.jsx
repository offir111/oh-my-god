import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAppStore } from '../../store/appStore.js';

export default function Navbar() {
  const user = useAppStore(s => s.user);
  const location = useLocation();

  const hiddenPaths = ['/login', '/faith', '/leaderboard', '/live-events', '/settings', '/terms', '/contact'];
  if (hiddenPaths.some(p => location.pathname === p || location.pathname.startsWith(p + '/'))) return null;
  if (location.pathname.startsWith('/knowledge')) return null;
  if (location.pathname.startsWith('/spectate')) return null;

  const sideLabel = user?.side === 'believer' ? 'מאמין' : 'אתאיסט';
  const sideColor = user?.side === 'believer' ? 'var(--believer)' : 'var(--atheist)';

  return (
    <nav className="navbar" aria-label="סטטוס משתמש">
      <div className="navbar-links navbar-links--score-only">
        <div className="navbar-score" aria-live="polite">
          <span style={{ color: sideColor, fontWeight: 700, marginLeft: 6 }}>{sideLabel}</span>
          {user.username} | <span>{user.score || 0} נק׳</span>
        </div>
      </div>
    </nav>
  );
}
