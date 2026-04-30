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
import { socket } from '../socket.js';

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

  const spectateUrl = `${window.location.origin}/spectate/${debateId}`;

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

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <div style={styles.player}>
          <SideTag side={mySide} />
          <span style={{ fontWeight: 700 }}>{user?.username}</span>
          {debate.turn === mySide && <span style={styles.turnDot} />}
        </div>
        <div style={{ textAlign: 'center' }}>
          {!debate.isAI && <PhaseIndicator phase={debate.phase} />}
          {debate.isAI && <span style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>🤖 AI • שיחה חופשית</span>}
          {spectatorCount > 0 && (
            <div style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>
              👁 {spectatorCount} צופים
            </div>
          )}
        </div>
        <div style={{ ...styles.player, flexDirection: 'row-reverse' }}>
          {debate.turn === oppSide && <span style={{ ...styles.turnDot, background: oppColor }} />}
          <span style={{ fontWeight: 700, color: oppColor }}>{opponent?.username}</span>
          <SideTag side={oppSide} />
        </div>
      </div>

      <div style={styles.body}>
        {/* AI debates: always text, no phase transitions */}
        {debate.isAI ? (
          <TextPhase debateId={debateId} opponentTyping={opponentTyping} />
        ) : (
          <>
            {debate.phase === 'text' && (
              <TextPhase debateId={debateId} opponentTyping={opponentTyping} />
            )}
            {debate.phase === 'voice' && (
              <VoicePhase debateId={debateId} opponentRecording={opponentRecording} />
            )}
            {debate.phase === 'live' && (
              <LivePhase debateId={debateId} />
            )}
          </>
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
    height: 'calc(100vh - var(--total-h))', /* כותרת + ניווט צר + navbar */
    padding: '0',
    overflow: 'hidden',
  },
  topBar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 20px',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 100%), var(--card)',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
    backdropFilter: 'blur(8px)',
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
