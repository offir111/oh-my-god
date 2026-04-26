import React, { useRef, useEffect } from 'react';
import { socket } from '../../socket.js';
import { useAppStore } from '../../store/appStore.js';
import { useMediaRecorder } from '../../hooks/useMediaRecorder.js';
import MessageBubble from './MessageBubble.jsx';

const VOICE_LIMIT = 5;

export default function VoicePhase({ debateId, opponentRecording }) {
  const user = useAppStore(s => s.user);
  const debate = useAppStore(s => s.debate);
  const { isRecording, audioBlob, duration, startRecording, stopRecording, clearBlob } = useMediaRecorder();
  const bottomRef = useRef(null);

  const myCount = debate?.voiceCount?.[user?.side] || 0;
  const isMyTurn = debate?.turn === user?.side;
  const remaining = VOICE_LIMIT - myCount;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [debate?.voiceMessages?.length]);

  function handleRecord() {
    if (isRecording) {
      stopRecording();
      socket.emit('VOICE_RECORDING_STOP', { debateId });
    } else {
      startRecording();
      socket.emit('VOICE_RECORDING_START', { debateId });
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

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
          שלב קולי — הודעות שלי: <strong>{myCount}/{VOICE_LIMIT}</strong>
        </span>
        {isMyTurn ? (
          <span style={{ color: '#fff', fontSize: '0.85rem' }}>🎙️ תורך להקליט</span>
        ) : (
          <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>⏳ ממתין ליריב...</span>
        )}
      </div>

      <div style={styles.messages}>
        {debate?.voiceMessages?.map((msg, i) => (
          <MessageBubble key={i} msg={msg} mySide={user?.side} />
        ))}
        {opponentRecording && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', color: 'var(--muted)' }}>
            <div className="recording-dots">
              <span /><span /><span />
            </div>
            היריב מקליט...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {isMyTurn && remaining > 0 && (
        <div style={styles.controls}>
          {!audioBlob ? (
            <button
              onClick={handleRecord}
              style={{
                ...styles.recordBtn,
                background: isRecording ? '#ff4444' : `var(--${user?.side})`,
                boxShadow: isRecording ? '0 0 20px rgba(255,68,68,0.6)' : 'none',
              }}
            >
              {isRecording ? (
                <>
                  <div className="recording-dots" style={{ justifyContent: 'center' }}>
                    <span /><span /><span />
                  </div>
                  <span style={{ marginTop: 4, fontSize: '0.85rem' }}>לחץ לסיום</span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: '2rem' }}>🎙️</span>
                  <span style={{ fontSize: '0.85rem' }}>לחץ להקלטה</span>
                </>
              )}
            </button>
          ) : (
            <div style={styles.previewRow}>
              <span style={{ color: '#aaa', fontSize: '0.9rem' }}>✅ הוקלטו {duration} שניות</span>
              <button className={`btn btn-${user?.side}`} onClick={sendVoice}>שלח הודעה קולית</button>
              <button className="btn btn-ghost" onClick={clearBlob} style={{ padding: '10px 16px' }}>מחק</button>
            </div>
          )}
        </div>
      )}

      {!isMyTurn && (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '16px 0' }}>
          {opponentRecording ? '🎙️ היריב מקליט...' : '⏳ ממתין להודעה הקולית של היריב'}
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: { display: 'flex', flexDirection: 'column', height: '100%', gap: 12 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  messages: { flex: 1, overflowY: 'auto', minHeight: 0 },
  controls: { display: 'flex', justifyContent: 'center', padding: '16px 0' },
  recordBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    width: 120, height: 120,
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    gap: 6,
    color: '#fff',
    fontWeight: 700,
    transition: 'all 0.2s',
    fontSize: '1rem',
  },
  previewRow: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' },
};
