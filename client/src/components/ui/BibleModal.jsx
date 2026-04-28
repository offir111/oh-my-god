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

const SECTION_COLORS = {
  תורה: 'var(--believer)',
  נביאים: 'var(--accent)',
  כתובים: 'var(--atheist)',
};

export default function BibleModal({ onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);
  const [chapter, setChapter] = useState(null);
  const [verses, setVerses] = useState(null);
  const [versesLoading, setVersesLoading] = useState(false);
  const searchRef = useRef();

  useEffect(() => { searchRef.current?.focus(); }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = query.trim()
    ? BOOKS.filter(b => b.he.includes(query) || b.en.toLowerCase().includes(query.toLowerCase()))
    : BOOKS;

  const sections = [...new Set(filtered.map(b => b.section))];

  async function searchVerses() {
    if (!query.trim()) return;
    setLoading(true);
    setResults(null);
    try {
      const BASE = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${BASE}/api/bible-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      });
      if (!res.ok) throw new Error('bible search failed');
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    }
    setLoading(false);
  }

  async function loadChapter(book, ch) {
    setVersesLoading(true);
    setVerses(null);
    setChapter(ch);
    try {
      const ref = `${book.en}.${ch}`;
      const res = await fetch(`https://www.sefaria.org/api/texts/${encodeURIComponent(ref)}?lang=he&commentary=0`);
      if (!res.ok) throw new Error('chapter load failed');
      const data = await res.json();
      const heArr = data.he || [];
      setVerses(heArr);
    } catch {
      setVerses([]);
    }
    setVersesLoading(false);
  }

  const chapterCount = selectedBook
    ? (selectedBook.en === 'Psalms' ? 150 : selectedBook.en === 'Proverbs' ? 31 :
       selectedBook.en === 'Genesis' ? 50 : selectedBook.en === 'Isaiah' ? 66 :
       selectedBook.en === 'Jeremiah' ? 52 : selectedBook.en === 'Ezekiel' ? 48 :
       selectedBook.en === 'Numbers' ? 36 : selectedBook.en === 'Deuteronomy' ? 34 :
       selectedBook.en === 'Exodus' ? 40 : selectedBook.en === 'Leviticus' ? 27 :
       selectedBook.en === 'Joshua' ? 24 : selectedBook.en === 'Judges' ? 21 :
       selectedBook.en === 'I Samuel' ? 31 : selectedBook.en === 'II Samuel' ? 24 :
       selectedBook.en === 'I Kings' ? 22 : selectedBook.en === 'II Kings' ? 25 :
       30)
    : 0;

  return (
    <div className="bm-overlay" onClick={e => e.target === e.currentTarget && onClose()} role="presentation">
      <div className="bm-sheet" role="dialog" aria-modal="true" aria-labelledby="bible-modal-title">
        <div className="bm-header">
          <span className="bm-title" id="bible-modal-title">ספר התנ״ך</span>
          <button type="button" className="bm-close" onClick={onClose} aria-label="סגור">✕</button>
        </div>

        <div className="bm-search">
          <input
            ref={searchRef}
            placeholder="חפש ספר, פרק או מילה…"
            value={query}
            onChange={e => { setQuery(e.target.value); setResults(null); setSelectedBook(null); setVerses(null); }}
            onKeyDown={e => e.key === 'Enter' && searchVerses()}
          />
          <button type="button" className="bm-search-btn" onClick={searchVerses} aria-label="חיפוש">🔍</button>
        </div>

        <div className="bm-body">
          {loading && (
            <div className="bm-center">
              <div className="spinner" />
            </div>
          )}
          {results && results.length === 0 && <p className="bm-muted">לא נמצאו תוצאות</p>}
          {results && results.length > 0 && (
            <div>
              <p className="bm-section-label">תוצאות חיפוש · {results.length} פסוקים</p>
              {results.map((r, i) => (
                <div key={i} className="bm-verse-card">
                  <div style={{ color: 'var(--gold)', fontSize: '0.8rem', fontWeight: 800, marginBottom: 8 }}>{r.ref}</div>
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
            </div>
          )}

          {!results && selectedBook && chapter && (
            <div>
              <button type="button" className="bm-back" onClick={() => { setChapter(null); setVerses(null); }}>
                ← {selectedBook.he}
              </button>
              <p className="bm-section-label" style={{ color: 'var(--text)' }}>{selectedBook.he} · פרק {chapter}</p>
              {versesLoading && (
                <div className="bm-center">
                  <div className="spinner" />
                </div>
              )}
              {verses && verses.map((v, i) => (
                <div key={i} className="bm-verse-card">
                  <span style={{ color: 'var(--muted)', fontSize: '0.72rem', marginLeft: 8 }}>{i + 1}</span>
                  <span style={{ fontSize: '0.95rem', lineHeight: 1.85, direction: 'rtl' }}
                    dangerouslySetInnerHTML={{ __html: typeof v === 'string' ? v : '' }} />
                </div>
              ))}
            </div>
          )}

          {!results && selectedBook && !chapter && (
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

          {!results && !selectedBook && sections.map(sec => (
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
    </div>
  );
}
