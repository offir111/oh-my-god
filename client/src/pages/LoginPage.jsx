import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore.js';
import { connectSocket, socket } from '../socket.js';
import TransparentImage from '../components/ui/TransparentImage.jsx';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [selectedSide, setSelectedSide] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [registered, setRegistered] = useState(() => {
    try { return JSON.parse(localStorage.getItem('omg_pending')) || null; } catch { return null; }
  });
  const user = useAppStore(s => s.user);
  const setUser = useAppStore(s => s.setUser);
  const setDebate = useAppStore(s => s.setDebate);
  const navigate = useNavigate();

  function handleRegister() {
    const name = username.trim();
    if (!name || name.length < 2) { setError('נא להזין שם משתמש (לפחות 2 תווים)'); return; }
    if (password.length !== 4) { setError('הסיסמה חייבת להיות בדיוק 4 תווים'); return; }
    setError('');
    const pending = { username: name };
    localStorage.setItem('omg_pending', JSON.stringify(pending));
    setRegistered(pending);
  }

  function handlePanelClick(side) {
    const name = registered?.username || user?.username;
    if (!name) { setError('נא להזין שם משתמש תחילה'); return; }
    setSelectedSide(side);
  }

  function handleHuman() {
    const name = registered?.username || user?.username;
    localStorage.removeItem('omg_pending');
    setUser({ username: name, side: selectedSide, score: 0, voiceDebates: 0 });
    connectSocket(name, selectedSide);
    navigate('/lobby');
  }

  function handleAIMode() {
    const name = registered?.username || user?.username;
    localStorage.removeItem('omg_pending');
    const side = selectedSide;
    setUser({ username: name, side, score: 0, voiceDebates: 0 });
    setAiLoading(true);

    // Disconnect first to ensure clean reconnect
    socket.disconnect();
    socket.auth = { username: name, side };

    socket.off('MATCH_FOUND');
    socket.once('MATCH_FOUND', ({ debateId, isAI, believer, atheist, aiSide }) => {
      setDebate({
        id: debateId, isAI, aiSide,
        believer, atheist,
        phase: 'text', turn: 'believer',
        textMessages: [], voiceMessages: [],
        textCount: { believer: 0, atheist: 0 },
        voiceCount: { believer: 0, atheist: 0 },
        giftsReceived: { believer: 0, atheist: 0 },
      });
      navigate(`/debate/${debateId}`);
    });

    // Wait for connection then emit — don't use fixed timeout
    function sendRequest() {
      console.log('[login] socket connected, emitting REQUEST_AI_DEBATE');
      socket.emit('REQUEST_AI_DEBATE', { username: name, side });
    }

    if (socket.connected) {
      sendRequest();
    } else {
      socket.once('connect', sendRequest);
      // Connection timeout after 8 seconds
      setTimeout(() => {
        if (!socket.connected) {
          console.error('[login] socket failed to connect after 8s');
          setAiLoading(false);
          setError('לא ניתן להתחבר לשרת. נסה שוב.');
        }
      }, 8000);
    }

    socket.connect();
  }

  function handleAI() {
    const name = registered?.username || user?.username;
    if (!name) { setError('נא להזין שם משתמש תחילה'); return; }
    setSelectedSide('believer');
    setAiLoading(false);
  }

  return (
    <>
      <style>{`
        .login-page {
          min-height: calc(100vh - 52px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px 16px;
          background: #000;
          gap: 20px;
          box-sizing: border-box;
          overflow-x: hidden;
          width: 100%;
        }
        .ticker-wrap {
          width: 100%;
          max-width: 520px;
          border: 1px solid #444;
          border-radius: 4px;
          overflow: hidden;
          padding: 3px 0;
          background: transparent;
          direction: ltr;
          margin-bottom: 18px;
        }
        .ticker-inner {
          display: inline-block;
          white-space: nowrap;
          animation: ticker-scroll 60s linear infinite;
          will-change: transform;
        }
        .ticker-inner:hover {
          animation-play-state: paused;
        }
        @keyframes ticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-item {
          display: inline-block;
          color: #fff;
          font-weight: 700;
          font-size: clamp(0.6rem, 2.2vw, 0.72rem);
          padding: 0 18px;
          direction: rtl;
          unicode-bidi: embed;
        }
        .ticker-sep {
          color: #555;
          font-size: 0.6rem;
        }
        .login-title {
          font-family: Arial, sans-serif;
          font-size: clamp(2.4rem, 10vw, 5rem);
          font-weight: 400;
          letter-spacing: 2px;
          word-spacing: -6px;
          color: #fff;
          text-align: center;
          margin: 0;
        }
        .login-subtitle {
          color: #d3d3d3;
          font-size: clamp(0.85rem, 3.5vw, 1.05rem);
          font-weight: 700;
          text-align: center;
          margin: 4px 0 0;
        }
        .login-input-row {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 12px;
          width: 100%;
          max-width: 360px;
          direction: rtl;
        }
        .login-input-wrap {
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex: 1;
        }
        .login-input {
          width: 100%;
          padding: 10px 12px;
          font-size: clamp(0.82rem, 3.5vw, 0.95rem);
          background: #111;
          border: 1px solid #333;
          border-radius: 10px;
          color: #fff;
          text-align: center;
          outline: none;
          box-sizing: border-box;
        }
        .login-enter-btn {
          width: 58px; height: 58px;
          border-radius: 50%;
          border: none;
          background: #555;
          color: #fff;
          font-size: 0.72rem;
          font-weight: 800;
          cursor: pointer;
          flex-shrink: 0;
          transition: background 0.3s, box-shadow 0.3s;
          font-family: Arial, sans-serif;
          display: flex; align-items: center; justify-content: center;
          text-align: center;
          line-height: 1.2;
        }
        .login-enter-btn.ready {
          background: #00AA44;
          box-shadow: 0 0 16px #00AA4488;
        }
        .login-choose {
          color: #fff;
          font-size: clamp(0.9rem, 3.5vw, 1rem);
          font-weight: 700;
          margin: 0;
        }
        .login-panels {
          display: flex;
          flex-direction: row;
          align-items: stretch;
          justify-content: center;
          gap: 12px;
          width: 100%;
          max-width: 600px;
        }
        .login-panel {
          flex: 1;
          max-width: 240px;
          padding: clamp(18px, 4vw, 36px) clamp(12px, 3vw, 24px);
          border-radius: 20px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          border: none;
          transition: transform 0.08s, box-shadow 0.08s;
          min-width: 0;
        }
        .panel-believer {
          background: linear-gradient(160deg, #aa0000 0%, #7a0000 60%, #550000 100%);
          box-shadow: 0 8px 0 #5a0000, 0 12px 20px rgba(0,0,0,0.5), 0 0 40px rgba(204,0,0,0.35);
          color: #fff;
        }
        .panel-atheist {
          background: linear-gradient(160deg, #00aa44 0%, #007a30 60%, #005522 100%);
          box-shadow: 0 8px 0 #004d22, 0 12px 20px rgba(0,0,0,0.5), 0 0 40px rgba(0,170,68,0.35);
          color: #fff;
        }
        .panel-title {
          font-size: clamp(1.3rem, 5.5vw, 2rem);
          font-weight: 800;
          letter-spacing: 1px;
        }
        .panel-subtitle {
          font-size: clamp(0.75rem, 3vw, 0.95rem);
          font-weight: 600;
          opacity: 0.85;
          margin-top: -4px;
        }
        .login-vs {
          font-size: clamp(1.1rem, 4vw, 1.6rem);
          font-weight: 900;
          color: #fff;
          text-shadow: 0 0 12px rgba(255,255,255,0.4);
          flex-shrink: 0;
          align-self: center;
        }
        .ai-button {
          background: linear-gradient(135deg, #f2f2f2 0%, #dcdcdc 60%, #c6c6c6 100%);
          box-shadow: 0 6px 0 #a8a8a8, 0 10px 20px rgba(0,0,0,0.35);
          color: #000;
          font-weight: 800;
          font-size: clamp(0.95rem, 3.5vw, 1.1rem);
          padding: 13px 18px;
          border-radius: 14px;
          border: none;
          cursor: pointer;
          letter-spacing: 1px;
          transition: transform 0.08s, box-shadow 0.08s;
          width: fit-content;
          text-align: center;
        }
        .login-links {
          display: flex;
          gap: 24px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .login-link {
          color: #fff;
          font-size: clamp(0.82rem, 3.2vw, 0.9rem);
          text-decoration: none;
          font-weight: 700;
          text-shadow: 0 0 10px rgba(255,255,255,0.3);
        }
        .login-error {
          color: #ff6666;
          margin-top: 8px;
          font-size: 0.88rem;
        }
      `}</style>

      <div className="login-page">

        <div className="ticker-wrap">
          <div className="ticker-inner">
            {[...Array(2)].map((_, rep) =>
              [
                'האם יש אלוהים?',
                'מתי נברא העולם?',
                'תאוריית המפץ הגדול',
                'העולם מסודר ולכן מחייב בורא',
                'תקופת הדינוזאורים לפני שישים מיליון שנה',
                'מתי נברא העולם עפ התנ״ך?',
                'איך עפ האבולוציה נוצר החיים הראשון מדומם — אביוגנזה',
                'האם נכון שארנבת מעלה גרה?',
                'האם נכון שאין דג שיש לו סנפיר ואין לו קשקשים?',
                'רטרו-וירוסים — הוכחה שלאדם ולקוף יש אב משותף',
                '99% מהDNA של האדם והשימפנזה זהה',
                'עפ תארוך פחמן 14 גיל היקום גדול בהרבה מ-5700 שנה כפי טענת התנ״ך',
              ].map((topic, i) => (
                <span key={`${rep}-${i}`}>
                  <span className="ticker-item">{topic}</span>
                  <span className="ticker-sep">◆</span>
                </span>
              ))
            )}
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <h1 className="login-title">oh my GOD</h1>
          <p className="login-subtitle">אמונה ודת <span style={{color:'#FFE566'}}>VS</span> אתאיזם ומדע</p>
        </div>

        {!registered ? (
          <div className="login-input-row">
            <div className="login-input-wrap">
              <input
                className="login-input"
                type="text"
                placeholder="שם משתמש..."
                value={username}
                onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleRegister()}
                maxLength={20}
                autoFocus
              />
              <input
                className="login-input"
                type="password"
                placeholder="סיסמה (4 תווים)..."
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleRegister()}
                maxLength={4}
              />
              {error && <p className="login-error">{error}</p>}
            </div>
            <button className="login-enter-btn" onClick={handleRegister}>
              כניסה
            </button>
          </div>
        ) : null}

        {aiLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div className="spinner" style={{ margin: '0 auto 20px' }} />
            <p style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 700 }}>🤖 מתחבר ל-AI...</p>
            <p style={{ color: '#888', fontSize: '0.9rem', marginTop: 8 }}>מכין את הדיון</p>
          </div>
        ) : !selectedSide ? (
          <>
            <p className="login-choose">בחר את הצד שלך:</p>

            <div className="login-panels">
              <button
                className="login-panel panel-believer"
                onClick={() => handlePanelClick('believer')}
                onTouchStart={e => e.currentTarget.style.transform = 'translateY(4px)'}
                onTouchEnd={e => e.currentTarget.style.transform = 'translateY(0)'}
                onMouseDown={e => e.currentTarget.style.transform = 'translateY(4px)'}
                onMouseUp={e => e.currentTarget.style.transform = 'translateY(0)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <TransparentImage src="/rabbis.jpg" alt="רבנים" size={Math.min(150, window.innerWidth * 0.33)} />
                <div className="panel-title">מאמין</div>
                <div className="panel-subtitle">דת</div>
              </button>

              <div className="login-vs">VS</div>

              <button
                className="login-panel panel-atheist"
                onClick={() => handlePanelClick('atheist')}
                onTouchStart={e => e.currentTarget.style.transform = 'translateY(4px)'}
                onTouchEnd={e => e.currentTarget.style.transform = 'translateY(0)'}
                onMouseDown={e => e.currentTarget.style.transform = 'translateY(4px)'}
                onMouseUp={e => e.currentTarget.style.transform = 'translateY(0)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <TransparentImage src="/torah.jpg" alt="איינשטיין" size={Math.min(150, window.innerWidth * 0.33)} />
                <div className="panel-title">אתאיסט</div>
                <div className="panel-subtitle">מדע</div>
              </button>
            </div>

            <button
              className="ai-button"
              onClick={handleAI}
              onTouchStart={e => e.currentTarget.style.transform = 'translateY(3px)'}
              onTouchEnd={e => e.currentTarget.style.transform = 'translateY(0)'}
              onMouseDown={e => e.currentTarget.style.transform = 'translateY(3px)'}
              onMouseUp={e => e.currentTarget.style.transform = 'translateY(0)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              התמודד מול AI
            </button>
          </>
        ) : (
          /* Side chosen — pick mode: human or AI */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%', maxWidth: 360 }}>
            <p className="login-choose" style={{ marginBottom: 4 }}>
              בחרת: <span style={{ color: selectedSide === 'believer' ? '#CC0000' : '#00AA44', fontWeight: 900 }}>
                {selectedSide === 'believer' ? 'מאמין' : 'אתאיסט'}
              </span>
            </p>
            <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: 8 }}>עם מי תרצה לדון?</p>
            <button
              className={`login-panel ${selectedSide === 'believer' ? 'panel-believer' : 'panel-atheist'}`}
              style={{ width: '100%', maxWidth: '100%', padding: '18px 24px', borderRadius: 16, fontSize: '1.1rem', fontWeight: 800 }}
              onClick={handleHuman}
            >
              👤 נגד יריב אנושי
            </button>
            <button
              className="login-panel"
              style={{ width: '100%', maxWidth: '100%', padding: '18px 24px', borderRadius: 16, fontSize: '1.1rem', fontWeight: 800,
                background: 'linear-gradient(135deg, #f2f2f2 0%, #c6c6c6 100%)', color: '#000',
                boxShadow: '0 6px 0 #a8a8a8, 0 10px 20px rgba(0,0,0,0.35)' }}
              onClick={handleAIMode}
            >
              🤖 נגד AI
            </button>
            <button
              style={{ background: 'none', border: 'none', color: '#888', fontSize: '0.9rem', cursor: 'pointer', marginTop: 4 }}
              onClick={() => setSelectedSide(null)}
            >
              ← חזרה
            </button>
          </div>
        )}

        <div className="login-links">
          <a href="/arguments" className="login-link">📚 בעד ונגד</a>
          <a href="/live-events" className="login-link">🏆 רב VS מדען</a>
        </div>
      </div>
    </>
  );
}
