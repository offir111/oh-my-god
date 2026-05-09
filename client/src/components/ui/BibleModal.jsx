import React, { useState, useRef, useEffect } from 'react';

const BOOKS = [
  // תורה
  { he: 'בראשית', en: 'Genesis', section: 'תורה' },
  { he: 'שמות', en: 'Exodus', section: 'תורה' },
  { he: 'ויקרא', en: 'Leviticus', section: 'תורה' },
  { he: 'במדבר', en: 'Numbers', section: 'תורה' },
  { he: 'דברים', en: 'Deuteronomy', section: 'תורה' },
  // נביאים
  { he: 'יהושע', en: 'Joshua', section: 'נביאים' },
  { he: 'שופטים', en: 'Judges', section: 'נביאים' },
  { he: 'שמואל א', en: 'I Samuel', section: 'נביאים' },
  { he: 'שמואל ב', en: 'II Samuel', section: 'נביאים' },
  { he: 'מלכים א', en: 'I Kings', section: 'נביאים' },
  { he: 'מלכים ב', en: 'II Kings', section: 'נביאים' },
  { he: 'ישעיהו', en: 'Isaiah', section: 'נביאים' },
  { he: 'ירמיהו', en: 'Jeremiah', section: 'נביאים' },
  { he: 'יחזקאל', en: 'Ezekiel', section: 'נביאים' },
  { he: 'הושע', en: 'Hosea', section: 'נביאים' },
  { he: 'יואל', en: 'Joel', section: 'נביאים' },
  { he: 'עמוס', en: 'Amos', section: 'נביאים' },
  { he: 'עובדיה', en: 'Obadiah', section: 'נביאים' },
  { he: 'יונה', en: 'Jonah', section: 'נביאים' },
  { he: 'מיכה', en: 'Micah', section: 'נביאים' },
  { he: 'נחום', en: 'Nahum', section: 'נביאים' },
  { he: 'חבקוק', en: 'Habakkuk', section: 'נביאים' },
  { he: 'צפניה', en: 'Zephaniah', section: 'נביאים' },
  { he: 'חגי', en: 'Haggai', section: 'נביאים' },
  { he: 'זכריה', en: 'Zechariah', section: 'נביאים' },
  { he: 'מלאכי', en: 'Malachi', section: 'נביאים' },
  // כתובים
  { he: 'תהילים', en: 'Psalms', section: 'כתובים' },
  { he: 'משלי', en: 'Proverbs', section: 'כתובים' },
  { he: 'איוב', en: 'Job', section: 'כתובים' },
  { he: 'שיר השירים', en: 'Song of Songs', section: 'כתובים' },
  { he: 'רות', en: 'Ruth', section: 'כתובים' },
  { he: 'איכה', en: 'Lamentations', section: 'כתובים' },
  { he: 'קהלת', en: 'Ecclesiastes', section: 'כתובים' },
  { he: 'אסתר', en: 'Esther', section: 'כתובים' },
  { he: 'דניאל', en: 'Daniel', section: 'כתובים' },
  { he: 'עזרא', en: 'Ezra', section: 'כתובים' },
  { he: 'נחמיה', en: 'Nehemiah', section: 'כתובים' },
  { he: 'דברי הימים א', en: 'I Chronicles', section: 'כתובים' },
  { he: 'דברי הימים ב', en: 'II Chronicles', section: 'כתובים' },
];

// גמטריה → מספר
const HEB_NUMS = {
  'א':1,'ב':2,'ג':3,'ד':4,'ה':5,'ו':6,'ז':7,'ח':8,'ט':9,'י':10,
  'יא':11,'יב':12,'יג':13,'יד':14,'טו':15,'טז':16,'יז':17,'יח':18,'יט':19,'כ':20,
  'כא':21,'כב':22,'כג':23,'כד':24,'כה':25,'כו':26,'כז':27,'כח':28,'כט':29,'ל':30,
  'לא':31,'לב':32,'לג':33,'לד':34,'לה':35,'לו':36,'לז':37,'לח':38,'לט':39,'מ':40,
  'מא':41,'מב':42,'מג':43,'מד':44,'מה':45,'מו':46,'מז':47,'מח':48,'מט':49,'נ':50,
  'נא':51,'נב':52,'ס':60,'ע':70,'פ':80,'צ':90,'ק':100,'קנ':150,
};

function hebOrArabicToNum(s) {
  if (!s) return null;
  const t = s.trim();
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  return HEB_NUMS[t] ?? null;
}

const NUM_HEB = Object.fromEntries(Object.entries(HEB_NUMS).map(([k, v]) => [v, k]));
function numToHeb(n) { return NUM_HEB[n] ?? String(n); }

function parseVerseRef(q) {
  const qn = q.trim().replace(/[״"]/g, '');
  const sorted = [...BOOKS].sort((a, b) => b.he.length - a.he.length);
  for (const book of sorted) {
    if (!qn.startsWith(book.he)) continue;
    let rest = qn.slice(book.he.length).trim();
    rest = rest.replace(/^פרק\s*/, '');
    const parts = rest.split(/[\s:,]+/).filter(p => p && p !== 'פסוק' && p !== 'פרק');
    if (parts.length === 0) return null;
    const ch = hebOrArabicToNum(parts[0]);
    if (!ch) return null;
    const vs = parts.length >= 2 ? hebOrArabicToNum(parts[1]) : null;
    return { book, chapter: ch, verse: vs };
  }
  return null;
}

const SECTION_COLORS = {
  תורה: 'var(--believer)',
  נביאים: 'var(--accent)',
  כתובים: 'var(--atheist)',
};

const CHAPTER_COUNTS = {
  Genesis: 50, Exodus: 40, Leviticus: 27, Numbers: 36, Deuteronomy: 34,
  Joshua: 24, Judges: 21, 'I Samuel': 31, 'II Samuel': 24,
  'I Kings': 22, 'II Kings': 25, Isaiah: 66, Jeremiah: 52, Ezekiel: 48,
  Hosea: 14, Joel: 4, Amos: 9, Obadiah: 1, Jonah: 4, Micah: 7,
  Nahum: 3, Habakkuk: 3, Zephaniah: 3, Haggai: 2, Zechariah: 14, Malachi: 3,
  Psalms: 150, Proverbs: 31, Job: 42, 'Song of Songs': 8,
  Ruth: 4, Lamentations: 5, Ecclesiastes: 12, Esther: 10,
  Daniel: 12, Ezra: 10, Nehemiah: 13, 'I Chronicles': 29, 'II Chronicles': 36,
};

export function BiblePanel({ embedded = false, onClose }) {
  const [query, setQuery] = useState('');
  const [searchedQuery, setSearchedQuery] = useState('');
  const [groqData, setGroqData] = useState(null);    // { explanation, results }
  const [refResult, setRefResult] = useState(null);   // פסוק ישיר
  const [loading, setLoading] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);
  const [chapter, setChapter] = useState(null);
  const [verses, setVerses] = useState(null);
  const [versesLoading, setVersesLoading] = useState(false);
  const [error, setError] = useState('');
  const searchRef = useRef();
  const answerPanelRef = useRef();

  useEffect(() => { searchRef.current?.focus(); }, []);

  // גלול לראש לוח התשובות כשנטען
  useEffect(() => {
    if ((groqData || refResult) && answerPanelRef.current) {
      answerPanelRef.current.scrollTop = 0;
    }
  }, [groqData, refResult]);

  const bookQueryMatch = query.trim()
    ? BOOKS.filter(b => b.he.includes(query) || b.en.toLowerCase().includes(query.toLowerCase()))
    : BOOKS;
  // אם השאילתה לא מכילה שם ספר (שאלה חופשית) — הצג את כל הספרים
  const filtered = bookQueryMatch.length > 0 ? bookQueryMatch : BOOKS;
  const sections = [...new Set(filtered.map(b => b.section))];

  function closeAnswerPanel() {
    setGroqData(null);
    setRefResult(null);
    setError('');
  }

  async function loadChapter(book, ch, highlightVerse = null) {
    setVersesLoading(true);
    setVerses(null);
    setChapter(ch);
    try {
      const ref = `${book.en}.${ch}`;
      const res = await fetch(`https://www.sefaria.org/api/texts/${encodeURIComponent(ref)}?lang=he&commentary=0`);
      if (!res.ok) throw new Error('sefaria load failed');
      const data = await res.json();
      const heArr = Array.isArray(data.he) ? data.he : [];
      setVerses({ arr: heArr, highlight: highlightVerse });
    } catch {
      setVerses({ arr: [], highlight: null });
    }
    setVersesLoading(false);
  }

  async function fetchSingleVerse(book, ch, vs) {
    const ref = `${book.en}.${ch}.${vs}`;
    const res = await fetch(`https://www.sefaria.org/api/texts/${encodeURIComponent(ref)}?lang=he&commentary=0`);
    if (!res.ok) throw new Error('sefaria verse failed');
    const data = await res.json();
    let text = '';
    if (typeof data.he === 'string') {
      text = data.he;
    } else if (Array.isArray(data.he)) {
      text = data.he[vs - 1] ?? data.he[0] ?? '';
    }
    return { text, url: `https://www.sefaria.org/${ref}` };
  }

  async function handleSearch() {
    const q = query.trim();
    if (!q) return;
    closeAnswerPanel();
    setSelectedBook(null);
    setChapter(null);
    setVerses(null);
    setSearchedQuery(q);

    const ref = parseVerseRef(q);
    if (ref) {
      setLoading(true);
      try {
        if (ref.verse) {
          const { text } = await fetchSingleVerse(ref.book, ref.chapter, ref.verse);
          setRefResult({
            book: ref.book,
            chapter: ref.chapter,
            verse: ref.verse,
            text,
            label: `${ref.book.he} ${numToHeb(ref.chapter)}:${numToHeb(ref.verse)}`,
          });
        } else {
          setSelectedBook(ref.book);
          await loadChapter(ref.book, ref.chapter);
        }
      } catch {
        setError('לא ניתן לטעון את הפסוק מ-Sefaria');
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const BASE = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${BASE}/api/bible-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      if (!res.ok) throw new Error('bible search failed');
      const data = await res.json();
      setGroqData({ explanation: data.explanation || '', results: data.results || [] });
    } catch {
      setGroqData({ explanation: '', results: [] });
    }
    setLoading(false);
  }

  const chapterCount = selectedBook ? (CHAPTER_COUNTS[selectedBook.en] ?? 30) : 0;
  const showAnswerPanel = (loading || groqData !== null || refResult !== null || error) && !selectedBook;
  const showBookList = !selectedBook;
  const showChapter = selectedBook && chapter;
  const showChapterPicker = selectedBook && !chapter;

  return (
    <div className={embedded ? 'bm-sheet bm-sheet-embedded' : 'bm-sheet'} role={embedded ? undefined : 'dialog'} aria-modal={embedded ? undefined : true} aria-labelledby="bible-modal-title">
      <style>{`
        /* ---- Answer panel overlay ---- */
        .bm-body { position: relative; }
        .bm-answer-panel {
          position: absolute;
          inset: 0;
          z-index: 10;
          background: var(--surface, #18181b);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 4px 32px rgba(0,0,0,0.45);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .bm-ap-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 11px 14px 10px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          flex-shrink: 0;
          direction: rtl;
          gap: 8px;
        }
        .bm-ap-title {
          font-size: 0.82rem;
          font-weight: 800;
          color: var(--gold, #fbbf24);
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .bm-ap-close {
          width: 32px; height: 32px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.06);
          color: var(--text-secondary, #b4b4c0);
          font-size: 0.9rem;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          touch-action: manipulation;
          font-family: inherit;
          transition: background 0.12s;
        }
        .bm-ap-close:hover { background: rgba(255,255,255,0.12); }
        .bm-ap-body {
          flex: 1;
          overflow-y: auto;
          padding: 14px 14px 18px;
          direction: rtl;
        }
        /* ---- Explanation block ---- */
        .bm-explanation {
          font-size: 0.93rem;
          line-height: 1.85;
          color: var(--text, #f4f4f8);
          margin-bottom: 16px;
          padding: 13px 15px;
          background: rgba(251,191,36,0.07);
          border-radius: 10px;
          border-right: 3px solid var(--gold, #fbbf24);
        }
        .bm-citations-label {
          font-size: 0.7rem;
          font-weight: 900;
          color: var(--muted, #8a8a9a);
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        /* ---- Direct verse card ---- */
        .bm-ref-card {
          background: linear-gradient(135deg, rgba(251,191,36,0.10) 0%, rgba(99,102,241,0.07) 100%);
          border: 1px solid rgba(251,191,36,0.35);
          border-radius: 14px;
          padding: 18px 16px 14px;
          direction: rtl;
          margin-bottom: 12px;
        }
        .bm-ref-label {
          font-size: 0.72rem;
          font-weight: 900;
          color: var(--gold, #fbbf24);
          letter-spacing: 0.08em;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .bm-ref-text {
          font-size: 1.12rem;
          line-height: 2;
          color: var(--text, #f4f4f8);
          margin-bottom: 14px;
        }
        .bm-ref-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .bm-ref-btn {
          padding: 8px 14px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.15);
          background: rgba(255,255,255,0.07);
          color: var(--text-secondary, #b4b4c0);
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          touch-action: manipulation;
          transition: background 0.12s, border-color 0.12s;
        }
        .bm-ref-btn:hover { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.25); }
        .bm-ref-btn--gold {
          border-color: rgba(251,191,36,0.45);
          background: rgba(251,191,36,0.1);
          color: var(--gold, #fbbf24);
        }
        .bm-ref-btn--gold:hover { background: rgba(251,191,36,0.18); }
        /* ---- Misc ---- */
        .bm-search-hint {
          font-size: 0.72rem;
          color: var(--muted, #8a8a9a);
          text-align: center;
          padding: 6px 8px 2px;
          direction: rtl;
          line-height: 1.6;
        }
        .bm-search-hint strong { color: var(--text-secondary, #b4b4c0); }
        .bm-error { color: #f87171; font-size: 0.85rem; text-align: center; padding: 16px; }
        .bm-verse-highlight {
          background: rgba(251,191,36,0.15);
          border-right: 3px solid var(--gold, #fbbf24);
          padding-right: 8px;
          border-radius: 4px;
        }
        .bm-groq-tag {
          display: inline-block;
          font-size: 0.62rem;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 4px;
          background: rgba(99,102,241,0.2);
          color: #a5b4fc;
          letter-spacing: 0.06em;
          vertical-align: middle;
          margin-right: 4px;
        }
        .bm-ap-spinner {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 0;
        }
      `}</style>

      <div className="bm-header">
        <span className="bm-title" id="bible-modal-title">ספר התנ״ך</span>
        {!embedded && onClose && <button type="button" className="bm-close" onClick={onClose} aria-label="סגור">✕</button>}
      </div>

      <div className="bm-search">
        <input
          ref={searchRef}
          placeholder="חפש פסוק, אירוע, נושא… (בראשית ג טו / אשת לוט)"
          value={query}
          onChange={e => { setQuery(e.target.value); closeAnswerPanel(); setSelectedBook(null); setChapter(null); setVerses(null); }}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        <button type="button" className="bm-search-btn" onClick={handleSearch} aria-label="חיפוש">🔍</button>
      </div>

      {!query.trim() && (
        <div className="bm-search-hint">
          <strong>פסוק ישיר:</strong> בראשית ג טו · תהילים כג א ·
          <strong> אירוע:</strong> אשת לוט · קריעת ים סוף · עקדת יצחק
        </div>
      )}

      <div className="bm-body">

        {/* ---- לוח תשובות (overlay) ---- */}
        {showAnswerPanel && (
          <div className="bm-answer-panel">
            <div className="bm-ap-header">
              <span className="bm-ap-title">📖 {searchedQuery}</span>
              <button type="button" className="bm-ap-close" onClick={closeAnswerPanel} aria-label="סגור">✕</button>
            </div>

            <div className="bm-ap-body" ref={answerPanelRef}>
              {loading && (
                <div className="bm-ap-spinner"><div className="spinner" /></div>
              )}

              {error && !loading && <div className="bm-error">{error}</div>}

              {/* פסוק ישיר מ-Sefaria */}
              {refResult && !loading && (
                <div>
                  <div className="bm-ref-card">
                    <div className="bm-ref-label">
                      📖 {refResult.label}
                      <span style={{ color: 'var(--muted)', fontWeight: 500, fontSize: '0.65rem' }}>· Sefaria</span>
                    </div>
                    <div className="bm-ref-text"
                      dangerouslySetInnerHTML={{ __html: refResult.text || '(טקסט לא זמין)' }}
                    />
                    <div className="bm-ref-actions">
                      <button
                        type="button"
                        className="bm-ref-btn bm-ref-btn--gold"
                        onClick={() => {
                          closeAnswerPanel();
                          setSelectedBook(refResult.book);
                          loadChapter(refResult.book, refResult.chapter, refResult.verse);
                        }}
                      >
                        פתח פרק {numToHeb(refResult.chapter)} ←
                      </button>
                      <button
                        type="button"
                        className="bm-ref-btn"
                        onClick={() => { closeAnswerPanel(); setQuery(''); }}
                      >
                        חיפוש חדש
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* תוצאות Groq — הסבר + סימוכין */}
              {groqData && !loading && (
                <div>
                  {groqData.explanation ? (
                    <div className="bm-explanation">{groqData.explanation}</div>
                  ) : null}

                  {groqData.results && groqData.results.length > 0 && (
                    <>
                      <div className="bm-citations-label">
                        <span className="bm-groq-tag">AI</span>
                        סימוכין מהתנ״ך · {groqData.results.length} פסוקים
                      </div>
                      {groqData.results.map((r, i) => (
                        <div key={i} className="bm-verse-card">
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <div style={{ color: 'var(--gold)', fontSize: '0.82rem', fontWeight: 900 }}>{r.ref}</div>
                            {r.ref && (() => {
                              const parsed = parseVerseRef(r.ref.replace(':', ' '));
                              if (!parsed) return null;
                              return (
                                <button
                                  type="button"
                                  className="bm-ref-btn"
                                  style={{ fontSize: '0.7rem', padding: '4px 9px' }}
                                  onClick={() => {
                                    closeAnswerPanel();
                                    setSelectedBook(parsed.book);
                                    loadChapter(parsed.book, parsed.chapter, parsed.verse);
                                  }}
                                >
                                  פתח פרק ←
                                </button>
                              );
                            })()}
                          </div>
                          <div style={{ fontSize: '0.98rem', lineHeight: 1.9, direction: 'rtl', marginBottom: r.context ? 8 : 0 }}>
                            {r.text}
                          </div>
                          {r.context && (
                            <div style={{ color: 'var(--muted)', fontSize: '0.8rem', borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 8, direction: 'rtl' }}>
                              {r.context}
                            </div>
                          )}
                        </div>
                      ))}
                    </>
                  )}

                  {groqData.results && groqData.results.length === 0 && (
                    <p className="bm-muted">לא נמצאו תוצאות — נסה לנסח אחרת</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---- תצוגת פרק ---- */}
        {showChapter && (
          <div>
            <button type="button" className="bm-back" onClick={() => { setChapter(null); setVerses(null); }}>
              ← {selectedBook.he}
            </button>
            <p className="bm-section-label" style={{ color: 'var(--text)' }}>{selectedBook.he} · פרק {numToHeb(chapter)}</p>
            {versesLoading && (
              <div className="bm-center"><div className="spinner" /></div>
            )}
            {verses && verses.arr.map((v, i) => {
              const vNum = i + 1;
              const isHL = verses.highlight === vNum;
              return (
                <div key={i} className={`bm-verse-card${isHL ? ' bm-verse-highlight' : ''}`} id={isHL ? 'bm-hl' : undefined}>
                  <span style={{ color: isHL ? 'var(--gold)' : 'var(--muted)', fontSize: '0.72rem', fontWeight: isHL ? 900 : 400, marginLeft: 8 }}>
                    {numToHeb(vNum)}
                  </span>
                  <span
                    style={{ fontSize: '0.95rem', lineHeight: 1.85, direction: 'rtl' }}
                    dangerouslySetInnerHTML={{ __html: typeof v === 'string' ? v : '' }}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* ---- בחירת פרק ---- */}
        {showChapterPicker && (
          <div>
            <button type="button" className="bm-back" onClick={() => setSelectedBook(null)}>← רשימת ספרים</button>
            <p className="bm-section-label" style={{ color: 'var(--text)' }}>{selectedBook.he} — בחר פרק</p>
            <div className="bm-chapter-grid">
              {Array.from({ length: chapterCount }, (_, i) => i + 1).map(ch => (
                <button type="button" key={ch} className="bm-chapter-btn" onClick={() => loadChapter(selectedBook, ch)}>{ch}</button>
              ))}
            </div>
          </div>
        )}

        {/* ---- רשימת ספרים (תמיד גלויה כשלא בתצוגת פרק) ---- */}
        {showBookList && sections.map(sec => (
          <div key={sec}>
            <p className="bm-section-label" style={{ color: SECTION_COLORS[sec] }}>{sec}</p>
            <div className="bm-book-grid">
              {filtered.filter(b => b.section === sec).map(b => (
                <button
                  type="button"
                  key={b.en}
                  className="bm-book-btn"
                  style={{ borderColor: SECTION_COLORS[b.section] }}
                  onClick={() => { setSelectedBook(b); setChapter(null); setVerses(null); }}
                >
                  {b.he}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BibleModal({ onClose }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="bm-overlay" onClick={e => e.target === e.currentTarget && onClose()} role="presentation">
      <BiblePanel onClose={onClose} />
    </div>
  );
}
