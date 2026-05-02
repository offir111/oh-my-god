import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { useAppStore } from '../store/appStore.js';
import { getApiBaseUrl } from '../lib/apiBaseUrl.js';
import { getLikes, saveLikes, getComments, saveComments, fmtDate } from '../lib/blogReactions.js';

/* ─── proxy helper ─────────────────────────────────────── */
function tvProxyUrl(m3u8) {
  return `${getApiBaseUrl()}/api/tv-proxy?url=${encodeURIComponent(m3u8)}`;
}

/* ─── Channel definitions ──────────────────────────────── */
const IL_CHANNELS = [
  {
    id: 'kan11', name: 'כאן 11', flag: '🇮🇱',
    hlsUrl: 'https://kancdn.medonecdn.net/livehls/oil/kancdn-live/live/kan11/live.livx/playlist.m3u8',
  },
  {
    id: 'kannews', name: 'כאן NEWS', flag: '🇮🇱',
    hlsUrl: 'https://mabatlive.media.kan.org.il/hls/live/2024516/kan_mabatlive/master.m3u8',
  },
  {
    id: 'ch13', name: 'ערוץ 13', flag: '🇮🇱',
    hlsUrl: 'https://d2xg1g9o5vns8m.cloudfront.net/out/v1/0855d703f7d5436fae6a9c7ce8ca5075/index.m3u8',
  },
  {
    id: 'ch14', name: 'ערוץ 14', flag: '🇮🇱',
    hlsUrl: 'https://r.il.cdn-redge.media/livehls/oil/ch14/live/ch14/live.livx/playlist.m3u8',
  },
  {
    id: 'i24heb', name: 'i24 NEWS עברית', flag: '🇮🇱',
    hlsUrl: 'https://bcovlive-a.akamaihd.net/d89ede8094c741b7924120b27764153c/eu-central-1/5377161796001/profile_0/chunklist.m3u8',
  },
  {
    id: 'hidabroot', name: 'הידברות', flag: '🇮🇱',
    hlsUrl: 'https://cdn.cybercdn.live/HidabrootIL/Live97/playlist.m3u8',
  },
  {
    id: 'knesset', name: 'ערוץ הכנסת', flag: '🇮🇱',
    hlsUrl: 'https://contact.gostreaming.tv/Knesset/myStream/playlist.m3u8',
  },
];

const WORLD_CHANNELS = [
  {
    id: 'france24', name: 'France 24', flag: '🇫🇷',
    hlsUrl: 'https://live.france24.com/hls/live/2037218/F24_EN_HI_HLS/master_5000.m3u8',
  },
  {
    id: 'alj', name: 'Al Jazeera', flag: '🌍',
    hlsUrl: 'https://live-hls-apps-aje-fa.getaj.net/AJE/index.m3u8',
  },
  {
    id: 'dw', name: 'DW News', flag: '🇩🇪',
    hlsUrl: 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/master.m3u8',
  },
  {
    id: 'bloomberg', name: 'Bloomberg', flag: '🇺🇸',
    hlsUrl: 'https://bloomberg.com/media-manifest/streams/us.m3u8',
  },
  {
    id: 'euronews', name: 'Euronews', flag: '🇪🇺',
    hlsUrl: 'https://rakuten-euronews-1-eu.samsung.wurl.tv/manifest/playlist.m3u8',
  },
  {
    id: 'nasa', name: 'NASA TV', flag: '🚀',
    hlsUrl: 'https://nasa-i.akamaihd.net/hls/live/253565/NASA-NTV1-HLS/master.m3u8',
  },
  {
    id: 'bloomorig', name: 'Bloomberg Originals', flag: '🇺🇸',
    hlsUrl: 'https://86fdc85a.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/TEctZ2JfQmxvb21iZXJnT3JpZ2luYWxzX0hMUw/playlist.m3u8',
  },
  {
    id: 'ajbalkan', name: 'Al Jazeera Balkans', flag: '🌍',
    hlsUrl: 'https://live-hls-web-ajb.getaj.net/AJB/index.m3u8',
  },
];

/* ─── HLS Player component ─────────────────────────────── */
function HLSPlayer({ src, channelName, muted, onUnmute }) {
  const videoRef     = useRef(null);
  const containerRef = useRef(null);
  const hlsRef       = useRef(null);
  const [status,  setStatus]  = useState('loading');
  const [isFs,    setIsFs]    = useState(false);

  useEffect(() => {
    const onFsChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    setStatus('loading');
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    video.src = '';

    if (Hls.isSupported()) {
      const hls = new Hls({ startLevel: -1, maxMaxBufferLength: 30, enableWorker: true });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { setStatus('playing'); video.play().catch(() => {}); });
      hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) setStatus('error'); });
      return () => { hls.destroy(); hlsRef.current = null; };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      const onMeta = () => { setStatus('playing'); video.play().catch(() => {}); };
      const onErr  = () => setStatus('error');
      video.addEventListener('loadedmetadata', onMeta);
      video.addEventListener('error', onErr);
      return () => { video.removeEventListener('loadedmetadata', onMeta); video.removeEventListener('error', onErr); };
    } else {
      setStatus('error');
    }
  }, [src]);

  // keep video.muted in sync with prop
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen().catch(() => {});
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%', background: '#000', borderRadius: 'inherit' }}>
      {status === 'loading' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, zIndex: 2 }}>
          <span style={{ fontSize: '2rem' }}>📡</span>
          <span style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 700 }}>מתחבר לשידור…</span>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{channelName}</span>
        </div>
      )}
      {status === 'error' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, zIndex: 2 }}>
          <span style={{ fontSize: '2rem' }}>📵</span>
          <span style={{ fontSize: '0.85rem', color: '#fca5a5', fontWeight: 700 }}>השידור לא זמין כרגע</span>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>נסה ערוץ אחר</span>
        </div>
      )}
      {/* Unmute overlay — shown until user taps */}
      {status === 'playing' && muted && (
        <div
          onClick={onUnmute}
          style={{
            position: 'absolute', inset: 0, zIndex: 5, cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
            background: 'rgba(0,0,0,0.45)',
          }}
        >
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            background: 'rgba(0,0,0,0.72)', border: '1.5px solid rgba(251,191,36,0.55)',
            borderRadius: 9, padding: '9px 14px', backdropFilter: 'blur(6px)',
          }}>
            <span style={{ fontSize: '1.1rem' }}>🔇</span>
            <span style={{ fontSize: '0.48rem', fontWeight: 900, color: '#fbbf24' }}>לחץ להפעלת סאונד</span>
            <span style={{ fontSize: '0.35rem', color: '#94a3b8' }}>הדפדפן דורש אישור ראשוני</span>
          </div>
        </div>
      )}
      <video
        ref={videoRef}
        controls
        playsInline
        muted
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: status === 'error' ? 'none' : 'block' }}
      />
      {/* Fullscreen button */}
      <button
        type="button"
        onClick={toggleFullscreen}
        title={isFs ? 'יציאה ממסך מלא' : 'מסך מלא'}
        style={{
          position: 'absolute', bottom: 10, left: 10, zIndex: 10,
          background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.25)',
          borderRadius: 7, padding: '5px 9px', cursor: 'pointer',
          color: '#fff', fontSize: '0.95rem', lineHeight: 1,
          backdropFilter: 'blur(4px)',
          display: status === 'error' ? 'none' : 'flex',
          alignItems: 'center', gap: 5,
        }}
      >
        {isFs ? '⛶' : '⛶'}
        <span style={{ fontSize: '0.65rem', fontWeight: 700 }}>{isFs ? 'צמצם' : 'הגדל'}</span>
      </button>
    </div>
  );
}

/* ─── Debate stream cards (kept below TV player) ──────── */
const STREAMS = [
  { id: 3, title: 'האבולוציה מול הבריאה',    host: 'פרופ׳ שפירא VS הרב רוזן', status: 'soon',  tag: 'בקרוב' },
  { id: 4, title: 'תפילה — מדע או רוחניות?', host: 'ד"ר גולן VS הרב כץ',      status: 'soon',  tag: 'בקרוב' },
  { id: 5, title: 'קבלה ופיזיקה קוונטית',    host: 'ד"ר מזרחי VS הרב פרידמן', status: 'ended', tag: 'הסתיים' },
  { id: 6, title: 'האם יש חיים אחרי המוות?', host: 'עו"ד שמיר VS הרב שרקי',  status: 'ended', tag: 'הסתיים' },
];

function StreamCard({ stream, username }) {
  const epId = `video-stream-${stream.id}`;
  const [likes,        setLikes]        = useState(() => getLikes(epId));
  const [comments,     setComments]     = useState(() => getComments(epId));
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [draft,        setDraft]        = useState('');
  const iLiked  = username && likes.includes(username);
  const isSoon  = stream.status === 'soon';
  const bg      = isSoon ? 'rgba(251,191,36,0.08)' : 'var(--card2)';
  const border  = isSoon ? 'rgba(251,191,36,0.35)' : 'var(--border)';
  const tagBg   = isSoon ? 'rgba(251,191,36,0.8)'  : 'rgba(255,255,255,0.12)';

  const handleLike = () => {
    if (!username) return;
    const next = iLiked ? likes.filter(u => u !== username) : [...likes, username];
    saveLikes(epId, next); setLikes(next);
  };
  const handleComment = () => {
    const body = draft.trim();
    if (!body || !username) return;
    const c = { id: `c-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, author: username, body, ts: Date.now() };
    const next = [...comments, c];
    saveComments(epId, next); setComments(next); setDraft('');
  };

  return (
    <div style={{ borderRadius: 10, border: `1.5px solid ${border}`, background: bg, display: 'flex', flexDirection: 'column', overflow: 'hidden', direction: 'rtl' }}>
      <div style={{ width: '100%', aspectRatio: '16/6.3', background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <span style={{ fontSize: '1.8rem', opacity: 0.35 }}>🎥</span>
        <div style={{ position: 'absolute', top: 5, right: 6, background: tagBg, borderRadius: 5, padding: '2px 7px', fontSize: '0.55rem', fontWeight: 800, color: isSoon ? '#1a1a0a' : '#fff' }}>{stream.tag}</div>
      </div>
      <div style={{ padding: '6px 10px 0', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--text)', lineHeight: 1.3 }}>{stream.title}</div>
        <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>{stream.host}</div>
        <button type="button" style={{ marginTop: 2, padding: '5px 0', borderRadius: 6, border: 'none', fontWeight: 800, fontSize: '0.62rem', cursor: isSoon ? 'pointer' : 'not-allowed', background: isSoon ? 'rgba(251,191,36,0.22)' : 'rgba(255,255,255,0.07)', color: isSoon ? '#fbbf24' : 'var(--muted)' }}>
          {isSoon ? '🔔 תזכורת לשידור' : 'הסתיים'}
        </button>
      </div>
      <div style={{ display: 'flex', gap: 3, padding: '5px 10px 4px', borderTop: '1px solid var(--border)', marginTop: 5 }}>
        <button type="button" onClick={handleLike} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 5, border: 'none', cursor: username ? 'pointer' : 'default', background: iLiked ? 'rgba(244,63,94,0.12)' : 'transparent', color: iLiked ? '#f43f5e' : 'var(--text-secondary)', fontSize: '0.65rem', fontWeight: 700 }}>{iLiked ? '❤️' : '🤍'} {likes.length}</button>
        <button type="button" onClick={() => setCommentsOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 5, border: 'none', cursor: 'pointer', background: commentsOpen ? 'rgba(99,102,241,0.1)' : 'transparent', color: commentsOpen ? 'var(--accent)' : 'var(--text-secondary)', fontSize: '0.65rem', fontWeight: 700 }}>💬 {comments.length}</button>
      </div>
      {commentsOpen && (
        <div style={{ padding: '4px 12px 12px' }}>
          {comments.length === 0
            ? <p style={{ margin: '0 0 8px', color: 'var(--muted)', fontSize: '0.78rem' }}>אין תגובות עדיין</p>
            : comments.map(cm => (
              <div key={cm.id} style={{ padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: 7, marginBottom: 2 }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--gold)' }}>{cm.author}</span>
                  <span style={{ fontSize: '0.63rem', color: 'var(--muted)' }}>{fmtDate(cm.ts)}</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{cm.body}</p>
              </div>
            ))
          }
          {username ? (
            <div style={{ display: 'flex', gap: 6, paddingTop: 7, alignItems: 'flex-end' }}>
              <textarea value={draft} onChange={e => setDraft(e.target.value.slice(0, 1000))} rows={2} placeholder="כתוב תגובה…" style={{ flex: 1, resize: 'none', padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--card)', color: 'var(--text)', fontFamily: 'inherit', fontSize: '0.8rem' }} />
              <button type="button" onClick={handleComment} disabled={!draft.trim()} style={{ padding: '6px 11px', borderRadius: 6, border: '1px solid rgba(99,102,241,0.4)', background: draft.trim() ? 'rgba(99,102,241,0.85)' : 'var(--card-hover)', color: '#fff', fontWeight: 800, fontSize: '0.78rem', cursor: draft.trim() ? 'pointer' : 'not-allowed', flexShrink: 0 }}>שלח</button>
            </div>
          ) : <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: 'var(--muted)' }}>יש להתחבר כדי להגיב</p>}
        </div>
      )}
    </div>
  );
}

/* ─── Main page ─────────────────────────────────────────── */
export default function VideoLivePage() {
  const user        = useAppStore(s => s.user);
  const pendingUser = useAppStore(s => s.pendingUser);
  const ytTvUrl     = useAppStore(s => s.ytTvUrl);
  const setYtTvUrl  = useAppStore(s => s.setYtTvUrl);
  const username    = user?.username || pendingUser?.username || '';

  const [activeCh, setActiveCh] = useState(() => IL_CHANNELS.find(c => c.id === 'hidabroot') ?? IL_CHANNELS[0]);
  const [muted, setMuted] = useState(true);
  const proxySrc = tvProxyUrl(activeCh.hlsUrl);

  const playerWrapRef = useRef(null);
  const [sidebarMaxH, setSidebarMaxH] = useState(null);

  useEffect(() => {
    const el = playerWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      setSidebarMaxH(entries[0].contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="tvpage" dir="rtl">
      <style>{`
        .tvpage { max-width: var(--app-shell-content-max, 920px); margin: 0 auto; padding: 16px var(--app-shell-gutter, 18px) 48px; box-sizing: border-box; }
        .tvpage__title { font-size: clamp(1rem, 3.5vw, 1.25rem); font-weight: 900; color: var(--gold); margin: 0 0 14px; display: flex; align-items: center; gap: 8px; }

        .tv-layout { display: grid; grid-template-columns: 1fr 190px; gap: 12px; margin-bottom: 28px; align-items: start; }
        @media (max-width: 620px) { .tv-layout { grid-template-columns: 1fr; } }

        .tv-player-wrap { border-radius: 14px; overflow: hidden; border: 1.5px solid rgba(251,191,36,0.3); box-shadow: 0 8px 36px rgba(0,0,0,0.6); background: #000; }
        .tv-player-screen { position: relative; width: 100%; aspect-ratio: 16/9; }
        .tv-player-bar { display: flex; align-items: center; gap: 8px; padding: 7px 12px; background: rgba(10,10,16,0.97); border-top: 1px solid rgba(255,255,255,0.07); }
        .tv-player-dot { width: 7px; height: 7px; border-radius: 50%; background: #ef4444; flex-shrink: 0; animation: tvPulse 1.4s ease-in-out infinite; }
        .tv-player-live { font-size: 0.6rem; font-weight: 900; letter-spacing: .1em; color: #ef4444; flex-shrink: 0; }
        .tv-player-name { font-size: 0.82rem; font-weight: 800; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        @keyframes tvPulse { 0%,100%{opacity:.5;transform:scale(.85)} 50%{opacity:1;transform:scale(1.15)} }

        .tv-sidebar { display: flex; flex-direction: column; gap: 0; overflow-y: auto; height: 100%; border-radius: 12px; border: 1px solid rgba(255,255,255,0.07); background: rgba(255,255,255,0.03); padding: 6px 4px; box-sizing: border-box; scrollbar-width: thin; scrollbar-color: rgba(251,191,36,0.3) transparent; }
        .tv-sidebar::-webkit-scrollbar { width: 4px; }
        .tv-sidebar::-webkit-scrollbar-track { background: transparent; }
        .tv-sidebar::-webkit-scrollbar-thumb { background: rgba(251,191,36,0.3); border-radius: 4px; }
        @media (max-width: 620px) { .tv-sidebar { flex-direction: row; flex-wrap: wrap; gap: 10px; height: auto; overflow-y: visible; } }

        .tv-sidebar-section { display: flex; flex-direction: column; gap: 2px; margin-bottom: 6px; }
        .tv-sidebar-label { font-size: 0.58rem; font-weight: 900; letter-spacing: .09em; color: var(--muted); padding: 4px 6px 3px; text-transform: uppercase; position: sticky; top: 0; background: rgba(10,10,16,0.95); z-index: 1; border-radius: 4px; }

        .tv-ch-btn { display: flex; align-items: center; gap: 7px; width: 100%; padding: 7px 10px; border-radius: 9px; border: 1px solid transparent; background: rgba(255,255,255,0.04); color: var(--text-secondary); font-size: 0.78rem; font-weight: 700; font-family: inherit; cursor: pointer; text-align: right; transition: background .12s, color .12s, border-color .12s; }
        .tv-ch-btn:hover { background: rgba(251,191,36,0.1); color: var(--text); }
        .tv-ch-btn--active { background: rgba(251,191,36,0.16); border-color: rgba(251,191,36,0.45); color: var(--gold); }
        @media (max-width: 620px) { .tv-ch-btn { width: auto; } }

        .tv-streams-label { font-size: 0.85rem; font-weight: 900; color: var(--text-secondary); margin: 0 0 12px; }
        .tv-streams-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 14px; }
        @media (max-width: 500px) { .tv-streams-grid { grid-template-columns: 1fr; } }
      `}</style>

      <h1 className="tvpage__title">📺 טלוויזיה LIVE</h1>

      <div className="tv-layout">

        {/* ── Player ── */}
        <div className="tv-player-wrap" ref={playerWrapRef}>
          <div className="tv-player-screen">
            {ytTvUrl ? (
              <iframe
                src={ytTvUrl}
                style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                title="YouTube"
              />
            ) : (
              <HLSPlayer key={activeCh.id} src={proxySrc} channelName={activeCh.name} muted={muted} onUnmute={() => setMuted(false)} />
            )}
          </div>
          <div className="tv-player-bar">
            <span className="tv-player-dot" aria-hidden />
            <span className="tv-player-live">LIVE</span>
            <span className="tv-player-name">
              {ytTvUrl ? '📺 YouTube' : `${activeCh.flag} ${activeCh.name}`}
            </span>
            {ytTvUrl && (
              <button type="button" onClick={() => setYtTvUrl(null)}
                style={{ marginRight: 'auto', padding: '2px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.07)', color: 'var(--text-secondary)', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}>
                ← חזור לטלוויזיה
              </button>
            )}
          </div>
        </div>

        {/* ── Channel sidebar ── */}
        <div className="tv-sidebar" style={sidebarMaxH ? { maxHeight: sidebarMaxH } : {}}>
          <div className="tv-sidebar-section">
            <div className="tv-sidebar-label">🇮🇱 ישראל</div>
            {IL_CHANNELS.map(ch => (
              <button key={ch.id} type="button"
                className={'tv-ch-btn' + (activeCh.id === ch.id ? ' tv-ch-btn--active' : '')}
                onClick={() => setActiveCh(ch)}>
                {ch.flag} {ch.name}
              </button>
            ))}
          </div>
          <div className="tv-sidebar-section">
            <div className="tv-sidebar-label">🌍 עולם</div>
            {WORLD_CHANNELS.map(ch => (
              <button key={ch.id} type="button"
                className={'tv-ch-btn' + (activeCh.id === ch.id ? ' tv-ch-btn--active' : '')}
                onClick={() => setActiveCh(ch)}>
                {ch.flag} {ch.name}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* ── OMG debate streams ── */}
      <p className="tv-streams-label">🎥 שידורים מצולמים — דיונים חיים</p>
      <div className="tv-streams-grid">
        {STREAMS.map(s => <StreamCard key={s.id} stream={s} username={username} />)}
      </div>
    </div>
  );
}
