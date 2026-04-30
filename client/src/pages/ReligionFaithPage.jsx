import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BiblePanel } from '../components/ui/BibleModal.jsx';
import FaithChatPanel from '../components/faith/FaithChatPanel.jsx';
import { FaithSubnavTabs } from '../components/faith/FaithSubnavTabs.jsx';
import { RABBI_QUESTION_GROUPS } from '../data/rabbiCommonQuestions.js';

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
        .faith-back {
          position: absolute;
          top: 16px;
          left: 12px;
          background: rgba(255,255,255,0.06);
          border: 1px solid var(--border);
          color: var(--muted);
          font-size: 0.82rem;
          font-weight: 600;
          padding: 8px 14px;
          border-radius: 10px;
          cursor: pointer;
        }
        .faith-back:hover {
          color: var(--text);
          background: rgba(255,255,255,0.1);
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
          .faith-back { position: static; display: block; margin: 0 auto 14px; }
          .faith-more-columns { grid-template-columns: 1fr; }
          .faith-more-col { border-left: none; border-bottom: 1px solid var(--border); }
          .faith-more-col:last-child { border-bottom: none; }
        }
      `}</style>

      <div className="faith-page">
        <header className="faith-header">
          <button type="button" className="faith-back" onClick={() => navigate(-1)}>← חזרה</button>
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
