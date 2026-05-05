import React, { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '../../store/appStore.js';
import { useRadioState } from '../../context/RadioAudioContext.jsx';
import {
  readYtStations,
  saveYtStations,
  ytEmbedUrl,
  applyYoutubeEmbedPlaybackParams,
  readYtSelectedStationId,
  writeYtSelectedStationId,
} from '../../lib/ytStationsLocal.js';

/* ─── Component — שורת נגן אחת; רדיו או YouTube לפי miniMediaBarFocus (מהתפריט) —─ */
export default function MiniBarRow() {
  const user               = useAppStore(s => s.user);
  const pendingUser        = useAppStore(s => s.pendingUser);
  const ytTvUrl            = useAppStore(s => s.ytTvUrl);
  const setYtTvUrl         = useAppStore(s => s.setYtTvUrl);
  const miniMediaBarOpen   = useAppStore(s => s.miniMediaBarOpen);
  const miniMediaBarFocus  = useAppStore(s => s.miniMediaBarFocus);
  const miniMediaBarPlayOnOpen = useAppStore(s => s.miniMediaBarPlayOnOpen);
  const closeMiniMediaBar  = useAppStore(s => s.closeMiniMediaBar);
  const isLoggedIn         = Boolean(user || pendingUser);

  /* radio */
  const {
    audioEl,
    setRadioActive,
    stationId,
    setStationId,
    stations,
    volume,
    setVolume,
    pauseRadioPlayback,
    resetRadioPlayback,
  } = useRadioState() ?? {};
  const [radioPlaying, setRadioPlaying] = useState(false);

  /* משותף לרדיו וליוטיוב — מסונכרן עם volume מהקונטקסט */
  const [sharedVol, setSharedVol] = useState(() => volume ?? 0.85);

  /* youtube */
  const [ytStations, setYtStationsState] = useState(readYtStations);
  const [ytSelectedId, setYtSelectedId] = useState(() => {
    const id = readYtSelectedStationId();
    const list = readYtStations();
    return list.some(s => s.id === id) ? id : 1;
  });
  const [configOpen, setConfigOpen] = useState(false);
  const [draft, setDraft] = useState(null);

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

  useEffect(() => {
    if (volume != null && Number.isFinite(volume)) setSharedVol(volume);
  }, [volume]);

  /* ── עצירה + ניקוי זרם רק בהתנתקות — לא בסגירת שורת המיני (✕) ── */
  useEffect(() => {
    if (!isLoggedIn) resetRadioPlayback?.();
  }, [isLoggedIn, resetRadioPlayback]);

  /* ── #root padding (רק כשהבר גלוי) ── */
  useEffect(() => {
    const root = document.getElementById('root');
    if (!root) return;
    root.classList.toggle('radio-bar-shown', isLoggedIn && miniMediaBarOpen);
    return () => root.classList.remove('radio-bar-shown');
  }, [isLoggedIn, miniMediaBarOpen]);

  /* ── גלילה למקטע הרלוונטי אחרי פתיחה מהתפריט (רדיו / יוטיוב) ── */
  useEffect(() => {
    if (!miniMediaBarOpen || !miniMediaBarFocus) return;
    const id = miniMediaBarFocus === 'radio' ? 'mini-media-bar-radio' : 'mini-media-bar-youtube';
    const el = document.getElementById(id);
    if (!el) return;
    const t = requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      const focusable =
        el.querySelector('select')
        ?? el.querySelector('button.mini-radio-bar__btn:not(.mini-radio-bar__close)');
      focusable?.focus?.({ preventScroll: true });
    });
    return () => cancelAnimationFrame(t);
  }, [miniMediaBarOpen, miniMediaBarFocus]);

  const openConfig = useCallback(() => {
    setDraft(ytStations.map(s => ({ ...s })));
    setConfigOpen(true);
  }, [ytStations]);

  /* פתיחת הרדיו/יוטיוב מהתפריט עם { play: true } — מפעיל את התחנה הנבחרת באותו נגן */
  useEffect(() => {
    if (!miniMediaBarOpen || !miniMediaBarPlayOnOpen) return;
    const kind = miniMediaBarPlayOnOpen;
    if (kind === 'radio') {
      if (!audioEl) return;
      useAppStore.setState({ miniMediaBarPlayOnOpen: null });
      setYtTvUrl(null);
      audioEl.play().catch(() => {});
      setRadioActive?.(true);
      return;
    }
    if (kind === 'youtube') {
      useAppStore.setState({ miniMediaBarPlayOnOpen: null });
      pauseRadioPlayback?.();
      const y = ytStations.find(s => s.id === ytSelectedId) ?? ytStations[0];
      const url = y ? ytEmbedUrl(y.url) : null;
      if (!url) {
        openConfig();
        return;
      }
      setYtTvUrl(applyYoutubeEmbedPlaybackParams(url));
    }
  }, [
    miniMediaBarOpen,
    miniMediaBarPlayOnOpen,
    audioEl,
    pauseRadioPlayback,
    ytStations,
    ytSelectedId,
    setYtTvUrl,
    setRadioActive,
    openConfig,
  ]);

  if (!isLoggedIn) return null;
  if (!miniMediaBarOpen) return null;

  const toggleRadio = () => {
    if (!audioEl) return;
    if (audioEl.paused) { audioEl.play().catch(() => {}); setRadioActive?.(true); }
    else { audioEl.pause(); }
  };

  const activeYt = ytStations.find(s => s.id === ytSelectedId) ?? ytStations[0];
  const embedUrl = activeYt ? ytEmbedUrl(activeYt.url) : null;

  const handleVol = (val) => {
    setSharedVol(val);
    setVolume?.(val);
  };

  const playYt = () => {
    pauseRadioPlayback?.();
    if (!embedUrl) { openConfig(); return; }
    setYtTvUrl(applyYoutubeEmbedPlaybackParams(embedUrl));
  };

  const toggleYoutubePlayback = () => {
    if (ytTvUrl) {
      setYtTvUrl(null);
      return;
    }
    playYt();
  };

  const saveConfig = () => {
    saveYtStations(draft);
    setYtStationsState(draft);
    setConfigOpen(false);
    setDraft(null);
  };

  const closeBar = () => {
    setConfigOpen(false);
    setDraft(null);
    pauseRadioPlayback?.();
    setYtTvUrl(null);
    closeMiniMediaBar();
  };

  const ytPlaying = Boolean(ytTvUrl);
  const playerMode = miniMediaBarFocus === 'youtube' ? 'youtube' : 'radio';

  return (
    <>
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

      <div className="mini-media-dock" role="region" aria-label="נגן">
        <div className="mini-media-dock__strip">
          <div
            className={
              'mini-radio-bar__inner mini-radio-bar__inner--radio-only'
              + (playerMode === 'youtube' ? ' mini-radio-bar__inner--youtube-row' : '')
            }
          >
            <button
              type="button"
              className="mini-radio-bar__btn mini-radio-bar__close"
              title="סגור"
              aria-label="סגור שורת הנגן"
              onClick={closeBar}
            >
              ✕
            </button>

            {playerMode === 'radio' ? (
              <>
                <div id="mini-media-bar-radio" className="mini-radio-bar__segment mini-media-bar__segment--focus">
                  <select className="mini-radio-bar__select" value={stationId ?? ''}
                    onChange={e => setStationId?.(e.target.value, { fromUserPick: true })} aria-label="תחנת רדיו">
                    {(stations ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <button type="button" className="mini-radio-bar__btn" onClick={toggleRadio}
                    aria-label={radioPlaying ? 'השהה' : 'נגן'}>
                    {radioPlaying ? '⏸' : '▶'}
                  </button>
                  <span className={'mini-radio-bar__dot' + (radioPlaying ? ' mini-radio-bar__dot--live' : '')} aria-hidden />
                </div>
                <div className="mini-bar-vols">
                  <input type="range" className="mini-radio-bar__vol mini-radio-bar__vol--shared" min={0} max={1} step={0.01}
                    value={sharedVol} onChange={e => handleVol(Number(e.target.value))} aria-label="עוצמת שמע" />
                </div>
              </>
            ) : (
              <>
                <div id="mini-media-bar-youtube" className="mini-radio-bar__segment mini-media-bar__segment--focus">
                  <select
                    className="mini-radio-bar__select"
                    value={ytSelectedId}
                    onChange={e => {
                      const n = Number(e.target.value);
                      setYtSelectedId(n);
                      writeYtSelectedStationId(n);
                      setYtTvUrl(null);
                    }}
                    aria-label="תחנת יוטיוב"
                  >
                    {ytStations.map(s => <option key={s.id} value={s.id}>{s.id}. {s.name}</option>)}
                  </select>
                  <button
                    type="button"
                    className="mini-radio-bar__btn"
                    onClick={toggleYoutubePlayback}
                    aria-label={ytPlaying ? 'כבה ניגון יוטיוב' : 'הפעל ניגון יוטיוב'}
                    title={ytPlaying ? 'כבה' : (embedUrl ? 'הפעל' : 'הזן קישור YouTube')}
                  >
                    {ytPlaying ? '⏸' : '▶'}
                  </button>
                  <span className={'mini-radio-bar__dot' + (ytPlaying ? ' mini-radio-bar__dot--live' : '')} aria-hidden />
                </div>
                <div className="mini-yt-vol-gear">
                  <div className="mini-bar-vols">
                    <input
                      type="range"
                      className="mini-radio-bar__vol mini-radio-bar__vol--shared"
                      min={0}
                      max={1}
                      step={0.01}
                      value={sharedVol}
                      onChange={e => handleVol(Number(e.target.value))}
                      aria-label="עוצמת שמע"
                    />
                  </div>
                  <button
                    type="button"
                    className="mini-radio-bar__btn mini-yt__gear"
                    onClick={openConfig}
                    title="ערוך תחנות יוטיוב"
                    aria-label="ערוך תחנות יוטיוב"
                  >
                    ⚙
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
