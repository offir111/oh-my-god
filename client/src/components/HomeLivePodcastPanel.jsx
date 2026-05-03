import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store/appStore.js';
import { HOME_LIVE_BROADCAST_BY_KEY } from '../data/homeLiveBroadcastEditor.js';
import { youtubeEmbedIdFromClip } from '../lib/youtubeEmbedId.js';
import {
  loadHomeLiveBroadcastOverrides,
  mergeHomeLiveBroadcastWithOverrides,
  saveHomeLiveBroadcastOverrides,
} from '../utils/homeLiveBroadcastEditorStorage.js';
import HomeLiveListenTransport from './HomeLiveListenTransport.jsx';
import './headerPodcastPanel.css';

const HOME_LIVE_TAB_KEYS = ['faith-1', 'faith-2', 'faith-3', 'atheism-1', 'atheism-2', 'atheism-3'];

function homeLiveEntryHasListenSource(entry) {
  if (!entry) return false;
  if (String(entry.listenAudioUrl || '').trim()) return true;
  return Boolean(
    youtubeEmbedIdFromClip({
      youtubeId: entry.listenYoutubeId,
      watchUrl: entry.listenYoutubeUrl,
    }),
  );
}

/** שורת פודקאסטים LIVE — נפתחת מהתפריט / ניווט המהיר, לא בדף הכניסה */
export default function HomeLivePodcastPanel() {
  const user = useAppStore(s => s.user);
  const pendingUser = useAppStore(s => s.pendingUser);
  const panelOpen = useAppStore(s => s.headerPodcastPanelOpen);
  const closePanel = useAppStore(s => s.closeHeaderPodcastPanel);
  const miniMediaBarOpen = useAppStore(s => s.miniMediaBarOpen);

  const [homeLivePlayingKey, setHomeLivePlayingKey] = useState(null);
  const podcastAccidentalPressBlockUntilRef = useRef(0);
  const [liveBroadcastOverrides, setLiveBroadcastOverrides] = useState(() => loadHomeLiveBroadcastOverrides());
  const [omgLiveEditDraft, setOmgLiveEditDraft] = useState({ audio: '', yid: '', yurl: '', tabLabel: '' });
  const [homeLiveOmgEditorShellOpen, setHomeLiveOmgEditorShellOpen] = useState(false);
  const [homeLiveOmgEditorTabKey, setHomeLiveOmgEditorTabKey] = useState('faith-1');
  const [vsLinkVisible, setVsLinkVisible] = useState(false);
  const [vsFlashTick, setVsFlashTick] = useState(0);
  const vsLinkTimerRef = useRef(null);

  const hasSession = Boolean(user || pendingUser);

  useEffect(() => {
    if (!panelOpen) return undefined;
    podcastAccidentalPressBlockUntilRef.current = Date.now() + 420;
    return undefined;
  }, [panelOpen]);

  useEffect(() => () => {
    if (vsLinkTimerRef.current) {
      clearTimeout(vsLinkTimerRef.current);
      vsLinkTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!panelOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') closePanel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelOpen, closePanel]);

  const mergedLiveBroadcastByKey = useMemo(
    () => mergeHomeLiveBroadcastWithOverrides(HOME_LIVE_BROADCAST_BY_KEY, liveBroadcastOverrides),
    [liveBroadcastOverrides],
  );
  const mergedLiveBroadcastRef = useRef(mergedLiveBroadcastByKey);
  mergedLiveBroadcastRef.current = mergedLiveBroadcastByKey;

  const statsLiveEditorNorm = (import.meta.env.VITE_STATS_ADMIN_USERNAME || '').trim().toLowerCase();
  const sessionLiveEditorNorm =
    user?.username?.trim().toLowerCase() || pendingUser?.username?.trim().toLowerCase() || '';
  const isOmgLiveEditor =
    sessionLiveEditorNorm === 'omg'
    || Boolean(statsLiveEditorNorm && sessionLiveEditorNorm === statsLiveEditorNorm);

  useEffect(() => {
    const e = mergedLiveBroadcastByKey[homeLiveOmgEditorTabKey];
    if (!e) return;
    setOmgLiveEditDraft({
      audio: String(e.listenAudioUrl ?? ''),
      yid: String(e.listenYoutubeId ?? ''),
      yurl: String(e.listenYoutubeUrl ?? ''),
      tabLabel: String(e.tabLabel ?? ''),
    });
  }, [homeLiveOmgEditorTabKey, mergedLiveBroadcastByKey]);

  useLayoutEffect(() => {
    if (!homeLivePlayingKey) return;
    const ent = mergedLiveBroadcastByKey[homeLivePlayingKey];
    if (!homeLiveEntryHasListenSource(ent)) setHomeLivePlayingKey(null);
  }, [homeLivePlayingKey, mergedLiveBroadcastByKey]);

  const homeLiveTransport = useMemo(() => {
    if (!homeLivePlayingKey) return { direct: '', youtubeVideoId: '' };
    const ent = mergedLiveBroadcastByKey[homeLivePlayingKey];
    if (!ent) return { direct: '', youtubeVideoId: '' };
    const direct = String(ent.listenAudioUrl || '').trim();
    if (direct) return { direct, youtubeVideoId: '' };
    const id = youtubeEmbedIdFromClip({
      youtubeId: ent.listenYoutubeId,
      watchUrl: ent.listenYoutubeUrl,
    });
    if (!id) return { direct: '', youtubeVideoId: '' };
    return { direct: '', youtubeVideoId: id };
  }, [homeLivePlayingKey, mergedLiveBroadcastByKey]);

  function flashVsLink() {
    if (vsLinkTimerRef.current) {
      clearTimeout(vsLinkTimerRef.current);
      vsLinkTimerRef.current = null;
    }
    setVsLinkVisible(true);
    setVsFlashTick(t => t + 1);
    vsLinkTimerRef.current = setTimeout(() => {
      setVsLinkVisible(false);
      vsLinkTimerRef.current = null;
    }, 10000);
  }

  useLayoutEffect(() => {
    if (!vsLinkVisible || vsFlashTick === 0) return;
    document.getElementById('header-podcast-vs-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [vsLinkVisible, vsFlashTick]);

  function toggleHomeLiveTabListen(tabKey) {
    setHomeLivePlayingKey(prev => {
      if (prev === tabKey) return null;
      const ent = mergedLiveBroadcastRef.current[tabKey];
      if (!homeLiveEntryHasListenSource(ent)) return prev;
      return tabKey;
    });
  }

  function handleLiveTabPress(tabKey) {
    if (Date.now() < podcastAccidentalPressBlockUntilRef.current) return;
    flashVsLink();
    toggleHomeLiveTabListen(tabKey);
  }

  function persistOmgLiveListenFields() {
    const tabKey = homeLiveOmgEditorTabKey;
    const next = { ...liveBroadcastOverrides };
    const audio = omgLiveEditDraft.audio.trim();
    const yid = omgLiveEditDraft.yid.trim();
    const yurl = omgLiveEditDraft.yurl.trim();
    const tabLabel = omgLiveEditDraft.tabLabel.trim();
    if (!audio && !yid && !yurl) delete next[tabKey];
    else {
      next[tabKey] = {
        listenAudioUrl: audio,
        listenYoutubeId: yid,
        listenYoutubeUrl: yurl,
        ...(tabLabel ? { tabLabel } : {}),
      };
    }
    saveHomeLiveBroadcastOverrides(next);
    setLiveBroadcastOverrides(next);
    if (homeLivePlayingKey === tabKey) setHomeLivePlayingKey(null);
    setHomeLiveOmgEditorShellOpen(false);
  }

  function clearOmgLiveTabOverrides() {
    const tabKey = homeLiveOmgEditorTabKey;
    const next = { ...liveBroadcastOverrides };
    delete next[tabKey];
    saveHomeLiveBroadcastOverrides(next);
    setLiveBroadcastOverrides(next);
    setOmgLiveEditDraft({ audio: '', yid: '', yurl: '', tabLabel: '' });
    if (homeLivePlayingKey === tabKey) setHomeLivePlayingKey(null);
  }

  const topOffset = miniMediaBarOpen
    ? 'calc(var(--shell-top) + var(--mini-media-bar-top-gap) + var(--mini-radio-h))'
    : 'var(--shell-top)';

  if (!hasSession || !panelOpen) return null;

  return (
    <div className="header-podcast-panel" style={{ top: topOffset }} role="region" aria-label="פודקאסט LIVE">
      <div className="header-podcast-panel__head">
        <span className="header-podcast-panel__title">פודקאסט LIVE — הקשבה</span>
        <button type="button" className="header-podcast-panel__close" onClick={closePanel} aria-label="סגור פאנל">
          ✕
        </button>
      </div>
      <div className="header-podcast-panel__inner">
        <div className="home-live-broadcast-block">
          {isOmgLiveEditor && homeLiveOmgEditorShellOpen ? (
            <div className="home-live-omg-editor-shell">
              <div className="home-live-omg-editor-tab-row">
                <label htmlFor="hdr-podcast-tab-select">טאב לעריכה</label>
                <select
                  id="hdr-podcast-tab-select"
                  className="home-live-omg-editor-tab-select"
                  value={homeLiveOmgEditorTabKey}
                  onChange={e => setHomeLiveOmgEditorTabKey(e.target.value)}
                >
                  {HOME_LIVE_TAB_KEYS.map(k => {
                    const m = mergedLiveBroadcastByKey[k];
                    const opt =
                      (m?.tabLabel && String(m.tabLabel).trim()) || HOME_LIVE_BROADCAST_BY_KEY[k]?.title || k;
                    return (
                      <option key={k} value={k}>
                        {opt}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="home-live-omg-editor">
                <p className="home-live-omg-editor-title">לינקי שמע / יוטיוב לטאב הנבחר</p>
                <p className="home-live-omg-editor-note">
                  שמירה מקומית בלבד (localStorage). לחיצה על טאב למטה מפעילה או עוצרת נגינה בלי לפתוח חלונות.
                </p>
                <div className="home-live-omg-editor-field">
                  <label htmlFor="hdr-podcast-audio-url">קישור שמע ישיר (mp3, m4a…)</label>
                  <input
                    id="hdr-podcast-audio-url"
                    type="url"
                    autoComplete="off"
                    placeholder="https://…/הרצאה.mp3"
                    value={omgLiveEditDraft.audio}
                    onChange={e => setOmgLiveEditDraft(d => ({ ...d, audio: e.target.value }))}
                  />
                </div>
                <div className="home-live-omg-editor-field">
                  <label htmlFor="hdr-podcast-yt-id">מזהה YouTube (אופציונלי)</label>
                  <input
                    id="hdr-podcast-yt-id"
                    type="text"
                    autoComplete="off"
                    placeholder="למשל dQw4w9WgXcQ"
                    value={omgLiveEditDraft.yid}
                    onChange={e => setOmgLiveEditDraft(d => ({ ...d, yid: e.target.value }))}
                  />
                </div>
                <div className="home-live-omg-editor-field">
                  <label htmlFor="hdr-podcast-yt-url">או קישור YouTube מלא</label>
                  <input
                    id="hdr-podcast-yt-url"
                    type="url"
                    autoComplete="off"
                    placeholder="https://www.youtube.com/watch?v=…"
                    value={omgLiveEditDraft.yurl}
                    onChange={e => setOmgLiveEditDraft(d => ({ ...d, yurl: e.target.value }))}
                  />
                </div>
                {homeLiveEntryHasListenSource({
                  listenAudioUrl: omgLiveEditDraft.audio,
                  listenYoutubeId: omgLiveEditDraft.yid,
                  listenYoutubeUrl: omgLiveEditDraft.yurl,
                }) ? (
                  <div className="home-live-omg-editor-field">
                    <label htmlFor="hdr-podcast-tab-label">שם על הטאב (במקום ברירת המחדל)</label>
                    <input
                      id="hdr-podcast-tab-label"
                      type="text"
                      autoComplete="off"
                      placeholder="למשל שם ההרצאה או האורח"
                      maxLength={48}
                      value={omgLiveEditDraft.tabLabel}
                      onChange={e => setOmgLiveEditDraft(d => ({ ...d, tabLabel: e.target.value }))}
                    />
                  </div>
                ) : null}
                <div className="home-live-omg-editor-actions">
                  <button type="button" className="home-live-omg-save" onClick={() => persistOmgLiveListenFields()}>
                    שמירה
                  </button>
                  <button type="button" className="home-live-omg-danger" onClick={() => clearOmgLiveTabOverrides()}>
                    ניקוי שמירה לטאב
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          <div className="home-live-broadcast-row" dir="rtl" aria-label="פודקאסטים — הקשבה">
            <div className="home-live-broadcast-label-col">
              <span className="home-live-broadcast-label">פודקאסטים:</span>
              {isOmgLiveEditor ? (
                <button
                  type="button"
                  className="home-live-omg-edit-link"
                  onClick={() => setHomeLiveOmgEditorShellOpen(v => !v)}
                  aria-expanded={homeLiveOmgEditorShellOpen}
                >
                  {homeLiveOmgEditorShellOpen ? 'סגירה' : 'עריכה'}
                </button>
              ) : null}
            </div>
            <div className="home-live-broadcast-tabs" role="list">
              {[1, 2, 3].map(slot => {
                const tabKey = `faith-${slot}`;
                const ent = mergedLiveBroadcastByKey[tabKey];
                const custom = String(ent?.tabLabel || '').trim();
                const btnLabel = custom || (slot === 1 ? 'הרב זמיר כהן' : 'LIVE');
                const ariaDefault =
                  slot === 1
                    ? 'שידור חי אמונה: הרב זמיר כהן — לחיצה נגן או עוצר'
                    : `שידור חי אמונה מס׳ ${slot} — לחיצה נגן או עוצר`;
                return (
                  <button
                    key={tabKey}
                    type="button"
                    role="listitem"
                    className={`home-live-tab home-live-tab--faith${homeLivePlayingKey === tabKey ? ' home-live-tab--selected' : ''}`}
                    aria-pressed={homeLivePlayingKey === tabKey}
                    aria-label={custom ? `שידור חי אמונה: ${custom} — לחיצה נגן או עוצר` : ariaDefault}
                    onClick={() => handleLiveTabPress(tabKey)}
                  >
                    {btnLabel}
                  </button>
                );
              })}
              {[1, 2, 3].map(slot => {
                const tabKey = `atheism-${slot}`;
                const ent = mergedLiveBroadcastByKey[tabKey];
                const custom = String(ent?.tabLabel || '').trim();
                const btnLabel = custom || (slot === 1 ? 'הקו האתאיסטי' : 'LIVE');
                const ariaDefault =
                  slot === 1
                    ? 'שידור חי אתאיזם: הקו האתאיסטי — לחיצה נגן או עוצר'
                    : `שידור חי אתאיזם מס׳ ${slot} — לחיצה נגן או עוצר`;
                return (
                  <button
                    key={tabKey}
                    type="button"
                    role="listitem"
                    className={`home-live-tab home-live-tab--atheism${homeLivePlayingKey === tabKey ? ' home-live-tab--selected' : ''}`}
                    aria-pressed={homeLivePlayingKey === tabKey}
                    aria-label={custom ? `שידור חי אתאיזם: ${custom} — לחיצה נגן או עוצר` : ariaDefault}
                    onClick={() => handleLiveTabPress(tabKey)}
                  >
                    {btnLabel}
                  </button>
                );
              })}
            </div>
          </div>
          {homeLivePlayingKey && (homeLiveTransport.direct || homeLiveTransport.youtubeVideoId) ? (
            <HomeLiveListenTransport
              key={homeLivePlayingKey}
              tabKey={homeLivePlayingKey}
              directUrl={homeLiveTransport.direct}
              youtubeVideoId={homeLiveTransport.youtubeVideoId}
            />
          ) : null}
        </div>

        {vsLinkVisible ? (
          <div
            className="header-podcast-panel__vs-link-row"
            id="header-podcast-vs-anchor"
            aria-live="polite"
          >
            <Link className="header-podcast-panel__vs-link" to="/live-events" onClick={closePanel}>
              למעבר לסרטונים לחץ כאן
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
