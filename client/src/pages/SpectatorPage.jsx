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
  const addGift = useAppStore(s => s.addGift);

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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div className="spinner" />
        <p style={{ color: 'var(--muted)' }}>מתחבר לדיון...</p>
      </div>
    );
  }

  const allMessages = phase === 'text' ? messages : voiceMessages;

  return (
    <div style={styles.page}>
      <button onClick={() => navigate(-1)} style={{ background:'none', border:'none', color:'#aaa', fontSize:'0.9rem', cursor:'pointer', padding:'8px 16px', alignSelf:'flex-start' }}>← חזרה</button>
      <div style={styles.header}>
        <div style={styles.headerTitle}>
          <span style={{ color: 'var(--believer)', fontWeight: 700 }}>{debate.believer.username} (מאמין)</span>
          <span style={{ color: 'var(--muted)' }}>VS</span>
          <span style={{ color: 'var(--atheist)', fontWeight: 700 }}>{debate.atheist.username} (אתאיסט)</span>
        </div>
        <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>👁 {count} צופים • שלב: {phase}</div>
      </div>

      <div style={styles.body}>
        <div style={styles.feed}>
          {allMessages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} mySide={null} />
          ))}
          {gifts.map(g => (
            <div key={g.uid} style={{ textAlign: 'center', fontSize: '2rem', animation: 'giftFloat 1.8s ease-out forwards' }}>
              {g.emoji} → {g.targetSide === 'believer' ? debate.believer.username : debate.atheist.username}
            </div>
          ))}
        </div>

        <div style={styles.sidebar}>
          <h3 style={styles.sidebarTitle}>שלח מתנה</h3>

          <div style={styles.giftSection}>
            <p style={{ color: 'var(--believer)', fontWeight: 700, fontSize: '0.85rem', marginBottom: 8 }}>
              למאמין — {debate.believer.username}
            </p>
            <div style={styles.giftGrid}>
              {GIFTS.map(e => (
                <button key={e} onClick={() => sendGift('believer', e)} style={styles.giftBtn}>{e}</button>
              ))}
            </div>
          </div>

          <div style={styles.giftSection}>
            <p style={{ color: 'var(--atheist)', fontWeight: 700, fontSize: '0.85rem', marginBottom: 8 }}>
              לאתאיסט — {debate.atheist.username}
            </p>
            <div style={styles.giftGrid}>
              {GIFTS.map(e => (
                <button key={e} onClick={() => sendGift('atheist', e)} style={styles.giftBtn}>{e}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#000' },
  header: {
    padding: '14px 20px', background: 'var(--card)',
    borderBottom: '1px solid var(--border)',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitle: { display: 'flex', gap: 12, alignItems: 'center', fontSize: '1rem' },
  body: { flex: 1, display: 'flex', overflow: 'hidden' },
  feed: { flex: 1, padding: '16px 20px', overflowY: 'auto' },
  sidebar: {
    width: 240, borderRight: '1px solid var(--border)',
    padding: '16px 14px', overflowY: 'auto',
    background: 'var(--card)',
  },
  sidebarTitle: { fontSize: '0.9rem', color: 'var(--muted)', marginBottom: 16, fontWeight: 700 },
  giftSection: { marginBottom: 20 },
  giftGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 },
  giftBtn: {
    background: 'var(--card2)', border: '1px solid var(--border)',
    borderRadius: 8, cursor: 'pointer', padding: '6px',
    fontSize: '1.2rem', transition: 'transform 0.1s',
  },
};
