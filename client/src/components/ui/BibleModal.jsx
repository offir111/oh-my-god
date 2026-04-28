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

const SECTION_COLORS = { תורה: '#CC0000', נביאים: '#0055AA', כתובים: '#007733' };

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
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.header}>
          <span style={s.title}>📖 ספר התנ"ך</span>
          <button style={s.close} onClick={onClose}>✕</button>
        </div>

        <div style={s.searchRow}>
          <input
            ref={searchRef}
            style={s.input}
            placeholder="חפש ספר, פרק או מילה..."
            value={query}
            onChange={e => { setQuery(e.target.value); setResults(null); setSelectedBook(null); setVerses(null); }}
            onKeyDown={e => e.key === 'Enter' && searchVerses()}
          />
          <button style={s.searchBtn} onClick={searchVerses}>🔍</button>
        </div>

        <div style={s.body}>
          {/* Verse search results */}
          {loading && <div style={s.center}><div className="spinner" /></div>}
          {results && results.length === 0 && <p style={s.muted}>לא נמצאו תוצאות</p>}
          {results && results.length > 0 && (
            <div>
              <p style={s.sectionLabel}>🤖 תוצאות AI — {results.length} פסוקים</p>
              {results.map((r, i) => (
                <div key={i} style={s.verseCard}>
                  <div style={{ color: '#FFE566', fontSize: '0.8rem', fontWeight: 700, marginBottom: 6 }}>📍 {r.ref}</div>
                  <div style={{ fontSize: '1rem', lineHeight: 1.9, direction: 'rtl', marginBottom: r.context ? 8 : 0 }}>
                    {r.text}
                  </div>
                  {r.context && (
                    <div style={{ color: '#888', fontSize: '0.78rem', borderTop: '1px solid #2a2a2a', paddingTop: 6, direction: 'rtl' }}>
                      💡 {r.context}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Chapter verses view */}
          {!results && selectedBook && chapter && (
            <div>
              <button style={s.back} onClick={() => { setChapter(null); setVerses(null); }}>
                ← {selectedBook.he}
              </button>
              <p style={s.sectionLabel}>{selectedBook.he} פרק {chapter}</p>
              {versesLoading && <div style={s.center}><div className="spinner" /></div>}
              {verses && verses.map((v, i) => (
                <div key={i} style={s.verseCard}>
                  <span style={{ color: '#888', fontSize: '0.72rem', marginLeft: 8 }}>{i + 1}</span>
                  <span style={{ fontSize: '0.95rem', lineHeight: 1.8, direction: 'rtl' }}
                    dangerouslySetInnerHTML={{ __html: typeof v === 'string' ? v : '' }} />
                </div>
              ))}
            </div>
          )}

          {/* Chapter selector */}
          {!results && selectedBook && !chapter && (
            <div>
              <button style={s.back} onClick={() => setSelectedBook(null)}>← רשימת ספרים</button>
              <p style={s.sectionLabel}>{selectedBook.he} — בחר פרק</p>
              <div style={s.chapterGrid}>
                {Array.from({ length: chapterCount }, (_, i) => i + 1).map(ch => (
                  <button key={ch} style={s.chapterBtn} onClick={() => loadChapter(selectedBook, ch)}>{ch}</button>
                ))}
              </div>
            </div>
          )}

          {/* Book list */}
          {!results && !selectedBook && sections.map(sec => (
            <div key={sec}>
              <p style={{ ...s.sectionLabel, color: SECTION_COLORS[sec] }}>{sec}</p>
              <div style={s.bookGrid}>
                {filtered.filter(b => b.section === sec).map(b => (
                  <button key={b.en} style={{ ...s.bookBtn, borderColor: SECTION_COLORS[b.section] }}
                    onClick={() => { setSelectedBook(b); setChapter(null); setVerses(null); }}>
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

const s = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 9000, padding: 16,
  },
  modal: {
    background: '#111', border: '1px solid #333', borderRadius: 16,
    width: '100%', maxWidth: 560, maxHeight: '85vh',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    direction: 'rtl',
  },
  header: {
    padding: '14px 18px', borderBottom: '1px solid #222',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexShrink: 0,
  },
  title: { fontWeight: 800, fontSize: '1.1rem', color: '#FFE566' },
  close: {
    background: 'none', border: 'none', color: '#888',
    fontSize: '1.2rem', cursor: 'pointer', lineHeight: 1,
    padding: '2px 6px', borderRadius: 6,
  },
  searchRow: {
    padding: '10px 14px', borderBottom: '1px solid #1a1a1a',
    display: 'flex', gap: 8, flexShrink: 0,
  },
  input: {
    flex: 1, background: '#1a1a1a', border: '1px solid #333',
    borderRadius: 10, padding: '9px 12px', color: '#fff',
    fontSize: '0.95rem', direction: 'rtl', outline: 'none',
  },
  searchBtn: {
    background: '#FFE566', border: 'none', borderRadius: 10,
    padding: '9px 14px', cursor: 'pointer', fontSize: '1rem', fontWeight: 700,
  },
  body: { flex: 1, overflowY: 'auto', padding: '12px 14px' },
  sectionLabel: {
    fontSize: '0.72rem', fontWeight: 800, color: '#888',
    letterSpacing: 1, textTransform: 'uppercase', margin: '10px 0 8px',
  },
  bookGrid: {
    display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 14,
  },
  bookBtn: {
    background: '#1a1a1a', border: '1px solid #444', borderRadius: 10,
    color: '#fff', padding: '7px 12px', cursor: 'pointer',
    fontSize: '0.88rem', fontWeight: 600, fontFamily: 'Arial, sans-serif',
    transition: 'background 0.15s',
  },
  chapterGrid: {
    display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8,
  },
  chapterBtn: {
    width: 42, height: 42, background: '#1a1a1a', border: '1px solid #333',
    borderRadius: 8, color: '#fff', cursor: 'pointer', fontWeight: 700,
    fontFamily: 'Arial, sans-serif',
  },
  verseCard: {
    background: '#1a1a1a', borderRadius: 10, padding: '10px 14px',
    marginBottom: 8, lineHeight: 1.7,
  },
  back: {
    background: 'none', border: 'none', color: '#888', cursor: 'pointer',
    fontSize: '0.9rem', padding: '4px 0', marginBottom: 6, display: 'block',
  },
  muted: { color: '#555', textAlign: 'center', padding: '20px 0' },
  center: { display: 'flex', justifyContent: 'center', padding: 20 },
};
