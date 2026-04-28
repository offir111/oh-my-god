import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAppStore } from '../store/appStore.js';
import { connectSocket, socket } from '../socket.js';
import TransparentImage from '../components/ui/TransparentImage.jsx';

function readLoginResume() {
  try {
    if (localStorage.getItem('omg_user')) return { registered: null, username: '' };
    const raw = localStorage.getItem('omg_pending');
    if (!raw) return { registered: null, username: '' };
    const p = JSON.parse(raw);
    if (!p?.username) return { registered: null, username: '' };
    return { registered: { username: p.username }, username: p.username };
  } catch {
    return { registered: null, username: '' };
  }
}

export default function LoginPage() {
  const loginInit = readLoginResume();
  const [username, setUsername] = useState(loginInit.username);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [selectedSide, setSelectedSide] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [registered, setRegistered] = useState(loginInit.registered);
  const setUser = useAppStore(s => s.setUser);
  const setPendingUser = useAppStore(s => s.setPendingUser);
  const pendingUser = useAppStore(s => s.pendingUser);
  const setDebate = useAppStore(s => s.setDebate);
  const navigate = useNavigate();

  useEffect(() => {
    if (!pendingUser && registered) {
      setRegistered(null);
      setSelectedSide(null);
      setUsername('');
      setPassword('');
    }
  }, [pendingUser, registered]);

  function handleRegister() {
    const name = username.trim();
    if (!name || name.length < 2) { setError('נא להזין שם משתמש (לפחות 2 תווים)'); return; }
    if (password.length !== 4) { setError('הסיסמה חייבת להיות בדיוק 4 תווים'); return; }
    setError('');
    const pending = { username: name };
    setRegistered(pending);
    setPendingUser(pending);

    const BASE = import.meta.env.VITE_API_URL || '';
    fetch(`${BASE}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: name }),
    }).catch(() => {});
  }

  function handlePanelClick(side) {
    const name = registered?.username;
    if (!name) { setError('נא להזין שם משתמש תחילה'); return; }
    setSelectedSide(side);
  }

  function handleHuman() {
    const name = registered?.username;
    setUser({ username: name, side: selectedSide, score: 0, voiceDebates: 0 });
    connectSocket(name, selectedSide);
    navigate('/lobby');
  }

  function handleAIMode() {
    const name = registered?.username;
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
          padding: 24px 16px 32px;
          background: transparent;
          gap: 22px;
          box-sizing: border-box;
          overflow-x: hidden;
          width: 100%;
        }
        .ticker-wrap {
          width: 100%;
          max-width: 540px;
          border: 1px solid var(--border-strong, rgba(255,255,255,0.14));
          border-radius: 12px;
          overflow: hidden;
          padding: 6px 0;
          background: rgba(14, 14, 20, 0.55);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          direction: ltr;
          margin-bottom: 8px;
          box-shadow: var(--shadow-sm, 0 4px 14px rgba(0,0,0,0.35));
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
          color: var(--text-secondary, #b4b4c0);
          font-weight: 600;
          font-size: clamp(0.62rem, 2.2vw, 0.74rem);
          padding: 0 18px;
          direction: rtl;
          unicode-bidi: embed;
        }
        .ticker-sep {
          color: var(--muted, #8a8a9a);
          font-size: 0.55rem;
          opacity: 0.7;
        }
        .login-title {
          font-size: clamp(2.35rem, 10vw, 4.8rem);
          font-weight: 500;
          letter-spacing: 0.06em;
          word-spacing: -0.12em;
          color: var(--text, #f4f4f8);
          text-align: center;
          margin: 0;
          text-shadow: 0 2px 40px rgba(0,0,0,0.45);
        }
        .login-title-homelink {
          text-decoration: none;
          color: inherit;
          cursor: pointer;
          border: none;
          background: none;
          padding: 0;
          display: inline-block;
        }
        .login-title-homelink:focus-visible {
          outline: 2px solid var(--accent, #6366f1);
          outline-offset: 6px;
          border-radius: 12px;
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
          1.5%, 4% { color: var(--omg-yellow-peak, #dcce58); }
          6%, 100% { color: #ffffff; }
        }
        @keyframes loginTitleCh1 {
          0%, 3.5% { color: #ffffff; }
          4.5%, 7.5% { color: var(--omg-yellow-peak, #dcce58); }
          9.5%, 100% { color: #ffffff; }
        }
        @keyframes loginTitleCh2 {
          0%, 7% { color: #ffffff; }
          8%, 10.5% { color: var(--omg-yellow-peak, #dcce58); }
          12.5%, 100% { color: #ffffff; }
        }
        @keyframes loginTitleCh3 {
          0%, 10% { color: #ffffff; }
          11%, 14% { color: var(--omg-yellow-peak, #dcce58); }
          16.5%, 100% { color: #ffffff; }
        }
        @keyframes loginTitleCh4 {
          0%, 16% { color: #ffffff; }
          17.5%, 96.875% { color: var(--omg-yellow-peak, #dcce58); }
          97.5%, 100% { color: #ffffff; }
        }
        @keyframes loginTitleCh5 {
          0%, 19.5% { color: #ffffff; }
          21.5%, 71.875% { color: var(--omg-yellow-peak, #dcce58); }
          72.5%, 100% { color: #ffffff; }
        }
        @keyframes loginTitleCh6 {
          0%, 23.5% { color: #ffffff; }
          25.5%, 84.375% { color: var(--omg-yellow-peak, #dcce58); }
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
          color: var(--muted, #8a8a9a);
          font-size: clamp(0.86rem, 3.5vw, 1.06rem);
          font-weight: 600;
          text-align: center;
          margin: 8px 0 0;
          letter-spacing: 0.02em;
        }
        .login-subtitle-vs {
          color: var(--omg-yellow-peak, #dcce58);
          font-weight: 800;
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
          padding: 12px 14px;
          font-size: clamp(0.84rem, 3.5vw, 0.96rem);
          background: var(--card2, #1a1a24);
          border: 1px solid var(--border-strong, rgba(255,255,255,0.14));
          border-radius: 12px;
          color: var(--text, #f4f4f8);
          text-align: center;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .login-input:focus {
          border-color: var(--accent, #6366f1);
          box-shadow: 0 0 0 3px var(--accent-soft, rgba(99,102,241,0.25));
        }
        .login-enter-btn {
          width: 60px; height: 60px;
          border-radius: 50%;
          border: 1px solid var(--border-strong, rgba(255,255,255,0.14));
          background: rgba(255,255,255,0.08);
          color: var(--text, #fff);
          font-size: 0.7rem;
          font-weight: 800;
          cursor: pointer;
          flex-shrink: 0;
          transition: background 0.25s, box-shadow 0.25s, transform 0.12s;
          display: flex; align-items: center; justify-content: center;
          text-align: center;
          line-height: 1.2;
        }
        .login-enter-btn:hover { transform: scale(1.03); }
        .login-enter-btn.ready {
          background: linear-gradient(145deg, #26e070 0%, var(--atheist, #00c853) 45%, #009624 100%);
          border-color: transparent;
          color: #031a0c;
          box-shadow: 0 0 28px var(--atheist-glow, rgba(0,200,83,0.35));
        }
        .login-choose {
          color: var(--text, #fff);
          font-size: clamp(0.9rem, 3.5vw, 1rem);
          font-weight: 700;
          margin: 0;
          letter-spacing: 0.02em;
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
          max-width: 148px;
          padding: clamp(10px, 2.4vw, 21px) clamp(7px, 1.8vw, 14px);
          border-radius: 18px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          border: 1px solid rgba(255,255,255,0.08);
          transition: transform 0.12s, box-shadow 0.2s;
          min-width: 0;
        }
        .panel-believer {
          background: linear-gradient(165deg, #ef5350 0%, var(--believer, #e53935) 42%, #8b1515 100%);
          box-shadow: 0 6px 0 #5c1010, 0 14px 32px rgba(0,0,0,0.45), 0 0 36px var(--believer-glow, rgba(229,57,53,0.35));
          color: #fff;
        }
        .panel-atheist {
          background: linear-gradient(165deg, #69f0ae 0%, var(--atheist, #00c853) 40%, #00682a 100%);
          box-shadow: 0 6px 0 #003d1a, 0 14px 32px rgba(0,0,0,0.45), 0 0 36px var(--atheist-glow, rgba(0,200,83,0.32));
          color: #031a0c;
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
          font-size: clamp(1.05rem, 4vw, 1.55rem);
          font-weight: 900;
          color: var(--text, #fff);
          text-shadow: 0 0 20px rgba(255,255,255,0.25);
          flex-shrink: 0;
          align-self: center;
          opacity: 0.95;
        }
        .ai-button {
          background: linear-gradient(180deg, #e8e8ee 0%, #a8a8b8 55%, #787890 100%);
          box-shadow: 0 4px 0 #5a5a6e, 0 10px 28px rgba(0,0,0,0.4);
          color: #0a0a0f;
          font-weight: 800;
          font-size: clamp(0.84rem, 3vw, 0.94rem);
          padding: 10px 22px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.25);
          cursor: pointer;
          letter-spacing: 0.06em;
          transition: transform 0.1s, box-shadow 0.15s, filter 0.15s;
          width: fit-content;
          text-align: center;
        }
        .ai-button:hover { filter: brightness(1.06); }
        .login-links {
          display: flex;
          gap: 24px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .login-link {
          color: var(--text-secondary, #b4b4c0);
          font-size: clamp(0.82rem, 3.2vw, 0.9rem);
          text-decoration: none;
          font-weight: 600;
          padding: 8px 12px;
          border-radius: 10px;
          transition: color 0.2s, background 0.2s;
        }
        .login-link:hover {
          color: var(--gold, #fbbf24);
          background: rgba(251, 191, 36, 0.08);
        }
        .login-error {
          color: #f87171;
          margin-top: 8px;
          font-size: 0.88rem;
          font-weight: 600;
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
          <h1 className="login-title" dir="ltr">
            <Link
              to="/login"
              className="login-title-homelink login-title-phrase"
              aria-label="דף הכניסה"
              onClick={() => window.scrollTo(0, 0)}
            >
              <span className="login-title-ch login-title-ch--0">o</span>
              <span className="login-title-ch login-title-ch--1">h</span>
              <span className="login-title-sp"> </span>
              <span className="login-title-ch login-title-ch--2">m</span>
              <span className="login-title-ch login-title-ch--3">y</span>
              <span className="login-title-sp"> </span>
              <span className="login-title-ch login-title-ch--4">G</span>
              <span className="login-title-ch login-title-ch--5">O</span>
              <span className="login-title-ch login-title-ch--6">D</span>
            </Link>
          </h1>
          <p className="login-subtitle">אמונה ודת <span className="login-subtitle-vs">VS</span> אתאיזם ומדע</p>
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
              בחרת: <span style={{ color: selectedSide === 'believer' ? 'var(--believer)' : 'var(--atheist)', fontWeight: 900 }}>
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
          <Link to="/arguments" className="login-link">📚 בעד ונגד</Link>
          <Link to="/live-events" className="login-link">🏆 רב VS מדען</Link>
        </div>
      </div>
    </>
  );
}
