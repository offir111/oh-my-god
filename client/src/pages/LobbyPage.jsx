import React, { useRef, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../store/appStore.js';
import { socket } from '../socket.js';
import SideTag from '../components/ui/SideTag.jsx';

export default function LobbyPage() {
  const user = useAppStore(s => s.user);
  const setDebate = useAppStore(s => s.setDebate);
  const [status, setStatus] = useState('idle'); // idle | waiting | waiting-ai | found | error
  const [connected, setConnected] = useState(socket.connected);
  const [serverUrl, setServerUrl] = useState('');
  const [httpOk, setHttpOk] = useState(null);
  const [liveDebates, setLiveDebates] = useState([]);
  const [matchError, setMatchError] = useState('');
  const matchmakingActiveRef = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const url = import.meta.env.VITE_API_URL || 'https://oh-my-god-production.up.railway.app';
    setServerUrl(url);

    // Test plain HTTP connectivity to Railway
    fetch(`${url}/api/health`)
      .then(r => {
        if (!r.ok) throw new Error('health check failed');
        return r.json();
      })
      .then(d => { console.log('[lobby] HTTP health OK:', d); setHttpOk(true); })
      .catch(e => { console.error('[lobby] HTTP health FAILED:', e.message); setHttpOk(false); });

    fetchLive();

    const onConnect = () => { setConnected(true); console.log('[lobby] socket connected'); };
    const onDisconnect = () => { setConnected(false); console.log('[lobby] socket disconnected'); };
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    if (!socket.connected) socket.connect();

    // Auto-start AI debate if coming from login with ?ai=1
    const params = new URLSearchParams(location.search);
    let autoStartTimer = null;
    if (params.get('ai') === '1') {
      autoStartTimer = setTimeout(() => {
        console.log('[lobby] auto-starting AI, connected=', socket.connected);
        matchmakingActiveRef.current = true;
        setStatus('waiting-ai');
        socket.emit('REQUEST_AI_DEBATE', { username: user?.username, side: user?.side });
      }, 800);
    }

    const onWaitingForOpponent = () => setStatus('waiting');
    const onMatchError = ({ message }) => {
      matchmakingActiveRef.current = false;
      setMatchError(message || 'לא ניתן להתחיל התאמה כרגע');
      setStatus('error');
    };
    const onMatchFound = ({ debateId, isAI, believer, atheist, aiSide, turn }) => {
      if (!matchmakingActiveRef.current) return;
      matchmakingActiveRef.current = false;
      setStatus('found');
      setDebate({
        id: debateId, isAI, aiSide,
        believer, atheist,
        phase: 'text', turn: turn || 'believer',
        textMessages: [], voiceMessages: [],
        textCount: { believer: 0, atheist: 0 },
        voiceCount: { believer: 0, atheist: 0 },
        giftsReceived: { believer: 0, atheist: 0 },
      });
      setTimeout(() => navigate(`/debate/${debateId}`), 600);
    };

    socket.on('WAITING_FOR_OPPONENT', onWaitingForOpponent);
    socket.on('MATCH_ERROR', onMatchError);
    socket.on('MATCH_FOUND', onMatchFound);

    return () => {
      if (autoStartTimer) clearTimeout(autoStartTimer);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('WAITING_FOR_OPPONENT', onWaitingForOpponent);
      socket.off('MATCH_ERROR', onMatchError);
      socket.off('MATCH_FOUND', onMatchFound);
    };
  }, []);

  async function fetchLive() {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/debates/live`);
      if (!res.ok) throw new Error('failed to load live debates');
      setLiveDebates(await res.json());
    } catch {
      setLiveDebates([]);
    }
  }

  function joinQueue() {
    matchmakingActiveRef.current = true;
    setMatchError('');
    setStatus('waiting');
    socket.emit('JOIN_QUEUE', { username: user.username, side: user.side });
  }

  function requestAI() {
    matchmakingActiveRef.current = true;
    setMatchError('');
    setStatus('waiting-ai');
    socket.emit('REQUEST_AI_DEBATE', { username: user.username, side: user.side });
  }

  function cancelQueue() {
    matchmakingActiveRef.current = false;
    setMatchError('');
    setStatus('idle');
    socket.emit('LEAVE_QUEUE');
  }

  const sideColor = user?.side === 'believer' ? 'var(--believer)' : 'var(--atheist)';
  const sideLabel = user?.side === 'believer' ? 'מאמין' : 'אתאיסט';

  return (
    <div className="page">
      <div className="container container-narrow">
        <div className="page-hero" style={{ textAlign: 'center' }}>
          <div className="page-kicker">לובי חי</div>
          <h1 className="page-title">שלום, {user?.username}</h1>
          <p className="page-subtitle" style={{ margin: '0 auto 16px' }}>
            בחר איך להתחיל את הדיון הבא שלך. אפשר לחכות ליריב אנושי או לפתוח דיון מיידי מול AI.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <SideTag side={user?.side} />
          </div>
          <div className="stat-grid">
            <div className="stat-tile">
              <strong>{user?.score || 0}</strong>
              <span>נקודות</span>
            </div>
            <div className="stat-tile">
              <strong>{liveDebates.length}</strong>
              <span>דיונים חיים</span>
            </div>
            <div className="stat-tile">
              <strong style={{ color: connected ? '#86efac' : '#fca5a5' }}>{connected ? 'מחובר' : 'מנותק'}</strong>
              <span>שרת בזמן אמת</span>
            </div>
          </div>
        </div>

        {status === 'idle' && (
          <div className="surface-panel" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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

        {status === 'waiting-ai' && (
          <div className="card" style={{ textAlign: 'center', padding: 40 }}>
            <div className="spinner" style={{ margin: '0 auto 20px' }} />
            <p style={{ fontSize: '1.1rem', marginBottom: 6 }}>🤖 מתחבר ל-AI...</p>
            <p style={{ color: connected ? '#00AA44' : '#ff6666', fontSize: '0.85rem', marginBottom: 4 }}>
              {connected ? '✅ מחובר לשרת' : '❌ לא מחובר לשרת'}
            </p>
            <p style={{ color: httpOk === true ? '#00AA44' : httpOk === false ? '#ff6666' : '#888', fontSize: '0.8rem', marginBottom: 2 }}>
              HTTP: {httpOk === null ? '⏳ בודק...' : httpOk ? '✅ שרת מגיב' : '❌ שרת לא מגיב'}
            </p>
            <p style={{ color: '#555', fontSize: '0.65rem', marginBottom: 4, wordBreak: 'break-all' }}>
              {serverUrl}
            </p>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: 20 }}>מכין את הדיון</p>
            <button className="btn btn-ghost" onClick={() => setStatus('idle')}>ביטול</button>
          </div>
        )}

        {status === 'found' && (
          <div className="card" style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>⚡</div>
            <p style={{ fontSize: '1.2rem', fontWeight: 700 }}>נמצא יריב! מתחיל דיון...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="card" style={{ textAlign: 'center', padding: 40 }}>
            <p style={{ color: '#f87171', fontWeight: 700, marginBottom: 16 }}>
              {matchError || 'לא ניתן להתחיל התאמה כרגע'}
            </p>
            <button type="button" className="btn btn-ghost" onClick={cancelQueue}>חזרה ללובי</button>
          </div>
        )}

        {liveDebates.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <h3 className="section-title" style={{ marginBottom: 14 }}>
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
