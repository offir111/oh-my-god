import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAppStore } from '../../store/appStore.js';

function linkClass({ isActive }) {
  return 'site-quick-nav__link' + (isActive ? ' site-quick-nav__link--active' : '');
}

export default function SiteQuickNav() {
  const { pathname, hash, search } = useLocation();
  const debate = useAppStore(s => s.debate);
  const user = useAppStore(s => s.user);

  const chatActive = pathname === '/faith' && (hash === '#chat' || hash === '');
  const faithDedActive = pathname === '/faith' && hash === '#rabbi';
  const aiNavActive =
    (pathname === '/lobby' && new URLSearchParams(search).get('ai') === '1') ||
    (Boolean(debate?.isAI) && debate?.id && pathname === `/debate/${debate.id}`);

  const hasFullSession =
    Boolean(user?.username) && (user.side === 'believer' || user.side === 'atheist');
  /** בלי ?logo= הלוגין מפנה מחוברים ללובי — אותה התנהגות כמו לחיצת לוגו בראש המסך */
  const homePath = hasFullSession ? '/login?logo=nav' : '/login';
  const homeActive = pathname === '/login';

  return (
    <nav className="site-quick-nav" aria-label="ניווט בין דפים">
      <div className="site-quick-nav__inner">
        <NavLink
          to="/faith#chat"
          className={() =>
            'site-quick-nav__link' + (chatActive ? ' site-quick-nav__link--active' : '')}
          aria-label="צ׳אט בדת ואמונה"
        >
          צ׳אט
        </NavLink>
        <NavLink to="/knowledge" className={linkClass}>
          מאגר מידע
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
    </nav>
  );
}
