import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore.js';

const PROFILE_PREFIX = 'cage_profile_v2:';

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
function PostCard({ p, username, navigate }) {
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

  return (
    <article style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
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
  const user = useAppStore(s => s.user);

  const posts = useMemo(() => {
    const real = loadAllPosts();
    const demosToShow = DEMO_POSTS.filter(d => !real.some(r => r.id === d.id));
    return [...real, ...demosToShow].sort((a, b) => b.ts - a.ts);
  }, []);

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', background: 'var(--bg)', minHeight: '100vh', direction: 'rtl' }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--surface)', borderBottom: '1px solid var(--border-strong)',
        padding: '11px 14px',
      }}>
        <span style={{ fontWeight: 900, fontSize: '1rem', color: 'var(--text)' }}>בלוג</span>
        {user?.username && (
          <button
            type="button"
            onClick={() => navigate(`/profile/${encodeURIComponent(user.username)}`)}
            style={{
              padding: '6px 14px', borderRadius: 6,
              border: '1px solid rgba(99,102,241,0.4)',
              background: 'rgba(99,102,241,0.15)',
              color: 'var(--accent)', fontWeight: 800,
              fontSize: '0.8rem', cursor: 'pointer',
            }}
          >
            ✎ כתוב פוסט
          </button>
        )}
      </div>

      {/* Feed */}
      {posts.map(p => (
        <PostCard key={p.id} p={p} username={user?.username || null} navigate={navigate} />
      ))}
    </div>
  );
}
