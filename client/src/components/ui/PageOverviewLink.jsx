import React from 'react';

/** אייקון קישור לעוגן #page-overview — גלילה חלקה מתחת לכותרת הקבועה. */
export default function PageOverviewLink({ className = '', title = 'סקירת העמוד', stopPropagation = false }) {
  return (
    <a
      href="#page-overview"
      className={`page-overview-link${className ? ` ${className}` : ''}`}
      aria-label={title}
      title={title}
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation();
        const el = document.getElementById('page-overview');
        if (!el) return;
        e.preventDefault();
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M8 6h13" />
        <path d="M8 12h13" />
        <path d="M8 18h13" />
        <path d="M3 6h.01" />
        <path d="M3 12h.01" />
        <path d="M3 18h.01" />
      </svg>
    </a>
  );
}
