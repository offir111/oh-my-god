import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore.js';
import { useRadioAudioElement, useRadioState, proxyUrl } from '../context/RadioAudioContext.jsx';

export default function RadioPage() {
  const navigate    = useNavigate();
  const audioEl     = useRadioAudioElement();
  const { stationId, setStationId, stations, volume, setVolume, apiLoading } = useRadioState() ?? {};
  const playGenRef  = useRef(0);
  const [playing,        setPlaying]        = useState(false);
  const [streamError,    setStreamError]    = useState('');
  const [radioPanelOpen, setRadioPanelOpen] = useState(true);

  const syncPlaying = useCallback(() => {
    setPlaying(Boolean(audioEl && !audioEl.paused));
  }, [audioEl]);

  useEffect(() => {
    if (!audioEl) return;
    setPlaying(!audioEl.paused);
  }, [audioEl]);

  useEffect(() => {
    const a = audioEl;
    if (!a) return;
    const onErr = () => {
      if (!a.getAttribute('data-radio-src')) return;
      setStreamError('לא ניתן לטעון את הזרם — נסו תחנה אחרת או רעננו את הדף.');
    };
    a.addEventListener('play',  syncPlaying);
    a.addEventListener('pause', syncPlaying);
    a.addEventListener('error', onErr);
    return () => {
      a.removeEventListener('play',  syncPlaying);
      a.removeEventListener('pause', syncPlaying);
      a.removeEventListener('error', onErr);
    };
  }, [audioEl, syncPlaying]);

  function togglePlay() {
    const a  = audioEl;
    const st = stations?.find(s => s.id === stationId) ?? stations?.[0];
    if (!a || !st?.streamUrl) return;
    setStreamError('');
    if (!a.paused) { playGenRef.current += 1; a.pause(); return; }

    const gen = playGenRef.current;
    const src = proxyUrl(st.streamUrl);
    if (a.getAttribute('data-radio-src') !== src) {
      a.src = src; a.setAttribute('data-radio-src', src); a.load();
    }
    const fail = (msg = 'לא ניתן להפעיל נגינה — נסו תחנה אחרת או בדקו חיבור.') => setStreamError(msg);
    const tryPlay = () => {
      if (gen !== playGenRef.current) return;
      a.play().catch(err => {
        if (import.meta.env.DEV) console.warn('[radio] play()', err?.name, err?.message);
        if (gen === playGenRef.current) fail();
      });
    };
    if (a.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) { tryPlay(); return; }
    let settled = false;
    const tid = window.setTimeout(() => {
      if (gen !== playGenRef.current || settled) return;
      settled = true; cleanup(); tryPlay();
    }, 14000);
    function cleanup() {
      clearTimeout(tid);
      a.removeEventListener('canplay',    onReady);
      a.removeEventListener('loadeddata', onReady);
      a.removeEventListener('error',      onErr2);
    }
    function onReady() {
      if (gen !== playGenRef.current || settled) return;
      settled = true; cleanup(); tryPlay();
    }
    function onErr2() {
      if (gen !== playGenRef.current || settled) return;
      settled = true; cleanup();
      fail('לא ניתן לטעון את הזרם — נסו תחנה אחרת או רעננו את הדף.');
    }
    a.addEventListener('canplay',    onReady, { once: true });
    a.addEventListener('loadeddata', onReady, { once: true });
    a.addEventListener('error',      onErr2,  { once: true });
  }

  function closeRadioPanel() {
    setRadioPanelOpen(false);
    const sessionUser = useAppStore.getState().user;
    const hasFullSession =
      Boolean(sessionUser?.username) &&
      (sessionUser.side === 'believer' || sessionUser.side === 'atheist');
    navigate(hasFullSession ? '/login?logo=nav' : '/login');
  }

  return (
    <>
      <style>{`
        .radio-page { max-width:var(--app-shell-content-max,920px); margin:0 auto; padding:20px var(--app-shell-gutter,18px) 40px; box-sizing:border-box; direction:rtl; text-align:right; }
        .radio-page__title { font-size:clamp(1.25rem,4vw,1.65rem); font-weight:900; color:var(--text,#f4f4f8); margin:0 0 8px; letter-spacing:.02em; }
        .radio-page__sub { margin:0 0 22px; font-size:.9rem; color:var(--text-secondary,#b4b4c0); line-height:1.55; max-width:52ch; }
        .radio-panel { position:relative; max-width:640px; margin:0 auto 20px; border-radius:var(--radius,16px); border:1px solid var(--border-strong,rgba(255,255,255,.16)); background:linear-gradient(165deg,rgba(255,255,255,.07),rgba(10,10,18,.92)); box-shadow:0 12px 40px rgba(0,0,0,.35); overflow:hidden; }
        .radio-panel__close { position:absolute; top:10px; left:10px; z-index:4; box-sizing:border-box; width:38px; height:38px; display:flex; align-items:center; justify-content:center; margin:0; padding:0; border-radius:10px; border:1px solid var(--border-strong,rgba(255,255,255,.18)); background:rgba(18,18,26,.92); color:var(--text-secondary,#c4c4d4); font-size:1.35rem; font-weight:700; line-height:1; cursor:pointer; font-family:inherit; transition:background .15s,color .15s,border-color .15s; }
        .radio-panel__close:hover { background:rgba(248,113,113,.18); border-color:rgba(248,113,113,.45); color:#fecaca; }
        .radio-panel__body { padding:48px 18px 18px; box-sizing:border-box; }
        .radio-reopen { display:block; margin:0 auto 20px; padding:12px 22px; border-radius:12px; border:1px solid rgba(99,102,241,.45); background:rgba(99,102,241,.18); color:#e0e7ff; font-size:.95rem; font-weight:800; font-family:inherit; cursor:pointer; }
        .radio-toolbar { display:flex; flex-wrap:wrap; align-items:flex-end; gap:16px 22px; padding:14px 16px; border-radius:12px; border:1px solid var(--border,rgba(255,255,255,.1)); background:rgba(0,0,0,.22); }
        .radio-toolbar label { display:flex; flex-direction:column; gap:6px; font-size:.78rem; font-weight:800; color:var(--muted,#8a8a9a); min-width:min(100%,220px); flex:1 1 200px; }
        .radio-toolbar select { font:inherit; font-size:.95rem; font-weight:700; color:var(--text,#fff); padding:10px 12px; border-radius:10px; border:1px solid var(--border,rgba(255,255,255,.1)); background:rgba(0,0,0,.35); cursor:pointer; width:100%; }
        .radio-volume { display:flex; flex-direction:column; gap:6px; min-width:min(100%,180px); flex:1 1 160px; }
        .radio-volume__head { display:flex; justify-content:space-between; align-items:baseline; gap:10px; }
        .radio-volume__head span:first-child { font-size:.78rem; font-weight:800; color:var(--muted,#8a8a9a); }
        .radio-volume__pct { font-size:.82rem; font-weight:800; color:var(--gold,#fbbf24); font-variant-numeric:tabular-nums; }
        .radio-volume input[type=range] { width:100%; accent-color:var(--gold,#fbbf24); }
        .radio-play-btn { align-self:center; padding:11px 22px; border-radius:12px; border:1px solid rgba(99,102,241,.45); background:rgba(99,102,241,.22); color:#e0e7ff; font-size:.95rem; font-weight:800; font-family:inherit; cursor:pointer; flex-shrink:0; }
        .radio-error { margin:0 0 14px; padding:12px 14px; border-radius:10px; background:rgba(248,113,113,.12); border:1px solid rgba(248,113,113,.35); color:#fecaca; font-size:.88rem; font-weight:700; }
        .radio-note { margin:0; font-size:.8rem; color:var(--muted,#8a8a9a); line-height:1.5; max-width:58ch; }
      `}</style>
      <section className="radio-page" aria-labelledby="radio-page-title">
        <h1 id="radio-page-title" className="radio-page__title">
          <span aria-hidden>📻</span> רדיו מישראל
        </h1>
        <p className="radio-page__sub">
          שידורים חיים מתחנות מרכזיות. בוחרים תחנה, מגבירים עוצמה, ומפעילים נגן.
        </p>
        {!radioPanelOpen && streamError && <p className="radio-error" role="alert">{streamError}</p>}
        {!radioPanelOpen && (
          <button type="button" className="radio-reopen" onClick={() => setRadioPanelOpen(true)}>
            הצגת נגן הרדיו
          </button>
        )}
        {radioPanelOpen && (
          <div className="radio-panel" aria-label="נגן רדיו">
            <button type="button" className="radio-panel__close" onClick={closeRadioPanel} aria-label="סגירת מלבן הנגן">×</button>
            <div className="radio-panel__body">
              {streamError && <p className="radio-error" role="alert">{streamError}</p>}
              <div className="radio-toolbar">
                <label htmlFor="radio-station-select">
                  תחנה
                  <select
                    id="radio-station-select"
                    value={stationId ?? ''}
                    onChange={e => { setStreamError(''); setStationId(e.target.value); }}
                  >
                    {(stations ?? []).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  {apiLoading && <span style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: 2 }}>טוען תחנות…</span>}
                  {!apiLoading && stations?.length > 0 && <span style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: 2 }}>{stations.length} תחנות זמינות</span>}
                </label>
                <div className="radio-volume">
                  <div className="radio-volume__head">
                    <span id="radio-vol-label">עוצמת שמע</span>
                    <span className="radio-volume__pct" aria-live="polite">{Math.round((volume ?? 0.85) * 100)}%</span>
                  </div>
                  <input type="range" min={0} max={1} step={0.01} value={volume ?? 0.85}
                    onChange={e => setVolume(Number(e.target.value))} aria-labelledby="radio-vol-label" />
                </div>
                <button type="button" className="radio-play-btn" onClick={togglePlay}>
                  {playing ? 'השהה' : 'נגן'}
                </button>
              </div>
            </div>
          </div>
        )}
        <p className="radio-note">
          השידורים מגיעים משרתים חיצוניים. אין אחריות לזמינות או לתוכן השידור.
        </p>
      </section>
    </>
  );
}
