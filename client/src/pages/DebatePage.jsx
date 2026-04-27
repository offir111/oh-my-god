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

export default function DebatePage() {
  const { debateId } = useParams();
  const navigate = useNavigate();
  const user = useAppStore(s => s.user);
  const debate = useAppStore(s => s.debate);
  const spectatorCount = useAppStore(s => s.spectatorCount);
  const { opponentTyping, opponentRecording, finished, finishData, disconnected } = useDebate(debateId);
  const [scoreToast, setScoreToast] = useState(null);

  useEffect(() => {
    if (!debate) navigate('/lobby', { replace: true });
  }, [debate]);

  useEffect(() => {
    if (finished) {
      setScoreToast(`+נקודות! 🎉`);
      setTimeout(() => setScoreToast(null), 3000);
    }
  }, [finished]);

  if (!debate) return null;

  const mySide = user?.side;
  const opponent = mySide === 'believer' ? debate.atheist : debate.believer;
  const oppSide = mySide === 'believer' ? 'atheist' : 'believer';
  const oppColor = oppSide === 'believer' ? 'var(--believer)' : 'var(--atheist)';

  const spectateUrl = `${window.location.origin}/spectate/${debateId}`;

  if (finished) {
    return (
      <div style={styles.finishPage}>
        <div style={{ fontSize: '3rem' }}>🏆</div>
        <h2 style={{ fontSize: '1.8rem' }}>הדיון הסתיים!</h2>
        {finishData?.summary && (
          <div className="card" style={{ maxWidth: 500, textAlign: 'center' }}>
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: 8 }}>סיכום:</p>
            <p style={{ lineHeight: 1.7 }}>{finishData.summary}</p>
            {finishData.tags?.length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                {finishData.tags.map(t => <span key={t} style={styles.tag}>{t}</span>)}
              </div>
            )}
          </div>
        )}
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-ghost" onClick={() => navigate('/lobby')}>חזור ללובי</button>
          <button className="btn btn-ghost" onClick={() => navigate('/knowledge')}>מאגר ידע</button>
        </div>
      </div>
    );
  }

  if (disconnected) {
    return (
      <div style={styles.finishPage}>
        <div style={{ fontSize: '3rem' }}>⚠️</div>
        <h2>היריב התנתק</h2>
        <p style={{ color: 'var(--muted)' }}>הדיון הסתיים מוקדם.</p>
        <button className="btn btn-ghost" onClick={() => navigate('/lobby')}>חזור ללובי</button>
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
        <a href={spectateUrl} target="_blank" rel="noreferrer"
          style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>
          🔗 שתף קישור לצפייה
        </a>
      </div>

      <GiftOverlay mySide={mySide} />

      {scoreToast && <div className="score-toast">{scoreToast}</div>}
    </div>
  );
}

const styles = {
  page: {
    display: 'flex', flexDirection: 'column',
    height: 'calc(100vh - 57px)',
    padding: '0',
    overflow: 'hidden',
  },
  topBar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 20px',
    background: 'var(--card)',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  player: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 140 },
  turnDot: { width: 8, height: 8, borderRadius: '50%', background: 'var(--believer)', animation: 'pulse 1s infinite' },
  body: { flex: 1, overflow: 'hidden', padding: '16px 20px', display: 'flex', flexDirection: 'column' },
  bottomBar: {
    padding: '8px 20px',
    borderTop: '1px solid var(--border)',
    display: 'flex', justifyContent: 'center',
    flexShrink: 0,
  },
  finishPage: {
    minHeight: '80vh',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 24, padding: '40px 20px', textAlign: 'center',
  },
  tag: {
    background: 'var(--card2)', padding: '3px 10px',
    borderRadius: 99, fontSize: '0.8rem', color: 'var(--muted)',
  },
};
