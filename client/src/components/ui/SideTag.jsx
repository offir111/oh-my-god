import React from 'react';

export default function SideTag({ side, size = 'md' }) {
  const label = side === 'believer' ? 'מאמין' : 'אתאיסט';
  const cls = `badge badge-${side}`;
  return <span className={cls}>{label}</span>;
}
