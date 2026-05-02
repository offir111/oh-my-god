import React, { useEffect, useRef } from 'react';

/** נגן HTML5 לקישור שמע ישיר (mp3, m4a, ogg וכו׳) — ניסיון ניגון אוטומטי אחרי לחיצה על הטאב */
export default function HomeLiveListenAudio({ src, title = 'הרצאה קולית' }) {
  const audioRef = useRef(null);
  const clean = String(src || '').trim();

  useEffect(() => {
    if (!clean) return undefined;
    const el = audioRef.current;
    if (!el) return undefined;
    el.pause();
    el.currentTime = 0;
    const playAttempt = el.play();
    if (playAttempt && typeof playAttempt.catch === 'function') {
      playAttempt.catch(() => {
        /* דפדפן חוסם autoplay — המשתמש ילחץ ▶ */
      });
    }
    return () => {
      el.pause();
    };
  }, [clean]);

  if (!clean) return null;

  return (
    <div className="home-live-audio-block">
      <p className="home-live-audio-label">{title}</p>
      <audio
        ref={audioRef}
        className="home-live-audio-native"
        controls
        src={clean}
        preload="metadata"
      >
        הדפדפן שלך לא תומך בנגן שמע מוטמע.
      </audio>
    </div>
  );
}
