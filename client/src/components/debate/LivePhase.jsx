import React from 'react';
import { socket } from '../../socket.js';

export default function LivePhase({ debateId }) {
  function endDebate() {
    socket.emit('END_DEBATE', { debateId });
  }

  return (
    <div className="live-phase">
      <div className="live-phase__icon" aria-hidden="true">📞</div>
      <h2 className="live-phase__title">שיחה קולית חיה</h2>
      <p className="live-phase__desc">
        בשלב זה המשתתפים מוזמנים לשיחה קולית רציפה ישירה.
        <br />
        <span style={{ color: 'var(--gold)', fontWeight: 700 }}>התכונה תהיה זמינה בגרסה הבאה (WebRTC).</span>
      </p>

      <div className="live-phase__card">
        <p style={{ color: 'var(--muted)', fontSize: '0.92rem', textAlign: 'center', lineHeight: 1.75 }}>
          בינתיים ניתן לתאם שיחה דרך פלטפורמה אחרת.
          <br />
          סיימו את הדיון כשהשיחה נגמרה.
        </p>
      </div>

      <button type="button" className="btn btn-ghost" onClick={endDebate} style={{ padding: '14px 36px' }}>
        סיים דיון
      </button>
    </div>
  );
}
