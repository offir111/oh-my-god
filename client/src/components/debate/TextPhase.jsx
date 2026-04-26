import React, { useState, useRef, useEffect } from 'react';
import { socket } from '../../socket.js';
import { useAppStore } from '../../store/appStore.js';
import MessageBubble from './MessageBubble.jsx';

const TEXT_LIMIT = 5;

export default function TextPhase({ debateId, opponentTyping }) {
  const user = useAppStore(s => s.user);
  const debate = useAppStore(s => s.debate);
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  const myCount = debate?.textCount?.[user?.side] || 0;
  const isMyTurn = debate?.turn === user?.side;
  const remaining = TEXT_LIMIT - myCount;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [debate?.textMessages?.length, opponentTyping]);

  function send() {
    if (!input.trim() || !isMyTurn) return;
    socket.emit('SEND_TEXT_MESSAGE', { debateId, content: input.trim() });
    setInput('');
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
          שלב טקסט — הודעות שלי: <strong>{myCount}/{TEXT_LIMIT}</strong>
        </span>
        {isMyTurn ? (
          <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>✏️ תורך לכתוב</span>
        ) : (
          <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>⏳ ממתין ליריב...</span>
        )}
      </div>

      <div style={styles.messages}>
        {debate?.textMessages?.map((msg, i) => (
          <MessageBubble key={i} msg={msg} mySide={user?.side} />
        ))}
        {opponentTyping && (
          <div style={{ textAlign: 'left', color: 'var(--muted)', fontSize: '0.9rem', padding: '4px 0' }}>
            🤖 AI מקליד<span className="pulse-anim">...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={styles.inputRow}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder={isMyTurn ? 'כתוב את טיעונך...' : 'ממתין ליריב...'}
          disabled={!isMyTurn || remaining <= 0}
          style={{ flex: 1 }}
          maxLength={600}
        />
        <button
          className={`btn btn-${user?.side}`}
          onClick={send}
          disabled={!input.trim() || !isMyTurn || remaining <= 0}
          style={{ padding: '10px 20px' }}
        >
          שלח
        </button>
      </div>
      {remaining <= 2 && remaining > 0 && (
        <div style={{ color: '#FFD700', fontSize: '0.8rem', textAlign: 'center', marginTop: 4 }}>
          נותרו {remaining} הודעות לשלב זה
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: { display: 'flex', flexDirection: 'column', height: '100%', gap: 12 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' },
  messages: { flex: 1, overflowY: 'auto', padding: '4px 0', minHeight: 0 },
  inputRow: { display: 'flex', gap: 10, alignItems: 'center' },
};
