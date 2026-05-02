import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import SideTag from '../components/ui/SideTag.jsx';
import UserAvatarSlot from '../components/ui/UserAvatarSlot.jsx';
import { getCageAvatarDataUrlForDisplayName } from '../lib/cageUserProfile.js';

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const [leaders, setLeaders] = useState([]);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadLeaderboard = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/leaderboard`);
      if (!res.ok) throw new Error('failed to load leaderboard');
      const d = await res.json();
      const payload = Array.isArray(d) ? { leaders: d, topics: [] } : d;
      setLeaders(payload.leaders || []);
      setTopics(payload.topics || []);
      setError('');
    } catch {
      if (!isManualRefresh) {
        setLeaders([]);
        setTopics([]);
        setError('לא ניתן לטעון את נתוני הנושאים המובילים כרגע.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadLeaderboard(false);
  }, [loadLeaderboard]);

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="page">
      <div className="container container-narrow">
        <button type="button" onClick={() => navigate('/')} className="ui-back-button" style={{ marginBottom: 14 }}>← חזרה</button>
        <div className="page-hero">
          <span className="page-kicker">דירוג חי</span>
          <h1 className="page-title">לוח המובילים</h1>
          <p className="page-subtitle">הנושאים הכי פופולריים לשיחה בין מאמינים לאתאיסטים עם הכי הרבה איזכורים.</p>

          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => loadLeaderboard(true)}
              disabled={loading || refreshing}
              style={{
                padding: '10px 18px',
                borderRadius: 12,
                border: '1px solid var(--border-strong, rgba(255,255,255,0.14))',
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--text, #fff)',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: loading || refreshing ? 'wait' : 'pointer',
                opacity: loading || refreshing ? 0.65 : 1,
              }}
            >
              {refreshing ? 'מרענן…' : '🔄 רענון נתונים'}
            </button>
          </div>

          {!loading && !error && topics.length > 0 && (
            <div
              className="card"
              style={{
                marginTop: 22,
                textAlign: 'right',
                direction: 'rtl',
                padding: '18px 20px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.03)',
              }}
            >
              <h2 style={{ margin: '0 0 8px', fontSize: '1.05rem', fontWeight: 800 }}>📌 נושאים פופולריים בשיחה</h2>
              <p style={{ margin: '0 0 14px', fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.45 }}>
                נספר לפי הודעות טקסט בדיונים בין משתמשים ובין משתמש ל־AI. לכל הודעה — נקודה לכל נושא שמילות המפתח שלו מופיעות בה (הנושא הפופולרי ראשון).
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-strong, rgba(255,255,255,0.12))' }}>
                      <th style={{ textAlign: 'right', padding: '10px 8px', fontWeight: 800, color: 'var(--muted)', width: 44 }}>#</th>
                      <th style={{ textAlign: 'right', padding: '10px 8px', fontWeight: 800 }}>נושא</th>
                      <th style={{ textAlign: 'center', padding: '10px 8px', fontWeight: 800, color: 'var(--muted)', whiteSpace: 'nowrap' }}>אזכורים</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topics.map((t, i) => (
                      <tr
                        key={t.id}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.06)',
                          background: i === 0 ? 'rgba(251,191,36,0.06)' : undefined,
                        }}
                      >
                        <td style={{ padding: '10px 8px', fontVariantNumeric: 'tabular-nums', color: 'var(--muted)' }}>{i + 1}</td>
                        <td style={{ padding: '10px 8px', fontWeight: 600 }}>{t.label}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 800, color: 'var(--gold, #fbbf24)' }}>{t.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
            <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: '20px 0 8px', color: 'var(--text-secondary, #b4b4c0)' }}>דיינים מובילים</h2>
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
                    <UserAvatarSlot
                      size="sm"
                      displayName={u.username}
                      avatarUrl={getCageAvatarDataUrlForDisplayName(u.username) || undefined}
                    />
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
