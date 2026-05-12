import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiBaseUrl } from '../lib/apiBaseUrl.js';
import './AdminPage.css';

const TABS = [
  { id: 'users', label: 'משתמשים' },
  { id: 'debates', label: 'דיונים' },
  { id: 'blog', label: 'בלוג' },
  { id: 'stats', label: 'סטטיסטיקות' },
];

function getToken() {
  return localStorage.getItem('omg_admin_token') || '';
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
  };
}

async function apiFetch(path, options = {}) {
  const BASE = getApiBaseUrl();
  const res = await fetch(`${BASE}/api/admin${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/* ─────────── Users Tab ─────────── */
function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [noteEdit, setNoteEdit] = useState({});
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { ok, data } = await apiFetch('/users');
    if (ok && data?.users) setUsers(data.users);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function flash(text) {
    setMsg(text);
    setTimeout(() => setMsg(''), 2500);
  }

  async function toggleBlock(user) {
    const { ok, data } = await apiFetch('/block', {
      method: 'POST',
      body: JSON.stringify({ username: user.normalized, blocked: !user.blocked }),
    });
    if (ok && data?.users) { setUsers(data.users); flash(user.blocked ? 'שוחרר מחסימה' : 'חסום'); }
  }

  async function saveNote(norm) {
    const note = noteEdit[norm] ?? users.find(u => u.normalized === norm)?.note ?? '';
    const { ok, data } = await apiFetch('/note', {
      method: 'POST',
      body: JSON.stringify({ username: norm, note }),
    });
    if (ok && data?.users) { setUsers(data.users); flash('הערה נשמרה'); }
  }

  async function resetScore(norm) {
    if (!window.confirm(`לאפס ניקוד של ${norm}?`)) return;
    const { ok, data } = await apiFetch('/reset-score', {
      method: 'POST',
      body: JSON.stringify({ username: norm }),
    });
    if (ok && data?.users) { setUsers(data.users); flash('ניקוד אופס'); }
  }

  async function deleteUser(norm, username) {
    if (!window.confirm(`למחוק לצמיתות את המשתמש "${username}"?`)) return;
    const { ok, data } = await apiFetch(`/users/${encodeURIComponent(norm)}`, { method: 'DELETE' });
    if (ok && data?.users) { setUsers(data.users); flash('משתמש נמחק'); }
  }

  const filtered = users.filter(u =>
    !search || u.username.includes(search) || u.note.includes(search),
  );

  return (
    <div className="admin-tab-content">
      {msg && <div className="admin-flash">{msg}</div>}
      <div className="admin-search-row">
        <input
          className="admin-input"
          placeholder="חיפוש שם משתמש..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span className="admin-count">{filtered.length} משתמשים</span>
      </div>
      {loading ? (
        <div className="admin-loading">טוען...</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>שם משתמש</th>
                <th>ניקוד</th>
                <th>עמדה</th>
                <th>ניצחונות</th>
                <th>מצב</th>
                <th>הערה</th>
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.normalized} className={u.blocked ? 'admin-row-blocked' : ''}>
                  <td className="admin-username">{u.username}</td>
                  <td>{u.score}</td>
                  <td>{u.side === 'believer' ? 'מאמין' : u.side === 'atheist' ? 'אתאיסט' : '—'}</td>
                  <td>{u.voiceDebates || 0}</td>
                  <td>
                    <span className={`admin-badge ${u.blocked ? 'admin-badge-blocked' : 'admin-badge-ok'}`}>
                      {u.blocked ? 'חסום' : 'פעיל'}
                    </span>
                  </td>
                  <td>
                    <div className="admin-note-cell">
                      <input
                        className="admin-input admin-note-input"
                        placeholder="הערה..."
                        value={noteEdit[u.normalized] ?? u.note}
                        onChange={e => setNoteEdit(prev => ({ ...prev, [u.normalized]: e.target.value }))}
                      />
                      <button className="admin-btn admin-btn-sm" onClick={() => saveNote(u.normalized)}>שמור</button>
                    </div>
                  </td>
                  <td>
                    <div className="admin-actions">
                      <button
                        className={`admin-btn admin-btn-sm ${u.blocked ? 'admin-btn-green' : 'admin-btn-orange'}`}
                        onClick={() => toggleBlock(u)}
                        disabled={u.normalized === 'omg'}
                      >
                        {u.blocked ? 'שחרר' : 'חסום'}
                      </button>
                      <button
                        className="admin-btn admin-btn-sm admin-btn-gray"
                        onClick={() => resetScore(u.normalized)}
                        disabled={u.normalized === 'omg'}
                      >
                        אפס ניקוד
                      </button>
                      <button
                        className="admin-btn admin-btn-sm admin-btn-red"
                        onClick={() => deleteUser(u.normalized, u.username)}
                        disabled={u.normalized === 'omg'}
                      >
                        מחק
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─────────── Debates Tab ─────────── */
function DebatesTab() {
  const [debates, setDebates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { ok, data } = await apiFetch('/debates');
    if (ok && data?.debates) setDebates(data.debates);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function flash(text) {
    setMsg(text);
    setTimeout(() => setMsg(''), 2500);
  }

  async function deleteDebate(id) {
    if (!window.confirm('למחוק דיון זה לצמיתות?')) return;
    const { ok } = await apiFetch(`/debates/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (ok) { setDebates(prev => prev.filter(d => d.id !== id)); flash('דיון נמחק'); }
  }

  return (
    <div className="admin-tab-content">
      {msg && <div className="admin-flash">{msg}</div>}
      <div className="admin-search-row">
        <span className="admin-count">{debates.length} דיונים</span>
      </div>
      {loading ? (
        <div className="admin-loading">טוען...</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>מאמין</th>
                <th>אתאיסט</th>
                <th>סוג</th>
                <th>הודעות</th>
                <th>תאריך</th>
                <th>תקציר</th>
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {debates.map(d => (
                <tr key={d.id}>
                  <td>{d.believer || '—'}</td>
                  <td>{d.atheist || '—'}</td>
                  <td>{d.isAI ? 'AI' : 'אנושי'}</td>
                  <td>{d.messageCount}</td>
                  <td>{formatDate(d.startedAt)}</td>
                  <td className="admin-summary">{d.summary || '—'}</td>
                  <td>
                    <button
                      className="admin-btn admin-btn-sm admin-btn-red"
                      onClick={() => deleteDebate(d.id)}
                    >
                      מחק
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─────────── Blog Tab ─────────── */
function BlogTab() {
  const [mod, setMod] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authorInput, setAuthorInput] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const BASE = getApiBaseUrl();
    const res = await fetch(`${BASE}/api/admin/blog-feed/status`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    }).catch(() => null);
    if (res && res.ok) {
      const data = await res.json().catch(() => null);
      if (data) setMod(data);
    } else {
      setMod({ hiddenKeys: [], pendingKeys: [], blockedAuthors: [] });
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function flash(text) {
    setMsg(text);
    setTimeout(() => setMsg(''), 2500);
  }

  async function blockAuthor() {
    const a = authorInput.trim();
    if (!a) return;
    const { ok, data } = await apiFetch('/blog-feed/block-author', {
      method: 'POST',
      body: JSON.stringify({ author: a }),
    });
    if (ok && data) { setMod(data); setAuthorInput(''); flash(`כותב "${a}" נחסם`); }
  }

  async function unblockAuthor(author) {
    const { ok, data } = await apiFetch('/blog-feed/unblock-author', {
      method: 'POST',
      body: JSON.stringify({ author }),
    });
    if (ok && data) { setMod(data); flash(`כותב "${author}" שוחרר`); }
  }

  return (
    <div className="admin-tab-content">
      {msg && <div className="admin-flash">{msg}</div>}
      {loading ? (
        <div className="admin-loading">טוען...</div>
      ) : (
        <>
          <div className="admin-section">
            <h3 className="admin-section-title">חסימת כותב מהבלוג הציבורי</h3>
            <div className="admin-row-gap">
              <input
                className="admin-input"
                placeholder="שם משתמש לחסימה..."
                value={authorInput}
                onChange={e => setAuthorInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && blockAuthor()}
              />
              <button className="admin-btn admin-btn-orange" onClick={blockAuthor}>חסום כותב</button>
            </div>
            {mod?.blockedAuthors?.length > 0 && (
              <div className="admin-tag-list">
                {mod.blockedAuthors.map(a => (
                  <span key={a} className="admin-tag admin-tag-red">
                    {a}
                    <button className="admin-tag-x" onClick={() => unblockAuthor(a)}>✕</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="admin-section">
            <h3 className="admin-section-title">פוסטים מוסתרים ({mod?.hiddenKeys?.length || 0})</h3>
            {mod?.hiddenKeys?.length > 0 ? (
              <div className="admin-key-list">
                {mod.hiddenKeys.map(k => <div key={k} className="admin-key-item">{k}</div>)}
              </div>
            ) : <p className="admin-empty">אין פוסטים מוסתרים</p>}
          </div>

          <div className="admin-section">
            <h3 className="admin-section-title">ממתינים לבדיקה ({mod?.pendingKeys?.length || 0})</h3>
            {mod?.pendingKeys?.length > 0 ? (
              <div className="admin-key-list">
                {mod.pendingKeys.map(k => <div key={k} className="admin-key-item">{k}</div>)}
              </div>
            ) : <p className="admin-empty">אין פוסטים ממתינים</p>}
          </div>
        </>
      )}
    </div>
  );
}

/* ─────────── Stats Tab ─────────── */
function StatsTab() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const BASE = getApiBaseUrl();
    fetch(`${BASE}/api/stats`)
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="admin-tab-content"><div className="admin-loading">טוען...</div></div>;

  return (
    <div className="admin-tab-content">
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-num">{stats?.registered ?? '—'}</div>
          <div className="admin-stat-label">משתמשים רשומים</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-num">{stats?.online ?? '—'}</div>
          <div className="admin-stat-label">מחוברים עכשיו</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-num">{stats?.believers ?? '—'}</div>
          <div className="admin-stat-label">מאמינים</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-num">{stats?.atheists ?? '—'}</div>
          <div className="admin-stat-label">אתאיסטים</div>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Main Admin Page ─────────── */
export default function AdminPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('users');
  const [authorized, setAuthorized] = useState(null);

  useEffect(() => {
    const token = getToken();
    if (!token) { setAuthorized(false); return; }
    apiFetch('/verify').then(({ ok }) => setAuthorized(ok));
  }, []);

  function logout() {
    localStorage.removeItem('omg_admin_token');
    localStorage.removeItem('omg_user');
    navigate('/login');
  }

  if (authorized === null) {
    return <div className="admin-page"><div className="admin-loading admin-loading-center">מאמת הרשאות...</div></div>;
  }

  if (!authorized) {
    return (
      <div className="admin-page">
        <div className="admin-auth-error">
          <h2>גישה נדחתה</h2>
          <p>נדרשת כניסה כמנהל (OMG)</p>
          <button className="admin-btn admin-btn-orange" onClick={() => navigate('/login')}>חזור לכניסה</button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page" dir="rtl">
      <div className="admin-header">
        <div className="admin-header-title">
          <span className="admin-crown">👑</span>
          <span>לוח בקרה — מנהל OMG</span>
        </div>
        <button className="admin-btn admin-btn-gray admin-btn-sm" onClick={logout}>התנתק</button>
      </div>

      <div className="admin-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`admin-tab-btn ${tab === t.id ? 'admin-tab-btn-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'users' && <UsersTab />}
      {tab === 'debates' && <DebatesTab />}
      {tab === 'blog' && <BlogTab />}
      {tab === 'stats' && <StatsTab />}
    </div>
  );
}
