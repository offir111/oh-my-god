import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore.js';
import { useDebate } from '../hooks/useDebate.js';
import PhaseIndicator from '../components/debate/PhaseIndicator.jsx';
import TextPhase from '../components/debate/TextPhase.jsx';
import VoicePhase from '../components/debate/VoicePhase.jsx';
import LivePhase from '../components/debate/LivePhase.jsx';
import GiftOverlay from '../components/debate/GiftOverlay.jsx';
import SideTag from '../components/ui/SideTag.jsx';
import UserAvatarSlot from '../components/ui/UserAvatarSlot.jsx';
import { socket } from '../socket.js';
import { getShareOrigin } from '../lib/shareOrigin.js';
import { getCageAvatarDataUrlForDisplayName } from '../lib/cageUserProfile.js';

export default function DebatePage() {
  const { debateId } = useParams();
  const navigate = useNavigate();
  const user = useAppStore(s => s.user);
  const debate = useAppStore(s => s.debate);
  const setDebate = useAppStore(s => s.setDebate);
  const spectatorCount = useAppStore(s => s.spectatorCount);
  const { opponentTyping, opponentRecording, finished, finishData, disconnected } = useDebate(debateId);
  const [scoreToast, setScoreToast] = useState(null);
  const [shareToast, setShareToast] = useState('');
  const [loadingDebate, setLoadingDebate] = useState(() => !debate || debate.id !== debateId);
  const [humanAvailable, setHumanAvailable] = useState(false);

  const myDebateSide = user?.side;
  const oppDebateSide = myDebateSide === 'believer' ? 'atheist' : 'believer';

  /** סטרימינג גלובלי בזוטסטנד — ננקה בכניסה לדיון; לא ב-unmount של ההוק (מפריע ל־Strict Mode ומזריק צ׳אנקים). */
  useEffect(() => {
    useAppStore.getState().clearStreamingMessage();
  }, [debateId]);

  useEffect(() => {
    if (debate?.id === debateId) {
      setLoadingDebate(false);
      return;
    }

    let cancelled = false;

    async function restoreLiveDebate() {
      setLoadingDebate(true);
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/debates/live/${debateId}`);
        if (!res.ok) throw new Error('live debate not found');
        const data = await res.json();
        const isParticipant = [data?.believer?.username, data?.atheist?.username].includes(user?.username);
        if (!isParticipant) {
          navigate(`/spectate/${debateId}`, { replace: true });
          return;
        }
        if (!cancelled) {
          const rejoin = () => socket.emit('REJOIN_DEBATE', {
            debateId,
            username: user?.username,
            side: user?.side,
          });
          if (socket.connected) rejoin();
          else {
            socket.once('connect', rejoin);
            socket.connect();
          }
          setDebate(data);
        }
      } catch {
        if (!cancelled) navigate('/lobby', { replace: true });
      } finally {
        if (!cancelled) setLoadingDebate(false);
      }
    }

    restoreLiveDebate();
    return () => { cancelled = true; };
  }, [debate, debateId, navigate, setDebate, user?.username]);

  useEffect(() => {
    if (finished) {
      setScoreToast(`+נקודות! 🎉`);
      setTimeout(() => setScoreToast(null), 3000);
    }
  }, [finished]);

  /** כפתור מעבר לאנושי — בדיון AI בלבד */
  useEffect(() => {
    if (!debate?.isAI) return;

    const onHumanInQueue = () => setHumanAvailable(true);
    socket.on('HUMAN_IN_QUEUE', onHumanInQueue);

    const onHumanQueueStatus = ({ available }) => setHumanAvailable(available);
    socket.on('HUMAN_QUEUE_STATUS', onHumanQueueStatus);

    // Initial + periodic poll
    socket.emit('CHECK_HUMAN_QUEUE', { side: oppDebateSide });
    const poll = setInterval(() => {
      socket.emit('CHECK_HUMAN_QUEUE', { side: oppDebateSide });
    }, 5000);

    // Handle the new human match arriving
    const onSwitchMatchFound = ({ debateId: newId, isAI, believer, atheist, aiSide, turn }) => {
      setDebate({
        id: newId, isAI, aiSide,
        believer, atheist,
        phase: 'text', turn: turn || 'believer',
        textMessages: [], voiceMessages: [],
        textCount: { believer: 0, atheist: 0 },
        voiceCount: { believer: 0, atheist: 0 },
        giftsReceived: { believer: 0, atheist: 0 },
      });
      setTimeout(() => navigate(`/debate/${newId}`), 200);
    };
    socket.on('MATCH_FOUND', onSwitchMatchFound);

    return () => {
      socket.off('HUMAN_IN_QUEUE', onHumanInQueue);
      socket.off('HUMAN_QUEUE_STATUS', onHumanQueueStatus);
      socket.off('MATCH_FOUND', onSwitchMatchFound);
      clearInterval(poll);
    };
  }, [debate?.isAI, oppDebateSide]);

  if (!debate || debate.id !== debateId) {
    return loadingDebate ? (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    ) : null;
  }

  const mySide = user?.side;
  const opponent = mySide === 'believer' ? debate.atheist : debate.believer;
  const oppSide = mySide === 'believer' ? 'atheist' : 'believer';
  const oppColor = oppSide === 'believer' ? 'var(--believer)' : 'var(--atheist)';

  const spectateUrl = `${getShareOrigin()}/spectate/${debateId}`;

  async function copySpectateUrl() {
    try {
      await navigator.clipboard.writeText(spectateUrl);
      setShareToast('קישור הצפייה הועתק');
    } catch {
      setShareToast(spectateUrl);
    }
    setTimeout(() => setShareToast(''), 2500);
  }

  if (finished) {
    return (
      <div className="debate-finish-screen">
        <div style={{ fontSize: 'clamp(2.5rem, 10vw, 3.5rem)', filter: 'drop-shadow(0 8px 24px rgba(251,191,36,0.25))' }} aria-hidden="true">🏆</div>
        <h2>הדיון הסתיים</h2>
        {finishData?.summary && (
          <div className="card" style={{ maxWidth: 520, textAlign: 'center', width: '100%' }}>
            <p style={{ color: 'var(--muted)', fontSize: '0.82rem', marginBottom: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>סיכום</p>
            <p style={{ lineHeight: 1.75, color: 'var(--text-secondary)' }}>{finishData.summary}</p>
            {finishData.tags?.length > 0 && (
              <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {finishData.tags.map(t => <span key={t} style={styles.tag}>{t}</span>)}
              </div>
            )}
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/lobby')}>חזור ללובי</button>
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/knowledge')}>מאגר ידע</button>
        </div>
      </div>
    );
  }

  if (disconnected) {
    return (
      <div className="debate-finish-screen">
        <div style={{ fontSize: 'clamp(2.5rem, 10vw, 3.5rem)' }} aria-hidden="true">⚠️</div>
        <h2>היריב התנתק</h2>
        <p style={{ color: 'var(--muted)', maxWidth: 360, lineHeight: 1.7 }}>הדיון נסגר לפני הסיום הרגיל.</p>
        <button type="button" className="btn btn-ghost" onClick={() => navigate('/lobby')}>חזור ללובי</button>
      </div>
    );
  }

  const humanChatHeader = (
    <header className="debate-chat-frame-header" aria-label="כותרת שיחת דיון">
      <div style={styles.player}>
        <SideTag side={mySide} />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
          <UserAvatarSlot
            size="sm"
            displayName={user?.username}
            avatarUrl={getCageAvatarDataUrlForDisplayName(user?.username) || undefined}
          />
          {user?.username}
        </span>
        {debate.turn === mySide && <span style={styles.turnDot} />}
      </div>
      <div style={{ flex: 1, textAlign: 'center', minWidth: 0, paddingInline: 6 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <PhaseIndicator phase={debate.phase} />
        </div>
        {spectatorCount > 0 && (
          <div style={{ color: 'var(--muted)', fontSize: '0.72rem', marginTop: 4 }}>
            👁 {spectatorCount} צופים
          </div>
        )}
      </div>
      <div style={{ ...styles.player, flexDirection: 'row-reverse', minWidth: 100, justifyContent: 'flex-end' }}>
        {debate.turn === oppSide && <span style={{ ...styles.turnDot, background: oppColor }} />}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, color: oppColor }}>
          <UserAvatarSlot
            size="sm"
            displayName={opponent?.username}
            avatarUrl={getCageAvatarDataUrlForDisplayName(opponent?.username) || undefined}
          />
          {opponent?.username}
        </span>
        <SideTag side={oppSide} />
      </div>
    </header>
  );

  return (
    <div style={styles.page}>
      {/* ── X לסגירת דיון AI — fixed, מיושר לקצה שמאל של פאנל התוכן ── */}
      {debate.isAI && (
        <>
          <button
            type="button"
            aria-label="סגירה וחזרה לדף הקודם"
            onClick={() => navigate('/login?logo=1')}
            style={{
              position: 'fixed',
              left: 'max(12px, calc(50vw - 448px))',
              top: 'calc(var(--shell-top, 62px) + 8px)',
              width: 36, height: 36, borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--card2)',
              color: 'var(--text-secondary)',
              fontSize: '1.1rem', fontWeight: 700,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 9999,
            }}
          >✕</button>
          {/* ── כפתור מעבר לאנושי — ירוק כשיש יוזר בתור ── */}
          <button
            type="button"
            aria-label={humanAvailable ? 'עבור לדיון עם יוזר אנושי' : 'ממתין לאנושי בתור'}
            title={humanAvailable ? 'יוזר אנושי זמין — לחץ למעבר' : 'ממתין ליוזר אנושי…'}
            onClick={() => {
              if (!humanAvailable) return;
              socket.emit('SWITCH_TO_HUMAN', { debateId, username: user?.username, side: user?.side });
            }}
            style={{
              position: 'fixed',
              left: 'max(56px, calc(50vw - 404px))',
              top: 'calc(var(--shell-top, 62px) + 8px)',
              width: 36, height: 36, borderRadius: 10,
              border: humanAvailable ? '1px solid #22c55e' : '1px solid var(--border)',
              background: humanAvailable ? 'rgba(34,197,94,0.15)' : 'var(--card2)',
              color: humanAvailable ? '#22c55e' : 'var(--text-secondary)',
              fontSize: '1rem', fontWeight: 700,
              cursor: humanAvailable ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 9999,
              transition: 'background 0.3s, border-color 0.3s, color 0.3s',
            }}
          >👤</button>
        </>
      )}
      <div style={styles.body}>
        {debate.isAI ? (
          <div className="debate-chat-frame">
            <header className="debate-chat-frame-header" aria-label="כותרת שיחת דיון עם AI"
              style={{ flexWrap: 'nowrap', gap: 6 }}
            >
              {/* LEFT — המשתמש */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <SideTag side={mySide} />
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700, fontSize: '0.88rem', whiteSpace: 'nowrap' }}>
                  <UserAvatarSlot
                    size="sm"
                    displayName={user?.username}
                    avatarUrl={getCageAvatarDataUrlForDisplayName(user?.username) || undefined}
                  />
                  {user?.username}
                </span>
                {debate.turn === mySide && <span style={styles.turnDot} />}
              </div>

              {/* CENTER — VS */}
              <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
                <span style={{ color: 'var(--muted)', fontSize: '0.72rem', fontWeight: 800 }}>
                  VS
                </span>
                {spectatorCount > 0 && (
                  <span style={{ color: 'var(--muted)', fontSize: '0.7rem', marginRight: 6 }}>
                    · 👁 {spectatorCount}
                  </span>
                )}
              </div>

              {/* RIGHT — AI */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, justifyContent: 'flex-end' }}>
                {debate.turn === oppSide && <span style={{ ...styles.turnDot, background: oppColor }} />}
                <span style={{ fontWeight: 700, fontSize: '0.88rem', color: oppColor, whiteSpace: 'nowrap' }}>
                  {opponent?.username || 'AI'}
                </span>
                <SideTag side={oppSide} />
              </div>
            </header>
            <div className="debate-chat-frame-body">
              <TextPhase debateId={debateId} opponentTyping={opponentTyping} />
            </div>
          </div>
        ) : (
          <div className="debate-chat-frame">
            {humanChatHeader}
            <div className="debate-chat-frame-body">
              {debate.phase === 'text' && (
                <TextPhase debateId={debateId} opponentTyping={opponentTyping} />
              )}
              {debate.phase === 'voice' && (
                <VoicePhase debateId={debateId} opponentRecording={opponentRecording} />
              )}
              {debate.phase === 'live' && (
                <LivePhase debateId={debateId} />
              )}
            </div>
          </div>
        )}
      </div>

      <div style={styles.bottomBar}>
        <button type="button" onClick={copySpectateUrl} className="debate-share-link" style={styles.shareButton}>
          שתף קישור לצפייה
        </button>
        {shareToast && <span style={styles.shareToast}>{shareToast}</span>}
      </div>

      <GiftOverlay mySide={mySide} />

      {scoreToast && <div className="score-toast">{scoreToast}</div>}
    </div>
  );
}

const styles = {
  page: {
    display: 'flex', flexDirection: 'column',
    height: 'calc(100vh - var(--shell-top))', /* כותרת קבועה + ניווט צר */
    padding: '0',
    overflow: 'hidden',
  },
  player: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 140 },
  turnDot: { width: 8, height: 8, borderRadius: '50%', background: 'var(--believer)', animation: 'pulse 1s infinite' },
  body: { flex: 1, overflow: 'hidden', padding: '16px 20px', display: 'flex', flexDirection: 'column' },
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
  shareToast: {
    color: 'var(--muted)',
    fontSize: '0.8rem',
    maxWidth: 260,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  tag: {
    background: 'var(--card2)',
    padding: '6px 12px',
    borderRadius: 99,
    fontSize: '0.78rem',
    fontWeight: 700,
    color: 'var(--muted)',
    border: '1px solid var(--border)',
  },
};
