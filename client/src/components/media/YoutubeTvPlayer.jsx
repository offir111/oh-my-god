import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { ensureYoutubeIframeAPI } from '../../lib/youtubeIframeApi.js';
import { applyYoutubeEmbedPlaybackParams } from '../../lib/ytStationsLocal.js';

export function youtubeEmbedVideoId(ytTvUrl) {
  if (!ytTvUrl || typeof ytTvUrl !== 'string') return null;
  try {
    const u = new URL(ytTvUrl);
    if (u.pathname.includes('live_stream')) return null;
    const m = u.pathname.match(/\/embed\/([^/?]+)/);
    return m?.[1] || null;
  } catch {
    return null;
  }
}

const IFRAME_ALLOW =
  'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';

function FallbackIframe({ src, className, style }) {
  return (
    <iframe
      className={className}
      style={style}
      src={applyYoutubeEmbedPlaybackParams(src)}
      title="YouTube"
      allow={IFRAME_ALLOW}
      allowFullScreen
    />
  );
}

export default function YoutubeTvPlayer({ ytTvUrl, className, style }) {
  const hostRef = useRef(null);
  const playerRef = useRef(null);
  const [apiFailed, setApiFailed] = useState(false);
  const [muted, setMuted] = useState(true);
  const videoId = youtubeEmbedVideoId(ytTvUrl);

  useLayoutEffect(() => {
    if (!ytTvUrl || !videoId) {
      setApiFailed(false);
      setMuted(true);
      return undefined;
    }

    const el = hostRef.current;
    if (!el) return undefined;

    let cancelled = false;
    setApiFailed(false);
    setMuted(true);

    ensureYoutubeIframeAPI()
      .then(() => {
        if (cancelled || !hostRef.current) return;
        if (!window.YT?.Player) { setApiFailed(true); return; }
        try { playerRef.current?.destroy?.(); } catch { /* ignore */ }
        playerRef.current = null;
        el.innerHTML = '';

        const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
        playerRef.current = new window.YT.Player(el, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 1,
            mute: 1,
            playsinline: 1,
            enablejsapi: 1,
            ...(origin ? { origin } : {}),
            rel: 0,
            modestbranding: 1,
          },
          events: {
            onReady: (e) => {
              if (cancelled) return;
              try { e.target.playVideo(); } catch { /* ignore */ }
            },
          },
        });
      })
      .catch(() => { if (!cancelled) setApiFailed(true); });

    return () => {
      cancelled = true;
      try { playerRef.current?.destroy?.(); } catch { /* ignore */ }
      playerRef.current = null;
      if (hostRef.current) hostRef.current.innerHTML = '';
    };
  }, [ytTvUrl, videoId]);

  const handleUnmute = useCallback(() => {
    const pl = playerRef.current;
    if (!pl) return;
    try {
      pl.unMute();
      pl.setVolume(100);
      setMuted(false);
    } catch { /* ignore */ }
  }, []);

  if (!ytTvUrl) return null;

  if (!videoId || apiFailed) {
    return <FallbackIframe src={ytTvUrl} className={className} style={style} />;
  }

  return (
    <div
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', ...style }}
      className={className}
    >
      <div
        ref={hostRef}
        style={{ width: '100%', height: '100%' }}
      />
      {muted && (
        <button
          type="button"
          onClick={handleUnmute}
          aria-label="הפעל שמע"
          style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            background: 'rgba(0,0,0,0.75)',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: 20,
            color: '#fff',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: 'pointer',
            zIndex: 10,
            backdropFilter: 'blur(4px)',
          }}
        >
          🔊 הפעל שמע
        </button>
      )}
    </div>
  );
}
