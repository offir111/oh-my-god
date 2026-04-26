import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore.js';
import { connectSocket } from '../socket.js';
import TransparentImage from '../components/ui/TransparentImage.jsx';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const setUser = useAppStore(s => s.setUser);
  const navigate = useNavigate();

  function handleSelect(side) {
    const name = username.trim();
    if (!name || name.length < 2) {
      setError('נא להזין שם משתמש (לפחות 2 תווים)');
      return;
    }
    setError('');
    setUser({ username: name, side, score: 0, voiceDebates: 0 });
    connectSocket(name, side);
    navigate('/lobby');
  }

  function handleAI() {
    const name = username.trim();
    if (!name || name.length < 2) {
      setError('נא להזין שם משתמש (לפחות 2 תווים)');
      return;
    }
    setError('');
    setUser({ username: name, side: 'believer', score: 0, voiceDebates: 0 });
    connectSocket(name, 'believer');
    navigate('/lobby?ai=1');
  }

  return (
    <>
      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px 16px;
          background: #000;
          gap: 20px;
          box-sizing: border-box;
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
          color: #aaa;
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
        .login-input-wrap {
          width: 100%;
          max-width: 360px;
          text-align: center;
        }
        .login-input {
          width: 100%;
          padding: 13px 16px;
          font-size: clamp(0.95rem, 4vw, 1.1rem);
          background: #111;
          border: 1px solid #333;
          border-radius: 10px;
          color: #fff;
          text-align: center;
          outline: none;
          box-sizing: border-box;
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

        <div className="login-input-wrap">
          <input
            className="login-input"
            type="text"
            placeholder="שם המשתמש שלך..."
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && username.trim() && handleSelect('believer')}
            maxLength={20}
            autoFocus
          />
          {error && <p className="login-error">{error}</p>}
        </div>

        <p className="login-choose">בחר את הצד שלך:</p>

        <div className="login-panels">
          <button
            className="login-panel panel-believer"
            onClick={() => handleSelect('believer')}
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
            onClick={() => handleSelect('atheist')}
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

        <div className="login-links">
          <a href="/knowledge" className="login-link">📚 בעד ונגד</a>
          <a href="/leaderboard" className="login-link">🏆 רב VS מדען</a>
        </div>
      </div>
    </>
  );
}
