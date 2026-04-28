import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SideTag from '../components/ui/SideTag.jsx';

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || ''}/api/leaderboard`)
      .then(r => {
        if (!r.ok) throw new Error('failed to load leaderboard');
        return r.json();
      })
      .then(d => { setLeaders(d); setError(''); setLoading(false); })
      .catch(() => {
        setLeaders([]);
        setError('לא ניתן לטעון את טבלת המובילים כרגע.');
        setLoading(false);
      });
  }, []);

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="page">
      <div className="container container-narrow">
        <button type="button" onClick={() => navigate('/')} className="ui-back-button" style={{ marginBottom: 14 }}>← חזרה</button>
        <div className="page-hero">
          <span className="page-kicker">דירוג חי</span>
          <h1 className="page-title">🏆 טבלת מובילים</h1>
          <p className="page-subtitle">הדיינים הבולטים לפי ניקוד, דיוני קול, מתנות ואיכות השתתפות.</p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : error ? (
          <div className="state-card">
            {error}
          </div>
        ) : leaders.length === 0 ? (
          <div className="state-card">
            עדיין אין דיינים ברשימה
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {leaders.map((u, i) => (
              <div key={u.username} className="card" style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
                border: i === 0 ? '1px solid var(--gold)' : undefined,
              }}>
                <div style={{ width: 32, textAlign: 'center', fontSize: i < 3 ? '1.4rem' : '1rem', color: i >= 3 ? 'var(--muted)' : undefined }}>
                  {i < 3 ? medals[i] : `${i + 1}`}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700 }}>{u.username}</span>
                    <SideTag side={u.side} />
                  </div>
                  <div style={{ display: 'flex', gap: 12, color: 'var(--muted)', fontSize: '0.8rem' }}>
                    <span>🎙️ {u.voiceDebates} דיוני קול</span>
                    <span>🎁 {u.giftsReceived} מתנות</span>
                    <span>⚡ ניקוד איכות: {u.qualityScore}</span>
                  </div>
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--gold)' }}>
                  {u.score} נק׳
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

