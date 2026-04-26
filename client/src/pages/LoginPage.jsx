import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore.js';
import { connectSocket } from '../socket.js';
import TransparentImage from '../components/ui/TransparentImage.jsx';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [pressedAI, setPressedAI] = useState(false);
  const setUser = useAppStore(s => s.setUser);
  const navigate = useNavigate();

  function handleSelect(side) {
    const name = username.trim();
    if (!name || name.length < 2) {
      setError('נא להזין שם משתמש (לפחות 2 תווים)');
      return;
    }
    setError('');
    const user = { username: name, side, score: 0, voiceDebates: 0 };
    setUser(user);
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
    const user = { username: name, side: 'believer', score: 0, voiceDebates: 0 };
    setUser(user);
    connectSocket(name, 'believer');
    navigate('/lobby?ai=1');
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>oh my GOD</h1>
        <p style={styles.subtitle}>אמונה ודת מול אתיזם ומדע</p>
      </div>

      <div style={styles.inputWrap}>
        <input
          style={styles.input}
          type="text"
          placeholder="שם המשתמש שלך..."
          value={username}
          onChange={e => setUsername(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && username.trim() && handleSelect('believer')}
          maxLength={20}
          autoFocus
        />
        {error && <p style={styles.error}>{error}</p>}
      </div>

      <p style={styles.choose}>בחר את הצד שלך:</p>

      <div style={styles.panels}>
        {/* כפתור מאמין */}
        <button
          style={{ ...styles.panel, ...styles.believerPanel }}
          onClick={() => handleSelect('believer')}
          onMouseDown={e => e.currentTarget.style.cssText += 'transform:translateY(5px);box-shadow:0 2px 0 #5a0000,0 4px 8px rgba(0,0,0,0.5),0 0 30px rgba(204,0,0,0.2);'}
          onMouseUp={e => e.currentTarget.style.cssText += 'transform:translateY(0);box-shadow:0 8px 0 #5a0000,0 12px 20px rgba(0,0,0,0.5),0 0 40px rgba(204,0,0,0.35);'}
          onMouseLeave={e => e.currentTarget.style.cssText += 'transform:translateY(0);box-shadow:0 8px 0 #5a0000,0 12px 20px rgba(0,0,0,0.5),0 0 40px rgba(204,0,0,0.35);'}
        >
          <TransparentImage src="/einstein.jpg" alt="תורה" size={120} />
          <div style={styles.panelTitle}>מאמין</div>
        </button>

        <div style={styles.vs}>VS</div>

        {/* כפתור אתאיסט */}
        <button
          style={{ ...styles.panel, ...styles.atheistPanel }}
          onClick={() => handleSelect('atheist')}
          onMouseDown={e => e.currentTarget.style.cssText += 'transform:translateY(5px);box-shadow:0 2px 0 #004d22,0 4px 8px rgba(0,0,0,0.5),0 0 30px rgba(0,170,68,0.2);'}
          onMouseUp={e => e.currentTarget.style.cssText += 'transform:translateY(0);box-shadow:0 8px 0 #004d22,0 12px 20px rgba(0,0,0,0.5),0 0 40px rgba(0,170,68,0.35);'}
          onMouseLeave={e => e.currentTarget.style.cssText += 'transform:translateY(0);box-shadow:0 8px 0 #004d22,0 12px 20px rgba(0,0,0,0.5),0 0 40px rgba(0,170,68,0.35);'}
        >
          <TransparentImage src="/torah.jpg" alt="איינשטיין" size={120} />
          <div style={styles.panelTitle}>אתאיסט</div>
        </button>
      </div>

      {/* כפתור AI */}
      <button
        onClick={handleAI}
        onMouseDown={e => e.currentTarget.style.cssText += 'transform:translateY(4px);box-shadow:0 2px 0 #b8860b,0 4px 10px rgba(0,0,0,0.5);'}
        onMouseUp={e => e.currentTarget.style.cssText += 'transform:translateY(0);box-shadow:0 6px 0 #b8860b,0 10px 20px rgba(0,0,0,0.4);'}
        onMouseLeave={e => e.currentTarget.style.cssText += 'transform:translateY(0);box-shadow:0 6px 0 #b8860b,0 10px 20px rgba(0,0,0,0.4);'}
        style={styles.aiButton}
      >
        התמודד מול AI
      </button>

      <div style={styles.links}>
        <a href="/knowledge" style={styles.link}>📚 מאגר ידע</a>
        <a href="/leaderboard" style={styles.link}>🏆 טבלת מובילים</a>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    background: '#000',
    gap: 24,
  },
  header: { textAlign: 'center' },
  title: {
    fontFamily: "Arial, sans-serif",
    fontSize: 'clamp(2.8rem, 7vw, 5rem)',
    fontWeight: 400,
    letterSpacing: 2,
    color: '#fff',
    textShadow: '0 0 30px rgba(255,255,255,0.15), 2px 4px 0 rgba(255,255,255,0.05)',
  },
  subtitle: { color: '#aaa', marginTop: 10, fontSize: '1.05rem', letterSpacing: 0.5 },
  inputWrap: { width: '100%', maxWidth: 360, textAlign: 'center' },
  input: {
    width: '100%',
    padding: '14px 18px',
    fontSize: '1.1rem',
    background: '#111',
    border: '1px solid #333',
    borderRadius: 10,
    color: '#fff',
    textAlign: 'center',
    outline: 'none',
  },
  error: { color: '#ff6666', marginTop: 8, fontSize: '0.9rem' },
  choose: { color: '#aaa', fontSize: '1rem' },
  panels: {
    display: 'flex',
    gap: 24,
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 700,
  },
  panel: {
    flex: '1 1 220px',
    maxWidth: 260,
    padding: '36px 24px',
    borderRadius: 20,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 14,
    border: 'none',
    transition: 'transform 0.08s, box-shadow 0.08s',
  },
  believerPanel: {
    background: 'linear-gradient(160deg, #aa0000 0%, #7a0000 60%, #550000 100%)',
    boxShadow: '0 8px 0 #5a0000, 0 12px 20px rgba(0,0,0,0.5), 0 0 40px rgba(204,0,0,0.35)',
    color: '#fff',
  },
  atheistPanel: {
    background: 'linear-gradient(160deg, #00aa44 0%, #007a30 60%, #005522 100%)',
    boxShadow: '0 8px 0 #004d22, 0 12px 20px rgba(0,0,0,0.5), 0 0 40px rgba(0,170,68,0.35)',
    color: '#fff',
  },
  panelImg: { width: 120, height: 120, objectFit: 'contain', mixBlendMode: 'multiply' },
  panelTitle: { fontSize: '2rem', fontWeight: 800, letterSpacing: 1 },
  vs: { fontSize: '1.6rem', fontWeight: 900, color: '#fff', flexShrink: 0, textShadow: '0 0 12px rgba(255,255,255,0.4)' },
  aiButton: {
    background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 60%, #e8940a 100%)',
    boxShadow: '0 6px 0 #b8860b, 0 10px 20px rgba(0,0,0,0.4)',
    color: '#000',
    fontWeight: 800,
    fontSize: '1.1rem',
    padding: '14px 48px',
    borderRadius: 14,
    border: 'none',
    cursor: 'pointer',
    letterSpacing: 1,
    transition: 'transform 0.08s, box-shadow 0.08s',
  },
  links: { display: 'flex', gap: 28, marginTop: 4 },
  link: { color: '#fff', fontSize: '0.9rem', textDecoration: 'none', fontWeight: 700, textShadow: '0 0 10px rgba(255,255,255,0.3)' },
};
