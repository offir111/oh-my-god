import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BiblePanel } from '../components/ui/BibleModal.jsx';
import FaithChatPanel from '../components/faith/FaithChatPanel.jsx';
import { FaithSubnavTabs } from '../components/faith/FaithSubnavTabs.jsx';
import { RABBI_QUESTION_GROUPS } from '../data/rabbiCommonQuestions.js';
import { fetchIsraelShabbatCandles } from '../lib/hebcalShabbatTimes.js';
import {
  lookupShabbatHalacha,
  listShabbatHalachaArchive,
  SHABBAT_HALACHA_BY_HEBREW_MONTH_DAY,
} from '../data/shabbatHalachaDaily.js';

const FALLBACK_API_ORIGIN = 'https://oh-my-god-production.up.railway.app';
function knowledgeAskUrl() {
  const env = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
  if (env) return `${env}/api/knowledge-ask`;
  // תמיד Railway — גם ב-localhost (המפתח מוגדר רק ב-Railway)
  return `${FALLBACK_API_ORIGIN}/api/knowledge-ask`;
}
const AI_WORD_LIMIT = 40;

export default function ReligionFaithPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('chat');
  const [faithSearch, setFaithSearch] = useState('');
  const [rabbiSearchPlaceholder, setRabbiSearchPlaceholder] = useState(false);
  const [faithSearchFocused, setFaithSearchFocused] = useState(false);
  const faithSearchInputRef = useRef(null);
  const shabbatEnterWrapRef = useRef(null);
  const halachaAnchorWrapRef = useRef(null);
  const candleAbortRef = useRef(null);
  const halachaAbortRef = useRef(null);

  const [shabbatEnterPopoverOpen, setShabbatEnterPopoverOpen] = useState(false);
  const [candleRows, setCandleRows] = useState(null);
  const [candleLoading, setCandleLoading] = useState(false);
  const [candleErr, setCandleErr] = useState(null);

  const [halachaModalOpen, setHalachaModalOpen] = useState(false);
  const [halachaModalLoading, setHalachaModalLoading] = useState(false);
  const [halachaModalConv, setHalachaModalConv] = useState(null);
  const [halachaModalErr, setHalachaModalErr] = useState(null);
  /** מפתח מאגר (למשל Iyyar-2) כשבוחרים מהרשימה */
  const [halachaManualKey, setHalachaManualKey] = useState(null);

  // ── AI state ──────────────────────────────────────────
  const [faithAiAnswer, setFaithAiAnswer] = useState('');
  const [faithAiLoading, setFaithAiLoading] = useState(false);
  const [faithAiError, setFaithAiError] = useState('');
  const [faithDisplayedAnswer, setFaithDisplayedAnswer] = useState('');
  const [faithExpandedAnswer, setFaithExpandedAnswer] = useState(false);
  const faithRafRef = useRef(null);

  // typewriter effect
  useEffect(() => {
    if (faithRafRef.current) cancelAnimationFrame(faithRafRef.current);
    if (!faithAiAnswer) { setFaithDisplayedAnswer(''); return; }
    setFaithDisplayedAnswer('');
    let idx = 0;
    const full = faithAiAnswer;
    function tick() {
      idx = Math.min(idx + 7, full.length);
      setFaithDisplayedAnswer(full.slice(0, idx));
      if (idx < full.length) faithRafRef.current = requestAnimationFrame(tick);
    }
    faithRafRef.current = requestAnimationFrame(tick);
    return () => { if (faithRafRef.current) cancelAnimationFrame(faithRafRef.current); };
  }, [faithAiAnswer]);

  /** סנכרון טאבים עם #chat / #rabbi וכו׳ — קישור ״צ׳אט״ בשורת הניווט הגלובלית */
  useEffect(() => {
    if (location.pathname !== '/faith') return;
    const raw = (location.hash || '').replace(/^#/, '');
    if (!raw) return;
    const id = raw.toLowerCase();
    if (id === 'mefarsim' || id === 'ads') {
      navigate('/faith/mefarsim', { replace: true });
      return;
    }
    if (id === 'chat') setActiveTab('chat');
    else if (id === 'rabbi') {
      setActiveTab('rabbi');
      setRabbiSearchPlaceholder(true);
    } else if (id === 'bible') setActiveTab('bible');
    else if (id === 'more') setActiveTab('more');
  }, [location.pathname, location.hash, navigate]);

  function wordCount(text) {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }
  function truncateWords(text, n) {
    const words = text.trim().split(/\s+/).filter(Boolean);
    return words.length <= n ? text : words.slice(0, n).join(' ');
  }
  function clearFaithAi() {
    if (faithRafRef.current) cancelAnimationFrame(faithRafRef.current);
    setFaithAiAnswer('');
    setFaithAiError('');
    setFaithDisplayedAnswer('');
    setFaithExpandedAnswer(false);
  }

  async function fetchFaithAiAnswer(q) {
    if (!q || faithAiLoading) return;
    setFaithAiLoading(true);
    setFaithAiError('');
    setFaithAiAnswer('');
    setFaithExpandedAnswer(false);
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 90000);
    try {
      const res = await fetch(knowledgeAskUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
        signal: ctrl.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'לא ניתן לקבל תשובה');
      const answer = typeof data.answer === 'string' ? data.answer.trim() : '';
      if (!answer) throw new Error('לא התקבלה תשובה מהשרת');
      setFaithAiAnswer(answer);
    } catch (e) {
      const name = e?.name;
      if (name === 'AbortError') setFaithAiError('תם הזמן — נסה שוב.');
      else if (name === 'TypeError') setFaithAiError('לא ניתן להתחבר לשרת.');
      else setFaithAiError(e.message || 'שגיאה');
    } finally {
      clearTimeout(tid);
      setFaithAiLoading(false);
    }
  }

  function renderFaithAiSlot() {
    if (!faithAiLoading && !faithAiAnswer && !faithAiError) return null;
    const isTyping = faithDisplayedAnswer.length < faithAiAnswer.length;
    const totalWords = wordCount(faithAiAnswer);
    const displayedWords = wordCount(faithDisplayedAnswer);
    const needsTrunc = totalWords > AI_WORD_LIMIT;
    const showExpand = needsTrunc && !faithExpandedAnswer && displayedWords >= AI_WORD_LIMIT;
    const visibleText = (!faithExpandedAnswer && needsTrunc)
      ? truncateWords(faithDisplayedAnswer, AI_WORD_LIMIT)
      : faithDisplayedAnswer;
    return (
      <div className="faith-ai-slot">
        {faithAiLoading && (
          <div className="faith-ai-bubble faith-ai-bubble--loading">
            <div className="faith-ai-label">🤖 AI — דת ואמונה<span className="faith-ai-dots"><span>.</span><span>.</span><span>.</span></span></div>
          </div>
        )}
        {faithAiError && !faithAiLoading && (
          <div className="faith-ai-bubble faith-ai-bubble--err">
            <div className="faith-ai-label">⚠️ שגיאה</div>
            <div>{faithAiError}</div>
          </div>
        )}
        {faithAiAnswer && !faithAiLoading && !faithAiError && (
          <div className="faith-ai-bubble">
            <div className="faith-ai-label">🤖 AI — דת ואמונה</div>
            <div className="faith-ai-text">
              {visibleText}
              {!showExpand && isTyping && displayedWords < AI_WORD_LIMIT && (
                <span className="faith-ai-cursor" aria-hidden />
              )}
              {!showExpand && isTyping && faithExpandedAnswer && (
                <span className="faith-ai-cursor" aria-hidden />
              )}
            </div>
            {showExpand && (
              <button type="button" className="faith-ai-expand-btn" onClick={() => setFaithExpandedAnswer(true)}>
                המשך...
              </button>
            )}
          </div>
        )}
      </div>
    );
  }
  // ── end AI state ───────────────────────────────────────

  const showRabbiWordsOverlay =
    rabbiSearchPlaceholder && !faithSearch.trim() && !faithSearchFocused;

  const normalizedFaithSearch = faithSearch.trim().toLowerCase();

  useEffect(() => {
    if (activeTab !== 'rabbi') setRabbiSearchPlaceholder(false);
  }, [activeTab]);

  const loadShabbatCandles = useCallback(async () => {
    if (candleAbortRef.current) candleAbortRef.current.abort();
    const ac = new AbortController();
    candleAbortRef.current = ac;
    setCandleLoading(true);
    setCandleErr(null);
    try {
      const rows = await fetchIsraelShabbatCandles(ac.signal);
      setCandleRows(rows);
    } catch (e) {
      if (e?.name === 'AbortError') return;
      setCandleErr(typeof e?.message === 'string' ? e.message : 'שגיאה בטעינת זמנים');
    } finally {
      setCandleLoading(false);
    }
  }, []);

  useEffect(() => {
    loadShabbatCandles();
    return () => candleAbortRef.current?.abort();
  }, [loadShabbatCandles]);

  const loadHalachaModalData = useCallback(async () => {
    if (halachaAbortRef.current) halachaAbortRef.current.abort();
    const ac = new AbortController();
    halachaAbortRef.current = ac;
    setHalachaModalLoading(true);
    setHalachaModalErr(null);
    setHalachaModalConv(null);
    try {
      const d = new Date();
      const url = `https://www.hebcal.com/converter?cfg=json&gy=${d.getFullYear()}&gm=${d.getMonth() + 1}&gd=${d.getDate()}&g2h=1`;
      const res = await fetch(url, { signal: ac.signal });
      if (!res.ok) throw new Error('לא ניתן לקבל תאריך עברי');
      const json = await res.json();
      setHalachaModalConv(json);
    } catch (e) {
      if (e?.name === 'AbortError') return;
      setHalachaModalErr(typeof e?.message === 'string' ? e.message : 'שגיאה בטעינה');
    } finally {
      setHalachaModalLoading(false);
    }
  }, []);

  function openHalachaModal() {
    setHalachaManualKey(null);
    setHalachaModalOpen(true);
    void loadHalachaModalData();
  }

  useEffect(() => {
    if (!halachaModalOpen) return;
    function onKey(e) {
      if (e.key === 'Escape') setHalachaModalOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [halachaModalOpen]);

  const halachaArchiveList = useMemo(() => listShabbatHalachaArchive(), []);

  const halachaDisplayEntry = useMemo(() => {
    if (halachaManualKey) return SHABBAT_HALACHA_BY_HEBREW_MONTH_DAY[halachaManualKey] || null;
    if (!halachaModalConv) return null;
    return lookupShabbatHalacha(halachaModalConv);
  }, [halachaManualKey, halachaModalConv]);

  useEffect(() => {
    if (!halachaModalOpen) {
      halachaAbortRef.current?.abort();
    }
  }, [halachaModalOpen]);

  useEffect(() => {
    if (!halachaModalOpen) return;
    function onDocPointerDown(e) {
      if (halachaAnchorWrapRef.current?.contains(e.target)) return;
      setHalachaModalOpen(false);
    }
    document.addEventListener('pointerdown', onDocPointerDown, true);
    return () => document.removeEventListener('pointerdown', onDocPointerDown, true);
  }, [halachaModalOpen]);

  useEffect(() => {
    if (!shabbatEnterPopoverOpen) return;
    function onDocPointerDown(e) {
      if (shabbatEnterWrapRef.current?.contains(e.target)) return;
      setShabbatEnterPopoverOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setShabbatEnterPopoverOpen(false);
    }
    document.addEventListener('pointerdown', onDocPointerDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDocPointerDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [shabbatEnterPopoverOpen]);

  const candleParashaLine = candleRows?.find((r) => r.parashaHebrew)?.parashaHebrew || '';
  const candleEveLabel = candleRows?.[0]?.eveLabel || '';

  const [openRabbiKeys, setOpenRabbiKeys] = useState(() => new Set());

  function toggleRabbiAnswer(key) {
    setOpenRabbiKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const filteredRabbiGroups = useMemo(() => {
    function itemMatches(item, needle) {
      if (item.q.toLowerCase().includes(needle)) return true;
      if (item.preview.toLowerCase().includes(needle)) return true;
      if (item.answer.toLowerCase().includes(needle)) return true;
      return false;
    }
    if (!normalizedFaithSearch) return RABBI_QUESTION_GROUPS;
    return RABBI_QUESTION_GROUPS.map((group) => {
      const topicMatch = group.topic.toLowerCase().includes(normalizedFaithSearch);
      const items = topicMatch
        ? group.items
        : group.items.filter((item) => itemMatches(item, normalizedFaithSearch));
      if (!topicMatch && items.length === 0) return null;
      return { ...group, items };
    }).filter(Boolean);
  }, [normalizedFaithSearch]);

  function submitFaithSearch() {
    const q = faithSearch.trim();
    if (!q) return;
    setActiveTab('rabbi');
    void fetchFaithAiAnswer(q);
  }

  function openShabbatTopic(label) {
    setActiveTab('rabbi');
    navigate('/faith#rabbi', { replace: true });
    setRabbiSearchPlaceholder(false);
    setFaithSearch(label);
    clearFaithAi();
    requestAnimationFrame(() => faithSearchInputRef.current?.focus());
  }

  return (
    <>
      <style>{`
        .faith-page {
          min-height: calc(100vh - var(--shell-top));
          background: transparent;
          color: var(--text);
          direction: rtl;
          padding: 0 0 52px;
        }
        .faith-header {
          position: relative;
          overflow: visible;
          text-align: center;
          padding: 26px 16px 20px;
          border-bottom: 1px solid var(--border);
          background: linear-gradient(180deg, rgba(255,255,255,0.04), transparent);
        }
        .faith-header h1 {
          font-size: clamp(1.5rem, 5.2vw, 2.15rem);
          font-weight: 900;
          margin: 0 0 8px;
          letter-spacing: 0.02em;
        }
        .faith-header p {
          color: var(--muted);
          font-size: 0.88rem;
          max-width: 460px;
          margin: 0 auto;
          line-height: 1.55;
        }
        .faith-header .args-knowledge-composer-wrap {
          max-width: min(720px, calc(100% - 24px));
          margin: 12px auto 0;
          padding: 0 12px;
          direction: rtl;
        }
        .faith-header .args-knowledge-debate-composer.debate-composer {
          margin-top: 0;
          padding-top: 0;
          border-top: none;
          background: transparent;
          gap: 12px;
          align-items: stretch;
        }
        .faith-search-input-shell {
          position: relative;
          flex: 1;
          min-width: 0;
        }
        .faith-header .args-knowledge-debate-composer .faith-search-input-shell input {
          flex: 1;
          width: 100%;
          min-height: 48px;
          border-radius: 999px;
          padding: 14px 20px;
          background: rgba(10, 10, 16, 0.55);
          border: 1px solid rgba(255, 255, 255, 0.16);
          text-align: right;
        }
        .faith-header .args-knowledge-debate-composer .btn-believer {
          border-radius: 999px;
          min-width: 96px;
          padding-inline: 22px;
          flex-shrink: 0;
        }
        @keyframes faith-rabbi-search-blink {
          0% { opacity: 1; }
          2% { opacity: 0.52; }
          4% { opacity: 1; }
          6% { opacity: 0.52; }
          8% { opacity: 1; }
          10% { opacity: 0.52; }
          12% { opacity: 1; }
          12%, 100% { opacity: 1; }
        }
        .faith-rabbi-placeholder-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          padding: 14px 20px;
          pointer-events: none;
          direction: rtl;
          gap: 0.2em;
          font-size: 1rem;
          white-space: nowrap;
        }
        .faith-rabbi-ph-w1,
        .faith-rabbi-ph-w2 {
          display: inline-block;
          color: #fbbf24;
          font-weight: 900;
          animation: faith-rabbi-search-blink 20s ease-in-out infinite;
        }
        .faith-rabbi-ph-w2 {
          animation-delay: 0.38s;
        }
        .faith-rabbi-ph-dots {
          color: rgba(251, 191, 36, 0.55);
          letter-spacing: 0.02em;
          font-weight: 700;
        }
        .faith-shabbat-actions {
          position: absolute;
          top: 14px;
          left: 12px;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          z-index: 2;
          max-width: calc(100% - 24px);
        }
        .faith-shabbat-actions[data-halacha-open='true'] {
          z-index: 100060;
        }
        .faith-halacha-anchor-wrap {
          position: relative;
          display: inline-flex;
          flex-direction: column;
          align-items: stretch;
        }
        .faith-shabbat-chip {
          padding: 3px 9px;
          font-size: 0.66rem;
          font-weight: 700;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.04);
          color: rgba(203,213,225,0.85);
          cursor: pointer;
          line-height: 1.35;
          white-space: nowrap;
        }
        .faith-shabbat-chip:hover {
          background: rgba(255,255,255,0.08);
          color: #e2e8f0;
          border-color: rgba(255,255,255,0.18);
        }
        .faith-shabbat-chip:focus-visible {
          outline: 2px solid rgba(251,191,36,0.45);
          outline-offset: 2px;
        }
        .faith-shabbat-enter-wrap {
          position: relative;
          display: inline-flex;
          flex-direction: column;
          align-items: stretch;
        }
        .faith-shabbat-chip--enter {
          white-space: nowrap;
          max-width: none;
          padding-block: 4px;
        }
        .faith-shabbat-popover {
          display: none;
          position: absolute;
          top: calc(100% - 5px);
          left: 0;
          min-width: 248px;
          max-width: min(304px, calc(100vw - 28px));
          padding: 10px 11px 9px;
          border-radius: 11px;
          background: rgba(12,17,28,0.98);
          border: 1px solid rgba(255,255,255,0.14);
          box-shadow: 0 14px 42px rgba(0,0,0,0.5);
          z-index: 60;
          direction: rtl;
          text-align: right;
        }
        .faith-shabbat-enter-wrap[data-open='true'] .faith-shabbat-popover {
          display: block;
        }
        .faith-shabbat-pop-title {
          font-size: 0.72rem;
          font-weight: 900;
          color: #fef9c3;
          margin: 0 0 8px;
          letter-spacing: 0.02em;
        }
        .faith-shabbat-pop-headrow {
          display: grid;
          grid-template-columns: 1fr auto auto;
          gap: 10px;
          align-items: baseline;
          font-size: 0.61rem;
          font-weight: 800;
          color: rgba(148,163,184,0.92);
          padding: 0 0 6px;
          margin-bottom: 4px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .faith-shabbat-pop-headrow span:nth-child(2),
        .faith-shabbat-pop-headrow span:nth-child(3) {
          font-variant-numeric: tabular-nums;
          text-align: left;
          justify-self: start;
        }
        .faith-shabbat-pop-row {
          display: grid;
          grid-template-columns: 1fr auto auto;
          gap: 10px;
          align-items: baseline;
          font-size: 0.74rem;
          padding: 5px 0;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          color: rgba(226,232,240,0.94);
        }
        .faith-shabbat-pop-row:last-child {
          border-bottom: none;
          padding-bottom: 2px;
        }
        .faith-shabbat-pop-city {
          font-weight: 750;
          color: rgba(203,213,225,0.95);
        }
        .faith-shabbat-pop-time {
          font-variant-numeric: tabular-nums;
          font-weight: 900;
          color: #a5f3fc;
          white-space: nowrap;
          text-align: left;
          justify-self: start;
        }
        .faith-shabbat-pop-time--out {
          color: #ddd6fe;
        }
        .faith-shabbat-pop-parsha {
          margin-top: 8px;
          font-size: 0.68rem;
          color: rgba(253,224,71,0.88);
          font-weight: 700;
          line-height: 1.45;
        }
        .faith-shabbat-pop-foot {
          margin-top: 10px;
          font-size: 0.58rem;
          color: rgba(148,163,184,0.82);
          line-height: 1.45;
        }
        .faith-shabbat-pop-foot a {
          color: rgba(147,197,253,0.92);
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .faith-shabbat-pop-err {
          font-size: 0.72rem;
          color: #fecaca;
          margin: 0;
          line-height: 1.45;
        }
        .faith-halacha-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 100051;
          margin: 0;
          padding: 0;
          border: none;
          background: rgba(2, 6, 23, 0.62);
          cursor: pointer;
        }
        .faith-halacha-modal-dialog {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          z-index: 100052;
          width: min(440px, calc(100vw - 24px));
          max-height: min(74vh, 600px);
          display: flex;
          flex-direction: column;
          border-radius: 16px;
          background: rgba(15, 23, 42, 0.98);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 28px 80px rgba(0,0,0,0.55);
          direction: rtl;
          text-align: right;
          overflow: hidden;
        }
        .faith-halacha-modal-head {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 12px 14px 10px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .faith-halacha-modal-title {
          margin: 0;
          font-size: 1rem;
          font-weight: 900;
          color: #fef9c3;
          letter-spacing: 0.02em;
        }
        .faith-halacha-modal-close {
          flex-shrink: 0;
          width: 34px;
          height: 34px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.06);
          color: rgba(226,232,240,0.95);
          font-size: 1.05rem;
          line-height: 1;
          cursor: pointer;
          font-weight: 700;
        }
        .faith-halacha-modal-close:hover {
          background: rgba(255,255,255,0.12);
        }
        .faith-halacha-modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 14px 16px 18px;
          -webkit-overflow-scrolling: touch;
        }
        .faith-halacha-muted {
          font-size: 0.82rem;
          color: rgba(148,163,184,0.95);
          margin: 0 0 10px;
          line-height: 1.5;
        }
        .faith-halacha-err {
          font-size: 0.84rem;
          color: #fecaca;
          margin: 0 0 12px;
          line-height: 1.45;
        }
        .faith-halacha-date-line {
          font-size: 0.84rem;
          color: rgba(226,232,240,0.94);
          margin: 0 0 12px;
          line-height: 1.55;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
        }
        .faith-halacha-pill {
          font-size: 0.62rem;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 999px;
          background: rgba(99,102,241,0.25);
          border: 1px solid rgba(129,140,248,0.35);
          color: #e0e7ff;
        }
        .faith-halacha-linkback {
          margin: 0 0 14px;
          padding: 5px 11px;
          border-radius: 8px;
          border: 1px solid rgba(251,191,36,0.35);
          background: rgba(251,191,36,0.1);
          color: #fde68a;
          font-size: 0.74rem;
          font-weight: 800;
          cursor: pointer;
        }
        .faith-halacha-article {
          margin-bottom: 18px;
          padding: 12px 13px;
          border-radius: 12px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
        }
        .faith-halacha-entry-title {
          margin: 0 0 6px;
          font-size: 0.98rem;
          font-weight: 900;
          color: #fef08a;
          line-height: 1.35;
        }
        .faith-halacha-entry-meta {
          margin: 0 0 12px;
          font-size: 0.74rem;
          color: rgba(165,243,252,0.92);
          font-weight: 700;
        }
        .faith-halacha-entry-body {
          font-size: 0.86rem;
          line-height: 1.65;
          color: rgba(241,245,249,0.94);
        }
        .faith-halacha-entry-body p {
          margin: 0 0 10px;
        }
        .faith-halacha-entry-body p:last-child {
          margin-bottom: 0;
        }
        .faith-halacha-sources {
          margin-top: 12px;
          font-size: 0.74rem;
          color: rgba(203,213,225,0.88);
          line-height: 1.55;
          font-weight: 600;
        }
        .faith-halacha-empty {
          margin-bottom: 16px;
          padding: 12px;
          border-radius: 11px;
          border: 1px dashed rgba(255,255,255,0.12);
          background: rgba(0,0,0,0.15);
        }
        .faith-halacha-empty p {
          margin: 0 0 8px;
          font-size: 0.84rem;
          line-height: 1.55;
          color: rgba(226,232,240,0.92);
        }
        .faith-halacha-archive-block {
          margin-top: 8px;
          padding-top: 12px;
          border-top: 1px solid rgba(255,255,255,0.08);
        }
        .faith-halacha-archive-heading {
          margin: 0 0 10px;
          font-size: 0.76rem;
          font-weight: 900;
          color: rgba(203,213,225,0.9);
          letter-spacing: 0.03em;
        }
        .faith-halacha-archive-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 7px;
        }
        .faith-halacha-archive-btn {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 3px;
          text-align: right;
          padding: 9px 11px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
          color: inherit;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
        }
        .faith-halacha-archive-btn:hover {
          background: rgba(255,255,255,0.07);
          border-color: rgba(255,255,255,0.16);
        }
        .faith-halacha-archive-btn.active {
          border-color: rgba(251,191,36,0.45);
          background: rgba(251,191,36,0.1);
        }
        .faith-halacha-archive-date {
          font-size: 0.68rem;
          font-weight: 800;
          color: rgba(253,224,71,0.9);
        }
        .faith-halacha-archive-topic {
          font-size: 0.8rem;
          font-weight: 750;
          color: rgba(248,250,252,0.94);
          line-height: 1.35;
        }
        .faith-halacha-actions-row {
          margin-top: 16px;
          padding-top: 14px;
          border-top: 1px solid rgba(255,255,255,0.08);
        }
        .faith-halacha-rabbi-btn {
          width: 100%;
          padding: 10px 14px;
          border-radius: 11px;
          border: 1px solid rgba(34,197,94,0.4);
          background: rgba(16,185,129,0.15);
          color: #bbf7d0;
          font-size: 0.82rem;
          font-weight: 900;
          cursor: pointer;
        }
        .faith-halacha-rabbi-btn:hover {
          background: rgba(16,185,129,0.24);
        }
        .faith-cats-wrap {
          position: relative;
          border-bottom: 1px solid var(--border);
        }
        .faith-cats {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          scroll-behavior: smooth;
          padding: 14px 16px 18px;
          scrollbar-width: none;
        }
        .faith-cats::-webkit-scrollbar { display: none; }
        .faith-cat-btn {
          white-space: nowrap;
          padding: 9px 18px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.04);
          color: rgba(245,247,255,0.86);
          font-size: 0.84rem;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.2s, color 0.2s, border-color 0.2s;
        }
        .faith-cat-btn:hover {
          color: #fff;
          background: rgba(255,255,255,0.08);
        }
        .faith-cat-btn.active {
          background: linear-gradient(145deg, #fff, #d8d8e4);
          color: #0a0a10;
          border-color: rgba(255,255,255,0.4);
          font-weight: 800;
        }
        .faith-rabbi-wrap {
          max-width: 720px;
          margin: 22px auto 0;
          padding: 0 16px 24px;
        }
        .faith-rabbi-intro {
          font-size: 0.86rem;
          color: rgba(226,232,240,0.88);
          line-height: 1.6;
          margin-bottom: 18px;
          text-align: center;
        }
        .faith-rabbi-page-title {
          font-size: clamp(1.35rem, 4.5vw, 1.85rem);
          font-weight: 900;
          margin: 0 0 8px;
          text-align: center;
          letter-spacing: 0.02em;
        }
        .faith-rabbi-page-sub {
          font-size: 0.9rem;
          color: var(--muted);
          line-height: 1.55;
          margin: 0 0 22px;
          text-align: center;
          max-width: 32em;
          margin-left: auto;
          margin-right: auto;
        }
        .faith-rabbi-group {
          margin-bottom: 22px;
        }
        .faith-rabbi-q {
          margin: 0 0 8px;
          font-size: 0.88rem;
          font-weight: 700;
          line-height: 1.45;
          color: rgba(248, 250, 252, 0.96);
        }
        .faith-rabbi-preview-btn {
          display: block;
          width: 100%;
          text-align: right;
          margin: 0 0 10px;
          padding: 10px 12px;
          border: none;
          border-radius: 10px;
          background: rgba(251, 191, 36, 0.12);
          color: #fcd34d;
          font: inherit;
          font-size: 0.82rem;
          line-height: 1.5;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .faith-rabbi-preview-btn:hover {
          background: rgba(251, 191, 36, 0.22);
          color: #fde68a;
        }
        .faith-rabbi-preview-btn:focus-visible {
          outline: 2px solid rgba(251, 191, 36, 0.55);
          outline-offset: 2px;
        }
        .faith-rabbi-answer-full {
          margin: 0;
          padding: 12px 14px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.08);
          font-size: 0.84rem;
          line-height: 1.65;
          color: rgba(226, 232, 240, 0.94);
          white-space: pre-wrap;
          word-break: break-word;
        }
        .faith-rabbi-topic {
          font-size: 0.92rem;
          font-weight: 900;
          margin: 0 0 10px;
          color: #fbbf24;
          letter-spacing: 0.02em;
        }
        .faith-rabbi-list {
          list-style: none;
          margin: 0;
          padding: 0;
        }
        .faith-rabbi-list li {
          font-size: 0.86rem;
          line-height: 1.5;
          padding: 8px 12px;
          margin-bottom: 6px;
          border-radius: 10px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.06);
        }
        .faith-bible-wrap {
          max-width: 760px;
          margin: 18px auto 0;
          padding: 0 12px;
        }
        .faith-bible-wrap .knowledge-bible-panel .bm-sheet-embedded {
          max-width: none;
          max-height: none;
          min-height: 640px;
        }
        .faith-more-wrap {
          max-width: 960px;
          margin: 22px auto 0;
          padding: 0 16px;
        }
        .faith-more-columns {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0;
          border: 1px solid var(--border);
          border-radius: 16px;
          overflow: hidden;
        }
        .faith-more-col {
          padding: 20px 16px;
          border-left: 1px solid var(--border);
          min-height: 200px;
        }
        .faith-more-col:first-child { border-left: none; }
        .faith-more-col h3 {
          margin: 0 0 12px;
          font-size: 0.95rem;
          text-align: center;
          color: var(--muted);
          font-weight: 800;
        }
        .faith-placeholder-box {
          border: 1px dashed rgba(255,255,255,0.14);
          border-radius: 12px;
          padding: 24px 16px;
          text-align: center;
          color: var(--muted);
          font-size: 0.84rem;
          line-height: 1.55;
        }
        .faith-ai-slot {
          max-width: min(720px, calc(100% - 24px));
          margin: 10px auto 0;
          padding: 0 12px 4px;
          direction: rtl;
          text-align: right;
        }
        .faith-ai-bubble {
          position: relative;
          padding: 14px 18px;
          border-radius: 4px 18px 18px 18px;
          background: linear-gradient(145deg, rgba(99,102,241,0.16) 0%, rgba(15,23,42,0.92) 100%);
          border: 1px solid rgba(99,102,241,0.28);
          font-size: 0.91rem;
          line-height: 1.7;
          color: #e2e8f0;
          box-shadow: 0 8px 28px rgba(99,102,241,0.1), inset 0 1px 0 rgba(255,255,255,0.06);
        }
        .faith-ai-bubble--loading {
          background: linear-gradient(145deg, rgba(99,102,241,0.08) 0%, rgba(15,23,42,0.85) 100%);
        }
        .faith-ai-bubble--err {
          border-color: rgba(248,113,113,0.42);
          background: linear-gradient(145deg, rgba(248,113,113,0.12) 0%, rgba(60,10,10,0.88) 100%);
          color: #fecaca;
        }
        .faith-ai-label {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 0.7rem;
          font-weight: 800;
          color: rgba(165,180,252,0.85);
          margin-bottom: 8px;
          letter-spacing: 0.07em;
          text-transform: uppercase;
        }
        .faith-ai-text { white-space: pre-wrap; word-break: break-word; }
        .faith-ai-cursor {
          display: inline-block;
          width: 2px;
          height: 1em;
          background: #a5b4fc;
          margin-right: 1px;
          vertical-align: text-bottom;
          border-radius: 1px;
          animation: faithCursorBlink 0.55s ease infinite;
        }
        @keyframes faithCursorBlink {
          0%, 45% { opacity: 1; }
          55%, 100% { opacity: 0; }
        }
        .faith-ai-dots span {
          animation: faithDotPulse 1.2s ease infinite;
          opacity: 0;
        }
        .faith-ai-dots span:nth-child(1) { animation-delay: 0s; }
        .faith-ai-dots span:nth-child(2) { animation-delay: 0.3s; }
        .faith-ai-dots span:nth-child(3) { animation-delay: 0.6s; }
        @keyframes faithDotPulse {
          0%, 100% { opacity: 0; }
          40% { opacity: 1; }
        }
        .faith-ai-expand-btn {
          display: inline-block;
          margin-top: 10px;
          padding: 5px 14px;
          border-radius: 999px;
          border: 1px solid rgba(165,180,252,0.35);
          background: rgba(99,102,241,0.15);
          color: #a5b4fc;
          font-size: 0.82rem;
          font-weight: 800;
          cursor: pointer;
          transition: background 0.18s, border-color 0.18s, color 0.18s;
        }
        .faith-ai-expand-btn:hover {
          background: rgba(99,102,241,0.28);
          border-color: rgba(165,180,252,0.6);
          color: #c7d2fe;
        }
        .faith-rabbi-inline-wrap {
          max-width: min(720px, calc(100% - 24px));
          margin: 12px auto 0;
          padding: 0 12px 10px;
          direction: rtl;
          text-align: right;
          border-top: 1px solid rgba(255,255,255,0.08);
          max-height: 50vh;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.12) transparent;
        }
        .faith-rabbi-inline-wrap::-webkit-scrollbar { width: 4px; }
        .faith-rabbi-inline-wrap::-webkit-scrollbar-track { background: transparent; }
        .faith-rabbi-inline-wrap::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }
        @media (max-width: 560px) {
          .faith-shabbat-actions {
            position: static;
            justify-content: center;
            margin: 0 auto 12px;
            max-width: 100%;
            left: auto;
            top: auto;
          }
          .faith-more-columns { grid-template-columns: 1fr; }
          .faith-more-col { border-left: none; border-bottom: 1px solid var(--border); }
          .faith-more-col:last-child { border-bottom: none; }
          .faith-shabbat-chip--enter {
            max-width: none;
          }
          .faith-shabbat-popover {
            left: 50%;
            right: auto;
            transform: translateX(-50%);
          }
          .faith-halacha-modal-dialog {
            left: 50%;
            right: auto;
            transform: translateX(-50%);
          }
        }
      `}</style>

      <div className="faith-page">
        <header className="faith-header">
          <div
            className="faith-shabbat-actions"
            role="group"
            aria-label="זמני שבת והלכות"
            data-halacha-open={halachaModalOpen ? 'true' : 'false'}
          >
            <div
              className="faith-shabbat-enter-wrap"
              ref={shabbatEnterWrapRef}
              data-open={shabbatEnterPopoverOpen ? 'true' : 'false'}
              onMouseLeave={() => setShabbatEnterPopoverOpen(false)}
            >
              <button
                type="button"
                className="faith-shabbat-chip faith-shabbat-chip--enter"
                aria-expanded={shabbatEnterPopoverOpen}
                aria-haspopup="dialog"
                aria-controls="faith-shabbat-times-popover"
                onClick={() => {
                  setShabbatEnterPopoverOpen(true);
                  void loadShabbatCandles();
                }}
              >
                כניסת שבת
              </button>
              <div
                id="faith-shabbat-times-popover"
                className="faith-shabbat-popover"
                role="dialog"
                aria-label="זמני כניסת שבת ויציאת שבת"
              >
                <p className="faith-shabbat-pop-title">כניסת שבת ויציאת שבת</p>
                {candleLoading && !candleRows ? (
                  <p className="faith-shabbat-pop-foot" style={{ marginTop: 0 }}>טוען נתונים מעודכנים…</p>
                ) : null}
                {candleErr && !candleRows ? (
                  <p className="faith-shabbat-pop-err">{candleErr}</p>
                ) : null}
                {candleRows?.length ? (
                  <>
                    <div className="faith-shabbat-pop-headrow" aria-hidden="true">
                      <span className="faith-shabbat-pop-city">עיר</span>
                      <span>כניסה</span>
                      <span>יציאה</span>
                    </div>
                    {candleRows.map((r) => (
                      <div key={r.key} className="faith-shabbat-pop-row">
                        <span className="faith-shabbat-pop-city">{r.label}</span>
                        <span className="faith-shabbat-pop-time">{r.timeLabel || '—'}</span>
                        <span className="faith-shabbat-pop-time faith-shabbat-pop-time--out">{r.havdalahTimeLabel || '—'}</span>
                      </div>
                    ))}
                  </>
                ) : null}
                {candleParashaLine ? (
                  <div className="faith-shabbat-pop-parsha">
                    {candleParashaLine}
                    {candleEveLabel ? ` · ערב שבת ${candleEveLabel}` : ''}
                  </div>
                ) : null}
                <p className="faith-shabbat-pop-foot">
                  כניסה: הדלקת נרות ~18 דק׳ לפני שקיעה מקומית. יציאה: זמן הבדלה כפי שמחושב ב־Hebcal לשבת הקרובה — המספרים משתנים מידי שבוע; מתעדכן בכל פתיחה.
                  {' '}
                  <a href="https://www.hebcal.com/" target="_blank" rel="noopener noreferrer">
                    Hebcal
                  </a>
                </p>
              </div>
            </div>
            <div
              className="faith-halacha-anchor-wrap"
              ref={halachaAnchorWrapRef}
              data-halacha-open={halachaModalOpen ? 'true' : 'false'}
            >
              <button
                type="button"
                className="faith-shabbat-chip"
                aria-expanded={halachaModalOpen}
                aria-haspopup="dialog"
                aria-controls="faith-halacha-panel"
                onClick={() => {
                  if (halachaModalOpen) {
                    setHalachaModalOpen(false);
                    return;
                  }
                  openHalachaModal();
                }}
              >
                הלכות שבת
              </button>
              {halachaModalOpen ? (
                <>
                  <button
                    type="button"
                    className="faith-halacha-modal-backdrop"
                    aria-label="סגירת חלון"
                    onClick={() => setHalachaModalOpen(false)}
                  />
                  <div
                    id="faith-halacha-panel"
                    className="faith-halacha-modal-dialog"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="faith-halacha-title"
                  >
                    <div className="faith-halacha-modal-head">
                      <h2 id="faith-halacha-title" className="faith-halacha-modal-title">
                        הלכות שבת
                      </h2>
                      <button
                        type="button"
                        className="faith-halacha-modal-close"
                        onClick={() => setHalachaModalOpen(false)}
                        aria-label="סגור"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="faith-halacha-modal-body">
                      {halachaModalLoading && !halachaModalConv ? (
                        <p className="faith-halacha-muted">טוען תאריך עברי וסינון ההלכה לפי היום…</p>
                      ) : null}
                      {halachaModalErr ? <p className="faith-halacha-err">{halachaModalErr}</p> : null}

                      {halachaModalConv ? (
                        <p className="faith-halacha-date-line">
                          <span>
                            <strong>תאריך היום:</strong> {halachaModalConv.hebrew}
                          </span>
                          {halachaManualKey ? <span className="faith-halacha-pill">מתוך המאגר</span> : null}
                        </p>
                      ) : null}

                      {halachaManualKey ? (
                        <button type="button" className="faith-halacha-linkback" onClick={() => setHalachaManualKey(null)}>
                          הצגת ההלכה לפי תאריך היום
                        </button>
                      ) : null}

                      {halachaDisplayEntry ? (
                        <article className="faith-halacha-article">
                          <h3 className="faith-halacha-entry-title">{halachaDisplayEntry.title}</h3>
                          <p className="faith-halacha-entry-meta">{halachaDisplayEntry.labelHe}</p>
                          <div className="faith-halacha-entry-body">
                            {halachaDisplayEntry.body.split(/\n\n+/).map((para, idx) => (
                              <p key={idx}>{para}</p>
                            ))}
                          </div>
                          {halachaDisplayEntry.sources ? (
                            <p className="faith-halacha-sources">{halachaDisplayEntry.sources}</p>
                          ) : null}
                        </article>
                      ) : null}

                      {!halachaModalLoading &&
                      halachaModalConv &&
                      !halachaManualKey &&
                      !halachaDisplayEntry ? (
                        <div className="faith-halacha-empty">
                          <p>
                            לא נמצאה כרגע הלכה במאגר המקומי שמותאמת בדיוק ליום העברי של היום ({halachaModalConv.hebrew}).
                          </p>
                          <p className="faith-halacha-muted">
                            ניתן לבחור הלכה מהרשימה למטה, או לעבור לשאלת רב עם חיפוש כללי.
                          </p>
                        </div>
                      ) : null}

                      {!halachaModalLoading && !halachaModalConv && halachaModalErr ? (
                        <p className="faith-halacha-muted">
                          לא הצלחנו לקבע את התאריך העברי — עדיין ניתן לבחור מהרשימה או לפתוח את שאלת הרב.
                        </p>
                      ) : null}

                      <div className="faith-halacha-archive-block">
                        <p className="faith-halacha-archive-heading">הלכות במאגר (לפי יום עברי בלוח)</p>
                        <ul className="faith-halacha-archive-list">
                          {halachaArchiveList.map((item) => (
                            <li key={item.key}>
                              <button
                                type="button"
                                className={`faith-halacha-archive-btn${halachaManualKey === item.key ? ' active' : ''}`}
                                onClick={() => setHalachaManualKey(item.key)}
                              >
                                <span className="faith-halacha-archive-date">{item.labelHe}</span>
                                <span className="faith-halacha-archive-topic">{item.title}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="faith-halacha-actions-row">
                        <button
                          type="button"
                          className="faith-halacha-rabbi-btn"
                          onClick={() => {
                            openShabbatTopic('הלכות שבת');
                            setHalachaModalOpen(false);
                          }}
                        >
                          חיפוש בשאלת רב — הלכות שבת
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
          <h1>דת ואמונה</h1>
          <p>המקום השייך לקהל המאמינים וכל מי שסקרן להכיר,</p>
          <div className="args-knowledge-composer-wrap">
            <div className="debate-composer args-knowledge-debate-composer">
              <div className="faith-search-input-shell">
                <input
                  ref={faithSearchInputRef}
                  placeholder={rabbiSearchPlaceholder ? '' : '🤖 שאל AI כל שאלה… Enter לשליחה'}
                  value={faithSearch}
                  onChange={(e) => {
                    setFaithSearch(e.target.value);
                    if (!e.target.value) clearFaithAi();
                  }}
                  onFocus={() => setFaithSearchFocused(true)}
                  onBlur={() => setFaithSearchFocused(false)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    submitFaithSearch();
                  }}
                  aria-label={
                    rabbiSearchPlaceholder
                      ? 'שאלת רב — חיפוש בניסוחי שאלות'
                      : 'חיפוש בניסוחי שאלות ובמדורי הדף'
                  }
                />
                {showRabbiWordsOverlay && (
                  <div className="faith-rabbi-placeholder-overlay" aria-hidden="true">
                    <span className="faith-rabbi-ph-w1">שאלת</span>
                    <span className="faith-rabbi-ph-w2">רב</span>
                    <span className="faith-rabbi-ph-dots">..</span>
                  </div>
                )}
              </div>
              <button
                type="button"
                className="btn btn-believer"
                onClick={submitFaithSearch}
                disabled={!faithSearch.trim()}
                aria-label="שלח חיפוש; מעבר לטאב שאלת רב עם סינון"
              >
                שלח
              </button>
            </div>
          </div>
          {renderFaithAiSlot()}

          {/* שאלות הרב מתחת לתיבת AI — מופיעות כשיש טקסט בחיפוש, ללא סינון */}
          {faithSearch.trim() && (
            <div className="faith-rabbi-inline-wrap">
              {RABBI_QUESTION_GROUPS.map((group) => (
                <div key={group.topic} className="faith-rabbi-group">
                  <h2 className="faith-rabbi-topic">{group.topic}</h2>
                  <ul className="faith-rabbi-list">
                    {group.items.map((item, i) => {
                      const rowKey = `hdr:${group.topic}:${i}`;
                      const isOpen = openRabbiKeys.has(rowKey);
                      return (
                        <li key={rowKey}>
                          <p className="faith-rabbi-q">{item.q}</p>
                          <button
                            type="button"
                            className="faith-rabbi-preview-btn"
                            onClick={() => toggleRabbiAnswer(rowKey)}
                            aria-expanded={isOpen}
                          >
                            {item.preview}
                          </button>
                          {isOpen && (
                            <div className="faith-rabbi-answer-full" role="region">
                              {item.answer}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </header>

        <FaithSubnavTabs
          activeTab={activeTab}
          onTabPick={(id) => {
            setActiveTab(id);
            if (id === 'rabbi') setRabbiSearchPlaceholder(true);
          }}
        />

        <div style={{ display: activeTab === 'chat' ? 'block' : 'none' }} aria-hidden={activeTab !== 'chat'}>
          <FaithChatPanel />
        </div>

        {activeTab === 'rabbi' && !faithSearch.trim() && (
          <div className="faith-rabbi-wrap">
            <h2 className="faith-rabbi-page-title">שאלת רב</h2>
            <p className="faith-rabbi-page-sub">כל הנושאים שהציבור הדתי מפנה לרבנים להתייעצות</p>
            {filteredRabbiGroups.length === 0 ? (
              <p className="faith-rabbi-intro">אין ניסוחים התואמים לחיפוש.</p>
            ) : (
              filteredRabbiGroups.map((group) => (
                <div key={group.topic} className="faith-rabbi-group">
                  <h2 className="faith-rabbi-topic">{group.topic}</h2>
                  <ul className="faith-rabbi-list">
                    {group.items.map((item, i) => {
                      const rowKey = `${group.topic}:${i}`;
                      const isOpen = openRabbiKeys.has(rowKey);
                      return (
                        <li key={rowKey}>
                          <p className="faith-rabbi-q">{item.q}</p>
                          <button
                            type="button"
                            className="faith-rabbi-preview-btn"
                            onClick={() => toggleRabbiAnswer(rowKey)}
                            aria-expanded={isOpen}
                          >
                            {item.preview}
                          </button>
                          {isOpen && (
                            <div className="faith-rabbi-answer-full" role="region" aria-label="תשובה מורחבת">
                              {item.answer}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'bible' && (
          <div className="faith-bible-wrap">
            <div className="knowledge-bible-panel">
              <BiblePanel embedded />
            </div>
          </div>
        )}

        {activeTab === 'more' && (
          <div className="faith-more-wrap">
            <div className="faith-more-columns">
              <div className="faith-more-col">
                <h3>כותרת (בהכנה)</h3>
                <div className="faith-placeholder-box">כאן יתווספו מדורים נוספים כשתעדכן את האפליקציה.</div>
              </div>
              <div className="faith-more-col">
                <h3>כותרת (בהכנה)</h3>
                <div className="faith-placeholder-box">מקום שמור לתוכן עתידי באותו מבנה דו-עמודי כמו בעמוד בעד־ונגד.</div>
              </div>
            </div>
          </div>
        )}

      </div>

    </>
  );
}
