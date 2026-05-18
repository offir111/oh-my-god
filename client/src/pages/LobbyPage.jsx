import React, { useRef, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../store/appStore.js';
import { socket } from '../socket.js';
import SideTag from '../components/ui/SideTag.jsx';
import UserAvatarSlot from '../components/ui/UserAvatarSlot.jsx';
import { getCageAvatarDataUrlForDisplayName } from '../lib/cageUserProfile.js';

/** מסך חיפוש יריב אנושי — פריסה כמו דף דיון / צ׳אט AI, עם ספינר במרכז בלבד */
const humanMatchStyles = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - var(--shell-top))',
    padding: 0,
    overflow: 'hidden',
  },
  player: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 140 },
  bottomBar: {
    padding: '10px 20px 14px',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    background: 'linear-gradient(0deg, rgba(0, 0, 0, 0.35), transparent)',
  },
  shareButton: {
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

function HumanMatchmakingShell({ user, humanOppLabel, status, autoVirtualPhase, onCancel }) {
  const mySide = user?.side;
  const oppSide = mySide === 'believer' ? 'atheist' : 'believer';
  const oppColor = oppSide === 'believer' ? 'var(--believer)' : 'var(--atheist)';
  const isConnecting = autoVirtualPhase === 'connecting' || autoVirtualPhase === 'done';
  const toolbarLine =
    status === 'found'
      ? 'מתחבר לדיון…'
      : isConnecting
      ? 'מתחבר לדיון…'
      : `מחפש יריב ${humanOppLabel} לצ׳אט חי`;

  return (
    <div style={humanMatchStyles.page}>
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <div className="debate-chat-frame debate-chat-frame--embedded">
          <header className="debate-chat-frame-header" aria-label="כותרת חיפוש יריב">
            <div style={humanMatchStyles.player}>
              <SideTag side={mySide} />
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                <UserAvatarSlot
                  size="sm"
                  displayName={user?.username}
                  avatarUrl={getCageAvatarDataUrlForDisplayName(user?.username) || undefined}
                />
                {user?.username}
              </span>
            </div>
            <div style={{ flex: 1, textAlign: 'center', minWidth: 0, paddingInline: 6 }}>
              <span style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>
                🔍 התאמה חיה • חיפוש יריב אנושי
              </span>
            </div>
            <div style={{ ...humanMatchStyles.player, flexDirection: 'row-reverse', minWidth: 100, justifyContent: 'flex-end' }}>
              <span style={{ fontWeight: 700, color: oppColor, opacity: 0.5 }} aria-hidden>
                …
              </span>
              <SideTag side={oppSide} />
            </div>
          </header>

          <div className="debate-chat-frame-body debate-phase-stack">
            <div className="debate-feed-toolbar">
              <span className="toolbar-muted">{toolbarLine}</span>
              <span className="debate-turn-pill debate-turn-pill--wait">{isConnecting ? 'מתחבר…' : 'ממתין ליריב אנושי'}</span>
            </div>

            <div
              className="debate-messages-scroller"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                minHeight: 0,
              }}
            >
              <div className="spinner" style={{ width: 44, height: 44 }} aria-hidden />
              {(status === 'found' || autoVirtualPhase === 'done') ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: 18, fontWeight: 700 }}>
                  נמצא יריב! פותחים את הצ׳אט…
                </p>
              ) : isConnecting ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: 18, fontWeight: 700 }}>
                  מתחבר…
                </p>
              ) : (
                <p style={{ color: 'var(--muted)', fontSize: '0.88rem', marginTop: 18, textAlign: 'center', maxWidth: 300, lineHeight: 1.55 }}>
                  מחפשים משתמש מתאים — כמו במסך שיחה עם AI, רגעים ספורים לפני תחילת הדיון
                </p>
              )}
            </div>

            <div className="debate-composer">
              <input
                disabled
                placeholder={isConnecting ? 'מתחבר…' : 'ממתין ליריב אנושי…'}
                aria-label="שדה שליחה — יופעל כשנמצא יריב"
              />
              <button type="button" className={`btn btn-send btn-send--${mySide || 'believer'}`} disabled>
                שלח
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={humanMatchStyles.bottomBar}>
        <button type="button" onClick={onCancel} className="debate-share-link" style={humanMatchStyles.shareButton}>
          ביטול חיפוש
        </button>
      </div>
    </div>
  );
}

export default function LobbyPage() {
  const user = useAppStore(s => s.user);
  const setDebate = useAppStore(s => s.setDebate);
  const [status, setStatus] = useState('idle'); // idle | waiting | waiting-ai | found | error
  const [autoVirtualPhase, setAutoVirtualPhase] = useState('idle'); // idle | connecting | done
  const [connected, setConnected] = useState(socket.connected);
  const [serverUrl, setServerUrl] = useState('');
  const [httpOk, setHttpOk] = useState(null);
  const [liveDebates, setLiveDebates] = useState([]);
  const [matchError, setMatchError] = useState('');
  const matchmakingActiveRef = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();
  const quickAi = new URLSearchParams(location.search).get('ai') === '1';
  const quickHuman = new URLSearchParams(location.search).get('human') === '1';
  const aiQuickSentRef = useRef(false);
  const humanQuickSentRef = useRef(false);

  useEffect(() => {
    const url = import.meta.env.VITE_API_URL || 'https://oh-my-god-production.up.railway.app';
    setServerUrl(url);

    // Test plain HTTP connectivity to Railway
    fetch(`${url}/api/health`)
      .then(r => {
        if (!r.ok) throw new Error('health check failed');
        return r.json();
      })
      .then(() => { setHttpOk(true); })
      .catch(() => { setHttpOk(false); });

    fetchLive();

    const onConnect = () => { setConnected(true); };
    const onDisconnect = () => { setConnected(false); };
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    if (!socket.connected) socket.connect();

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
      setTimeout(() => navigate(`/debate/${debateId}`), 200);
    };

    socket.on('WAITING_FOR_OPPONENT', onWaitingForOpponent);
    socket.on('MATCH_ERROR', onMatchError);
    socket.on('MATCH_FOUND', onMatchFound);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('WAITING_FOR_OPPONENT', onWaitingForOpponent);
      socket.off('MATCH_ERROR', onMatchError);
      socket.off('MATCH_FOUND', onMatchFound);
    };
  }, []);

  useEffect(() => {
    if (!quickAi) {
      aiQuickSentRef.current = false;
      return;
    }
    if (!user?.username || !user?.side) return;
    if (aiQuickSentRef.current) return;
    aiQuickSentRef.current = true;
    matchmakingActiveRef.current = true;
    setMatchError('');
    socket.emit('REQUEST_AI_DEBATE', { username: user.username, side: user.side });
  }, [quickAi, user?.username, user?.side]);

  /** מסך כניסה: כבר נבחר „נגד יריב אנושי” — נכנסים ישר לתור בלי לשאול שוב אנושי מול AI */
  useEffect(() => {
    if (!quickHuman) {
      humanQuickSentRef.current = false;
      return;
    }
    if (!user?.username || !user?.side) return;
    if (humanQuickSentRef.current) return;
    humanQuickSentRef.current = true;
    matchmakingActiveRef.current = true;
    setMatchError('');
    setStatus('waiting');
    socket.emit('JOIN_QUEUE', { username: user.username, side: user.side });
  }, [quickHuman, user?.username, user?.side]);

  /** אחרי 3 שניות בתור אנושי — הצג "מתחבר..." ואחרי 5 שניות עבור לוירטואלי */
  useEffect(() => {
    if (status !== 'waiting') { setAutoVirtualPhase('idle'); return; }
    const t1 = setTimeout(() => setAutoVirtualPhase('connecting'), 3000);
    const t2 = setTimeout(() => {
      setAutoVirtualPhase('done');
      socket.emit('LEAVE_QUEUE');
      matchmakingActiveRef.current = true;
      socket.emit('REQUEST_AI_DEBATE', { username: user?.username, side: user?.side, firstMessage: 'היי' });
    }, 5000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [status]);

  /** לחיצה על לוגו בראש המסך — מאפס התאמה / המתנה ל-AI גם כשנשארים ב־/lobby (?homeTap מאלץ עדכון URL) */
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tap = params.get('homeTap');
    if (!tap) return;
    matchmakingActiveRef.current = false;
    aiQuickSentRef.current = false;
    humanQuickSentRef.current = false;
    setMatchError('');
    setStatus('idle');
    socket.emit('LEAVE_QUEUE');
    navigate('/lobby', { replace: true });
  }, [location.search, navigate]);

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
    aiQuickSentRef.current = false;
    humanQuickSentRef.current = false;
    setMatchError('');
    setStatus('idle');
    socket.emit('LEAVE_QUEUE');
  }

  function cancelQuickAi() {
    matchmakingActiveRef.current = false;
    aiQuickSentRef.current = false;
    humanQuickSentRef.current = false;
    setMatchError('');
    setStatus('idle');
    socket.emit('LEAVE_QUEUE');
    navigate('/lobby', { replace: true });
  }

  function cancelHumanQuick() {
    matchmakingActiveRef.current = false;
    humanQuickSentRef.current = false;
    aiQuickSentRef.current = false;
    setMatchError('');
    setStatus('idle');
    socket.emit('LEAVE_QUEUE');
    navigate('/lobby', { replace: true });
  }

  const humanOppLabel = user?.side === 'believer' ? 'אתאיסט' : 'מאמין';

  const showHumanMatchChatUi =
    user?.username &&
    user?.side &&
    status !== 'error' &&
    (quickHuman || (!quickAi && !quickHuman && (status === 'waiting' || status === 'found')));

  if (quickHuman && status === 'error') {
    return (
      <div className="page">
        <div className="container container-narrow" style={{ paddingTop: 48, textAlign: 'center' }}>
          <p style={{ color: '#f87171', fontWeight: 700, marginBottom: 16 }}>
            {matchError || 'לא ניתן להתחיל התאמה כרגע'}
          </p>
          <button type="button" className="btn btn-ghost" onClick={cancelHumanQuick}>חזרה ללובי</button>
        </div>
      </div>
    );
  }

  if (showHumanMatchChatUi) {
    return (
      <HumanMatchmakingShell
        user={user}
        humanOppLabel={humanOppLabel}
        status={status}
        autoVirtualPhase={autoVirtualPhase}
        onCancel={quickHuman ? cancelHumanQuick : cancelQueue}
      />
    );
  }

  if (quickAi && status === 'error') {
    return (
      <div className="page">
        <div className="container container-narrow" style={{ paddingTop: 48, textAlign: 'center' }}>
          <p style={{ color: '#f87171', fontWeight: 700, marginBottom: 16 }}>
            {matchError || 'לא ניתן להתחיל התאמה כרגע'}
          </p>
          <button type="button" className="btn btn-ghost" onClick={cancelQuickAi}>חזרה ללובי</button>
        </div>
      </div>
    );
  }

  if (quickAi) {
    return (
      <div
        className="page"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 'calc(100vh - var(--shell-top) - 48px)',
          padding: 24,
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <div className="spinner" style={{ margin: '0 auto 20px' }} />
          <p style={{ fontSize: '1.1rem', fontWeight: 700 }}>פותחים שיחה מול AI…</p>
          <p style={{ color: 'var(--muted)', fontSize: '0.88rem', marginTop: 10, lineHeight: 1.5 }}>
            מעבירים אותך לצ׳אט
          </p>
          <button type="button" className="btn btn-ghost" style={{ marginTop: 28 }} onClick={() => { cancelQuickAi(); navigate('/login?logo=1'); }}>
            ✕ ביטול וחזרה
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="container container-narrow">
        <div className="page-hero" style={{ textAlign: 'center' }}>
          <div className="page-kicker">לובי חי</div>
          <h1
            className="page-title"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <span>שלום,</span>
            <UserAvatarSlot
              size="md"
              displayName={user?.username}
              avatarUrl={getCageAvatarDataUrlForDisplayName(user?.username) || undefined}
            />
            <span>{user?.username}</span>
          </h1>
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
            <button className="btn btn-ghost" onClick={cancelQueue}>ביטול</button>
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
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <UserAvatarSlot
                        size="sm"
                        displayName={d.believer.username}
                        avatarUrl={getCageAvatarDataUrlForDisplayName(d.believer.username) || undefined}
                      />
                      <span style={{ color: 'var(--believer)', fontWeight: 700 }}>{d.believer.username}</span>
                    </span>
                    <span style={{ color: 'var(--muted)' }}>VS</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <UserAvatarSlot
                        size="sm"
                        displayName={d.atheist.username}
                        avatarUrl={getCageAvatarDataUrlForDisplayName(d.atheist.username) || undefined}
                      />
                      <span style={{ color: 'var(--atheist)', fontWeight: 700 }}>{d.atheist.username}</span>
                    </span>
                    <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>• 👁 {d.spectators}</span>
                  </div>
                  <button className="btn btn-dark" style={{ padding: '10px 18px', fontSize: '0.88rem', minHeight: 44, touchAction: 'manipulation' }}
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
