import React, { useState, useRef, useEffect } from 'react';
import { socket } from '../../socket.js';
import { useAppStore } from '../../store/appStore.js';
import MessageBubble from './MessageBubble.jsx';

const TEXT_LIMIT = 5;

export default function TextPhase({ debateId, opponentTyping }) {
  const user = useAppStore(s => s.user);
  const debate = useAppStore(s => s.debate);
  const streamingMessage = useAppStore(s => s.streamingMessage);
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  const myCount = debate?.textCount?.[user?.side] || 0;
  const isMyTurn = debate?.turn === user?.side;
  const hasTextLimit = !debate?.isAI;
  const remaining = hasTextLimit ? TEXT_LIMIT - myCount : Infinity;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [debate?.textMessages?.length, opponentTyping, streamingMessage?.content]);

  function send() {
    if (!input.trim() || !isMyTurn) return;
    socket.emit('SEND_TEXT_MESSAGE', { debateId, content: input.trim() });
    setInput('');
  }

  return (
    <div className="debate-phase-stack">
      <div className="debate-feed-toolbar">
        <span className="toolbar-muted">
          שלב טקסט — הודעות שלי: <strong>{hasTextLimit ? `${myCount}/${TEXT_LIMIT}` : myCount}</strong>
        </span>
        {isMyTurn ? (
          <span className="debate-turn-pill debate-turn-pill--active">תורך לכתוב</span>
        ) : (
          <span className="debate-turn-pill debate-turn-pill--wait">ממתין ליריב…</span>
        )}
      </div>

      <div className="debate-messages-scroller">
        {debate?.textMessages?.map((msg, i) => (
          <MessageBubble key={i} msg={msg} mySide={user?.side} />
        ))}
        {streamingMessage && (
          <MessageBubble
            msg={{ ...streamingMessage, content: streamingMessage.content + '▋' }}
            mySide={user?.side}
          />
        )}
        {opponentTyping && !streamingMessage && (
          <div className="toolbar-muted" style={{ textAlign: 'right', padding: '8px 4px' }}>
            AI חושב<span className="pulse-anim">…</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="debate-composer">
        <input
          type="text"
          lang="he"
          dir="rtl"
          autoComplete="off"
          spellCheck
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder={isMyTurn ? 'כתוב את טיעונך…' : 'ממתין ליריב…'}
          disabled={!isMyTurn || remaining <= 0}
          aria-label="הודעת טקסט לדיון"
        />
        <button
          type="button"
          className={`btn btn-send btn-send--${user?.side || 'believer'}`}
          onClick={send}
          disabled={!input.trim() || !isMyTurn || remaining <= 0}
        >
          שלח
        </button>
      </div>
      {remaining <= 2 && remaining > 0 && (
        <div className="debate-hint">נותרו {remaining} הודעות לשלב זה</div>
      )}
    </div>
  );
}
