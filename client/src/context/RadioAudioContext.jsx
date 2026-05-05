import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { ISRAELI_RADIO_STATIONS } from '../data/israeliRadioStations.js';
import { getApiBaseUrl } from '../lib/apiBaseUrl.js';
import { displayStationNameHebrewPrefer } from '../lib/radioStationDisplayName.js';
import { sortIsraelRadioStationsForMenu, radioStationIsraelMenuPriority } from '../lib/radioStationIsraelOrder.js';

const RadioAudioContext = createContext(null);

export const LS_STATION  = 'omg_radio_station_id';
export const LS_VOLUME   = 'omg_radio_volume';
export const DEFAULT_STATION_ID = 'radius100';

const RADIO_BROWSER_URLS = [
  'https://de1.api.radio-browser.info',
  'https://at1.api.radio-browser.info',
  'https://nl1.api.radio-browser.info',
];

function readSavedStationId() {
  try { const s = localStorage.getItem(LS_STATION); if (s) return s; } catch {}
  return DEFAULT_STATION_ID;
}
function readSavedVolume() {
  try {
    const v = Number(localStorage.getItem(LS_VOLUME));
    if (Number.isFinite(v) && v >= 0 && v <= 1) return v;
  } catch {}
  return 0.85;
}
function hasArabicScript(name) {
  return /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/.test(name);
}
export function proxyUrl(streamUrl) {
  if (!streamUrl) return '';
  return `${getApiBaseUrl()}/api/radio-proxy?url=${encodeURIComponent(streamUrl)}`;
}

export function RadioAudioProvider({ children }) {
  const [audioEl,      setAudioEl]      = useState(null);
  const [stationId,    setStationIdRaw] = useState(readSavedStationId);
  const [stations, setStations] = useState(() =>
    sortIsraelRadioStationsForMenu(
      ISRAELI_RADIO_STATIONS.map(s => ({
        ...s,
        name: displayStationNameHebrewPrefer(s.name),
      })),
    ),
  );
  const [volume,       setVolumeRaw]    = useState(readSavedVolume);
  const [apiLoading,   setApiLoading]   = useState(true);
  const [radioActive,  setRadioActive]  = useState(false); // true once user has pressed play
  const wasPlayingRef = useRef(false);
  const playGenRef    = useRef(0);
  /** בחירת תחנה מה־UI — נגן אוטומטית אחרי טעינת הזרם */
  const stationPickAutoplayRef = useRef(false);

  const setStationId = (id, opts) => {
    if (opts?.fromUserPick) stationPickAutoplayRef.current = true;
    setStationIdRaw(id);
    try { localStorage.setItem(LS_STATION, id); } catch {}
  };
  const setVolume = (v) => {
    setVolumeRaw(v);
    try { localStorage.setItem(LS_VOLUME, String(v)); } catch {}
  };

  // ── Fetch Radio Browser API ──────────────────────────────────────
  useEffect(() => {
    const ctrl = new AbortController();
    async function fetchStations() {
      for (const base of RADIO_BROWSER_URLS) {
        try {
          const url = `${base}/json/stations/bycountryexact/Israel?order=votes&reverse=true&limit=100&hidebroken=true`;
          const r = await fetch(url, { signal: ctrl.signal });
          if (!r.ok) continue;
          const data = await r.json();
          if (!Array.isArray(data) || data.length === 0) continue;
          const mapped = data
            .filter(s => s.url_resolved && !hasArabicScript(s.name))
            .map(s => ({
              id: s.stationuuid,
              name: displayStationNameHebrewPrefer(String(s.name || '').trim() || s.name),
              streamUrl: s.url_resolved,
            }));
          if (mapped.length > 0) {
            // Merge hardcoded stations that the API doesn't cover
            const hardcodedMapped = ISRAELI_RADIO_STATIONS.map(s => ({
              ...s,
              name: displayStationNameHebrewPrefer(s.name),
            }));
            const merged = [...mapped];
            for (const hs of hardcodedMapped) {
              const priority = radioStationIsraelMenuPriority(hs);
              if (priority >= 1000) continue;
              if (!merged.some(s => radioStationIsraelMenuPriority(s) === priority)) {
                merged.push(hs);
              }
            }
            setStations(sortIsraelRadioStationsForMenu(merged));
            break;
          }
        } catch (e) {
          if (e?.name === 'AbortError') return;
        }
      }
      setApiLoading(false);
    }
    fetchStations();
    return () => ctrl.abort();
  }, []);

  // ── Validate stationId when stations list changes ────────────────
  useEffect(() => {
    if (stations.some(s => s.id === stationId)) return;
    const find100 = stations.find(s => /\b100\b/.test(s.name) && /fm|radius|רדיוס/i.test(s.name));
    setStationId((find100 ?? stations[0])?.id ?? '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stations]);

  // ── Sync volume to audio element ────────────────────────────────
  useEffect(() => {
    if (audioEl) audioEl.volume = volume;
  }, [audioEl, volume]);

  // ── Load stream when stationId changes ─────────────────────────
  useEffect(() => {
    const a = audioEl;
    const st = stations.find(s => s.id === stationId) ?? stations[0];
    if (!a || !st?.streamUrl) return;
    playGenRef.current += 1;
    const wasPlaying = !a.paused;
    const pickAutoplay = stationPickAutoplayRef.current;
    stationPickAutoplayRef.current = false;
    const src = proxyUrl(st.streamUrl);
    a.src = src;
    a.setAttribute('data-radio-src', src);
    a.load();
    if (wasPlaying || pickAutoplay) {
      a.play().catch(() => {});
      if (pickAutoplay) setRadioActive(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioEl, stationId, stations]);

  // ── Media coordinator: auto-pause radio when other media plays ──
  useEffect(() => {
    if (!audioEl) return;

    const onOtherPlay = (e) => {
      if (e.target === audioEl) return;
      if (!audioEl.paused) { wasPlayingRef.current = true; audioEl.pause(); }
    };
    const onOtherStop = (e) => {
      if (e.target === audioEl) return;
      if (wasPlayingRef.current) { wasPlayingRef.current = false; audioEl.play().catch(() => {}); }
    };
    const onRadioPlay = () => { wasPlayingRef.current = false; setRadioActive(true); };

    const onYTMessage = (e) => {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        const state = data?.info?.playerState ?? (typeof data?.info === 'number' ? data.info : null);
        if (state === 1) {
          if (!audioEl.paused) { wasPlayingRef.current = true; audioEl.pause(); }
        } else if (state === 0 || state === 2) {
          if (wasPlayingRef.current) { wasPlayingRef.current = false; audioEl.play().catch(() => {}); }
        }
      } catch {}
    };

    document.addEventListener('play',  onOtherPlay, true);
    document.addEventListener('pause', onOtherStop, true);
    document.addEventListener('ended', onOtherStop, true);
    audioEl.addEventListener('play', onRadioPlay);
    window.addEventListener('message', onYTMessage);
    return () => {
      document.removeEventListener('play',  onOtherPlay, true);
      document.removeEventListener('pause', onOtherStop, true);
      document.removeEventListener('ended', onOtherStop, true);
      audioEl.removeEventListener('play', onRadioPlay);
      window.removeEventListener('message', onYTMessage);
    };
  }, [audioEl]);

  /** עצירת ניגון בלי למחוק src — אחרת useEffect של הזרם לא רץ שוב ו־▶ „נשבר” אחרי ✕ */
  const pauseRadioPlayback = useCallback(() => {
    const a = audioEl;
    if (!a) return;
    a.pause();
    setRadioActive(false);
  }, [audioEl]);

  /** עצירה + ניקוי זרם — רק התנתקות / יציאה מזהות */
  const resetRadioPlayback = useCallback(() => {
    const a = audioEl;
    if (!a) return;
    a.pause();
    a.removeAttribute('src');
    a.removeAttribute('data-radio-src');
    try {
      a.load();
    } catch {
      /* ignore */
    }
    setRadioActive(false);
  }, [audioEl]);

  const radioStation = stations.find(s => s.id === stationId) ?? stations[0] ?? null;

  const value = useMemo(() => ({
    audioEl, setAudioEl,
    stationId, setStationId,
    stations,
    radioStation,
    volume, setVolume,
    apiLoading,
    radioActive, setRadioActive,
    pauseRadioPlayback,
    resetRadioPlayback,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [audioEl, stationId, stations, radioStation, volume, apiLoading, pauseRadioPlayback, resetRadioPlayback]);

  return (
    <RadioAudioContext.Provider value={value}>
      {children}
      <style>{`
        .global-radio-audio {
          position: absolute; width: 1px; height: 1px;
          padding: 0; margin: -1px; overflow: hidden;
          clip: rect(0,0,0,0); white-space: nowrap; border: 0;
        }
      `}</style>
      <audio ref={setAudioEl} preload="auto" playsInline className="global-radio-audio" aria-hidden="true" />
    </RadioAudioContext.Provider>
  );
}

export function useRadioAudioElement() {
  return useContext(RadioAudioContext)?.audioEl ?? null;
}
export function useRadioState() {
  return useContext(RadioAudioContext);
}
