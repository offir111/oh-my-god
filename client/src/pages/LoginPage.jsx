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
  const [registered, setRegistered] = useState(null); // always start fresh
  const setUser = useAppStore(s => s.setUser);
  const setPendingUser = useAppStore(s => s.setPendingUser);
  const setDebate = useAppStore(s => s.setDebate);
  const navigate = useNavigate();

  // Always start fresh — clear any saved session so each visitor enters their own name
  useEffect(() => {
    localStorage.removeItem('omg_user');
    localStorage.removeItem('omg_pending');
    setUser(null);
  }, []);

  function handleRegister() {
    const name = username.trim();
    if (!name || name.length < 2) { setError('נא להזין שם משתמש (לפחות 2 תווים)'); return; }
    if (password.length !== 4) { setError('הסיסמה חייבת להיות בדיוק 4 תווים'); return; }
    setError('');
    const pending = { username: name };
    localStorage.setItem('omg_pending', JSON.stringify(pending));
    setRegistered(pending);
    setPendingUser(pending);
  }

  function handlePanelClick(side) {
    const name = registered?.username;
    if (!name) { setError('נא להזין שם משתמש תחילה'); return; }
    setSelectedSide(side);
  }

  function handleHuman() {
    const name = registered?.username;
    localStorage.removeItem('omg_pending');
    setUser({ username: name, side: selectedSide, score: 0, voiceDebates: 0 });
    connectSocket(name, selectedSide);
    navigate('/lobby');
  }

  function handleAIMode() {
    const name = registered?.username;
    localStorage.removeItem('omg_pending');
    const side = selectedSide;
    setUser({ username: name, side, score: 0, voiceDebates: 0 });
    setAiLoading(true);

    // Disconnect first to ensure clean reconnect
    socket.disconnect();
    socket.auth = { username: name, side };

    socket.off('MATCH_FOUND');
    socket.once('MATCH_FOUND', ({ debateId, isAI, believer, atheist, aiSide, turn }) => {
      setDebate({
        id: debateId, isAI, aiSide,
        believer, atheist,
        phase: 'text', turn: turn || 'believer',
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
    const name = registered?.username;
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
        /* "oh my": travelling yellow (prev letter fades as next lights). GOD: wave stops, G→O→D build then 3s hold, then O→D→G out */
        .login-title-phrase {
          direction: ltr;
          unicode-bidi: embed;
        }
        .login-title-ch {
          display: inline-block;
          color: #ffffff;
        }
        .login-title-sp {
          color: #ffffff;
        }
        @keyframes loginTitleCh0 {
          0%, 1% { color: #ffffff; }
          1.5%, 4% { color: #FFEB3B; }
          6%, 100% { color: #ffffff; }
        }
        @keyframes loginTitleCh1 {
          0%, 3.5% { color: #ffffff; }
          4.5%, 7.5% { color: #FFEB3B; }
          9.5%, 100% { color: #ffffff; }
        }
        @keyframes loginTitleCh2 {
          0%, 7% { color: #ffffff; }
          8%, 10.5% { color: #FFEB3B; }
          12.5%, 100% { color: #ffffff; }
        }
        @keyframes loginTitleCh3 {
          0%, 10% { color: #ffffff; }
          11%, 14% { color: #FFEB3B; }
          16.5%, 100% { color: #ffffff; }
        }
        @keyframes loginTitleCh4 {
          0%, 16% { color: #ffffff; }
          17.5%, 96.875% { color: #FFEB3B; }
          97.5%, 100% { color: #ffffff; }
        }
        @keyframes loginTitleCh5 {
          0%, 19.5% { color: #ffffff; }
          21.5%, 71.875% { color: #FFEB3B; }
          72.5%, 100% { color: #ffffff; }
        }
        @keyframes loginTitleCh6 {
          0%, 23.5% { color: #ffffff; }
          25.5%, 84.375% { color: #FFEB3B; }
          85%, 100% { color: #ffffff; }
        }
        .login-title-ch--0 { animation: loginTitleCh0 8s linear infinite; }
        .login-title-ch--1 { animation: loginTitleCh1 8s linear infinite; }
        .login-title-ch--2 { animation: loginTitleCh2 8s linear infinite; }
        .login-title-ch--3 { animation: loginTitleCh3 8s linear infinite; }
        .login-title-ch--4 { animation: loginTitleCh4 8s linear infinite; }
        .login-title-ch--5 { animation: loginTitleCh5 8s linear infinite; }
        .login-title-ch--6 { animation: loginTitleCh6 8s linear infinite; }
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
          gap: 8px;
          width: 100%;
          max-width: 360px;
        }
        .login-panel {
          flex: 1;
          max-width: 144px;
          padding: clamp(10px, 2.4vw, 21px) clamp(7px, 1.8vw, 14px);
          border-radius: 20px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
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
          font-size: clamp(0.78rem, 3.3vw, 1.2rem);
          font-weight: 800;
          letter-spacing: 1px;
        }
        .panel-subtitle {
          font-size: clamp(0.65rem, 2.4vw, 0.82rem);
          font-weight: 800;
          opacity: 0.95;
          margin-top: 0;
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
          box-shadow: 0 3px 0 #a8a8a8, 0 6px 14px rgba(0,0,0,0.35);
          color: #000;
          font-weight: 800;
          font-size: clamp(0.85rem, 3vw, 0.95rem);
          padding: 6px 18px;
          border-radius: 10px;
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
          <h1 className="login-title login-title-phrase" dir="ltr">
            <span className="login-title-ch login-title-ch--0">o</span>
            <span className="login-title-ch login-title-ch--1">h</span>
            <span className="login-title-sp"> </span>
            <span className="login-title-ch login-title-ch--2">m</span>
            <span className="login-title-ch login-title-ch--3">y</span>
            <span className="login-title-sp"> </span>
            <span className="login-title-ch login-title-ch--4">G</span>
            <span className="login-title-ch login-title-ch--5">O</span>
            <span className="login-title-ch login-title-ch--6">D</span>
          </h1>
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
                autoComplete="off"
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
                autoComplete="new-password"
              />
              {error && <p className="login-error">{error}</p>}
            </div>
            <button className={`login-enter-btn${password.length === 4 ? ' ready' : ''}`} onClick={handleRegister}>
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
                <TransparentImage src="/rabbis.jpg" alt="רבנים" size={Math.min(126, window.innerWidth * 0.28)} />
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
                <TransparentImage src="/torah.jpg" alt="איינשטיין" size={Math.min(126, window.innerWidth * 0.28)} />
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
              כל התשובות ב AI
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
