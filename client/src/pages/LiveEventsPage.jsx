import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LIVE_YOUTUBE_DEBATES } from '../data/liveYoutubeDebates.js';
import { FAITH_SCIENCE_VIDEO_VAULT } from '../data/faithScienceVideoVault.js';
import {
  VAULT_EDITOR_QUERY_PARAM,
  clearVaultEditorPayload,
  computeVaultItems,
  isVaultEditorEnabledFromEnv,
  loadVaultEditorPayload,
  readVaultEditorEnabledFlag,
  saveVaultEditorPayload,
  setVaultEditorEnabledFlag,
  vaultEditorMove,
  vaultEditorRemove,
} from '../utils/faithScienceVaultEditor.js';
import { youtubeEmbedIdFromClip } from '../lib/youtubeEmbedId.js';

const LIVE_PAGE_INTRO_CLIP_ID = 'intro';
const LIVE_PAGE_INTRO_VIDEO_ID = '_ePyoPwytX0';

/** מדגיש את ה־VS אם יש בפורמט "א׳ VS ב׳" */
function DebateTitleParts({ label, vsClassName }) {
  const m = String(label).match(/^(.+?)\s+VS\s+(.+)$/i);
  if (!m) {
    return label;
  }
  return (
    <>
      {m[1].trim()}
      <span className={vsClassName}> VS </span>
      {m[2].trim()}
    </>
  );
}

function LiveVideoProfessorHeadline({ variant = 'overlay' }) {
  const cls =
    variant === 'header'
      ? 'live-video-intro-professor'
      : 'live-video-loading-phrase-line live-video-loading-phrase-line--sub';
  return (
    <p className={cls}>
      פרופסור שחזר בתשובה
      <span className="live-video-loading-inline-dots" aria-hidden="true">
        <span>.</span>
        <span>.</span>
        <span>.</span>
      </span>
    </p>
  );
}

function LiveVideoLoadingPhrases({ withProfessor = true }) {
  return (
    <div className="live-video-loading-phrases">
      <p className="live-video-loading-phrase-line">מיד:</p>
      {withProfessor ? <LiveVideoProfessorHeadline /> : null}
    </div>
  );
}

export default function LiveEventsPage() {
  const navigate = useNavigate();
  /** { clipId: string, youtubeId: string, label: string } | null */
  const [activeYoutubeClip, setActiveYoutubeClip] = useState(null);
  const [videoEmbedLoaded, setVideoEmbedLoaded] = useState(false);
  /** iframe ברירת מחדל דיווח על טעינה (או גיבוי זמן) — לא מספיק להסתרת כותרת הפרופסור */
  const [mainDefaultIframeReady, setMainDefaultIframeReady] = useState(false);
  /** משתמש לחץ על תיבת הנגן (נגינה) — מסיר כותרת + שכבת המתנה */
  const [mainDefaultOverlayDismissed, setMainDefaultOverlayDismissed] = useState(false);
  const [mainDefaultEmbedNonce, setMainDefaultEmbedNonce] = useState(0);
  const prevActiveClipRef = useRef(null);
  const [omgVaultEditorUi, setOmgVaultEditorUi] = useState(
    () => isVaultEditorEnabledFromEnv() || readVaultEditorEnabledFlag(),
  );
  const [vaultPayload, setVaultPayload] = useState(loadVaultEditorPayload);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get(VAULT_EDITOR_QUERY_PARAM) !== '1') return;
    setVaultEditorEnabledFlag(true);
    setOmgVaultEditorUi(true);
    params.delete(VAULT_EDITOR_QUERY_PARAM);
    const qs = params.toString();
    const path = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
    navigate(path, { replace: true });
  }, [navigate]);

  const vaultDisplayItems = useMemo(
    () => computeVaultItems(FAITH_SCIENCE_VIDEO_VAULT, vaultPayload),
    [vaultPayload],
  );

  const persistVaultPayload = (next) => {
    saveVaultEditorPayload(next);
    setVaultPayload(next);
  };

  const liveVideoSlotRef = useRef(null);

  const openVaultVideoInMain = useCallback((item) => {
    if (!item || item.kind !== 'video') return;
    const yid = youtubeEmbedIdFromClip({
      youtubeId: item.youtubeId,
      watchUrl: item.href,
    });
    if (!yid) {
      window.open(item.href, '_blank', 'noopener,noreferrer');
      return;
    }
    setActiveYoutubeClip({
      clipId: `vault:${item.id}`,
      youtubeId: yid,
      label: item.title,
    });
    window.requestAnimationFrame(() => {
      liveVideoSlotRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, []);

  const isOmgVaultEditor = isVaultEditorEnabledFromEnv() || omgVaultEditorUi;

  useEffect(() => {
    const prev = prevActiveClipRef.current;
    prevActiveClipRef.current = activeYoutubeClip;
    if (prev && !activeYoutubeClip) {
      setMainDefaultIframeReady(false);
      setMainDefaultOverlayDismissed(false);
      setMainDefaultEmbedNonce((n) => n + 1);
    }
  }, [activeYoutubeClip]);

  /** גיבוי אם iframeno לא מפעיל onLoad (חוסם הרחבות / רשת) — לא להשאיר כיתוב ולא תיבה «מתה» ללא משוב */
  useEffect(() => {
    if (activeYoutubeClip) return undefined;
    const t = window.setTimeout(() => setMainDefaultIframeReady(true), 16000);
    return () => window.clearTimeout(t);
  }, [activeYoutubeClip, mainDefaultEmbedNonce]);

  useEffect(() => {
    if (!activeYoutubeClip) return undefined;
    setVideoEmbedLoaded(false);
    const fallback = window.setTimeout(() => setVideoEmbedLoaded(true), 16000);
    return () => window.clearTimeout(fallback);
  }, [activeYoutubeClip?.clipId, activeYoutubeClip?.youtubeId]);

  return (
    <>
      <style>{`
        .live-events-page {
          min-height: calc(100vh - var(--shell-top));
          background: transparent;
          padding: 24px 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
          direction: rtl;
        }
        .live-events-title {
          font-family: var(--font-sans, Rubik, sans-serif);
          font-size: clamp(1.6rem, 7vw, 2.6rem);
          font-weight: 900;
          color: #fff;
          text-align: center;
          letter-spacing: 1px;
          margin: 0;
        }
        .live-events-subtitle {
          color: #888;
          font-size: 0.9rem;
          text-align: center;
          margin: -12px 0 0;
        }

        .faith-science-vault {
          width: 100%;
          max-width: 960px;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 14px;
        }
        .faith-science-vault-head {
          margin-top: 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          width: 100%;
          text-align: center;
        }
        .faith-science-vault-enable-editor-btn {
          padding: 7px 14px;
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.45);
          background: rgba(30, 41, 59, 0.65);
          color: #e2e8f0;
          font-size: 0.78rem;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
        }
        .faith-science-vault-enable-editor-btn:hover {
          border-color: #fde047;
          color: #fde047;
        }
        .faith-science-vault-enable-editor-btn:focus-visible {
          outline: 2px solid #fde047;
          outline-offset: 2px;
        }
        .faith-science-vault-heading {
          margin: 0;
          font-family: var(--font-sans, Rubik, sans-serif);
          font-size: clamp(1.15rem, 4.2vw, 1.55rem);
          font-weight: 900;
          color: #f1f5f9;
          letter-spacing: 0.03em;
        }
        .faith-science-vault-subheading {
          margin: 0;
          font-family: var(--font-sans, Rubik, sans-serif);
          font-size: clamp(0.76rem, 3vw, 0.88rem);
          font-weight: 600;
          color: #94a3b8;
          letter-spacing: 0.02em;
        }
        .faith-science-vault-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
          gap: 14px;
          margin-top: 4px;
        }
        .faith-science-vault-card {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 8px;
          min-height: 0;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px dashed rgba(148, 163, 184, 0.38);
          background: rgba(15, 23, 42, 0.42);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
          text-decoration: none;
          color: rgba(226, 232, 240, 0.96);
          transition: border-color 0.18s, background 0.18s, color 0.18s;
          box-sizing: border-box;
        }
        .faith-science-vault-card--video {
          cursor: default;
        }
        .faith-science-vault-embed-wrap {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          border-radius: 10px;
          overflow: hidden;
          background: #0a0a0a;
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 4px 18px rgba(0, 0, 0, 0.45);
        }
        .faith-science-vault-embed-wrap iframe {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          border: none;
        }
        .faith-science-vault-thumb-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .faith-science-vault-thumb-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.42);
          transition: background 0.18s ease;
          pointer-events: none;
        }
        .faith-science-vault-card--vault-picker:hover .faith-science-vault-thumb-overlay {
          background: rgba(0, 0, 0, 0.28);
        }
        .faith-science-vault-thumb-play {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: rgba(220, 38, 38, 0.92);
          border: 3px solid rgba(255, 255, 255, 0.92);
          color: #fff;
          font-size: 1.25rem;
          display: flex;
          align-items: center;
          justify-content: center;
          padding-inline-start: 5px;
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
        }
        .faith-science-vault-card--vault-picker {
          cursor: pointer;
          text-align: inherit;
        }
        .faith-science-vault-card--vault-picker:focus-visible {
          outline: 2px solid #fde047;
          outline-offset: 3px;
        }
        .faith-science-vault-card--video.faith-science-vault-card--vault-picker:hover {
          border-color: rgba(253, 224, 71, 0.48);
          background: rgba(30, 41, 59, 0.52);
          color: #fff;
        }
        .faith-science-vault-embed-placeholder {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          aspect-ratio: 16 / 9;
          border-radius: 10px;
          background: rgba(0, 0, 0, 0.35);
          border: 1px dashed rgba(148, 163, 184, 0.25);
          font-size: 0.78rem;
          font-weight: 700;
          color: #64748b;
          text-align: center;
          padding: 10px;
          line-height: 1.4;
          overflow: hidden;
        }
        .faith-science-vault-placeholder-fill-link {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 10px;
          z-index: 1;
          font-size: inherit;
          font-weight: inherit;
          color: inherit;
          text-align: center;
          line-height: inherit;
          text-decoration: none;
          cursor: pointer;
        }
        .faith-science-vault-placeholder-fill-link:hover {
          color: #94a3b8;
          background: rgba(255, 255, 255, 0.04);
        }
        .faith-science-vault-placeholder-fill-link:focus-visible {
          outline: 2px solid #fde047;
          outline-offset: -4px;
        }
        .faith-science-vault-external-title-link {
          text-decoration: none;
          color: inherit;
          align-self: stretch;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 5px;
        }
        .faith-science-vault-external-title-link:focus-visible .faith-science-vault-title {
          outline: 2px solid #fde047;
          outline-offset: 4px;
          border-radius: 4px;
        }
        .faith-science-vault-card:hover {
          border-color: rgba(253, 224, 71, 0.55);
          background: rgba(30, 41, 59, 0.55);
          color: #fff;
        }
        .faith-science-vault-card--video:hover {
          border-color: rgba(148, 163, 184, 0.38);
          background: rgba(15, 23, 42, 0.42);
          color: rgba(226, 232, 240, 0.96);
        }
        .faith-science-vault-card:focus-visible {
          outline: 2px solid #fde047;
          outline-offset: 3px;
        }
        .faith-science-vault-title {
          font-size: clamp(0.95rem, 3.85vw, 1.14rem);
          font-weight: 800;
          line-height: 1.38;
          color: rgba(248, 250, 252, 0.98);
        }
        .faith-science-vault-source {
          font-size: 0.69rem;
          font-weight: 650;
          color: #7dd3fc;
          line-height: 1.35;
          margin: 0;
          letter-spacing: 0.01em;
        }
        .faith-science-vault-card:hover .faith-science-vault-source,
        .faith-science-vault-card--video.faith-science-vault-card--vault-picker:hover .faith-science-vault-source {
          color: #bae6fd;
        }

        .faith-science-vault-editor-banner {
          padding: 12px 14px;
          border-radius: 10px;
          background: rgba(127, 29, 29, 0.38);
          border: 1px solid rgba(248, 113, 113, 0.42);
          font-size: 0.82rem;
          color: #fecaca;
          line-height: 1.45;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
          justify-content: space-between;
        }
        .faith-science-vault-editor-banner-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }
        .faith-science-vault-editor-banner-btn {
          padding: 6px 12px;
          border-radius: 8px;
          border: 1px solid rgba(252, 211, 211, 0.55);
          background: rgba(0, 0, 0, 0.25);
          color: #fff;
          font-size: 0.78rem;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
        }
        .faith-science-vault-editor-banner-btn:hover {
          background: rgba(0, 0, 0, 0.4);
        }
        .faith-science-vault-card-wrap {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
        }
        .faith-science-vault-editor-controls {
          position: absolute;
          bottom: 8px;
          left: 8px;
          top: auto;
          right: auto;
          inset-inline-end: auto;
          z-index: 30;
          display: flex;
          gap: 5px;
          flex-direction: row;
          align-items: center;
          padding: 5px 7px;
          border-radius: 11px;
          background: rgba(15, 23, 42, 0.96);
          border: 1px solid rgba(248, 113, 113, 0.5);
          box-shadow: 0 8px 28px rgba(0, 0, 0, 0.55);
          pointer-events: auto;
        }
        .faith-science-vault-editor-controls button {
          min-width: 36px;
          padding: 7px 10px;
          border-radius: 8px;
          border: 1px solid rgba(148, 163, 184, 0.45);
          background: rgba(30, 41, 59, 0.95);
          color: #f1f5f9;
          font-weight: 800;
          font-size: 0.88rem;
          cursor: pointer;
          font-family: inherit;
          line-height: 1;
        }
        .faith-science-vault-editor-controls button:hover:not(:disabled) {
          border-color: #fde047;
          color: #fde047;
        }
        .faith-science-vault-editor-controls button:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }
        .faith-science-vault-editor-remove {
          border-color: rgba(239, 68, 68, 0.65) !important;
          background: rgba(127, 29, 29, 0.65) !important;
          color: #fecaca !important;
          min-width: 40px !important;
          font-size: 1.05rem !important;
        }

        .events-empty-notice {
          color: #555;
          font-size: 0.88rem;
          text-align: center;
          margin-top: 12px;
        }
        .bulletin-board {
          width: 100%;
          max-width: 480px;
          border: 3px solid #888;
          border-radius: 8px;
          background: #0e0e0e;
          box-shadow:
            0 0 0 6px #1a1a1a,
            0 0 0 8px #555,
            0 8px 32px rgba(0,0,0,0.6);
          padding: 28px 24px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          position: relative;
        }
        .bulletin-pin {
          position: absolute;
          top: -10px;
          width: 18px; height: 18px;
          border-radius: 50%;
          background: radial-gradient(circle at 40% 35%, #ff6666, #990000);
          box-shadow: 0 2px 6px rgba(0,0,0,0.5);
        }
        .bulletin-pin-left  { left: 30px; }
        .bulletin-pin-right { right: 30px; }
        .bulletin-title {
          font-family: var(--font-sans, Rubik, sans-serif);
          font-size: clamp(1.3rem, 5vw, 1.9rem);
          font-weight: 900;
          color: #FFE566;
          text-align: center;
          letter-spacing: 1px;
          border-bottom: 2px solid #444;
          padding-bottom: 12px;
          width: 100%;
        }
        .bulletin-names {
          font-size: clamp(0.95rem, 3.5vw, 1.15rem);
          font-weight: 700;
          color: #fff;
          text-align: center;
          line-height: 1.6;
        }
        .bulletin-names .vs-word {
          color: #FFE566;
          font-size: 1.1em;
        }
        .bulletin-question {
          font-size: clamp(0.9rem, 3vw, 1.05rem);
          color: #ddd;
          text-align: center;
          font-style: italic;
          line-height: 1.5;
        }
        .bulletin-date {
          font-size: 0.88rem;
          color: #aaa;
          letter-spacing: 2px;
          font-weight: 600;
          border-top: 1px solid #333;
          padding-top: 10px;
          width: 100%;
          text-align: center;
        }

        .live-youtube-toolbar {
          width: 100%;
          max-width: 480px;
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 8px;
          margin-bottom: 4px;
        }
        .live-youtube-toolbar-btn {
          flex: 1 1 calc(33.333% - 8px);
          min-width: 120px;
          max-width: 200px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid #444;
          background: rgba(255,255,255,0.05);
          font-family: var(--font-sans, Rubik, sans-serif);
          cursor: pointer;
          transition: border-color 0.18s, background 0.18s;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 5px;
        }
        .live-youtube-toolbar-btn-title {
          font-size: clamp(0.88rem, 3.2vw, 1.05rem);
          font-weight: 800;
          line-height: 1.28;
          color: rgba(248, 250, 252, 0.98);
        }
        .live-youtube-toolbar-btn-source {
          font-size: 0.68rem;
          font-weight: 650;
          line-height: 1.25;
          color: #7dd3fc;
        }
        .live-youtube-toolbar-btn:hover:not(:disabled) {
          border-color: #FFE566;
          background: rgba(255, 229, 102, 0.06);
        }
        .live-youtube-toolbar-btn:hover:not(:disabled) .live-youtube-toolbar-btn-title {
          color: #FFE566;
        }
        .live-youtube-toolbar-btn:hover:not(:disabled) .live-youtube-toolbar-btn-source {
          color: #bae6fd;
        }
        .live-youtube-toolbar-btn:focus-visible {
          outline: 2px solid #FFE566;
          outline-offset: 2px;
        }
        .live-youtube-toolbar-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .live-youtube-toolbar-btn.is-active:not(:disabled) {
          border-color: #CC0000;
          background: rgba(204, 0, 0, 0.15);
        }
        .live-youtube-toolbar-btn.is-active:not(:disabled) .live-youtube-toolbar-btn-title {
          color: #fff;
        }
        .live-youtube-toolbar-btn.is-active:not(:disabled) .live-youtube-toolbar-btn-source {
          color: #7dd3fc;
        }

        .live-video-slot {
          width: 100%;
          max-width: 480px;
          border-radius: 20px;
          overflow: hidden;
          border: 1px solid #333;
          background: #000;
          box-shadow: 0 12px 40px rgba(0,0,0,0.7);
          position: relative;
          display: flex;
          flex-direction: column;
        }
        .live-video-slot-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 8px 12px;
          background: linear-gradient(180deg, #141414 0%, #0a0a0a 100%);
          border-bottom: 1px solid #333;
        }
        .live-video-slot-close {
          flex-shrink: 0;
          width: 34px;
          height: 34px;
          border-radius: 10px;
          border: 1px solid #444;
          background: rgba(255,255,255,0.06);
          color: #ddd;
          font-size: 1.1rem;
          line-height: 1;
          cursor: pointer;
          font-weight: 700;
        }
        .live-video-slot-close:hover {
          background: rgba(255,255,255,0.12);
          color: #fff;
        }
        .live-video-embed-wrap {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          background: #000;
        }
        .live-video-embed-wrap iframe {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          border: none;
          z-index: 1;
        }
        .live-video-default-embed-await-click {
          position: absolute;
          inset: 0;
          z-index: 4;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 16px;
          background: linear-gradient(
            180deg,
            rgba(8, 8, 12, 0.55) 0%,
            rgba(8, 8, 12, 0.28) 50%,
            rgba(8, 8, 12, 0.5) 100%
          );
          cursor: pointer;
          pointer-events: auto;
          border: none;
          font: inherit;
          text-align: center;
          direction: rtl;
        }
        .live-video-default-embed-await-click:focus-visible {
          outline: 2px solid #fde047;
          outline-offset: -4px;
        }
        .live-video-default-embed-loading {
          position: absolute;
          inset: 0;
          z-index: 4;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          background: radial-gradient(
            ellipse 80% 70% at 50% 45%,
            rgba(18, 16, 12, 0.94) 0%,
            rgba(0, 0, 0, 0.92) 70%
          );
          pointer-events: none;
        }
        .live-video-loading-phrases {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 0 14px;
        }
        .live-video-loading-phrase-line {
          margin: 0;
          font-family: var(--font-sans, Rubik, sans-serif);
          font-size: clamp(0.92rem, 3.8vw, 1.12rem);
          font-weight: 800;
          color: #fde047;
          text-align: center;
          letter-spacing: 0.04em;
          line-height: 1.35;
        }
        .live-video-loading-phrase-line--sub {
          font-size: clamp(0.82rem, 3.35vw, 1rem);
          font-weight: 750;
          color: rgba(253, 224, 71, 0.93);
        }
        .live-video-loading-inline-dots {
          display: inline-flex;
          gap: 1px;
          margin-inline-start: 4px;
          vertical-align: baseline;
        }
        .live-video-loading-inline-dots span {
          display: inline-block;
          animation: live-video-typing-dot 1.2s ease-in-out infinite;
          opacity: 0.32;
        }
        .live-video-loading-inline-dots span:nth-child(1) { animation-delay: 0s; }
        .live-video-loading-inline-dots span:nth-child(2) { animation-delay: 0.2s; }
        .live-video-loading-inline-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes live-video-typing-dot {
          0%, 70%, 100% { opacity: 0.28; }
          35% { opacity: 1; }
        }

        .live-video-loading-overlay {
          position: absolute;
          inset: 0;
          z-index: 4;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          background:
            radial-gradient(ellipse 85% 75% at 50% 42%, rgba(30, 28, 18, 0.97) 0%, rgba(4, 4, 6, 0.99) 72%);
        }
        .live-video-loading-title {
          margin: 0;
          padding: 0 12px;
          font-family: var(--font-sans, Rubik, sans-serif);
          font-size: clamp(1.65rem, 7.5vw, 2.45rem);
          font-weight: 900;
          color: #fff;
          line-height: 1.12;
          letter-spacing: 0.02em;
          text-align: center;
          text-shadow: 0 2px 28px rgba(0, 0, 0, 0.75);
        }
        .live-video-loading-title-vs {
          color: #FFE566;
        }
        .live-video-loading-shuttle {
          display: flex;
          align-items: center;
          gap: 6px;
          animation: live-video-shuttle-pack 1.45s ease-in-out infinite;
        }
        @keyframes live-video-shuttle-pack {
          0%, 100% { transform: translateX(-20px); }
          50% { transform: translateX(20px); }
        }
        .live-video-loading-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #FFE566;
          box-shadow: 0 0 12px rgba(255, 229, 102, 0.55);
          animation: live-video-dot-scrub 1.12s ease-in-out infinite;
        }
        .live-video-loading-dot:nth-child(1) { animation-delay: 0s; }
        .live-video-loading-dot:nth-child(2) { animation-delay: 0.16s; }
        .live-video-loading-dot:nth-child(3) { animation-delay: 0.32s; }
        @keyframes live-video-dot-scrub {
          0%, 100% { transform: translateX(-7px) scale(0.78); opacity: 0.45; }
          50% { transform: translateX(7px) scale(1.08); opacity: 1; }
        }

        @media (prefers-reduced-motion: reduce) {
          .live-video-loading-shuttle,
          .live-video-loading-dot {
            animation: none !important;
          }
          .live-video-loading-dot {
            opacity: 0.85;
            transform: none;
          }
          .live-video-loading-inline-dots span {
            animation: none !important;
            opacity: 0.85;
          }
        }
        .live-video-slot-default-head {
          flex-shrink: 0;
          padding: 12px 14px 14px;
          background: linear-gradient(180deg, #141414 0%, #0a0a0a 100%);
          border-bottom: 1px solid #333;
          text-align: center;
        }
        .live-video-slot-default-head .live-video-intro-tagline {
          margin-inline: auto;
        }
        .live-video-intro-title {
          margin: 0;
          font-family: var(--font-sans, Rubik, sans-serif);
          font-size: clamp(1.5rem, 6.5vw, 2.1rem);
          font-weight: 900;
          color: #fff;
          line-height: 1.12;
          letter-spacing: 0.02em;
        }
        .live-video-intro-title-vs {
          color: #FFE566;
          margin-inline: 0.1em;
        }
        .live-video-intro-tagline {
          margin: 6px 0 0;
          font-size: clamp(0.76rem, 3.1vw, 0.88rem);
          color: #a1a1aa;
          font-weight: 600;
          line-height: 1.55;
          max-width: 26em;
        }
        .live-video-intro-professor {
          margin: 10px 0 0;
          padding: 0 12px;
          font-family: var(--font-sans, Rubik, sans-serif);
          font-size: clamp(0.82rem, 3.15vw, 0.96rem);
          font-weight: 750;
          color: rgba(253, 224, 71, 0.96);
          line-height: 1.45;
          letter-spacing: 0.03em;
        }
        .live-video-intro-professor .live-video-loading-inline-dots {
          margin-inline-start: 5px;
        }
      `}</style>
      <style>{`.back-btn-inline{background:none;border:none;color:#aaa;font-size:0.9rem;cursor:pointer;align-self:flex-start;padding:4px 0;}`}</style>

      <div className="live-events-page">
        <button type="button" onClick={() => navigate('/')} style={backBtn}>← חזרה</button>

        <div>
          <h1 className="live-events-title">רב <span style={{color:'#FFE566'}}>VS</span> מדען</h1>
          <p className="live-events-subtitle">אירועי לייב מתוכננים באפליקציה</p>
        </div>

        <div className="live-youtube-toolbar" role="group" aria-label="דיבייטים מצולמים מיוטיוב">
          {LIVE_YOUTUBE_DEBATES.map((clip) => {
            const embedId = youtubeEmbedIdFromClip(clip);
            const actionable = Boolean(embedId);
            const isActive = actionable && activeYoutubeClip?.clipId === clip.id;
            return (
              <button
                key={clip.id}
                type="button"
                className={`live-youtube-toolbar-btn${isActive ? ' is-active' : ''}`}
                disabled={!actionable}
                title={actionable ? `צפייה: ${clip.label}` : 'יקושר כשנוסיף כתובת YouTube'}
                onClick={() => {
                  if (!actionable) return;
                  setActiveYoutubeClip({ clipId: clip.id, youtubeId: embedId, label: clip.label });
                }}
              >
                <span className="live-youtube-toolbar-btn-title">{clip.label}</span>
                {clip.channelLabel ? (
                  <span className="live-youtube-toolbar-btn-source">{clip.channelLabel}</span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div
          ref={liveVideoSlotRef}
          className="live-video-slot"
          role="region"
          aria-label={activeYoutubeClip ? 'דיבייט מצולם' : 'אמונה מול מדע — נגן פתיחה'}
        >
          {activeYoutubeClip ? (
            <>
              <div className="live-video-slot-head">
                <span aria-hidden style={{ width: 34 }} />
                <button
                  type="button"
                  className="live-video-slot-close"
                  onClick={() => setActiveYoutubeClip(null)}
                  aria-label="סגירת הסרטון וחזרה לפתיחה"
                >
                  ✕
                </button>
              </div>
              <div className="live-video-embed-wrap">
                <iframe
                  key={`${activeYoutubeClip.clipId}-${activeYoutubeClip.youtubeId}`}
                  src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(activeYoutubeClip.youtubeId)}?rel=0&modestbranding=1&playsinline=1${
                    activeYoutubeClip.clipId === LIVE_PAGE_INTRO_CLIP_ID ? '' : '&autoplay=1'
                  }`}
                  title={activeYoutubeClip.label}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  onLoad={() => setVideoEmbedLoaded(true)}
                />
                {!videoEmbedLoaded ? (
                  <div
                    className="live-video-loading-overlay"
                    aria-busy
                    aria-live="polite"
                  >
                    <p className="live-video-loading-title">
                      <DebateTitleParts label={activeYoutubeClip.label} vsClassName="live-video-loading-title-vs" />
                    </p>
                    <LiveVideoLoadingPhrases />
                    <div className="live-video-loading-shuttle" aria-hidden="true">
                      <span className="live-video-loading-dot" />
                      <span className="live-video-loading-dot" />
                      <span className="live-video-loading-dot" />
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <>
              {!mainDefaultOverlayDismissed ? (
                <div className="live-video-slot-default-head">
                  <h2 className="live-video-intro-title">
                    אמונה <span className="live-video-intro-title-vs">VS</span> מדע
                  </h2>
                  <p className="live-video-intro-tagline">חשיבה ביקורתית למציאת האמת</p>
                  <LiveVideoProfessorHeadline variant="header" />
                </div>
              ) : null}
              <div className="live-video-embed-wrap">
                {!mainDefaultIframeReady ? (
                  <div className="live-video-default-embed-loading" aria-busy aria-live="polite">
                    <LiveVideoLoadingPhrases withProfessor={false} />
                    <div className="live-video-loading-shuttle" aria-hidden="true">
                      <span className="live-video-loading-dot" />
                      <span className="live-video-loading-dot" />
                      <span className="live-video-loading-dot" />
                    </div>
                  </div>
                ) : null}
                {mainDefaultIframeReady && !mainDefaultOverlayDismissed ? (
                  <button
                    type="button"
                    className="live-video-default-embed-await-click"
                    aria-label="לחץ לנגינה בנגן"
                    onClick={() => setMainDefaultOverlayDismissed(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setMainDefaultOverlayDismissed(true);
                      }
                    }}
                  />
                ) : null}
                <iframe
                  key={`live-page-default-intro-${mainDefaultEmbedNonce}`}
                  src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(LIVE_PAGE_INTRO_VIDEO_ID)}?rel=0&modestbranding=1&playsinline=1`}
                  title="אמונה VS מדע"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  onLoad={() => setMainDefaultIframeReady(true)}
                />
              </div>
            </>
          )}
        </div>

        <aside className="live-ad-strip-placeholder" aria-label="מיקום מודעה — אירוע קרוב">
          <span className="live-ad-strip-placeholder-text">
            בקרוב: הרב זמיר כהן VS פרופ׳ יובל נוח הררי
          </span>
        </aside>

        <section
          className={`faith-science-vault${isOmgVaultEditor ? ' faith-science-vault--editor-on' : ''}`}
          aria-labelledby="faith-science-vault-heading"
        >
          <div className="faith-science-vault-head">
            <h2 id="faith-science-vault-heading" className="faith-science-vault-heading">
              אמונה · מדע · אבולוציה
            </h2>
            <p className="faith-science-vault-subheading">מאגר סרטונים נבחר</p>
            {!isOmgVaultEditor ? (
              <button
                type="button"
                className="faith-science-vault-enable-editor-btn"
                onClick={() => {
                  setVaultEditorEnabledFlag(true);
                  setOmgVaultEditorUi(true);
                }}
              >
                עריכת מאגר (מכשיר זה בלבד)
              </button>
            ) : null}
          </div>
          {isOmgVaultEditor ? (
            <div className="faith-science-vault-editor-banner" role="status">
              <span>
                מצב עורך OMG — השינויים נשמרים מקומית בדפדפן שלך בלבד (לא משפיע על משתמשים אחרים).
              </span>
              <div className="faith-science-vault-editor-banner-actions">
                <button
                  type="button"
                  className="faith-science-vault-editor-banner-btn"
                  onClick={() => {
                    clearVaultEditorPayload();
                    setVaultPayload(loadVaultEditorPayload());
                  }}
                >
                  איפוס מאגר (הצגת הכל + סדר ברירת מחדל)
                </button>
                <button
                  type="button"
                  className="faith-science-vault-editor-banner-btn"
                  onClick={() => {
                    setVaultEditorEnabledFlag(false);
                    setOmgVaultEditorUi(false);
                  }}
                >
                  יציאה ממצב עורך
                </button>
              </div>
            </div>
          ) : null}
          <div className="faith-science-vault-grid">
            {vaultDisplayItems.map((item, vaultIndex) => {
              const editorControls =
                isOmgVaultEditor ?
                  <div
                    className="faith-science-vault-editor-controls"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="faith-science-vault-editor-remove"
                      aria-label="הסר מהמאגר במכשיר זה"
                      title="הסר פריט"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        persistVaultPayload(
                          vaultEditorRemove(vaultPayload, item.id, FAITH_SCIENCE_VIDEO_VAULT),
                        );
                      }}
                    >
                      ✕
                    </button>
                    <button
                      type="button"
                      disabled={vaultIndex <= 0}
                      aria-label="הזז למעלה ברשימה"
                      title="למעלה"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        persistVaultPayload(
                          vaultEditorMove(vaultPayload, item.id, -1, FAITH_SCIENCE_VIDEO_VAULT),
                        );
                      }}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={vaultIndex >= vaultDisplayItems.length - 1}
                      aria-label="הזז למטה ברשימה"
                      title="למטה"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        persistVaultPayload(
                          vaultEditorMove(vaultPayload, item.id, 1, FAITH_SCIENCE_VIDEO_VAULT),
                        );
                      }}
                    >
                      ↓
                    </button>
                  </div>
                : null;

              if (item.kind === 'video') {
                const yid = youtubeEmbedIdFromClip({
                  youtubeId: item.youtubeId,
                  watchUrl: item.href,
                });
                return (
                  <div key={item.id} className="faith-science-vault-card-wrap">
                    <div
                      className="faith-science-vault-card faith-science-vault-card--video faith-science-vault-card--vault-picker"
                      role="button"
                      tabIndex={0}
                      onClick={() => openVaultVideoInMain(item)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openVaultVideoInMain(item);
                        }
                      }}
                      aria-label={`הפעלה בנגן הראשי למעלה: ${item.title}`}
                    >
                      <span className="faith-science-vault-title">{item.title}</span>
                      {item.channelLabel ? (
                        <span className="faith-science-vault-source">{item.channelLabel}</span>
                      ) : null}
                      {yid ? (
                        <div className="faith-science-vault-embed-wrap">
                          <img
                            src={`https://i.ytimg.com/vi/${encodeURIComponent(yid)}/hqdefault.jpg`}
                            alt=""
                            loading="lazy"
                            className="faith-science-vault-thumb-img"
                          />
                          <div className="faith-science-vault-thumb-overlay" aria-hidden="true">
                            <span className="faith-science-vault-thumb-play">▶</span>
                          </div>
                          {editorControls}
                        </div>
                      ) : (
                        <div className="faith-science-vault-embed-placeholder">
                          לחיצה פותחת ביוטיוב — אין מזהה להטמעה
                          {editorControls}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              return (
                <div key={item.id} className="faith-science-vault-card-wrap">
                  <div className="faith-science-vault-card faith-science-vault-card--external">
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="faith-science-vault-external-title-link"
                    >
                      <span className="faith-science-vault-title">{item.title}</span>
                      {item.channelLabel ? (
                        <span className="faith-science-vault-source">{item.channelLabel}</span>
                      ) : null}
                    </a>
                    <div className="faith-science-vault-embed-placeholder">
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="faith-science-vault-placeholder-fill-link"
                      >
                        נפתח ביוטיוב — אין נגן מוטמע לדף זה
                      </a>
                      {editorControls}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <p className="events-empty-notice">עוד אירועים יתווספו בקרוב ◆ עקבו אחרינו</p>
      </div>
    </>
  );
}

const backBtn = {
  background: 'none', border: 'none', color: '#aaa',
  fontSize: '0.9rem', cursor: 'pointer', alignSelf: 'flex-start', padding: '4px 0',
};
