import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socket } from '../socket.js';
import MessageBubble from '../components/debate/MessageBubble.jsx';
import UserAvatarSlot from '../components/ui/UserAvatarSlot.jsx';
import { useAppStore } from '../store/appStore.js';
import { getCageAvatarDataUrlForDisplayName } from '../lib/cageUserProfile.js';

const GIFTS = ['🔥', '💡', '👏', '🎯', '⚡', '🌟', '💪', '🤔', '😤', '🎤'];

export default function SpectatorPage() {
  const { debateId } = useParams();
  const navigate = useNavigate();
  const user = useAppStore(s => s.user);
  const [debate, setDebate] = useState(null);
  const [count, setCount] = useState(0);
  const [messages, setMessages] = useState([]);
  const [voiceMessages, setVoiceMessages] = useState([]);
  const [phase, setPhase] = useState('text');
  const [gifts, setGifts] = useState([]);
  const [error, setError] = useState('');
  const giftTimersRef = useRef(new Set());

  useEffect(() => {
    let didReceiveState = false;
    const timeoutId = setTimeout(() => {
      if (!didReceiveState) setError('לא הצלחנו להתחבר לדיון. ייתכן שהקישור כבר לא פעיל.');
    }, 10000);

    if (!socket.connected) socket.connect();

    socket.emit('SPECTATE_DEBATE', { debateId });

    const onSpectatorState = ({ debate, count }) => {
      didReceiveState = true;
      clearTimeout(timeoutId);
      setError('');
      setDebate(debate);
      setCount(count);
      setMessages(debate.textMessages || []);
      setVoiceMessages(debate.voiceMessages || []);
      setPhase(debate.phase);
    };

    const onSpectateError = ({ message }) => {
      didReceiveState = true;
      clearTimeout(timeoutId);
      setError(message || 'לא ניתן להתחבר לדיון');
    };

    const onTextMessageReceived = msg => setMessages(m => [...m, msg]);
    const onVoiceMessageReceived = msg => setVoiceMessages(m => [...m, msg]);
    const onPhaseChanged = ({ phase }) => setPhase(phase);
    const onSpectatorCountUpdated = ({ count }) => setCount(count);
    const onGiftReceived = gift => {
      setGifts(g => [...g, { ...gift, uid: Math.random() }]);
      const timer = setTimeout(() => {
        setGifts(g => g.slice(1));
        giftTimersRef.current.delete(timer);
      }, 2000);
      giftTimersRef.current.add(timer);
    };

    socket.on('SPECTATOR_STATE', onSpectatorState);
    socket.on('SPECTATE_ERROR', onSpectateError);
    socket.on('TEXT_MESSAGE_RECEIVED', onTextMessageReceived);
    socket.on('VOICE_MESSAGE_RECEIVED', onVoiceMessageReceived);
    socket.on('PHASE_CHANGED', onPhaseChanged);
    socket.on('SPECTATOR_COUNT_UPDATED', onSpectatorCountUpdated);
    socket.on('GIFT_RECEIVED', onGiftReceived);

    return () => {
      clearTimeout(timeoutId);
      for (const timer of giftTimersRef.current) clearTimeout(timer);
      giftTimersRef.current.clear();
      socket.emit('LEAVE_SPECTATE', { debateId });
      socket.off('SPECTATOR_STATE', onSpectatorState);
      socket.off('SPECTATE_ERROR', onSpectateError);
      socket.off('TEXT_MESSAGE_RECEIVED', onTextMessageReceived);
      socket.off('VOICE_MESSAGE_RECEIVED', onVoiceMessageReceived);
      socket.off('PHASE_CHANGED', onPhaseChanged);
      socket.off('SPECTATOR_COUNT_UPDATED', onSpectatorCountUpdated);
      socket.off('GIFT_RECEIVED', onGiftReceived);
    };
  }, [debateId]);

  function sendGift(targetSide, emoji) {
    socket.emit('SEND_GIFT', { debateId, targetSide, emoji });
  }

  if (!debate) {
    return (
      <div className="spectator-page" style={{ alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        {error ? (
          <>
            <p style={{ color: 'var(--muted)', fontWeight: 600 }}>{error}</p>
            <button type="button" className="btn btn-ghost" onClick={() => navigate('/knowledge')}>
              חזרה למאגר הידע
            </button>
          </>
        ) : (
          <>
            <div className="spinner" />
            <p style={{ color: 'var(--muted)', fontWeight: 600 }}>מתחבר לדיון…</p>
          </>
        )}
      </div>
    );
  }

  const allMessages = phase === 'text' ? messages : voiceMessages;
  const phaseLabel = phase === 'text' ? 'טקסט' : phase === 'voice' ? 'קולי' : 'שיחה';

  return (
    <div className="spectator-page">
      <button type="button" className="spectator-back" onClick={() => navigate(user ? '/lobby' : '/knowledge')}>
        חזרה
      </button>
      <header className="spectator-top">
        <div className="spectator-top__names">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--believer)', fontWeight: 800 }}>
            <UserAvatarSlot
              size="sm"
              displayName={debate.believer.username}
              avatarUrl={getCageAvatarDataUrlForDisplayName(debate.believer.username) || undefined}
            />
            {debate.believer.username}
          </span>
          <span style={{ color: 'var(--muted)', fontWeight: 700 }}>VS</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--atheist)', fontWeight: 800 }}>
            <UserAvatarSlot
              size="sm"
              displayName={debate.atheist.username}
              avatarUrl={getCageAvatarDataUrlForDisplayName(debate.atheist.username) || undefined}
            />
            {debate.atheist.username}
          </span>
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
