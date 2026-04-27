import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SideTag from '../components/ui/SideTag.jsx';

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || ''}/api/leaderboard`)
      .then(r => r.json())
      .then(d => { setLeaders(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 600 }}>
        <button onClick={() => navigate(-1)} style={backBtn}>← חזרה</button>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: 6 }}>🏆 טבלת מובילים</h1>
          <p style={{ color: 'var(--muted)' }}>TOP 20 הדיינים המובילים</p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : leaders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
            עדיין אין דיינים ברשימה
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {leaders.map((u, i) => (
              <div key={u.username} className="card" style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
                border: i === 0 ? '1px solid #FFD700' : undefined,
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
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#FFD700' }}>
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

const backBtn = {
  background: 'none', border: 'none', color: '#aaa',
  fontSize: '0.9rem', cursor: 'pointer', padding: '4px 0', marginBottom: 12,
};
