import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from './store/appStore.js';
import { connectSocket } from './socket.js';
import Navbar from './components/layout/Navbar.jsx';
import AppHeader from './components/layout/AppHeader.jsx';
import LoginPage from './pages/LoginPage.jsx';
import LobbyPage from './pages/LobbyPage.jsx';
import DebatePage from './pages/DebatePage.jsx';
import SpectatorPage from './pages/SpectatorPage.jsx';
import KnowledgeBasePage from './pages/KnowledgeBasePage.jsx';
import DebateDetailPage from './pages/DebateDetailPage.jsx';
import LeaderboardPage from './pages/LeaderboardPage.jsx';

function RequireAuth({ children }) {
  const user = useAppStore(s => s.user);
  if (!user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const user = useAppStore(s => s.user);

  useEffect(() => {
    if (user) connectSocket(user.username, user.side);
  }, []);

  return (
    <BrowserRouter>
      <AppHeader />
      {user && <Navbar />}
      <Routes>
        <Route path="/" element={user ? <Navigate to="/lobby" replace /> : <LoginPage />} />
        <Route path="/lobby" element={<RequireAuth><LobbyPage /></RequireAuth>} />
        <Route path="/debate/:debateId" element={<RequireAuth><DebatePage /></RequireAuth>} />
        <Route path="/spectate/:debateId" element={<SpectatorPage />} />
        <Route path="/knowledge" element={<KnowledgeBasePage />} />
        <Route path="/knowledge/:id" element={<DebateDetailPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
