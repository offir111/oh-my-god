import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../store/appStore.js';
import { getApiBaseUrl } from '../lib/apiBaseUrl.js';

const PROFILE_PREFIX = 'cage_profile_v2:';
const ADMIN_TOKEN_KEY = 'omg_admin_token';

function readStoredAdminToken() {
  try {
    let t = localStorage.getItem(ADMIN_TOKEN_KEY) || '';
    if (!t) {
      t = sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';
      if (t) {
        localStorage.setItem(ADMIN_TOKEN_KEY, t);
        sessionStorage.removeItem(ADMIN_TOKEN_KEY);
      }
    }
    return t;
  } catch {
    return '';
  }
}

function normBlogAuthor(a) {
  return String(a || '').trim().toLowerCase();
}

function postModerationKey(p) {
  return `${normBlogAuthor(p.author)}|${String(p.id || '').trim()}`;
}

function isPostVisibleOnPublicBlog(p, mod) {
  const a = normBlogAuthor(p.author);
  if (mod.blockedAuthors.includes(a)) return false;
  const key = postModerationKey(p);
  if (mod.hiddenKeys.includes(key)) return false;
  if (mod.pendingKeys.includes(key)) return false;
  return true;
}

const DEMO_POSTS = [
  {
    id: 'demo-1',
    author: 'מתן',
    title: 'שיחות עם אלוהים',
    body: 'אני מוצא את עצמי בשיחה פנימית עם משהו גדול ממני. לא תמיד אני יודע אם זה אלוהים, אבל התחושה שיש מי שמקשיב — היא ממשית לחלוטין עבורי.',
    ts: Date.now() - 1000 * 60 * 60 * 3,
    isDemo: true,
  },
  {
    id: 'demo-2',
    author: 'אריאל',
    title: 'האם המדע מבטל את האמונה?',
    body: 'דווקא ככל שלמדתי יותר מדע, כך גדל הפלא. הביג-בנג, האבולוציה, הפיזיקה הקוונטית — כל אלה לא הרגו את אמונתי, הם העמיקו אותה.',
    ts: Date.now() - 1000 * 60 * 60 * 9,
    isDemo: true,
  },
  {
    id: 'demo-3',
    author: 'מתן',
    title: 'על הספק והוודאות',
    body: 'הספק אינו אויב האמונה — הוא חברה הנאמן. מי שמעולם לא התלבט, האם באמת בחר? השאלות הקשות הן שמחזקות את מה שנשאר.',
    ts: Date.now() - 1000 * 60 * 60 * 22,
    isDemo: true,
  },
];

import { getLikes, saveLikes, getComments, saveComments, getPositions, savePositions } from '../lib/blogReactions.js';

function loadAllPosts() {
  const posts = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(PROFILE_PREFIX)) continue;
      const username = key.slice(PROFILE_PREFIX.length);
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const profile = JSON.parse(raw);
      if (!Array.isArray(profile.blogPosts)) continue;
      for (const p of profile.blogPosts) {
        if (p?.title && p?.body) posts.push({ ...p, author: username });
      }
    }
  } catch {}
  return posts.sort((a, b) => b.ts - a.ts);
}

import { fmtDate } from '../lib/blogReactions.js';

/* ─── Reaction bar per post ─────────────────────────────────────────── */
function PostCard({
  p,
  username,
  navigate,
  showChiefToolbar,
  chiefEditorVerified,
  onChiefEditorAction,
  actionBusy,
}) {
  const [likes, setLikesState] = useState(() => getLikes(p.id));
  const [comments, setCommentsState] = useState(() => getComments(p.id));
  const [positions, setPositionsState] = useState(() => getPositions(p.id));
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [toast, setToast] = useState('');

  const iLiked = username && likes.includes(username);
  const myPosition = username ? positions[username] : null;

  const believerCount = Object.values(positions).filter(v => v === 'believer').length;
  const skepticCount  = Object.values(positions).filter(v => v === 'skeptic').length;

  const showToast = msg => { setToast(msg); window.setTimeout(() => setToast(''), 2200); };

  const handleLike = e => {
    e.stopPropagation();
    if (!username) { showToast('יש להתחבר כדי לתת לייק'); return; }
    const next = iLiked ? likes.filter(u => u !== username) : [...likes, username];
    saveLikes(p.id, next);
    setLikesState(next);
  };

  const handlePosition = (e, pos) => {
    e.stopPropagation();
    if (!username) { showToast('יש להתחבר כדי להביע עמדה'); return; }
    const next = { ...positions };
    if (next[username] === pos) delete next[username];
    else next[username] = pos;
    savePositions(p.id, next);
    setPositionsState(next);
  };

  const handleComment = e => {
    e.stopPropagation();
    const body = draft.trim();
    if (!body || !username) return;
    const c = { id: `c-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, author: username, body, ts: Date.now() };
    const next = [...comments, c];
    saveComments(p.id, next);
    setCommentsState(next);
    setDraft('');
  };

  const btnBase = {
    border: 'none', background: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 4,
    fontSize: '0.8rem', fontWeight: 700, padding: '4px 8px',
    borderRadius: 6, transition: 'background 0.12s',
  };

  const editorDisabled = actionBusy || !chiefEditorVerified;
  const editorBtn = {
    padding: '5px 10px',
    borderRadius: 6,
    border: '1px solid var(--border-strong)',
    background: 'var(--card2)',
    color: 'var(--text-secondary)',
    fontSize: '0.7rem',
    fontWeight: 700,
    cursor: editorDisabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
    opacity: editorDisabled ? 0.5 : 1,
  };

  return (
    <article style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
      {showChiefToolbar ? (
        <div
          role="group"
          aria-label="כלי עורך ראשי"
          onClick={e => e.stopPropagation()}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            padding: '8px 12px',
            borderBottom: '1px solid var(--border)',
            background: 'rgba(99,102,241,0.1)',
            direction: 'rtl',
            opacity: chiefEditorVerified ? 1 : 0.92,
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--muted)', fontWeight: 800, marginInlineEnd: 2 }}>עורך:</span>
            <button type="button" style={editorBtn} disabled={editorDisabled} onClick={() => onChiefEditorAction('permanent-hide', p)}>
              הסר פוסט
            </button>
            <button type="button" style={editorBtn} disabled={editorDisabled} onClick={() => onChiefEditorAction('pending-hide', p)}>
              הסתר עד ברור
            </button>
            <button type="button" style={{ ...editorBtn, opacity: actionBusy ? 0.5 : 1 }} disabled={actionBusy} onClick={() => onChiefEditorAction('outreach', p)}>
              פניה
            </button>
            <button type="button" style={editorBtn} disabled={editorDisabled} onClick={() => onChiefEditorAction('notify', p)}>
              התראה ליוזר
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <button type="button" style={{ ...editorBtn, borderColor: 'rgba(244,63,94,0.35)', color: '#fda4af' }} disabled={editorDisabled} onClick={() => onChiefEditorAction('block', p)}>
              חסום כותב
            </button>
          </div>
          {!chiefEditorVerified ? (
            <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--muted)', fontWeight: 600 }}>
              יש לאמת את האסימון מול השרת — רעננו את הדף או התחברו מחדש ב־«צור קשר».
            </p>
          ) : null}
        </div>
      ) : null}
      {/* Post body */}
      <div
        style={{ padding: '16px 14px 10px', cursor: 'pointer' }}
        onClick={() => navigate(`/profile/${encodeURIComponent(p.author)}`)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{
            fontSize: '0.72rem', fontWeight: 800, color: 'var(--gold)',
            background: 'rgba(234,179,8,0.1)', padding: '2px 8px', borderRadius: 4,
          }}>
            {p.author}
          </span>
          <span style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{fmtDate(p.ts)}</span>
        </div>
        <h2 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: 900, color: 'var(--text)', lineHeight: 1.25 }}>
          {p.title}
        </h2>
        <p style={{
          margin: 0, fontSize: '0.86rem', color: 'var(--text-secondary)',
          lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          display: '-webkit-box', WebkitLineClamp: 4,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {p.body}
        </p>
      </div>

      {/* Reaction bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2,
        padding: '6px 10px 8px', borderTop: '1px solid var(--border)',
        flexWrap: 'wrap', direction: 'rtl',
      }}>
        {/* Like */}
        <button
          type="button"
          onClick={handleLike}
          style={{
            ...btnBase,
            color: iLiked ? '#f43f5e' : 'var(--text-secondary)',
            background: iLiked ? 'rgba(244,63,94,0.1)' : 'transparent',
          }}
        >
          <span>{iLiked ? '❤️' : '🤍'}</span>
          <span>{likes.length}</span>
        </button>

        {/* Comments toggle */}
        <button
          type="button"
          onClick={e => { e.stopPropagation(); setCommentsOpen(o => !o); }}
          style={{
            ...btnBase,
            color: commentsOpen ? 'var(--accent)' : 'var(--text-secondary)',
            background: commentsOpen ? 'rgba(99,102,241,0.1)' : 'transparent',
          }}
        >
          <span>💬</span>
          <span>{comments.length} תגובות</span>
        </button>

        {/* Divider */}
        <span style={{ color: 'var(--border)', margin: '0 4px', fontSize: '0.8rem' }}>|</span>

        {/* Position: believer */}
        <button
          type="button"
          onClick={e => handlePosition(e, 'believer')}
          style={{
            ...btnBase,
            color: myPosition === 'believer' ? '#a78bfa' : 'var(--text-secondary)',
            background: myPosition === 'believer' ? 'rgba(167,139,250,0.12)' : 'transparent',
          }}
          title="אני מאמין"
        >
          <span>🙏</span>
          <span>{believerCount}</span>
        </button>

        {/* Position: skeptic */}
        <button
          type="button"
          onClick={e => handlePosition(e, 'skeptic')}
          style={{
            ...btnBase,
            color: myPosition === 'skeptic' ? '#34d399' : 'var(--text-secondary)',
            background: myPosition === 'skeptic' ? 'rgba(52,211,153,0.12)' : 'transparent',
          }}
          title="אני מפקפק"
        >
          <span>🔬</span>
          <span>{skepticCount}</span>
        </button>
      </div>

      {/* Comments section */}
      {commentsOpen && (
        <div style={{ borderTop: '1px solid var(--border)', background: 'var(--card2)', direction: 'rtl' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Comment list */}
          {comments.length === 0 ? (
            <p style={{ margin: 0, padding: '12px 14px', color: 'var(--muted)', fontSize: '0.82rem' }}>
              אין תגובות עדיין — היה הראשון!
            </p>
          ) : (
            comments.map(c => (
              <div key={c.id} style={{ padding: '9px 14px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 3, alignItems: 'center' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--gold)' }}>{c.author}</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>{fmtDate(c.ts)}</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text)', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {c.body}
                </p>
              </div>
            ))
          )}

          {/* Write comment */}
          {username ? (
            <div style={{ display: 'flex', gap: 8, padding: '10px 14px', alignItems: 'flex-end' }}>
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value.slice(0, 1000))}
                rows={2}
                placeholder="כתוב תגובה…"
                style={{
                  flex: 1, resize: 'none', padding: '7px 10px',
                  borderRadius: 6, border: '1px solid var(--border-strong)',
                  background: 'var(--card)', color: 'var(--text)',
                  fontFamily: 'inherit', fontSize: '0.84rem',
                }}
              />
              <button
                type="button"
                onClick={handleComment}
                disabled={!draft.trim()}
                style={{
                  padding: '8px 14px', borderRadius: 6,
                  border: '1px solid rgba(99,102,241,0.4)',
                  background: draft.trim() ? 'rgba(99,102,241,0.85)' : 'var(--card-hover)',
                  color: '#fff', fontWeight: 800, fontSize: '0.82rem',
                  cursor: draft.trim() ? 'pointer' : 'not-allowed', flexShrink: 0,
                }}
              >
                שלח
              </button>
            </div>
          ) : (
            <p style={{ margin: 0, padding: '10px 14px', color: 'var(--muted)', fontSize: '0.8rem' }}>
              <span style={{ cursor: 'pointer', color: 'var(--accent)', textDecoration: 'underline' }}
                onClick={() => navigate('/login')}>התחבר</span> כדי להגיב
            </p>
          )}
        </div>
      )}

      {/* Mini toast */}
      {toast ? (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--card2)', border: '1px solid var(--border-strong)',
          color: 'var(--text)', padding: '8px 18px', borderRadius: 8,
          zIndex: 1200, fontSize: '0.83rem',
        }}>
          {toast}
        </div>
      ) : null}
    </article>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────── */
export default function BlogPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAppStore(s => s.user);
  const pendingUser = useAppStore(s => s.pendingUser);
  const blogWriterName = String(user?.username || pendingUser?.username || '').trim();

  const [moderation, setModeration] = useState({ hiddenKeys: [], pendingKeys: [], blockedAuthors: [] });
  const [hasAdminToken, setHasAdminToken] = useState(
    () => typeof window !== 'undefined' && Boolean(readStoredAdminToken()),
  );
  const [isChiefEditor, setIsChiefEditor] = useState(false);
  const [chiefEditorBusyKey, setChiefEditorBusyKey] = useState(null);
  const [chiefToast, setChiefToast] = useState('');

  const refreshAdminTokenPresence = useCallback(() => {
    setHasAdminToken(Boolean(readStoredAdminToken()));
  }, []);

  useEffect(() => {
    refreshAdminTokenPresence();
    const onFocus = () => refreshAdminTokenPresence();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshAdminTokenPresence]);

  /** נטען מחדש בכל כניסה ל־/blog — אחרי פרסום בפרופיל יופיעו פוסטים מעודכנים */
  const allPosts = useMemo(() => {
    const real = loadAllPosts();
    const demosToShow = DEMO_POSTS.filter(d => !real.some(r => r.id === d.id));
    return [...real, ...demosToShow].sort((a, b) => b.ts - a.ts);
  }, [location.key]);

  useEffect(() => {
    let cancelled = false;
    const BASE = getApiBaseUrl();
    fetch(`${BASE}/api/blog-feed-moderation`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (cancelled || !d) return;
        setModeration({
          hiddenKeys: Array.isArray(d.hiddenKeys) ? d.hiddenKeys : [],
          pendingKeys: Array.isArray(d.pendingKeys) ? d.pendingKeys : [],
          blockedAuthors: Array.isArray(d.blockedAuthors) ? d.blockedAuthors.map(normBlogAuthor) : [],
        });
      })
      .catch(() => {
        if (!cancelled) setModeration({ hiddenKeys: [], pendingKeys: [], blockedAuthors: [] });
      });
    return () => { cancelled = true; };
  }, [location.key]);

  useEffect(() => {
    let cancelled = false;
    const token = readStoredAdminToken();
    if (!token) {
      setIsChiefEditor(false);
      return () => { cancelled = true; };
    }
    const BASE = getApiBaseUrl();
    fetch(`${BASE}/api/admin/verify`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async r => {
        if (!r.ok) return { ok: false };
        try {
          const d = await r.json();
          return { ok: Boolean(d?.ok) };
        } catch {
          return { ok: false };
        }
      })
      .then(d => {
        if (!cancelled) setIsChiefEditor(Boolean(d?.ok));
      })
      .catch(() => {
        if (!cancelled) setIsChiefEditor(false);
      });
    return () => { cancelled = true; };
  }, [location.key, hasAdminToken]);

  const posts = useMemo(
    () => allPosts.filter(p => isPostVisibleOnPublicBlog(p, moderation)),
    [allPosts, moderation],
  );

  const chiefEditorAction = useCallback(async (kind, p) => {
    if (kind === 'outreach') {
      navigate(`/profile/${encodeURIComponent(p.author)}?compose=1`);
      return;
    }
    const token = readStoredAdminToken();
    if (!token) {
      setChiefToast('אין הרשאת מנהל — התחברו ב־«צור קשר»');
      window.setTimeout(() => setChiefToast(''), 3200);
      return;
    }
    if (kind === 'notify') {
      const text = window.prompt('טקסט ההתראה לכותב (יוצג בפרופיל שלו):', '');
      if (text == null) return;
      const t = String(text).trim();
      if (!t) {
        setChiefToast('בוטל — לא נשלחה התראה');
        window.setTimeout(() => setChiefToast(''), 2200);
        return;
      }
      const BASE = getApiBaseUrl();
      const key = postModerationKey(p);
      setChiefEditorBusyKey(key);
      try {
        const res = await fetch(`${BASE}/api/admin/blog-feed/author-notice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ author: p.author, text: t }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'בקשה נכשלה');
        setChiefToast('התראה נשמרה — הכותב יראה אותה בפרופיל שלו');
        window.setTimeout(() => setChiefToast(''), 3200);
      } catch (e) {
        setChiefToast(String(e.message || e) || 'שגיאה');
        window.setTimeout(() => setChiefToast(''), 4000);
      } finally {
        setChiefEditorBusyKey(null);
      }
      return;
    }

    const BASE = getApiBaseUrl();
    const key = postModerationKey(p);
    setChiefEditorBusyKey(key);
    try {
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      let url = '';
      let body = {};
      if (kind === 'permanent-hide') {
        url = `${BASE}/api/admin/blog-feed/hide`;
        body = { author: p.author, postId: p.id };
      } else if (kind === 'pending-hide') {
        url = `${BASE}/api/admin/blog-feed/hide-pending`;
        body = { author: p.author, postId: p.id };
      } else if (kind === 'block') {
        url = `${BASE}/api/admin/blog-feed/block-author`;
        body = { author: p.author };
      } else {
        setChiefEditorBusyKey(null);
        return;
      }
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'בקשה נכשלה');
      setModeration({
        hiddenKeys: Array.isArray(data.hiddenKeys) ? data.hiddenKeys : [],
        pendingKeys: Array.isArray(data.pendingKeys) ? data.pendingKeys : [],
        blockedAuthors: Array.isArray(data.blockedAuthors) ? data.blockedAuthors.map(normBlogAuthor) : [],
      });
      if (kind === 'block') setChiefToast('הכותב נחסם — כל הפוסטים שלו יוסתרו מהבלוג הציבורי');
      else if (kind === 'pending-hide') setChiefToast('הפוסט הוסתר מהפיד עד ברור');
      else setChiefToast('הפוסט הוסר מהבלוג הציבורי');
      window.setTimeout(() => setChiefToast(''), 3200);
    } catch (e) {
      setChiefToast(String(e.message || e) || 'שגיאה');
      window.setTimeout(() => setChiefToast(''), 4000);
    } finally {
      setChiefEditorBusyKey(null);
    }
  }, [navigate]);

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', background: 'var(--bg)', minHeight: '100vh', direction: 'rtl' }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        flexDirection: 'row', direction: 'rtl',
        background: 'var(--surface)', borderBottom: '1px solid var(--border-strong)',
        padding: '11px 14px',
      }}>
        <span style={{ fontWeight: 900, fontSize: '1rem', color: 'var(--text)' }}>בלוג</span>
        {blogWriterName.length >= 2 ? (
          <button
            type="button"
            onClick={() => navigate(`/profile/${encodeURIComponent(blogWriterName)}?blog=1`)}
            style={{
              padding: '6px 14px', borderRadius: 6,
              border: '1px solid rgba(99,102,241,0.4)',
              background: 'rgba(99,102,241,0.15)',
              color: 'var(--accent)', fontWeight: 800,
              fontSize: '0.8rem', cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            כתוב לבלוג
          </button>
        ) : null}
      </div>

      {chiefToast ? (
        <div style={{
          position: 'fixed', bottom: 120, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--card2)', border: '1px solid var(--border-strong)',
          color: 'var(--text)', padding: '10px 18px', borderRadius: 8,
          zIndex: 1300, fontSize: '0.82rem', maxWidth: '92%', textAlign: 'center',
          boxShadow: 'var(--shadow-md)',
        }}>
          {chiefToast}
        </div>
      ) : null}

      {hasAdminToken && !isChiefEditor ? (
        <div
          role="status"
          style={{
            margin: '10px 14px 0',
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid rgba(234,179,8,0.45)',
            background: 'rgba(234,179,8,0.12)',
            color: 'var(--text)',
            fontSize: '0.78rem',
            fontWeight: 700,
            lineHeight: 1.45,
            textAlign: 'center',
          }}
        >
          נמצא אסימון מנהל, אך האימות מול השרת נכשל — כלי העורך חסומים. בדקו חיבור ל־API או התחברו מחדש דרך{' '}
          <span style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate('/info/contact')}>
            צור קשר
          </span>
          .
        </div>
      ) : null}

      {hasAdminToken && isChiefEditor ? (
        <div
          style={{
            margin: '10px 14px 0',
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid rgba(99,102,241,0.35)',
            background: 'rgba(99,102,241,0.08)',
            color: 'var(--text-secondary)',
            fontSize: '0.74rem',
            fontWeight: 700,
            textAlign: 'center',
          }}
        >
          מצב עורך ראשי פעיל — לכל פוסט יש שורת כלים מעל התוכן.
        </div>
      ) : null}

      {/* Feed */}
      {posts.map(p => (
        <PostCard
          key={`${p.author}-${p.id}`}
          p={p}
          username={blogWriterName || null}
          navigate={navigate}
          showChiefToolbar={hasAdminToken}
          chiefEditorVerified={isChiefEditor}
          onChiefEditorAction={chiefEditorAction}
          actionBusy={chiefEditorBusyKey === postModerationKey(p)}
        />
      ))}
    </div>
  );
}
