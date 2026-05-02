import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ensureYoutubeIframeAPI } from '../lib/youtubeIframeApi.js';

function formatListenTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const ss = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  return `${m}:${String(ss).padStart(2, '0')}`;
}

/**
 * פס נגינה מינימלי — שורה דקה + כדור אדום.
 * שמע ישיר: <audio> + גרירה.
 * YouTube: IFrame API (זמן אמיתי + seek), נגן מוסתר (בלי וידאו גלוי).
 */
export default function HomeLiveListenTransport({ tabKey, directUrl, youtubeVideoId = '' }) {
  const audioRef = useRef(null);
  const ytPlayerRef = useRef(null);
  const ytHostIdRef = useRef(`home-live-yt-${Math.random().toString(36).slice(2, 11)}`);
  const ytPollRef = useRef(null);
  const scrubbingRef = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  /** null = עקוב אחרי הנגן; מספר = ערך בזמן גרירה */
  const [scrubOverride, setScrubOverride] = useState(null);
  const [ytLoadError, setYtLoadError] = useState('');

  const direct = String(directUrl || '').trim();
  const ytId = String(youtubeVideoId || '').trim();
  const youtubeOnly = Boolean(ytId && !direct);

  useEffect(() => {
    if (!direct) return undefined;
    const el = audioRef.current;
    if (!el) return undefined;
    el.src = direct;
    const onTime = () => {
      setCurrentSec(el.currentTime);
      setPlaying(!el.paused);
    };
    const onDur = () => {
      const d = el.duration;
      setDurationSec(Number.isFinite(d) && d > 0 ? d : 0);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onDur);
    el.addEventListener('durationchange', onDur);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onPause);
    /** בלי autoplay — נגינה רק בלחיצה על כפתור הנגן בפס התחבורה */
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onDur);
      el.removeEventListener('durationchange', onDur);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onPause);
      el.pause();
      el.removeAttribute('src');
      try {
        el.load();
      } catch {
        /* ignore */
      }
    };
  }, [tabKey, direct]);

  useEffect(() => {
    if (!youtubeOnly) return undefined;

    let cancelled = false;
    setYtLoadError('');
    setCurrentSec(0);
    setDurationSec(0);
    setPlaying(false);
    setScrubOverride(null);
    scrubbingRef.current = false;
    ytPlayerRef.current = null;

    const hostId = ytHostIdRef.current;

    ensureYoutubeIframeAPI()
      .then(() => {
        if (cancelled) return;
        if (!window.YT?.Player) {
          setYtLoadError('טעינת ספריית YouTube נכשלה');
          return;
        }

        new window.YT.Player(hostId, {
          videoId: ytId,
          width: 320,
          height: 180,
          playerVars: {
            autoplay: 0,
            mute: 1,
            controls: 0,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            iv_load_policy: 3,
            enablejsapi: 1,
          },
          events: {
            onReady: ev => {
              if (cancelled) return;
              ytPlayerRef.current = ev.target;
              try {
                const d = ev.target.getDuration();
                if (Number.isFinite(d) && d > 0) setDurationSec(d);
              } catch {
                /* ignore */
              }
              /** בלי playVideo אוטומטי — המשתמש לוחץ ▶ בפס התחבורה */
              if (cancelled) return;
              if (ytPollRef.current != null) window.clearInterval(ytPollRef.current);
              ytPollRef.current = window.setInterval(() => {
                if (cancelled || scrubbingRef.current) return;
                const pl = ytPlayerRef.current;
                if (!pl?.getCurrentTime) return;
                try {
                  const c = pl.getCurrentTime();
                  const d = pl.getDuration();
                  if (Number.isFinite(c)) setCurrentSec(c);
                  if (Number.isFinite(d) && d > 0) setDurationSec(d);
                } catch {
                  /* ignore */
                }
              }, 200);
            },
            onStateChange: ev => {
              if (cancelled) return;
              const YT = window.YT;
              if (!YT) return;
              const st = ev.data;
              setPlaying(st === YT.PlayerState.PLAYING || st === YT.PlayerState.BUFFERING);
            },
            onError: () => {
              if (cancelled) return;
              setYtLoadError('לא ניתן להפעיל את הסרטון מ-YouTube');
            },
          },
        });
      })
      .catch(() => {
        if (!cancelled) setYtLoadError('טעינת נגן YouTube נכשלה');
      });

    return () => {
      cancelled = true;
      if (ytPollRef.current != null) {
        window.clearInterval(ytPollRef.current);
        ytPollRef.current = null;
      }
      const pl = ytPlayerRef.current;
      ytPlayerRef.current = null;
      if (pl?.destroy) {
        try {
          pl.destroy();
        } catch {
          /* ignore */
        }
      }
    };
  }, [tabKey, youtubeOnly, ytId]);

  useEffect(() => {
    if (!youtubeOnly) return undefined;
    const end = () => {
      if (!scrubbingRef.current) return;
      scrubbingRef.current = false;
      setScrubOverride(null);
    };
    window.addEventListener('pointerup', end, true);
    window.addEventListener('pointercancel', end, true);
    return () => {
      window.removeEventListener('pointerup', end, true);
      window.removeEventListener('pointercancel', end, true);
    };
  }, [youtubeOnly]);

  const togglePlay = useCallback(() => {
    if (direct) {
      const el = audioRef.current;
      if (!el) return;
      if (el.paused) {
        const p = el.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } else el.pause();
      return;
    }
    const pl = ytPlayerRef.current;
    if (!pl?.getPlayerState) return;
    const YT = window.YT;
    if (!YT) return;
    const st = pl.getPlayerState();
    if (st === YT.PlayerState.PLAYING) pl.pauseVideo();
    else {
      try {
        pl.unMute();
      } catch {
        /* ignore */
      }
      pl.playVideo();
    }
  }, [direct]);

  const onScrubDirect = useCallback(e => {
    const el = audioRef.current;
    if (!el) return;
    const v = Number(e.target.value);
    if (Number.isFinite(v)) el.currentTime = Math.max(0, v);
  }, []);

  const onScrubYt = useCallback(e => {
    const pl = ytPlayerRef.current;
    if (!pl?.seekTo) return;
    const v = Number(e.target.value);
    if (!Number.isFinite(v)) return;
    setScrubOverride(v);
    try {
      pl.seekTo(Math.max(0, v), true);
    } catch {
      /* ignore */
    }
  }, []);

  const onRailPointerDown = useCallback(() => {
    if (!youtubeOnly) return;
    scrubbingRef.current = true;
    setScrubOverride(currentSec);
  }, [youtubeOnly, currentSec]);

  if (!direct && !ytId) return null;

  const rangeMax = Math.max(durationSec || 0, 0.01);
  const baseVal = Math.min(Math.max(0, currentSec), rangeMax);
  const rangeVal = scrubOverride != null ? Math.min(Math.max(0, scrubOverride), rangeMax) : baseVal;

  const ytPortal =
    youtubeOnly && typeof document !== 'undefined' && document.body
      ? createPortal(
          <div
            className="home-live-transport-yt-portal-root"
            aria-hidden="true"
            style={{
              position: 'fixed',
              left: '-4000px',
              top: 0,
              width: 320,
              height: 180,
              opacity: 0,
              pointerEvents: 'none',
              zIndex: 0,
              overflow: 'hidden',
            }}
          >
            <div id={ytHostIdRef.current} className="home-live-transport-yt-player-mount" />
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={`home-live-transport home-live-transport--slim${youtubeOnly ? ' home-live-transport--youtube-audio' : ''}`} dir="ltr">
      {ytPortal}

      <div className="home-live-transport-slim-row">
        {direct ? <audio ref={audioRef} preload="metadata" playsInline className="home-live-transport-audio-el" /> : null}

        {direct || youtubeOnly ? (
          <button type="button" className="home-live-transport-slim-play" onClick={togglePlay} aria-label={playing ? 'השהה' : 'נגן'}>
            {playing ? '❚❚' : '▶'}
          </button>
        ) : null}

        <div className="home-live-transport-rail">
          {direct ? (
            <input
              type="range"
              className="home-live-transport-range home-live-transport-range--red"
              min={0}
              max={rangeMax}
              step={0.2}
              value={rangeVal}
              onChange={onScrubDirect}
              aria-label="מיקום בקטע"
            />
          ) : (
            <input
              type="range"
              className="home-live-transport-range home-live-transport-range--red"
              min={0}
              max={rangeMax}
              step={0.25}
              value={rangeVal}
              onPointerDown={onRailPointerDown}
              onChange={onScrubYt}
              disabled={Boolean(ytLoadError)}
              aria-label="מיקום בקטע — YouTube"
            />
          )}
        </div>

        {direct || youtubeOnly ? (
          <span className="home-live-transport-times-slim" aria-live="polite">
            {formatListenTime(rangeVal)}
            <span className="home-live-transport-times-sep"> / </span>
            {formatListenTime(durationSec)}
          </span>
        ) : null}
      </div>
      {ytLoadError ? (
        <p className="home-live-transport-yt-err" dir="rtl">
          {ytLoadError}
        </p>
      ) : null}
    </div>
  );
}
