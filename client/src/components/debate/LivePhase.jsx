import React from 'react';
import { socket } from '../../socket.js';

export default function LivePhase({ debateId }) {
  function endDebate() {
    socket.emit('END_DEBATE', { debateId });
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.icon}>📞</div>
      <h2 style={styles.title}>שלב השיחה הקולית החיה</h2>
      <p style={styles.desc}>
        בשלב זה המשתתפים מוזמנים לשיחה קולית רציפה ישירה.
        <br />
        <span style={{ color: '#FFD700' }}>תכונה זו תהיה זמינה בגרסה הבאה עם WebRTC.</span>
      </p>

      <div style={styles.card}>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', textAlign: 'center', lineHeight: 1.7 }}>
          בינתיים תוכלו לתאם שיחה דרך פלטפורמה אחרת.
          <br />
          סיים את הדיון כשתסיימו.
        </p>
      </div>

      <button className="btn btn-ghost" onClick={endDebate} style={{ marginTop: 8, padding: '12px 32px' }}>
        סיים דיון ✓
      </button>
    </div>
  );
}

const styles = {
  wrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 20, padding: '40px 20px', textAlign: 'center',
    flex: 1,
  },
  icon: { fontSize: '4rem' },
  title: { fontSize: '1.6rem', fontWeight: 700 },
  desc: { color: 'var(--muted)', lineHeight: 1.7, maxWidth: 440 },
  card: {
    background: 'var(--card2)', border: '1px solid var(--border)',
    borderRadius: 12, padding: '20px 30px', maxWidth: 380, width: '100%',
  },
};
