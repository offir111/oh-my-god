import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAppStore } from '../../store/appStore.js';

/** אותם יעדי ניווט כמו בשורת ה־site-quick-nav — בפוטר כטבים ברורים ולחיצים */
export default function QuickNavInlineLinks({ style }) {
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
  const homePath = hasFullSession ? '/login?logo=nav' : '/login';
  const homeActive = pathname === '/login';

  function cn(...parts) {
    return parts.filter(Boolean).join(' ');
  }

  return (
    <nav
      className="quick-nav-footer"
      aria-label="קישורים מהירים — כמו שורת הניווט העליונה"
      style={style}
    >
      <span className="quick-nav-footer__label">מעבר ל:</span>
      <div className="quick-nav-footer__pills">
        <NavLink
          to="/faith#chat"
          aria-label="צ׳אט בדת ואמונה"
          className={cn('quick-nav-footer__pill', chatActive && 'quick-nav-footer__pill--active')}
        >
          צ׳אט
        </NavLink>
        <NavLink
          to="/radio"
          aria-label="רדיו — שידורים מישראל"
          className={({ isActive }) =>
            cn('quick-nav-footer__pill', isActive && 'quick-nav-footer__pill--active')}
        >
          רדיו
        </NavLink>
        <NavLink
          to="/knowledge"
          className={({ isActive }) =>
            cn('quick-nav-footer__pill', isActive && 'quick-nav-footer__pill--active')}
        >
          מאגר ידע
        </NavLink>
        <NavLink
          to="/faith#rabbi"
          aria-label="דת ואמונה — שאלת רב"
          className={cn('quick-nav-footer__pill', faithDedActive && 'quick-nav-footer__pill--active')}
        >
          דת
        </NavLink>
        <NavLink
          to="/lobby?ai=1"
          aria-label="שיחה מול AI"
          className={cn('quick-nav-footer__pill', aiNavActive && 'quick-nav-footer__pill--active')}
        >
          AI
        </NavLink>
        <NavLink
          to="/live-events"
          className={({ isActive }) =>
            cn('quick-nav-footer__pill', isActive && 'quick-nav-footer__pill--active')}
        >
          רב VS מדען
        </NavLink>
        <NavLink
          to={homePath}
          aria-label="דף הבית — מסך הכניסה"
          className={cn('quick-nav-footer__pill', homeActive && 'quick-nav-footer__pill--active')}
        >
          דף הבית
        </NavLink>
      </div>
    </nav>
  );
}
