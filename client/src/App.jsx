import React, { useEffect, useLayoutEffect } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { useAppStore, rehydrateUserIfNeeded } from './store/appStore.js';
import { connectSocket, disconnectSocket } from './socket.js';
import AppHeader from './components/layout/AppHeader.jsx';
import LoginPage from './pages/LoginPage.jsx';
import LobbyPage from './pages/LobbyPage.jsx';
import DebatePage from './pages/DebatePage.jsx';
import SpectatorPage from './pages/SpectatorPage.jsx';
import KnowledgeBasePage from './pages/KnowledgeBasePage.jsx';
import DebateDetailPage from './pages/DebateDetailPage.jsx';
import LeaderboardPage from './pages/LeaderboardPage.jsx';
import LiveEventsPage from './pages/LiveEventsPage.jsx';
import LivrPage from './pages/LivrPage.jsx';
import StaticInfoPage from './pages/StaticInfoPage.jsx';
import RegisteredMembersPage from './pages/RegisteredMembersPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import ReligionFaithPage from './pages/ReligionFaithPage.jsx';
import FaithAdvertisersPage from './pages/FaithAdvertisersPage.jsx';
import CageUserProfilePage from './pages/CageUserProfilePage.jsx';
import BlogPage from './pages/BlogPage.jsx';
import PhotosPage from './pages/PhotosPage.jsx';
import PodcastPage from './pages/PodcastPage.jsx';
import VideoLivePage from './pages/VideoLivePage.jsx';
import RadioPage from './pages/RadioPage.jsx';
import { RadioAudioProvider } from './context/RadioAudioContext.jsx';
import MiniRadioBar from './components/layout/MiniRadioBar.jsx';
import HomeLivePodcastPanel from './components/HomeLivePodcastPanel.jsx';
import { applyPreferencesToDocument, loadPreferences } from './lib/appPreferences.js';

/** תופס קריסת רינדור — במקום מסך שחור ללא הסבר */
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[AppErrorBoundary]', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            padding: '28px 18px',
            textAlign: 'center',
            fontFamily: 'var(--font-sans, Rubik, Segoe UI, sans-serif)',
            background: '#07070c',
            color: '#e8e8ef',
            lineHeight: 1.65,
          }}
        >
          <p style={{ marginBottom: 12, fontWeight: 800, fontSize: '1.05rem' }}>
            משהו השתבש בטעינת האפליקציה.
          </p>
          <pre style={{ marginBottom: 18, color: '#f87171', fontSize: '0.8rem', maxWidth: 600, marginInline: 'auto', textAlign: 'left', background: '#1e1e2e', padding: '12px', borderRadius: 8, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {this.state.error?.message}{'\n'}{this.state.error?.stack}
          </pre>
          <p style={{ marginBottom: 18, color: '#94a3b8', fontSize: '0.92rem', maxWidth: 420, marginInline: 'auto' }}>
            אפשר לרענן את הדף או לפתוח את Google.
          </p>
          <p style={{ marginBottom: 14 }}>
            <a href="https://www.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#7dd3fc', fontWeight: 700 }}>
              Google — חיפוש
            </a>
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              cursor: 'pointer',
              padding: '10px 18px',
              borderRadius: 10,
              border: '1px solid #475569',
              background: '#1e293b',
              color: '#fff',
              fontWeight: 700,
              fontFamily: 'inherit',
            }}
          >
            רענון דף
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function RequireAuth({ children }) {
  useLayoutEffect(() => { rehydrateUserIfNeeded(); }, []);
  const user = useAppStore(s => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RequireSession({ children }) {
  useLayoutEffect(() => { rehydrateUserIfNeeded(); }, []);
  const user = useAppStore(s => s.user);
  const pendingUser = useAppStore(s => s.pendingUser);
  if (!user && !pendingUser) return <Navigate to="/login" replace />;
  return children;
}

function ProfileMeRedirect() {
  const user = useAppStore(s => s.user);
  const name = user?.username?.trim();
  if (!name) return <Navigate to="/login" replace />;
  return <Navigate to={`/profile/${encodeURIComponent(name)}`} replace />;
}

export default function App() {
  /** נקבע בהרצת הקומפוננטה כדי שהזיהוי של Capacitor יהיה אחרי טעינת ה-WebView */
  const AppRouter = React.useMemo(
    () => (Capacitor.isNativePlatform() ? HashRouter : BrowserRouter),
    [],
  );

  const user = useAppStore(s => s.user);
  const socketUsername = user?.username;
  const socketSide = user?.side;

  useEffect(() => {
    applyPreferencesToDocument(loadPreferences());
  }, []);

  useEffect(() => {
    rehydrateUserIfNeeded();
  }, []);

  /** בדפדפן בלבד — עמודת תוכן אחידה (כותרת / ניווט / גוף) מיושרת לאותם גבולות לרוחב */
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return undefined;
    document.documentElement.classList.add('app-shell-browser');
    return () => document.documentElement.classList.remove('app-shell-browser');
  }, []);

  // Reconnect only when identity changes, not when `user` is replaced (e.g. updateScore clones the object).
  useEffect(() => {
    if (!socketUsername || !socketSide) {
      disconnectSocket();
      return;
    }
    connectSocket(socketUsername, socketSide);
  }, [socketUsername, socketSide]);

  return (
    <AppRouter>
      <RadioAudioProvider>
        <AppErrorBoundary>
          <AppHeader />
          <HomeLivePodcastPanel />
          <MiniRadioBar />
          <main id="main-content" className="app-main" tabIndex={-1}>
            <Routes>
            <Route path="/" element={user ? <Navigate to="/lobby" replace /> : <Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/lobby" element={<RequireAuth><LobbyPage /></RequireAuth>} />
            <Route path="/debate/:debateId" element={<RequireAuth><DebatePage /></RequireAuth>} />
            <Route path="/spectate/:debateId" element={<RequireSession><SpectatorPage /></RequireSession>} />
            <Route path="/faith/mefarsim" element={<RequireSession><FaithAdvertisersPage /></RequireSession>} />
            <Route path="/faith" element={<RequireSession><ReligionFaithPage /></RequireSession>} />
            <Route path="/profile/me" element={<RequireAuth><ProfileMeRedirect /></RequireAuth>} />
            <Route path="/profile/:username" element={<RequireSession><CageUserProfilePage /></RequireSession>} />
            <Route path="/registered" element={<RequireSession><RegisteredMembersPage /></RequireSession>} />
            <Route path="/blog" element={<RequireSession><BlogPage /></RequireSession>} />
            <Route path="/photos" element={<RequireSession><PhotosPage /></RequireSession>} />
            <Route path="/podcast" element={<RequireSession><PodcastPage /></RequireSession>} />
            <Route path="/video-live" element={<RequireSession><VideoLivePage /></RequireSession>} />
            <Route path="/knowledge" element={<RequireSession><KnowledgeBasePage /></RequireSession>} />
            <Route path="/knowledge/:id" element={<RequireSession><DebateDetailPage /></RequireSession>} />
            <Route path="/leaderboard" element={<RequireSession><LeaderboardPage /></RequireSession>} />
            <Route path="/arguments" element={<Navigate to="/knowledge" replace />} />
            <Route path="/live-events" element={<RequireSession><LiveEventsPage /></RequireSession>} />
            <Route path="/radio" element={<RequireSession><RadioPage /></RequireSession>} />
            <Route path="/livr" element={<RequireAuth><LivrPage /></RequireAuth>} />
            <Route path="/settings" element={<RequireSession><SettingsPage /></RequireSession>} />
            <Route path="/terms" element={<StaticInfoPage pageId="terms" />} />
            <Route path="/contact" element={<StaticInfoPage pageId="contact" />} />
            <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </AppErrorBoundary>
      </RadioAudioProvider>
    </AppRouter>
  );
}
