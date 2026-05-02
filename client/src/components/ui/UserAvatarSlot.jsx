import React from 'react';

function initialLetter(displayName) {
  const s = String(displayName || '').trim();
  if (!s) return '?';
  const arr = [...s];
  return arr[0] || '?';
}

/**
 * Small profile tile (letter or image) — shown before display names (RTL: visually to the right of the name text when placed first in a row).
 * @param {'sm'|'md'|'chat'} [size='md'] — 22px / 26px / 28px
 */
export default function UserAvatarSlot({
  displayName,
  avatarUrl,
  size = 'md',
  className = '',
  title: titleProp,
  ...rest
}) {
  const safeName = String(displayName || '').trim() || 'אורח';
  const url = typeof avatarUrl === 'string' && avatarUrl.trim() ? avatarUrl.trim() : '';
  const title = titleProp ?? safeName;
  const sizeClass =
    size === 'sm' || size === 'md' || size === 'chat' ? `user-avatar-slot--${size}` : 'user-avatar-slot--md';
  return (
    <span
      className={`user-avatar-slot ${sizeClass} ${className}`.trim()}
      title={title}
      aria-hidden="true"
      {...rest}
    >
      {url ? (
        <img src={url} alt="" />
      ) : (
        <span className="user-avatar-slot__letter">{initialLetter(safeName)}</span>
      )}
    </span>
  );
}
