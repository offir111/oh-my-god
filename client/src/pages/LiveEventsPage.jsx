import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const EVENTS = [
  {
    id: 1,
    date: '03.08.26',
    believer: 'הרב זמיר כהן',
    scientist: 'פרופסור יובל נוח הררי',
    question: 'האם יש אלוהים?',
    description: 'הנכם מוזמנים לדיבייט בין הרב זמיר כהן לפרופסור יובל נוח הררי בשאלה האם יש אלוהים.',
    status: 'upcoming',
  },
];

export default function LiveEventsPage() {
  const navigate = useNavigate();
  const [registeredEvents, setRegisteredEvents] = useState(() => new Set());
  const [reminders, setReminders] = useState(() => new Set());

  function registerForEvent(eventId) {
    setRegisteredEvents(prev => new Set(prev).add(eventId));
  }

  function setReminder(eventId) {
    setReminders(prev => new Set(prev).add(eventId));
  }

  return (
    <>
      <style>{`
        .live-events-page {
          min-height: calc(100vh - var(--appheader-h));
          background: transparent;
          padding: 24px 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
          direction: rtl;
        }
        .live-events-title {
          font-family: Arial, sans-serif;
          font-size: clamp(1.6rem, 7vw, 2.6rem);
          font-weight: 900;
          color: #fff;
          text-align: center;
          letter-spacing: 1px;
          margin: 0;
        }
        .live-events-subtitle {
          color: #888;
          font-size: 0.9rem;
          text-align: center;
          margin: -12px 0 0;
        }
        .event-poster {
          width: 100%;
          max-width: 480px;
          background: linear-gradient(160deg, #0a0a0a 0%, #111 100%);
          border: 1px solid #333;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 12px 40px rgba(0,0,0,0.7);
          position: relative;
        }
        .event-poster-top {
          background: linear-gradient(135deg, #1a0000 0%, #000 50%, #001a0a 100%);
          padding: 20px 20px 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }
        .event-badge-live {
          background: #CC0000;
          color: #fff;
          font-size: 0.72rem;
          font-weight: 800;
          padding: 4px 12px;
          border-radius: 99px;
          letter-spacing: 1px;
          animation: live-pulse 1.5s ease-in-out infinite;
        }
        @keyframes live-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
        .event-heading {
          font-family: Arial, sans-serif;
          font-size: clamp(1.5rem, 6vw, 2.2rem);
          font-weight: 900;
          color: #FFE566;
          text-align: center;
          margin: 0;
          line-height: 1.1;
        }
        .event-date {
          color: #aaa;
          font-size: 0.88rem;
          font-weight: 600;
          letter-spacing: 2px;
        }
        .event-vs-row {
          display: flex;
          align-items: stretch;
          width: 100%;
          min-height: 110px;
          margin-top: 12px;
        }
        .event-side {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 16px 12px;
          gap: 6px;
        }
        .event-side-believer {
          background:
            radial-gradient(ellipse 105% 88% at 72% 18%, rgba(244, 63, 94, 0.38), transparent 52%),
            radial-gradient(ellipse 85% 70% at 18% 88%, rgba(72, 16, 24, 0.42), transparent 46%),
            linear-gradient(185deg, rgba(22, 12, 16, 0.93) 0%, rgba(8, 6, 12, 0.96) 100%);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
        }
        .event-side-scientist {
          background:
            radial-gradient(ellipse 105% 88% at 30% 18%, rgba(52, 211, 153, 0.32), transparent 52%),
            radial-gradient(ellipse 85% 72% at 82% 82%, rgba(5, 80, 58, 0.38), transparent 46%),
            linear-gradient(185deg, rgba(8, 22, 20, 0.93) 0%, rgba(6, 12, 14, 0.96) 100%);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
        }
        .event-side-icon {
          font-size: 2rem;
          line-height: 1;
        }
        .event-side-name {
          font-size: clamp(0.78rem, 3vw, 0.92rem);
          font-weight: 800;
          color: #fff;
          text-align: center;
          line-height: 1.3;
        }
        .event-side-role {
          font-size: 0.68rem;
          color: #aaa;
          text-align: center;
        }
        .event-vs-divider {
          width: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #000;
          font-size: 1.1rem;
          font-weight: 900;
          color: #fff;
          text-shadow: 0 0 12px rgba(255,255,255,0.4);
          flex-shrink: 0;
        }
        .event-body {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .event-question {
          font-size: clamp(1rem, 4vw, 1.2rem);
          font-weight: 800;
          color: #fff;
          text-align: center;
          line-height: 1.4;
        }
        .event-description {
          color: #bbb;
          font-size: 0.9rem;
          text-align: center;
          line-height: 1.6;
        }
        .event-cta {
          background: linear-gradient(135deg, #CC0000 0%, #00AA44 100%);
          color: #fff;
          font-size: 1rem;
          font-weight: 800;
          padding: 14px;
          border-radius: 12px;
          border: none;
          cursor: pointer;
          text-align: center;
          letter-spacing: 1px;
          transition: opacity 0.2s, transform 0.1s;
          width: 100%;
        }
        .event-cta:hover { opacity: 0.9; }
        .event-cta:active { transform: scale(0.98); }
        .event-reminder {
          background: none;
          border: 1px solid #333;
          color: #888;
          font-size: 0.85rem;
          padding: 10px;
          border-radius: 10px;
          cursor: pointer;
          text-align: center;
          width: 100%;
          transition: border-color 0.2s, color 0.2s;
        }
        .event-reminder:hover { border-color: #FFE566; color: #FFE566; }
        .event-demo-note {
          color: #777;
          font-size: 0.78rem;
          text-align: center;
          line-height: 1.5;
          margin-top: -6px;
        }
        .events-empty-notice {
          color: #555;
          font-size: 0.88rem;
          text-align: center;
          margin-top: 12px;
        }
        .bulletin-board {
          width: 100%;
          max-width: 480px;
          border: 3px solid #888;
          border-radius: 8px;
          background: #0e0e0e;
          box-shadow:
            0 0 0 6px #1a1a1a,
            0 0 0 8px #555,
            0 8px 32px rgba(0,0,0,0.6);
          padding: 28px 24px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          position: relative;
        }
        .bulletin-pin {
          position: absolute;
          top: -10px;
          width: 18px; height: 18px;
          border-radius: 50%;
          background: radial-gradient(circle at 40% 35%, #ff6666, #990000);
          box-shadow: 0 2px 6px rgba(0,0,0,0.5);
        }
        .bulletin-pin-left  { left: 30px; }
        .bulletin-pin-right { right: 30px; }
        .bulletin-title {
          font-family: Arial, sans-serif;
          font-size: clamp(1.3rem, 5vw, 1.9rem);
          font-weight: 900;
          color: #FFE566;
          text-align: center;
          letter-spacing: 1px;
          border-bottom: 2px solid #444;
          padding-bottom: 12px;
          width: 100%;
        }
        .bulletin-names {
          font-size: clamp(0.95rem, 3.5vw, 1.15rem);
          font-weight: 700;
          color: #fff;
          text-align: center;
          line-height: 1.6;
        }
        .bulletin-names .vs-word {
          color: #FFE566;
          font-size: 1.1em;
        }
        .bulletin-question {
          font-size: clamp(0.9rem, 3vw, 1.05rem);
          color: #ddd;
          text-align: center;
          font-style: italic;
          line-height: 1.5;
        }
        .bulletin-date {
          font-size: 0.88rem;
          color: #aaa;
          letter-spacing: 2px;
          font-weight: 600;
          border-top: 1px solid #333;
          padding-top: 10px;
          width: 100%;
          text-align: center;
        }
      `}</style>
      <style>{`.back-btn-inline{background:none;border:none;color:#aaa;font-size:0.9rem;cursor:pointer;align-self:flex-start;padding:4px 0;}`}</style>

      <div className="live-events-page">
        <button type="button" onClick={() => navigate('/')} style={backBtn}>← חזרה</button>
        <div>
          <h1 className="live-events-title">רב <span style={{color:'#FFE566'}}>VS</span> מדען</h1>
          <p className="live-events-subtitle">אירועי לייב מתוכננים באפליקציה</p>
        </div>

        {EVENTS.map(ev => (
          <div className="event-poster" key={ev.id}>
            <div className="event-poster-top">
              <span className="event-badge-live">● LIVE EVENT</span>
              <h2 className="event-heading">ראש בראש</h2>
              <span className="event-date">{ev.date}</span>

              <div className="event-vs-row">
                <div className="event-side event-side-believer">
                  <span className="event-side-icon">🕍</span>
                  <span className="event-side-name">{ev.believer}</span>
                  <span className="event-side-role">מאמין</span>
                </div>
                <div className="event-vs-divider">VS</div>
                <div className="event-side event-side-scientist">
                  <span className="event-side-icon">🔬</span>
                  <span className="event-side-name">{ev.scientist}</span>
                  <span className="event-side-role">מדען</span>
                </div>
              </div>
            </div>

            <div className="event-body">
              <div className="event-question">"{ev.question}"</div>
              <div className="event-description">{ev.description}</div>
              <button
                type="button"
                className="event-cta"
                onClick={() => registerForEvent(ev.id)}
                aria-pressed={registeredEvents.has(ev.id)}
              >
                {registeredEvents.has(ev.id) ? 'נרשמת לצפייה בלייב' : '📺 הרשמה לצפייה בלייב'}
              </button>
              <button
                type="button"
                className="event-reminder"
                onClick={() => setReminder(ev.id)}
                aria-pressed={reminders.has(ev.id)}
              >
                {reminders.has(ev.id) ? 'תזכורת נשמרה' : '🔔 תזכורת לאירוע'}
              </button>
              <div className="event-demo-note">השיחה הנ"ל למטרת המחשה בלבד</div>
            </div>
          </div>
        ))}

        <p className="events-empty-notice">עוד אירועים יתווספו בקרוב ◆ עקבו אחרינו</p>
      </div>
    </>
  );
}

const backBtn = {
  background: 'none', border: 'none', color: '#aaa',
  fontSize: '0.9rem', cursor: 'pointer', alignSelf: 'flex-start', padding: '4px 0',
};
