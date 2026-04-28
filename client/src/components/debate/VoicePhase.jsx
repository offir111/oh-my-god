import React, { useRef, useEffect } from 'react';
import { socket } from '../../socket.js';
import { useAppStore } from '../../store/appStore.js';
import { useMediaRecorder } from '../../hooks/useMediaRecorder.js';
import MessageBubble from './MessageBubble.jsx';

const VOICE_LIMIT = 5;

export default function VoicePhase({ debateId, opponentRecording }) {
  const user = useAppStore(s => s.user);
  const debate = useAppStore(s => s.debate);
  const { isRecording, audioBlob, duration, error, startRecording, stopRecording, clearBlob } = useMediaRecorder();
  const bottomRef = useRef(null);

  const myCount = debate?.voiceCount?.[user?.side] || 0;
  const isMyTurn = debate?.turn === user?.side;
  const remaining = VOICE_LIMIT - myCount;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [debate?.voiceMessages?.length]);

  async function handleRecord() {
    if (isRecording) {
      stopRecording();
      socket.emit('VOICE_RECORDING_STOP', { debateId });
    } else {
      const started = await startRecording();
      if (started) socket.emit('VOICE_RECORDING_START', { debateId });
    }
  }

  async function sendVoice() {
    if (!audioBlob) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const b64 = reader.result.split(',')[1];
      socket.emit('SEND_VOICE_MESSAGE', { debateId, audioB64: b64, duration });
      clearBlob();
    };
    reader.readAsDataURL(audioBlob);
  }

  const recordStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: 124,
    height: 124,
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    gap: 6,
    color: '#fff',
    fontWeight: 700,
    transition: 'all 0.2s',
    fontSize: '1rem',
    background: isRecording ? '#ef4444' : `var(--${user?.side})`,
    boxShadow: isRecording ? '0 0 28px rgba(239,68,68,0.55)' : '0 8px 32px rgba(0,0,0,0.35)',
  };

  return (
    <div className="debate-phase-stack">
      <div className="debate-feed-toolbar">
        <span className="toolbar-muted">
          שלב קולי — הודעות שלי: <strong>{myCount}/{VOICE_LIMIT}</strong>
        </span>
        {isMyTurn ? (
          <span className="debate-turn-pill debate-turn-pill--active">תורך להקליט</span>
        ) : (
          <span className="debate-turn-pill debate-turn-pill--wait">ממתין ליריב…</span>
        )}
      </div>

      <div className="debate-messages-scroller">
        {debate?.voiceMessages?.map((msg, i) => (
          <MessageBubble key={i} msg={msg} mySide={user?.side} />
        ))}
        {opponentRecording && (
          <div className="toolbar-muted" style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 4px' }}>
            <div className="recording-dots">
              <span /><span /><span />
            </div>
            היריב מקליט…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {isMyTurn && remaining > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0' }}>
          {!audioBlob ? (
            <button type="button" onClick={handleRecord} style={recordStyle} aria-pressed={isRecording}>
              {isRecording ? (
                <>
                  <div className="recording-dots" style={{ justifyContent: 'center' }}>
                    <span /><span /><span />
                  </div>
                  <span style={{ marginTop: 4, fontSize: '0.82rem' }}>לחץ לסיום</span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: '2rem' }} aria-hidden="true">🎙️</span>
                  <span style={{ fontSize: '0.82rem' }}>לחץ להקלטה</span>
                </>
              )}
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
              <span className="toolbar-muted" style={{ fontSize: '0.9rem' }}>
                הוקלטו {duration} שניות
              </span>
              <button type="button" className={`btn btn-${user?.side}`} onClick={sendVoice}>
                שלח הודעה קולית
              </button>
              <button type="button" className="btn btn-ghost" onClick={clearBlob}>
                מחק
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="debate-hint" role="alert">
          {error}
        </div>
      )}

      {!isMyTurn && (
        <div className="toolbar-muted" style={{ textAlign: 'center', padding: '16px 0' }}>
          {opponentRecording ? 'היריב מקליט…' : 'ממתין להודעה הקולית של היריב'}
        </div>
      )}
    </div>
  );
}
