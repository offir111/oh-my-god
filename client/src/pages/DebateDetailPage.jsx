import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MessageBubble from '../components/debate/MessageBubble.jsx';

export default function DebateDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [debate, setDebate] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/debates/${id}`)
      .then(r => r.json())
      .then(d => { setDebate(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  );

  if (!debate) return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <p style={{ color: 'var(--muted)' }}>דיון לא נמצא</p>
      <button className="btn btn-ghost" onClick={() => navigate('/knowledge')}>חזרה למאגר</button>
    </div>
  );

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 700 }}>
        <button className="btn btn-ghost" onClick={() => navigate('/knowledge')} style={{ marginBottom: 20, padding: '8px 16px' }}>
          ← חזרה למאגר
        </button>

        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
            <span style={{ color: 'var(--believer)', fontWeight: 700, fontSize: '1.1rem' }}>{debate.believer.username}</span>
            <span style={{ color: 'var(--muted)' }}>vs</span>
            <span style={{ color: 'var(--atheist)', fontWeight: 700, fontSize: '1.1rem' }}>
              {debate.atheist.username}{debate.isAI && ' (AI)'}
            </span>
          </div>
          {debate.summary && <p style={{ color: '#ccc', lineHeight: 1.7, marginBottom: 12 }}>{debate.summary}</p>}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {debate.tags?.map(t => <span key={t} style={styles.tag}>{t}</span>)}
          </div>
          <div style={{ display: 'flex', gap: 16, color: 'var(--muted)', fontSize: '0.8rem' }}>
            <span>⏱ {Math.round((debate.stats?.duration || 0) / 60)} דקות</span>
            <span>👁 {debate.stats?.spectatorPeak || 0} צופי שיא</span>
            <span>🎁 {debate.stats?.giftsTotal || 0} מתנות</span>
            <span>📅 {new Date(debate.archivedAt).toLocaleDateString('he-IL')}</span>
          </div>
        </div>

        {debate.phases?.text?.messages?.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <h3 style={styles.phaseTitle}>💬 שלב הטקסט</h3>
            {debate.phases.text.messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} mySide={null} />
            ))}
          </div>
        )}

        {debate.phases?.voice?.messages?.length > 0 && (
          <div>
            <h3 style={styles.phaseTitle}>🎙️ שלב הקולי</h3>
            {debate.phases.voice.messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} mySide={null} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  phaseTitle: {
    fontSize: '1rem', color: 'var(--muted)', marginBottom: 14,
    borderBottom: '1px solid var(--border)', paddingBottom: 8,
  },
  tag: {
    background: 'var(--card2)', border: '1px solid var(--border)',
    padding: '2px 8px', borderRadius: 99, fontSize: '0.75rem', color: 'var(--muted)',
  },
};
