import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/appStore.js';
import { useRadioState } from '../../context/RadioAudioContext.jsx';

/* ─── YouTube helpers ─────────────────────────────── */
const LS_YT = 'omg_yt_stations_v1';
const DEFAULT_YT = [
  { id: 1,  name: 'הקו האתאיסטי',  url: '' },
  { id: 2,  name: 'אמנון יצחק',    url: '' },
  { id: 3,  name: 'הרב זמיר כהן',  url: '' },
  { id: 4,  name: 'שידור 4',        url: '' },
  { id: 5,  name: 'שידור 5',        url: '' },
  { id: 6,  name: 'שידור 6',        url: '' },
  { id: 7,  name: 'שידור 7',        url: '' },
  { id: 8,  name: 'שידור 8',        url: '' },
  { id: 9,  name: 'שידור 9',        url: '' },
  { id: 10, name: 'שידור 10',       url: '' },
];

function readYtStations() {
  try { const r = localStorage.getItem(LS_YT); if (r) return JSON.parse(r); } catch {}
  return DEFAULT_YT;
}
function saveYtStations(list) {
  try { localStorage.setItem(LS_YT, JSON.stringify(list)); } catch {}
}
function ytEmbedUrl(raw) {
  if (!raw?.trim()) return null;
  try {
    const u = new URL(raw.trim());
    if (u.hostname === 'youtu.be') return `https://www.youtube.com/embed${u.pathname}?autoplay=1&enablejsapi=1`;
    const v = u.searchParams.get('v');
    if (v) return `https://www.youtube.com/embed/${v}?autoplay=1&enablejsapi=1`;
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts[0] === 'live' && parts[1]) return `https://www.youtube.com/embed/${parts[1]}?autoplay=1&enablejsapi=1`;
    if (parts[0] === 'channel' && parts[1]?.startsWith('UC'))
      return `https://www.youtube.com/embed/live_stream?channel=${parts[1]}&autoplay=1&enablejsapi=1`;
  } catch {}
  return null;
}

/* ─── Component ───────────────────────────────────── */
export default function MiniBarRow() {
  const user        = useAppStore(s => s.user);
  const pendingUser = useAppStore(s => s.pendingUser);
  const setYtTvUrl  = useAppStore(s => s.setYtTvUrl);
  const isLoggedIn  = Boolean(user || pendingUser);
  const navigate    = useNavigate();

  /* radio */
  const { audioEl, setRadioActive, stationId, setStationId, stations, volume, setVolume } = useRadioState() ?? {};
  const [radioPlaying, setRadioPlaying] = useState(false);

  /* shared volume */
  const [sharedVol, setSharedVol] = useState(0.85);

  /* youtube */
  const [ytStations,   setYtStationsState] = useState(readYtStations);
  const [ytSelectedId, setYtSelectedId]   = useState(1);
  const [configOpen,   setConfigOpen]      = useState(false);
  const [draft,        setDraft]           = useState(null);

  /* ── sync radio playing state ── */
  useEffect(() => {
    if (!audioEl) return;
    const on  = () => setRadioPlaying(true);
    const off = () => setRadioPlaying(false);
    setRadioPlaying(!audioEl.paused);
    audioEl.addEventListener('play',  on);
    audioEl.addEventListener('pause', off);
    return () => { audioEl.removeEventListener('play', on); audioEl.removeEventListener('pause', off); };
  }, [audioEl]);

  /* ── stop everything on logout ── */
  useEffect(() => {
    if (!isLoggedIn) {
      if (audioEl) { audioEl.pause(); audioEl.src = ''; audioEl.removeAttribute('data-radio-src'); }
      setRadioActive?.(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  /* ── #root padding ── */
  useEffect(() => {
    const root = document.getElementById('root');
    if (!root) return;
    root.classList.toggle('radio-bar-shown', isLoggedIn);
    return () => root.classList.remove('radio-bar-shown');
  }, [isLoggedIn]);

  if (!isLoggedIn) return null;

  /* ── radio actions ── */
  const toggleRadio = () => {
    if (!audioEl) return;
    if (audioEl.paused) { audioEl.play().catch(() => {}); setRadioActive?.(true); }
    else { audioEl.pause(); }
  };

  /* ── youtube actions ── */
  const activeYt = ytStations.find(s => s.id === ytSelectedId) ?? ytStations[0];
  const embedUrl = activeYt ? ytEmbedUrl(activeYt.url) : null;

  const handleVol = (val) => {
    setSharedVol(val);
    setVolume?.(val);
  };

  const playYt = () => {
    if (!embedUrl) { openConfig(); return; }
    const vol = Math.round(sharedVol * 100);
    setYtTvUrl(embedUrl.replace('?autoplay=1', `?autoplay=1&volume=${vol}`));
    navigate('/video-live');
  };

  const openConfig = () => { setDraft(ytStations.map(s => ({ ...s }))); setConfigOpen(true); };
  const saveConfig = () => {
    saveYtStations(draft);
    setYtStationsState(draft);
    setConfigOpen(false);
    setDraft(null);
  };

  return (
    <>
      {/* ── Config panel ─────────────────────────────────── */}
      {configOpen && draft && (
        <div className="yt-config">
          <div className="yt-config__head">
            <span>📺 תחנות יוטיוב — עריכה</span>
            <button type="button" className="yt-config__x" onClick={() => setConfigOpen(false)}>✕</button>
          </div>
          <div className="yt-config__list">
            {draft.map((s, i) => (
              <div key={s.id} className="yt-config__row">
                <span className="yt-config__num">{s.id}</span>
                <input className="yt-config__name" type="text" value={s.name} placeholder="שם תחנה"
                  onChange={e => { const n=[...draft]; n[i]={...n[i],name:e.target.value}; setDraft(n); }} />
                <input className="yt-config__url" type="url" value={s.url} placeholder="קישור YouTube" dir="ltr"
                  onChange={e => { const n=[...draft]; n[i]={...n[i],url:e.target.value}; setDraft(n); }} />
              </div>
            ))}
          </div>
          <button type="button" className="yt-config__save" onClick={saveConfig}>שמור</button>
        </div>
      )}

      {/* ── The mini bar ─────────────────────────────────── */}
      {/*
        Layout (LTR, left→right):
        [⚙radio] [select radio] [▶radio] [●radio]   [vol-radio] | [vol-yt]   [●yt] [▶yt] [select-yt] [⚙yt]
      */}
      <div className="mini-radio-bar" role="region" aria-label="שורת שידורים">
        <div className="mini-radio-bar__inner">

          {/* ── Radio gear (far left) ── */}
          <button type="button" className="mini-radio-bar__btn mini-yt__gear"
            title="הגדרות רדיו" aria-label="הגדרות רדיו" style={{ opacity: 0.45, cursor: 'default' }}>⚙</button>

          {/* ── Radio: select → play → dot ── */}
          <select className="mini-radio-bar__select" value={stationId ?? ''}
            onChange={e => setStationId?.(e.target.value)} aria-label="תחנת רדיו">
            {(stations ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button type="button" className="mini-radio-bar__btn" onClick={toggleRadio}
            aria-label={radioPlaying ? 'השהה' : 'נגן'}>
            {radioPlaying ? '⏸' : '▶'}
          </button>
          <span className={'mini-radio-bar__dot' + (radioPlaying ? ' mini-radio-bar__dot--live' : '')} aria-hidden />

          {/* ── Single shared volume fader — center ── */}
          <div className="mini-bar-vols">
            <input type="range" className="mini-radio-bar__vol mini-radio-bar__vol--shared" min={0} max={1} step={0.01}
              value={sharedVol} onChange={e => handleVol(Number(e.target.value))} aria-label="עוצמת שמע" />
          </div>

          {/* ── YouTube: dot → play → select ── */}
          <span className={'mini-radio-bar__dot' + (embedUrl ? ' mini-radio-bar__dot--live' : '')} aria-hidden />
          <button type="button" className="mini-radio-bar__btn" onClick={playYt}
            aria-label="פתח ביוטיוב" title={embedUrl ? 'פתח בנגן' : 'הזן קישור YouTube'}>
            ▶
          </button>
          <select className="mini-radio-bar__select" value={ytSelectedId}
            onChange={e => setYtSelectedId(Number(e.target.value))} aria-label="תחנת יוטיוב">
            {ytStations.map(s => <option key={s.id} value={s.id}>{s.id}. {s.name}</option>)}
          </select>

          {/* ── YouTube gear (far right) ── */}
          <button type="button" className="mini-radio-bar__btn mini-yt__gear"
            onClick={openConfig} title="ערוך תחנות יוטיוב" aria-label="ערוך תחנות יוטיוב">⚙</button>

        </div>
      </div>
    </>
  );
}
