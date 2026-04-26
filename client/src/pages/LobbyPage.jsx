import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore.js';
import { socket } from '../socket.js';
import SideTag from '../components/ui/SideTag.jsx';

export default function LobbyPage() {
  const user = useAppStore(s => s.user);
  const setDebate = useAppStore(s => s.setDebate);
  const [status, setStatus] = useState('idle'); // idle | waiting | found
  const [liveDebates, setLiveDebates] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchLive();

    socket.on('WAITING_FOR_OPPONENT', () => setStatus('waiting'));
    socket.on('MATCH_FOUND', ({ debateId, isAI, believer, atheist, aiSide }) => {
      setStatus('found');
      setDebate({
        id: debateId, isAI, aiSide,
        believer, atheist,
        phase: 'text', turn: 'believer',
        textMessages: [], voiceMessages: [],
        textCount: { believer: 0, atheist: 0 },
        voiceCount: { believer: 0, atheist: 0 },
        giftsReceived: { believer: 0, atheist: 0 },
      });
      setTimeout(() => navigate(`/debate/${debateId}`), 600);
    });

    return () => {
      socket.off('WAITING_FOR_OPPONENT');
      socket.off('MATCH_FOUND');
    };
  }, []);

  async function fetchLive() {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/debates/live`);
      if (res.ok) setLiveDebates(await res.json());
    } catch {}
  }

  function joinQueue() {
    setStatus('waiting');
    socket.emit('JOIN_QUEUE', { username: user.username, side: user.side });
  }

  function requestAI() {
    socket.emit('REQUEST_AI_DEBATE', { username: user.username, side: user.side });
  }

  function cancelQueue() {
    setStatus('idle');
    socket.emit('LEAVE_QUEUE');
  }

  const sideColor = user?.side === 'believer' ? 'var(--believer)' : 'var(--atheist)';
  const sideLabel = user?.side === 'believer' ? 'מאמין' : 'אתאיסט';

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 700 }}>
        <div className="card" style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--muted)', marginBottom: 8 }}>שלום,</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>
            {user?.username}
            <span style={{ marginRight: 10 }}><SideTag side={user?.side} /></span>
          </div>
          <div style={{ color: 'var(--muted)', marginTop: 6, fontSize: '0.9rem' }}>
            ניקוד: <span style={{ color: '#FFD700', fontWeight: 700 }}>{user?.score || 0}</span>
          </div>
        </div>

        {status === 'idle' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <button
              className={`btn btn-${user?.side}`}
              style={{ width: '100%', padding: '18px', fontSize: '1.1rem' }}
              onClick={joinQueue}
            >
              🔍 חפש יריב אנושי
            </button>
            <button
              className="btn btn-ghost"
              style={{ width: '100%', padding: '16px' }}
              onClick={requestAI}
            >
              🤖 שחק נגד AI
            </button>
          </div>
        )}

        {status === 'waiting' && (
          <div className="card" style={{ textAlign: 'center', padding: 40 }}>
            <div className="spinner" style={{ margin: '0 auto 20px' }} />
            <p style={{ fontSize: '1.1rem', marginBottom: 6 }}>מחפש יריב {sideLabel === 'מאמין' ? 'אתאיסט' : 'מאמין'}...</p>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: 20 }}>ממתין בתור</p>
            <button className="btn btn-ghost" onClick={cancelQueue}>ביטול</button>
          </div>
        )}

        {status === 'found' && (
          <div className="card" style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>⚡</div>
            <p style={{ fontSize: '1.2rem', fontWeight: 700 }}>נמצא יריב! מתחיל דיון...</p>
          </div>
        )}

        {liveDebates.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <h3 style={{ marginBottom: 14, color: 'var(--muted)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: 1 }}>
              דיונים חיים עכשיו
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {liveDebates.map(d => (
                <div key={d.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ color: 'var(--believer)', fontWeight: 700 }}>{d.believer.username}</span>
                    <span style={{ color: 'var(--muted)' }}>VS</span>
                    <span style={{ color: 'var(--atheist)', fontWeight: 700 }}>{d.atheist.username}</span>
                    <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>• 👁 {d.spectators}</span>
                  </div>
                  <button className="btn btn-dark" style={{ padding: '6px 16px', fontSize: '0.85rem' }}
                    onClick={() => navigate(`/spectate/${d.id}`)}>
                    צפה
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
