import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore.js';

export default function LivrPage() {
  const user = useAppStore(s => s.user);
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [isLive, setIsLive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [audienceMessages, setAudienceMessages] = useState([
    { name: 'מערכת', text: 'ברוך הבא לצ׳אט LIVE. פתח מצלמה כדי להתחיל חדר לייב.' },
  ]);
  const [message, setMessage] = useState('');

  useEffect(() => () => {
    stopLive();
  }, []);

  async function startLive() {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setIsLive(true);
      setAudienceMessages(prev => [...prev, { name: 'מערכת', text: 'החדר נפתח. הקהל יכול להצטרף ולהשתתף בצ׳אט.' }]);
    } catch {
      setCameraError('לא ניתן לפתוח מצלמה/מיקרופון. בדוק הרשאות בדפדפן ונסה שוב.');
    }
  }

  function stopLive() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsLive(false);
  }

  function sendAudienceMessage() {
    const text = message.trim();
    if (!text) return;
    setAudienceMessages(prev => [...prev, { name: user?.username || 'אורח', text }]);
    setMessage('');
  }

  return (
    <div className="page">
      <style>{`
        .livr-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.5fr) minmax(280px, 0.85fr);
          gap: 18px;
          align-items: start;
        }
        .livr-stage {
          overflow: hidden;
          border-radius: 24px;
          border: 1px solid var(--border-strong);
          background: #050509;
        }
        .livr-video {
          width: 100%;
          aspect-ratio: 16 / 10;
          display: block;
          object-fit: cover;
          background: radial-gradient(circle at 50% 40%, rgba(99,102,241,0.18), rgba(0,0,0,0.9) 62%);
        }
        .livr-video-empty {
          min-height: 320px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 26px;
          color: var(--text-secondary);
          line-height: 1.7;
        }
        .livr-controls {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: center;
          padding: 14px;
          border-top: 1px solid var(--border);
          background: rgba(255,255,255,0.035);
        }
        .livr-chat {
          min-height: 460px;
          display: flex;
          flex-direction: column;
        }
        .livr-chat-list {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 4px 0 14px;
        }
        .livr-chat-row {
          padding: 10px 12px;
          border: 1px solid var(--border);
          border-radius: 14px;
          background: rgba(255,255,255,0.035);
        }
        .livr-chat-row strong {
          display: block;
          color: var(--text);
          font-size: 0.78rem;
          margin-bottom: 3px;
        }
        .livr-chat-row span {
          color: var(--text-secondary);
          font-size: 0.88rem;
          line-height: 1.5;
        }
        .livr-composer {
          display: flex;
          gap: 8px;
        }
        @media (max-width: 820px) {
          .livr-layout {
            grid-template-columns: 1fr;
          }
          .livr-chat {
            min-height: 320px;
          }
        }
      `}</style>

      <div className="container container-wide">
        <button type="button" className="ui-back-button" onClick={() => navigate('/lobby')} style={{ marginBottom: 14 }}>
          ← חזרה ללובי
        </button>

        <div className="page-hero">
          <span className="page-kicker">פלטפורמת LIVE</span>
          <h1 className="page-title">צ׳אט LIVE</h1>
          <p className="page-subtitle">
            חדר שיחה חי שבו המשתמש מדבר עם מצלמה ומיקרופון, והקהל יכול לצפות, להגיב ולהשתתף בשיחה. זהו בסיס ראשוני לחוויית לייב מלאה.
          </p>
        </div>

        <div className="livr-layout">
          <section className="livr-stage">
            {isLive ? (
              <video ref={videoRef} className="livr-video" autoPlay playsInline muted />
            ) : (
              <div className="livr-video-empty">
                <div>
                  <h2 style={{ marginBottom: 8 }}>החדר עדיין לא באוויר</h2>
                  <p>לחץ על פתיחת שיחת LIVE כדי להפעיל מצלמה ומיקרופון ולהתחיל שיחת לייב.</p>
                </div>
              </div>
            )}
            <div className="livr-controls">
              {!isLive ? (
                <button type="button" className="btn btn-primary-soft" onClick={startLive}>
                  פתח שיחת LIVE
                </button>
              ) : (
                <button type="button" className="btn btn-ghost" onClick={stopLive}>
                  סיים שידור
                </button>
              )}
              <button type="button" className="btn btn-ghost" onClick={() => navigate('/live-events')}>
                אירועי LIVE
              </button>
            </div>
          </section>

          <aside className="surface-panel livr-chat">
            <div style={{ marginBottom: 14 }}>
              <h2 style={{ fontSize: '1.1rem', marginBottom: 4 }}>קהל והשתתפות</h2>
              <p style={{ color: 'var(--muted)', fontSize: '0.86rem', lineHeight: 1.5 }}>
                כאן יופיעו תגובות הצופים, שאלות ובקשות להצטרף לשיחה.
              </p>
            </div>

            {cameraError && (
              <div className="state-card" style={{ padding: 14, marginBottom: 12, color: '#fca5a5' }}>
                {cameraError}
              </div>
            )}

            <div className="livr-chat-list">
              {audienceMessages.map((item, index) => (
                <div key={`${item.name}-${index}`} className="livr-chat-row">
                  <strong>{item.name}</strong>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>

            <div className="livr-composer">
              <input
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendAudienceMessage()}
                placeholder="כתוב תגובה או שאלה..."
              />
              <button type="button" className="btn btn-send" onClick={sendAudienceMessage}>
                שלח
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
