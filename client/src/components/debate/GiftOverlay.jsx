import React from 'react';
import { useGifts } from '../../hooks/useGifts.js';
import { useAppStore } from '../../store/appStore.js';

export default function GiftOverlay({ mySide }) {
  const gifts = useGifts();
  const myGifts = gifts.filter(g => g.targetSide === mySide);

  return (
    <div style={{ position: 'fixed', bottom: 80, left: 0, right: 0, pointerEvents: 'none', zIndex: 500 }}>
      {myGifts.map(g => (
        <span
          key={g.uid}
          className="gift-emoji"
          style={{
            left: `${20 + Math.random() * 60}%`,
            bottom: 0,
            position: 'absolute',
          }}
        >
          {g.emoji}
        </span>
      ))}
    </div>
  );
}
