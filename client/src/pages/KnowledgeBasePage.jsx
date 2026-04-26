import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function KnowledgeBasePage() {
  const [debates, setDebates] = useState([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => { fetchDebates(); }, [query]);

  async function fetchDebates() {
    setLoading(true);
    try {
      const qs = query ? `?q=${encodeURIComponent(query)}` : '';
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/debates${qs}`);
      if (res.ok) {
        const data = await res.json();
        setDebates(data.items);
        setTotal(data.total);
      }
    } catch {}
    setLoading(false);
  }

  return (
    <div className="page">
      <div className="container">
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: 8 }}>📚 מאגר הידע</h1>
          <p style={{ color: 'var(--muted)' }}>ויקיפדיה של טענות בעד ונגד האמונה — {total} דיונים שמורים</p>
        </div>

        <input
          placeholder="חפש לפי נושא, שם משתמש..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ marginBottom: 20 }}
        />

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : debates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
            {query ? 'לא נמצאו תוצאות' : 'עדיין אין דיונים שמורים'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {debates.map(d => (
              <div key={d.id} className="card" style={{ cursor: 'pointer', transition: 'border-color 0.2s' }}
                onClick={() => navigate(`/knowledge/${d.id}`)}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
                  <span style={{ color: 'var(--believer)', fontWeight: 700, fontSize: '0.9rem' }}>{d.believer.username}</span>
                  <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>vs</span>
                  <span style={{ color: 'var(--atheist)', fontWeight: 700, fontSize: '0.9rem' }}>
                    {d.atheist.username}{d.isAI && ' (AI)'}
                  </span>
                </div>
                {d.summary && <p style={{ color: '#ccc', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: 10 }}>{d.summary}</p>}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                  {d.tags?.map(t => <span key={t} style={styles.tag}>{t}</span>)}
                </div>
                <div style={{ display: 'flex', justify: 'space-between', color: 'var(--muted)', fontSize: '0.75rem', gap: 12 }}>
                  <span>⏱ {Math.round(d.stats?.duration / 60) || 0} דק׳</span>
                  <span>👁 {d.stats?.spectatorPeak || 0} צופים</span>
                  <span>🎁 {d.stats?.giftsTotal || 0} מתנות</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  tag: {
    background: 'var(--card2)', border: '1px solid var(--border)',
    padding: '2px 8px', borderRadius: 99, fontSize: '0.75rem', color: 'var(--muted)',
  },
};
