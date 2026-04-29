import React, { useEffect, useLayoutEffect } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { useAppStore, rehydrateUserIfNeeded } from './store/appStore.js';
import { connectSocket, disconnectSocket } from './socket.js';
import Navbar from './components/layout/Navbar.jsx';
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
import SettingsPage from './pages/SettingsPage.jsx';
import { applyPreferencesToDocument, loadPreferences } from './lib/appPreferences.js';

function RequireAuth({ children }) {
  useLayoutEffect(() => {
    rehydrateUserIfNeeded();
  }, []);
  const user = useAppStore(s => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return children;
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
      <AppHeader />
      {user && <Navbar />}
      <main id="main-content" className="app-main" tabIndex={-1}>
        <Routes>
          <Route path="/" element={user ? <Navigate to="/lobby" replace /> : <Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/lobby" element={<RequireAuth><LobbyPage /></RequireAuth>} />
          <Route path="/debate/:debateId" element={<RequireAuth><DebatePage /></RequireAuth>} />
          <Route path="/spectate/:debateId" element={<SpectatorPage />} />
          <Route path="/knowledge" element={<KnowledgeBasePage />} />
          <Route path="/knowledge/:id" element={<DebateDetailPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/arguments" element={<Navigate to="/knowledge" replace />} />
          <Route path="/live-events" element={<LiveEventsPage />} />
          <Route path="/livr" element={<RequireAuth><LivrPage /></RequireAuth>} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/terms" element={<StaticInfoPage pageId="terms" />} />
          <Route path="/contact" element={<StaticInfoPage pageId="contact" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </AppRouter>
  );
}
