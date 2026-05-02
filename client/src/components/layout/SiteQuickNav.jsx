import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/appStore.js';

function linkClass({ isActive }) {
  return 'site-quick-nav__link' + (isActive ? ' site-quick-nav__link--active' : '');
}

export default function SiteQuickNav() {
  const { pathname, hash, search } = useLocation();
  const navigate = useNavigate();
  const debate = useAppStore(s => s.debate);
  const user = useAppStore(s => s.user);
  const pendingUser = useAppStore(s => s.pendingUser);

  if (!user && !pendingUser) return null;

  const chatActive = pathname === '/faith' && (hash === '#chat' || hash === '');
  const faithDedActive = pathname === '/faith' && hash === '#rabbi';
  const aiNavActive =
    (pathname === '/lobby' && new URLSearchParams(search).get('ai') === '1') ||
    (Boolean(debate?.isAI) && debate?.id && pathname === `/debate/${debate.id}`);

  const hasFullSession =
    Boolean(user?.username) && (user.side === 'believer' || user.side === 'atheist');
  const homePath = hasFullSession ? '/login?logo=nav' : '/login';
  const homeActive = pathname === '/login';

  const profileNavUsername = String(user?.username || pendingUser?.username || '').trim();
  const canOpenProfileNav = profileNavUsername.length >= 2;
  const profilePath = canOpenProfileNav
    ? `/profile/${encodeURIComponent(profileNavUsername)}`
    : null;
  const profileActive = pathname.startsWith('/profile/');

  return (
    <nav className="site-quick-nav" aria-label="ניווט בין דפים">
      <div className="site-quick-nav__inner">

        {/* ── שורה עליונה ── */}
        <div className="site-quick-nav__row">
          <NavLink
            to="/faith#chat"
            className={() =>
              'site-quick-nav__link' + (chatActive ? ' site-quick-nav__link--active' : '')}
            aria-label="צ׳אט בדת ואמונה"
          >
            צ׳אט
          </NavLink>
          <NavLink to="/knowledge" className={linkClass}>
            מאגר ידע
          </NavLink>
          <NavLink
            to="/faith#rabbi"
            className={() =>
              'site-quick-nav__link' + (faithDedActive ? ' site-quick-nav__link--active' : '')}
            aria-label="דת ואמונה — שאלת רב"
          >
            דת
          </NavLink>
          <NavLink
            to="/lobby?ai=1"
            className={() =>
              'site-quick-nav__link' + (aiNavActive ? ' site-quick-nav__link--active' : '')}
            aria-label="שיחה מול AI — דיון מול בינה מלאכותית"
            onClick={(!user && pendingUser?.username) ? (e) => {
              e.preventDefault();
              navigate('/login', { state: { autoAI: true } });
            } : undefined}
          >
            AI
          </NavLink>
          <NavLink to="/live-events" className={linkClass}>
            רב VS מדען
          </NavLink>
          <NavLink
            to={homePath}
            className={() =>
              'site-quick-nav__link' + (homeActive ? ' site-quick-nav__link--active' : '')}
            aria-label="דף הבית — מסך הכניסה"
          >
            דף הבית
          </NavLink>
        </div>

        {/* ── שורה תחתונה ── */}
        <div className="site-quick-nav__row">
          <NavLink to="/blog" className={linkClass}>
            בלוגים
          </NavLink>
          <NavLink to="/podcast" className={linkClass}>
            פודקאסט LIVE
          </NavLink>
          <NavLink to="/video-live" className={linkClass}>
            וידיאו+LIVE TV
          </NavLink>
          <NavLink to="/photos" className={linkClass}>
            תמונות
          </NavLink>
          {canOpenProfileNav ? (
            <NavLink
              to={profilePath}
              className={() =>
                'site-quick-nav__link' + (profileActive ? ' site-quick-nav__link--active' : '')}
              aria-label="הפרופיל שלי"
            >
              פרופיל
            </NavLink>
          ) : (
            <span
              className={
                'site-quick-nav__link site-quick-nav__link--nav-disabled' +
                (profileActive ? ' site-quick-nav__link--active' : '')
              }
              aria-label="אין שם משתמש לקישור פרופיל"
              title="התחבר כדי לפתוח את הפרופיל"
            >
              פרופיל
            </span>
          )}
        </div>

      </div>
    </nav>
  );
}
