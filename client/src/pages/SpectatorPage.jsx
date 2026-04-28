import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socket } from '../socket.js';
import MessageBubble from '../components/debate/MessageBubble.jsx';
import { useAppStore } from '../store/appStore.js';

const GIFTS = ['🔥', '💡', '👏', '🎯', '⚡', '🌟', '💪', '🤔', '😤', '🎤'];

export default function SpectatorPage() {
  const { debateId } = useParams();
  const navigate = useNavigate();
  const [debate, setDebate] = useState(null);
  const [count, setCount] = useState(0);
  const [messages, setMessages] = useState([]);
  const [voiceMessages, setVoiceMessages] = useState([]);
  const [phase, setPhase] = useState('text');
  const [gifts, setGifts] = useState([]);

  useEffect(() => {
    if (!socket.connected) socket.connect();

    socket.emit('SPECTATE_DEBATE', { debateId });

    socket.on('SPECTATOR_STATE', ({ debate, count }) => {
      setDebate(debate);
      setCount(count);
      setMessages(debate.textMessages || []);
      setVoiceMessages(debate.voiceMessages || []);
      setPhase(debate.phase);
    });

    socket.on('TEXT_MESSAGE_RECEIVED', msg => setMessages(m => [...m, msg]));
    socket.on('VOICE_MESSAGE_RECEIVED', msg => setVoiceMessages(m => [...m, msg]));
    socket.on('PHASE_CHANGED', ({ phase }) => setPhase(phase));
    socket.on('SPECTATOR_COUNT_UPDATED', ({ count }) => setCount(count));
    socket.on('GIFT_RECEIVED', gift => {
      setGifts(g => [...g, { ...gift, uid: Math.random() }]);
      setTimeout(() => setGifts(g => g.slice(1)), 2000);
    });

    return () => {
      socket.emit('LEAVE_SPECTATE', { debateId });
      socket.off('SPECTATOR_STATE');
      socket.off('TEXT_MESSAGE_RECEIVED');
      socket.off('VOICE_MESSAGE_RECEIVED');
      socket.off('PHASE_CHANGED');
      socket.off('SPECTATOR_COUNT_UPDATED');
      socket.off('GIFT_RECEIVED');
    };
  }, [debateId]);

  function sendGift(targetSide, emoji) {
    socket.emit('SEND_GIFT', { debateId, targetSide, emoji });
  }

  if (!debate) {
    return (
      <div className="spectator-page" style={{ alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div className="spinner" />
        <p style={{ color: 'var(--muted)', fontWeight: 600 }}>מתחבר לדיון…</p>
      </div>
    );
  }

  const allMessages = phase === 'text' ? messages : voiceMessages;
  const phaseLabel = phase === 'text' ? 'טקסט' : phase === 'voice' ? 'קולי' : 'שיחה';

  return (
    <div className="spectator-page">
      <button type="button" className="spectator-back" onClick={() => navigate(-1)}>
        חזרה
      </button>
      <header className="spectator-top">
        <div className="spectator-top__names">
          <span style={{ color: 'var(--believer)', fontWeight: 800 }}>{debate.believer.username}</span>
          <span style={{ color: 'var(--muted)', fontWeight: 700 }}>VS</span>
          <span style={{ color: 'var(--atheist)', fontWeight: 800 }}>{debate.atheist.username}</span>
        </div>
        <div className="spectator-top__meta">
          {count} צופים · שלב {phaseLabel}
        </div>
      </header>

      <div className="spectator-layout">
        <div className="spectator-feed">
          {allMessages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} mySide={null} />
          ))}
          {gifts.map(g => (
            <div
              key={g.uid}
              style={{ textAlign: 'center', fontSize: '2rem', animation: 'giftFloat 1.8s ease-out forwards' }}
            >
              {g.emoji} → {g.targetSide === 'believer' ? debate.believer.username : debate.atheist.username}
            </div>
          ))}
        </div>

        <aside className="spectator-sidebar" aria-label="מתנות לצדדים">
          <h3>מתנות</h3>

          <div style={{ marginBottom: 22 }}>
            <p style={{ color: 'var(--believer)', fontWeight: 800, fontSize: '0.86rem', marginBottom: 10 }}>
              למאמין — {debate.believer.username}
            </p>
            <div className="spectator-gift-grid">
              {GIFTS.map(e => (
                <button
                  type="button"
                  key={e}
                  className="spectator-gift-btn"
                  onClick={() => sendGift('believer', e)}
                  aria-label={`מתנה ${e} למאמין`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p style={{ color: 'var(--atheist)', fontWeight: 800, fontSize: '0.86rem', marginBottom: 10 }}>
              לאתאיסט — {debate.atheist.username}
            </p>
            <div className="spectator-gift-grid">
              {GIFTS.map(e => (
                <button
                  type="button"
                  key={e}
                  className="spectator-gift-btn"
                  onClick={() => sendGift('atheist', e)}
                  aria-label={`מתנה ${e} לאתאיסט`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
