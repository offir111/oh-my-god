import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAppStore } from '../store/appStore.js';
import { disconnectSocket } from '../socket.js';
import {
  DEMO_PROFILE_USERNAME,
  emptyCageProfile,
  getMergedCageProfile,
  normalizeProfileUsername,
  readPrivateNote,
  readFileAsDataUrl,
  saveCageProfile,
  savePrivateNote,
  getAllPublicPhotos,
} from '../lib/cageUserProfile.js';
import UserAvatarSlot from '../components/ui/UserAvatarSlot.jsx';
import { getLikes, saveLikes, getComments, saveComments, getPositions, savePositions, fmtDate } from '../lib/blogReactions.js';

const AVATAR_EMOJI_GROUPS = [
  {
    label: '✡️ מאמינים ודת',
    emojis: ['🙏','✡️','✝️','☪️','🛐','📿'],
  },
  {
    label: '🔬 אתאיסטים ומדע',
    emojis: ['🌌','💥','🔬','🧬','🦕','🐒'],
  },
  {
    label: '🎭 כלליים',
    emojis: [
      '😀','😎','🤩','🧐','😇','🥷','🧠','💪','🦊','🐺',
      '🦁','🐯','🦅','🦋','🌟','⚡','🔥','💎','🌙','☀️',
      '🎭','🎯','🏆','👑','🚀','🌊','🌈','🧙','🎸','🤖',
    ],
  },
];

const PROF_BTN_PRIMARY =
  'linear-gradient(135deg, rgba(99,102,241,0.95), rgba(79,70,229,0.78))';
const PROF_BTN_MSG =
  'linear-gradient(175deg, rgba(244, 63, 94, 0.92) 0%, rgba(62, 14, 22, 0.98) 100%)';

/* ─── Sub-components ─────────────────────────────────────────────────── */

function CageTopBar({ onClose }) {
  return (
    <header
      className="cage-prof-top"
      style={{
        background: 'var(--surface)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px',
        direction: 'rtl',
        borderBottom: '1px solid var(--border-strong)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, color: 'var(--text-secondary)' }} aria-hidden>
        <span style={{ fontSize: '1.15rem', opacity: 0.9 }}>☰</span>
        <span style={{ fontSize: '1rem' }}>✉</span>
        <span style={{ fontSize: '1rem' }}>👥</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontWeight: 900, fontSize: '0.78rem', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.18)', fontFamily: 'var(--font-sans)', userSelect: 'none' }}>
          oh my GOD
        </div>
        <button
          type="button"
          aria-label="סגור דף פרופיל"
          onClick={onClose}
          style={{
            width: 28, height: 28, borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.07)',
            color: 'rgba(255,255,255,0.55)',
            fontSize: '0.82rem', fontWeight: 700,
            cursor: 'pointer', lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          ✕
        </button>
      </div>
    </header>
  );
}

function StripeRow({ label, value, stripeIndex }) {
  const bg = stripeIndex % 2 === 0 ? 'var(--card2)' : 'var(--card)';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        padding: '11px 14px',
        background: bg,
        borderBottom: '1px solid var(--border)',
        fontSize: '0.86rem',
        lineHeight: 1.45,
        direction: 'rtl',
      }}
    >
      <span style={{ color: 'var(--text-secondary)', fontWeight: 700, flex: '0 0 auto' }}>{label}</span>
      <span style={{ color: 'var(--text)', textAlign: 'right', wordBreak: 'break-word', flex: 1, minWidth: 0 }}>
        {value || '—'}
      </span>
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <section style={{ marginTop: 2 }}>
      <div
        style={{
          background: 'var(--surface)',
          color: 'var(--text)',
          padding: '9px 14px',
          fontWeight: 800,
          fontSize: '0.82rem',
          direction: 'rtl',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {title}
      </div>
      <div
        style={{
          background: 'var(--card2)',
          padding: '14px 14px 16px',
          direction: 'rtl',
          color: 'var(--text-secondary)',
          fontSize: '0.88rem',
          lineHeight: 1.65,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {children || <span style={{ color: 'var(--muted)' }}>—</span>}
      </div>
    </section>
  );
}

function ActionBtn({ icon, label, onClick, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="cage-action-btn"
      style={{ position: 'relative' }}
    >
      {icon}
      {badge ? (
        <span style={{
          position: 'absolute', top: -5, right: -5,
          minWidth: 16, height: 16, borderRadius: 8,
          background: '#ef4444', color: '#fff',
          fontSize: '0.58rem', fontWeight: 900,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 3px', lineHeight: 1, pointerEvents: 'none',
        }}>
          {badge > 9 ? '9+' : badge}
        </span>
      ) : null}
    </button>
  );
}

function StatChip({ value, label }) {
  return (
    <div className="cage-stat-chip">
      <span className="cage-stat-chip-num">{value ?? 0}</span>
      <span className="cage-stat-chip-label">{label}</span>
    </div>
  );
}

function computeAvatarFilter(v = 100) {
  if (v >= 100) return 'none';
  if (v <= 0) return 'grayscale(1)';
  if (v <= 50) {
    const gr = (1 - v / 50).toFixed(2);
    const sp = (v / 50).toFixed(2);
    return `grayscale(${gr}) sepia(${sp})`;
  }
  const sp = (1 - (v - 50) / 50).toFixed(2);
  return `sepia(${sp})`;
}

/* ─── Messaging helpers (localStorage) ──────────────────────────────── */
function loadInbox(norm) {
  if (!norm) return [];
  try { return JSON.parse(localStorage.getItem(`omg_inbox_${norm}`) || '[]'); }
  catch { return []; }
}
function loadOutbox(norm) {
  if (!norm) return [];
  try { return JSON.parse(localStorage.getItem(`omg_outbox_${norm}`) || '[]'); }
  catch { return []; }
}
function persistMsgs(key, arr) {
  try { localStorage.setItem(key, JSON.stringify(arr.slice(-300))); } catch {}
}
function doSendMessage(fromNorm, toNorm, body) {
  const msg = {
    id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    from: fromNorm, to: toNorm,
    body: body.slice(0, 2000),
    ts: Date.now(), read: false,
  };
  const ob = loadOutbox(fromNorm);
  ob.push({ ...msg, read: true });
  persistMsgs(`omg_outbox_${fromNorm}`, ob);
  const ib = loadInbox(toNorm);
  ib.push(msg);
  persistMsgs(`omg_inbox_${toNorm}`, ib);
}
function fmtMsgTime(ts) {
  try {
    return new Date(ts).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function safeFaithChatReturnHref(raw) {
  if (typeof raw !== 'string') return '';
  const s = raw.trim();
  if (s.startsWith('/') && !s.startsWith('//') && !s.includes('.')) return s.includes('#') ? s : `${s}#chat`;
  return '';
}

/* ─── Blog post card with reactions (profile view) ──────────────────── */
function ProfilePostCard({ post, username }) {
  const [likes, setLikes] = useState(() => getLikes(post.id));
  const [comments, setComments] = useState(() => getComments(post.id));
  const [positions, setPositions] = useState(() => getPositions(post.id));
  const [showLikers, setShowLikers] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [draft, setDraft] = useState('');

  const iLiked = username && likes.includes(username);
  const myPos = username ? positions[username] : null;
  const believerCount = Object.values(positions).filter(v => v === 'believer').length;
  const skepticCount  = Object.values(positions).filter(v => v === 'skeptic').length;

  const handleLike = () => {
    if (!username) return;
    const next = iLiked ? likes.filter(u => u !== username) : [...likes, username];
    saveLikes(post.id, next);
    setLikes(next);
  };

  const handlePos = pos => {
    if (!username) return;
    const next = { ...positions };
    if (next[username] === pos) delete next[username];
    else next[username] = pos;
    savePositions(post.id, next);
    setPositions(next);
  };

  const handleComment = () => {
    const body = draft.trim();
    if (!body || !username) return;
    const c = { id: `c-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, author: username, body, ts: Date.now() };
    const next = [...comments, c];
    saveComments(post.id, next);
    setComments(next);
    setDraft('');
  };

  const btnBase = {
    border: 'none', background: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 4,
    fontSize: '0.8rem', fontWeight: 700, padding: '4px 8px',
    borderRadius: 6,
  };

  return (
    <article style={{ padding: '14px 14px 0', borderBottom: '1px solid var(--border)', direction: 'rtl' }}>
      <h3 style={{ margin: '0 0 6px', color: 'var(--gold)', fontSize: '1rem', fontWeight: 900 }}>{post.title}</h3>
      <p style={{ margin: '0 0 8px', color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.65, fontSize: '0.88rem' }}>{post.body}</p>
      <span style={{ color: 'var(--muted)', fontSize: '0.68rem' }}>{fmtDate(post.ts)}</span>

      {/* Reaction bar */}
      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', margin: '8px 0 0', paddingBottom: 8, borderBottom: commentsOpen || showLikers ? '1px solid var(--border)' : 'none', alignItems: 'center' }}>
        <button type="button" onClick={handleLike} style={{ ...btnBase, color: iLiked ? '#f43f5e' : 'var(--text-secondary)', background: iLiked ? 'rgba(244,63,94,0.1)' : 'transparent' }}>
          {iLiked ? '❤️' : '🤍'} {likes.length}
        </button>
        {likes.length > 0 && (
          <button type="button" onClick={() => setShowLikers(o => !o)} style={{ ...btnBase, color: 'var(--muted)', fontSize: '0.72rem' }}>
            {showLikers ? 'הסתר ▲' : 'מי אהב? ▼'}
          </button>
        )}
        <button type="button" onClick={() => setCommentsOpen(o => !o)} style={{ ...btnBase, color: commentsOpen ? 'var(--accent)' : 'var(--text-secondary)', background: commentsOpen ? 'rgba(99,102,241,0.1)' : 'transparent' }}>
          💬 {comments.length}
        </button>
        <span style={{ color: 'var(--border)', margin: '0 2px' }}>|</span>
        <button type="button" onClick={() => handlePos('believer')} style={{ ...btnBase, color: myPos === 'believer' ? '#a78bfa' : 'var(--text-secondary)', background: myPos === 'believer' ? 'rgba(167,139,250,0.12)' : 'transparent' }} title="מאמין">🙏 {believerCount}</button>
        <button type="button" onClick={() => handlePos('skeptic')} style={{ ...btnBase, color: myPos === 'skeptic' ? '#34d399' : 'var(--text-secondary)', background: myPos === 'skeptic' ? 'rgba(52,211,153,0.12)' : 'transparent' }} title="מפקפק">🔬 {skepticCount}</button>
      </div>

      {/* Likers list */}
      {showLikers && likes.length > 0 && (
        <div style={{ padding: '8px 0 10px', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          <span style={{ color: 'var(--muted)', fontWeight: 700 }}>אהבו: </span>
          {likes.join(' · ')}
        </div>
      )}

      {/* Comments */}
      {commentsOpen && (
        <div style={{ paddingBottom: 4 }}>
          {comments.length === 0 ? (
            <p style={{ margin: '8px 0', color: 'var(--muted)', fontSize: '0.8rem' }}>אין תגובות עדיין</p>
          ) : (
            comments.map(c => (
              <div key={c.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 2, alignItems: 'center' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--gold)' }}>{c.author}</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>{fmtDate(c.ts)}</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text)', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{c.body}</p>
              </div>
            ))
          )}
          {username && (
            <div style={{ display: 'flex', gap: 8, paddingTop: 8, alignItems: 'flex-end' }}>
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value.slice(0, 1000))}
                rows={2}
                placeholder="כתוב תגובה…"
                style={{ flex: 1, resize: 'none', padding: '6px 9px', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--card)', color: 'var(--text)', fontFamily: 'inherit', fontSize: '0.83rem' }}
              />
              <button type="button" onClick={handleComment} disabled={!draft.trim()} style={{ padding: '7px 13px', borderRadius: 6, border: '1px solid rgba(99,102,241,0.4)', background: draft.trim() ? 'rgba(99,102,241,0.85)' : 'var(--card-hover)', color: '#fff', fontWeight: 800, fontSize: '0.8rem', cursor: draft.trim() ? 'pointer' : 'not-allowed', flexShrink: 0 }}>
                שלח
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────── */

export default function CageUserProfilePage() {
  const { username: usernameParam } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const chatReturnHref = useMemo(
    () => safeFaithChatReturnHref(searchParams.get('returnTo') || ''),
    [searchParams],
  );
  const user = useAppStore(s => s.user);
  const pendingUser = useAppStore(s => s.pendingUser);
  const setUser = useAppStore(s => s.setUser);
  const resetDebate = useAppStore(s => s.resetDebate);

  const displayName = useMemo(() => {
    try { return decodeURIComponent(usernameParam || '').trim() || ''; }
    catch { return String(usernameParam || '').trim(); }
  }, [usernameParam]);

  const subjectNorm = useMemo(() => normalizeProfileUsername(displayName), [displayName]);
  const viewerName = user?.username || pendingUser?.username || '';
  const viewerNorm = normalizeProfileUsername(viewerName);
  const isOwner = Boolean(viewerNorm && viewerNorm === subjectNorm);
  const hasFullLogin = Boolean(user?.username && (user.side === 'believer' || user.side === 'atheist'));
  /** עריכת פרופיל — כל מי שצופה בפרופיל שלו (גם pending); hasFullLogin נשאר לשימושים אחרים בדף */
  const canEditProfile = Boolean(isOwner);

  const [profile, setProfile] = useState(() => getMergedCageProfile(displayName));
  const [editOpen, setEditOpen] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [privateNoteDraft, setPrivateNoteDraft] = useState('');
  const [blogTitle, setBlogTitle] = useState('');
  const [blogBody, setBlogBody] = useState('');
  const [toast, setToast] = useState('');
  const [blogOpen, setBlogOpen] = useState(false);
  const [liveOpen, setLiveOpen] = useState(false);
  const [liveTitle, setLiveTitle] = useState('');
  const [liveType, setLiveType] = useState('audio');
  const [liveUrl, setLiveUrl] = useState('');
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgTab, setMsgTab] = useState('inbox');
  const [msgBody, setMsgBody] = useState('');
  const [inbox, setInbox] = useState([]);
  const [outbox, setOutbox] = useState([]);

  useEffect(() => {
    setProfile(getMergedCageProfile(displayName));
    setDirty(false);
    setPrivateNoteDraft(viewerNorm && subjectNorm ? readPrivateNote(viewerNorm, subjectNorm) : '');
  }, [displayName, viewerNorm, subjectNorm]);

  useEffect(() => {
    if (!canEditProfile) setEditOpen(false);
  }, [canEditProfile]);

  useEffect(() => {
    if (searchParams.get('compose') !== '1') return;
    const strip = () => {
      const next = new URLSearchParams(searchParams);
      next.delete('compose');
      if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
    };
    if (!viewerNorm) return;
    if (isOwner) {
      strip();
      return;
    }
    setMsgOpen(true);
    strip();
  }, [searchParams, setSearchParams, viewerNorm, isOwner]);

  const personalEditPanelRef = useRef(null);
  useEffect(() => {
    if (!editOpen || !personalEditPanelRef.current) return;
    personalEditPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [editOpen]);

  useEffect(() => {
    if (!viewerNorm) return;
    setInbox(loadInbox(viewerNorm));
    setOutbox(loadOutbox(viewerNorm));
  }, [viewerNorm]);

  const unreadCount = inbox.filter(m => !m.read).length;

  const openMsgPanel = () => {
    setMsgOpen(o => !o);
    setMsgTab('inbox');
    if (unreadCount > 0) {
      const updated = inbox.map(m => ({ ...m, read: true }));
      setInbox(updated);
      persistMsgs(`omg_inbox_${viewerNorm}`, updated);
    }
  };

  const handleSendMsg = () => {
    const body = msgBody.trim();
    if (!body || !viewerNorm || !subjectNorm || viewerNorm === subjectNorm) return;
    doSendMessage(viewerNorm, subjectNorm, body);
    setOutbox(loadOutbox(viewerNorm));
    setMsgBody('');
    setToast('ההודעה נשלחה!');
    window.setTimeout(() => setToast(''), 2000);
  };

  // Auto-save on page exit when there are unsaved changes
  useEffect(() => {
    const handleUnload = () => {
      if (dirty && isOwner && subjectNorm) {
        saveCageProfile(subjectNorm, profile);
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [dirty, isOwner, subjectNorm, profile]);

  // Auto-record last-seen timestamp whenever the owner visits their own profile
  useEffect(() => {
    if (!isOwner || !subjectNorm) return;
    const now = Date.now();
    const current = getMergedCageProfile(displayName);
    const next = { ...current, lastSeenTs: now };
    saveCageProfile(subjectNorm, next);
    setProfile(p => ({ ...p, lastSeenTs: now }));
  }, [isOwner, subjectNorm, displayName]);

  const updatedLabel = useMemo(() => {
    const ts = profile.updatedAtTs;
    try {
      return new Date(ts).toLocaleString('he-IL', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return ''; }
  }, [profile.updatedAtTs]);

  const latestBlogTitle = profile.blogPosts?.length
    ? profile.blogPosts.reduce((best, p) => (p.ts >= best.ts ? p : best)).title
    : '';

  const persist = useCallback(next => {
    if (!subjectNorm || !isOwner) return;
    const saved = saveCageProfile(subjectNorm, next);
    if (!saved) {
      setToast('השמירה נכשלה (ייתכן שאין מקום במכשיר). נסו למחוק תמונות או קיצרו טקסט.');
      window.setTimeout(() => setToast(''), 5000);
      return;
    }
    setProfile(saved);
    setDirty(false);
    setToast('נשמר');
    window.setTimeout(() => setToast(''), 2000);
  }, [subjectNorm, isOwner]);

  const patchField = (key, val) => {
    setProfile(p => ({ ...p, [key]: val }));
    setDirty(true);
  };

  const onAvatarPick = async e => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const url = await readFileAsDataUrl(file);
    if (!url) {
      setToast('תמונה גדולה מדי או לא בפורמט תקין');
      window.setTimeout(() => setToast(''), 3500);
      return;
    }
    persist({ ...profile, avatarDataUrl: url });
  };

  const onPhotosPick = async e => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    const nextPhotos = [...(profile.photos || [])];
    for (const f of files.slice(0, 6)) {
      if (nextPhotos.length >= 20) break;
      const url = await readFileAsDataUrl(f);
      if (url) nextPhotos.push(url);
    }
    patchField('photos', nextPhotos);
  };

  const addBlogPost = () => {
    const title = blogTitle.trim();
    const body = blogBody.trim();
    if (!title || !body) return;
    const post = {
      id: `b-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      title: title.slice(0, 200),
      body: body.slice(0, 20000),
      ts: Date.now(),
    };
    setProfile(p => ({ ...p, blogPosts: [post, ...(p.blogPosts || [])].slice(0, 80) }));
    setBlogTitle('');
    setBlogBody('');
    setDirty(true);
  };

  const persistPrivateNote = () => {
    if (!viewerNorm || !subjectNorm) return;
    savePrivateNote(viewerNorm, subjectNorm, privateNoteDraft);
    setToast('הערה נשמרה במכשיר');
    window.setTimeout(() => setToast(''), 2200);
  };

  const lastSeenDisplay = useMemo(() => {
    if (isOwner) return 'נמצא כרגע 🟢';
    if (!profile.lastSeenTs) return '';
    const d = new Date(profile.lastSeenTs);
    const day = d.getDate();
    const month = d.getMonth() + 1;
    const year = String(d.getFullYear()).slice(2);
    return `נראה בתאריך ${day}.${month}.${year}`;
  }, [isOwner, hasFullLogin, profile.lastSeenTs]);

  const isOnline = isOwner;

  const infoStripes = useMemo(() => [
    ['מין / מגדר', profile.gender],
    ['אזור', profile.region],
    ['גיל', profile.age],
    ['מצב משפחתי', profile.maritalStatus],
    ['נראה לאחרונה', lastSeenDisplay],
  ], [profile.gender, profile.region, profile.age, profile.maritalStatus, lastSeenDisplay]);

  // Stats: from appStore when owner, else zeros (future: fetch from server)
  const stats = {
    score: isOwner ? (user?.score ?? 0) : 0,
    voiceDebates: isOwner ? (user?.voiceDebates ?? 0) : 0,
    humanDebates: isOwner ? (user?.humanDebates ?? 0) : 0,
  };

  if (!displayName) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
        <p>לא צוין שם פרופיל</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', background: 'var(--bg)', minHeight: 'calc(100vh - var(--shell-top, 0px))', direction: 'rtl' }}>

      {/* ── Styles ── */}
      <style>{`
        .cage-action-btn {
          width: 42px; height: 42px; border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.16);
          background: rgba(255,255,255,0.09);
          color: rgba(255,255,255,0.82);
          font-size: 1.05rem; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s, transform 0.1s;
          flex-shrink: 0;
        }
        .cage-action-btn:hover { background: rgba(255,255,255,0.16); }
        .cage-action-btn:active { transform: scale(0.92); }

        .cage-stat-chip {
          display: flex; flex-direction: column; align-items: center;
          gap: 1px; padding: 8px 14px;
          background: var(--card2); border-radius: var(--radius-sm);
          border: 1px solid var(--border); flex: 1; min-width: 0;
        }
        .cage-stat-chip-num {
          font-size: 1.05rem; font-weight: 900; color: var(--gold);
          line-height: 1;
        }
        .cage-stat-chip-label {
          font-size: 0.68rem; color: var(--muted); font-weight: 600;
          white-space: nowrap;
        }

        .cage-blog-btn {
          width: 100%; padding: 13px 14px;
          border-radius: var(--radius-sm);
          border: 1px solid rgba(99,102,241,0.35);
          background: ${PROF_BTN_PRIMARY};
          color: #fff; font-weight: 800; font-size: 0.84rem;
          cursor: pointer; font-family: inherit;
          text-align: center;
          box-shadow: var(--shadow-xs);
          transition: opacity 0.15s;
        }
        .cage-blog-btn:hover { opacity: 0.88; }
        .cage-blog-btn:active { transform: scale(0.99); }

        .cage-msg-btn {
          width: 100%; padding: 13px 14px;
          border-radius: var(--radius-sm);
          border: 1px solid rgba(244,63,94,0.25);
          background: ${PROF_BTN_MSG};
          color: #fff; font-weight: 800; font-size: 0.84rem;
          cursor: pointer; font-family: inherit;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          box-shadow: var(--shadow-xs), 0 0 24px var(--believer-glow);
          transition: opacity 0.15s;
        }
        .cage-msg-btn:hover { opacity: 0.9; }
        .cage-msg-btn:active { transform: scale(0.99); }

        .cage-edit-input {
          width: 100%; padding: 8px 10px; box-sizing: border-box;
          border-radius: var(--radius-sm); border: 1px solid var(--border-strong);
          background: var(--card2); color: var(--text);
          font-family: inherit; font-size: 0.86rem;
        }
        .cage-edit-textarea {
          width: 100%; padding: 8px 10px; box-sizing: border-box;
          border-radius: var(--radius-sm); border: 1px solid var(--border-strong);
          background: var(--card2); color: var(--text);
          font-family: inherit; font-size: 0.86rem; resize: vertical;
        }
        .cage-prof-fab {
          position: fixed;
          bottom: calc(28px + env(safe-area-inset-bottom));
          inset-inline-start: calc(22px + env(safe-area-inset-inline-start));
          width: 52px; height: 52px; border-radius: var(--radius-pill);
          border: 1px solid rgba(255,255,255,0.12);
          background: ${PROF_BTN_PRIMARY};
          color: #fff; font-size: 1.35rem; cursor: pointer;
          box-shadow: var(--shadow-md), 0 0 28px rgba(99,102,241,0.25);
          z-index: 900; display: flex; align-items: center; justify-content: center;
        }
        .cage-prof-fab:active { transform: scale(0.96); }
        @media (min-width: 900px) {
          .cage-prof-fab { inset-inline-start: auto; inset-inline-end: 24px; }
        }
        .cage-prof-file {
          display: block; margin-top: 6px; font-size: 0.8rem;
          color: var(--muted); max-width: 100%;
        }
      `}</style>

      {/* ── Back to chat button ── */}
      {chatReturnHref ? (
        <div style={{ padding: '10px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border-strong)', display: 'flex', justifyContent: 'flex-start' }}>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ fontWeight: 800, fontSize: '0.85rem', padding: '8px 14px' }}
            onClick={() => {
              const h = chatReturnHref;
              const ix = h.indexOf('#');
              if (ix < 0) navigate(h);
              else navigate({ pathname: h.slice(0, ix) || '/faith', hash: h.slice(ix + 1) });
            }}
          >
            חזרה לצ&apos;אט האמונה
          </button>
        </div>
      ) : null}

      <CageTopBar onClose={() => navigate(-1)} />

      {/* ── Hero card ── */}
      <div style={{
        display: 'flex',
        direction: 'rtl',
        gap: 14,
        padding: '16px 14px 14px',
        background: 'var(--card)',
        borderBottom: '1px solid var(--border-strong)',
        alignItems: 'flex-start',
      }}>
        {/* Avatar (right in RTL = first DOM element) */}
        <div style={{
          width: 92, height: 92, flexShrink: 0,
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
          background: 'var(--card-hover)',
          border: '1px solid var(--border-strong)',
          cursor: canEditProfile ? 'pointer' : 'default',
        }}
          onClick={() => canEditProfile && setEditOpen(true)}
          title={canEditProfile ? 'לחץ לעריכת פרופיל' : undefined}
        >
          {profile.avatarDataUrl ? (
            <img src={profile.avatarDataUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: computeAvatarFilter(profile.avatarFilterVal ?? 100) }} />
          ) : profile.avatarEmoji ? (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3.2rem', lineHeight: 1 }}>
              {profile.avatarEmoji}
            </div>
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '2.4rem' }}>
              👤
            </div>
          )}
        </div>

        {/* Text section (left in RTL = second DOM element) */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h1 style={{ margin: 0, color: 'var(--gold)', fontSize: '1.25rem', fontWeight: 900, wordBreak: 'break-word', lineHeight: 1.15 }} dir="auto">
            {displayName}
          </h1>

          {/* Online status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, direction: 'rtl' }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: isOnline ? '#22c55e' : 'var(--muted)',
              boxShadow: isOnline ? '0 0 6px rgba(34,197,94,0.6)' : 'none',
            }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              {profile.lastSeenLabel || 'לא מחובר כרגע'}
            </span>
          </div>

          {/* Action buttons row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <ActionBtn icon="🎥" label="לדיון" onClick={() => navigate('/lobby')} />
              <ActionBtn icon="💬" label="לשיחה" onClick={() => navigate('/lobby')} />
              <ActionBtn icon="✉" label="הודעות" onClick={openMsgPanel} badge={unreadCount || null} />
            </div>
            <button
              type="button"
              onClick={() => setLiveOpen(o => !o)}
              aria-label="שידור חי"
              title="שידור חי LIVE"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 1, padding: '4px 10px', borderRadius: 10,
                border: profile.liveSession?.active ? '1.5px solid rgba(239,68,68,0.7)' : '1px solid rgba(255,255,255,0.16)',
                background: profile.liveSession?.active ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.09)',
                color: profile.liveSession?.active ? '#fca5a5' : 'rgba(255,255,255,0.82)',
                cursor: 'pointer', minWidth: 44, minHeight: 42,
                transition: 'background 0.15s',
              }}
            >
              {profile.liveSession?.active && (
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', display: 'block', marginBottom: 1 }} />
              )}
              <span style={{ fontSize: '0.65rem', fontWeight: 900, letterSpacing: '0.06em' }}>LIVE</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Message panel (inline, replaces content sections) ── */}
      {msgOpen && viewerNorm ? (
        <div style={{ direction: 'rtl', display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 160px)', background: 'var(--bg)' }}>

          {/* Section header (same style as other sections) */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--surface)', color: 'var(--text)',
            padding: '9px 14px', fontWeight: 800, fontSize: '0.82rem',
            borderBottom: '1px solid var(--border-strong)',
          }}>
            <span>הודעות</span>
            <button
              type="button"
              onClick={() => setMsgOpen(false)}
              aria-label="סגור הודעות"
              style={{
                width: 28, height: 28, borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.07)',
                color: 'rgba(255,255,255,0.65)',
                fontSize: '0.82rem', fontWeight: 700,
                cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              ✕
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            {[['inbox', `נכנסות${unreadCount ? ` (${unreadCount})` : ''}`], ['outbox', 'יוצאות']].map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setMsgTab(tab);
                  if (tab === 'inbox' && unreadCount > 0) {
                    const updated = inbox.map(m => ({ ...m, read: true }));
                    setInbox(updated);
                    persistMsgs(`omg_inbox_${viewerNorm}`, updated);
                  }
                }}
                style={{
                  flex: 1, padding: '11px 0', fontWeight: 800, fontSize: '0.88rem',
                  border: 'none', cursor: 'pointer',
                  background: msgTab === tab ? 'var(--card2)' : 'transparent',
                  color: msgTab === tab ? 'var(--accent)' : 'var(--text-secondary)',
                  borderBottom: msgTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Message list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {(msgTab === 'inbox' ? inbox : outbox).length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: '0.9rem' }}>
                {msgTab === 'inbox' ? '📭 אין הודעות נכנסות' : '📤 אין הודעות יוצאות'}
              </div>
            ) : (
              [...(msgTab === 'inbox' ? inbox : outbox)]
                .sort((a, b) => b.ts - a.ts)
                .map(m => (
                  <div key={m.id} style={{
                    padding: '12px 14px', borderBottom: '1px solid var(--border)',
                    background: msgTab === 'inbox' && !m.read ? 'rgba(99,102,241,0.07)' : 'transparent',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{fmtMsgTime(m.ts)}</span>
                      <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        {msgTab === 'inbox' ? `מ: ${m.from}` : `אל: ${m.to}`}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6 }}>
                      {m.body}
                    </p>
                  </div>
                ))
            )}
          </div>

          {/* Compose — only when viewing someone else */}
          {!isOwner && viewerNorm && subjectNorm && viewerNorm !== subjectNorm ? (
            <div style={{
              padding: '10px 14px', borderTop: '1px solid var(--border-strong)',
              display: 'flex', gap: 8, alignItems: 'flex-end',
              background: 'var(--surface)',
            }}>
              <textarea
                value={msgBody}
                onChange={e => setMsgBody(e.target.value.slice(0, 2000))}
                rows={3}
                placeholder={`שלח הודעה ל${displayName}…`}
                className="cage-edit-textarea"
                style={{ flex: 1, resize: 'none' }}
              />
              <button
                type="button"
                onClick={handleSendMsg}
                disabled={!msgBody.trim()}
                style={{
                  padding: '10px 16px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(99,102,241,0.4)',
                  background: msgBody.trim() ? 'rgba(99,102,241,0.85)' : 'var(--card-hover)',
                  color: '#fff', fontWeight: 800, fontSize: '0.85rem',
                  cursor: msgBody.trim() ? 'pointer' : 'not-allowed', flexShrink: 0,
                }}
              >
                שלח
              </button>
            </div>
          ) : null}
        </div>
      ) : blogOpen ? (
        <div style={{ direction: 'rtl', display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 160px)', background: 'var(--bg)' }}>

          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--surface)', color: 'var(--text)',
            padding: '9px 14px', fontWeight: 800, fontSize: '0.82rem',
            borderBottom: '1px solid var(--border-strong)',
          }}>
            <span>הבלוג של {displayName}</span>
            <button
              type="button"
              onClick={() => setBlogOpen(false)}
              aria-label="סגור בלוג"
              style={{
                width: 28, height: 28, borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.07)',
                color: 'rgba(255,255,255,0.65)',
                fontSize: '0.82rem', fontWeight: 700,
                cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              ✕
            </button>
          </div>

          {/* Post list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {!profile.blogPosts?.length ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: '0.9rem' }}>
                📝 עדיין אין פוסטים בבלוג
              </div>
            ) : (
              profile.blogPosts
                .slice()
                .sort((a, b) => b.ts - a.ts)
                .map(p => (
                  <ProfilePostCard key={p.id} post={p} username={viewerName || null} />
                ))
            )}
          </div>

          {/* Write new post — owner only */}
          {isOwner ? (
            <div style={{
              borderTop: '1px solid var(--border-strong)',
              background: 'var(--surface)',
              padding: '12px 14px',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <p style={{ margin: 0, fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>פוסט חדש</p>
              <input
                type="text"
                placeholder="כותרת…"
                value={blogTitle}
                onChange={e => setBlogTitle(e.target.value.slice(0, 200))}
                className="cage-edit-input"
              />
              <textarea
                placeholder="תוכן הפוסט…"
                value={blogBody}
                onChange={e => setBlogBody(e.target.value.slice(0, 20000))}
                rows={4}
                className="cage-edit-textarea"
                style={{ resize: 'none' }}
              />
              <button
                type="button"
                onClick={() => {
                  const title = blogTitle.trim();
                  const body = blogBody.trim();
                  if (!title || !body || !subjectNorm || !isOwner || !hasFullLogin) return;
                  const post = { id: `b-${Date.now()}-${Math.random().toString(36).slice(2,9)}`, title: title.slice(0,200), body: body.slice(0,20000), ts: Date.now() };
                  const next = { ...profile, blogPosts: [post, ...(profile.blogPosts||[])].slice(0,80) };
                  const saved = saveCageProfile(subjectNorm, next);
                  if (saved) { setProfile(saved); setBlogTitle(''); setBlogBody(''); setToast('פוסט פורסם!'); window.setTimeout(() => setToast(''), 2000); }
                }}
                disabled={!blogTitle.trim() || !blogBody.trim()}
                style={{
                  padding: '10px 0', borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(99,102,241,0.4)',
                  background: blogTitle.trim() && blogBody.trim() ? PROF_BTN_PRIMARY : 'var(--card-hover)',
                  color: '#fff', fontWeight: 900, fontSize: '0.85rem',
                  cursor: blogTitle.trim() && blogBody.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                פרסם לבלוג ✓
              </button>
            </div>
          ) : null}
        </div>
      ) : liveOpen ? (
        <div style={{ direction: 'rtl', display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 160px)', background: 'var(--bg)' }}>

          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--surface)', padding: '9px 14px',
            borderBottom: '1px solid var(--border-strong)',
          }}>
            <span style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              {profile.liveSession?.active && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'livePulse 1.5s ease-in-out infinite' }} />}
              שידור חי — {displayName}
            </span>
            <button
              type="button"
              onClick={() => setLiveOpen(false)}
              style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.65)', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >✕</button>
          </div>

          <style>{`@keyframes livePulse { 0%,100%{opacity:.6;transform:scale(.85)} 50%{opacity:1;transform:scale(1)} }`}</style>

          <div style={{ flex: 1, overflowY: 'auto', padding: '18px 14px', display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Visitor view — user is live */}
            {!isOwner && profile.liveSession?.active ? (
              <div style={{ textAlign: 'center', padding: '28px 14px', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
                <span style={{ fontSize: '2.2rem' }}>{profile.liveSession.type === 'video' ? '🎥' : '🎙'}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'livePulse 1.5s ease-in-out infinite' }} />
                  <span style={{ fontWeight: 900, fontSize: '1rem', color: '#fca5a5' }}>שידור חי</span>
                </div>
                {profile.liveSession.title ? (
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>{profile.liveSession.title}</p>
                ) : null}
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)' }}>
                  {profile.liveSession.type === 'video' ? 'שידור וידאו' : 'פודקאסט / שמע'}
                  {profile.liveSession.startedAt ? ` · החל ב-${new Date(profile.liveSession.startedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}` : ''}
                </p>
                {profile.liveSession.streamUrl ? (
                  <a
                    href={profile.liveSession.streamUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ padding: '11px 28px', borderRadius: 10, background: 'rgba(239,68,68,0.85)', color: '#fff', fontWeight: 900, fontSize: '0.9rem', textDecoration: 'none', display: 'inline-block' }}
                  >
                    🔴 הצטרף לשידור
                  </a>
                ) : (
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)', fontStyle: 'italic' }}>המשדר לא שיתף קישור הצטרפות</p>
                )}
              </div>
            ) : !isOwner ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: '0.9rem' }}>
                📡 {displayName} אינו בשידור כרגע
              </div>
            ) : null}

            {/* Owner controls */}
            {isOwner ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* Current status */}
                <div style={{ padding: '14px', borderRadius: 12, border: `1px solid ${profile.liveSession?.active ? 'rgba(239,68,68,0.5)' : 'var(--border)'}`, background: profile.liveSession?.active ? 'rgba(239,68,68,0.08)' : 'var(--card2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.85rem', color: profile.liveSession?.active ? '#fca5a5' : 'var(--text-secondary)' }}>
                    {profile.liveSession?.active ? '🔴 אתה בשידור חי כרגע' : '⚫ לא בשידור'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const cur = profile.liveSession?.active;
                      const next = {
                        active: !cur,
                        type: liveType || profile.liveSession?.type || 'audio',
                        title: liveTitle || profile.liveSession?.title || '',
                        streamUrl: liveUrl || profile.liveSession?.streamUrl || '',
                        startedAt: cur ? null : Date.now(),
                      };
                      const saved = { ...profile, liveSession: next };
                      saveCageProfile(subjectNorm, saved);
                      setProfile(saved);
                    }}
                    style={{
                      padding: '8px 18px', borderRadius: 8, fontWeight: 900, fontSize: '0.82rem', cursor: 'pointer',
                      border: profile.liveSession?.active ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(34,197,94,0.45)',
                      background: profile.liveSession?.active ? 'rgba(239,68,68,0.18)' : 'rgba(34,197,94,0.18)',
                      color: profile.liveSession?.active ? '#fca5a5' : '#86efac',
                    }}
                  >
                    {profile.liveSession?.active ? 'סיים שידור' : 'התחל שידור'}
                  </button>
                </div>

                {/* Type selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)' }}>סוג שידור</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[['audio', '🎙 פודקאסט / שמע'], ['video', '🎥 וידאו']].map(([t, lbl]) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setLiveType(t)}
                        style={{
                          flex: 1, padding: '10px 8px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                          border: (liveType || profile.liveSession?.type || 'audio') === t ? '1.5px solid rgba(99,102,241,0.7)' : '1px solid var(--border)',
                          background: (liveType || profile.liveSession?.type || 'audio') === t ? 'rgba(99,102,241,0.18)' : 'var(--card2)',
                          color: (liveType || profile.liveSession?.type || 'audio') === t ? 'var(--accent)' : 'var(--text-secondary)',
                        }}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)' }}>כותרת השידור (אופציונלי)</label>
                  <input
                    type="text"
                    value={liveTitle !== '' ? liveTitle : (profile.liveSession?.title || '')}
                    onChange={e => setLiveTitle(e.target.value.slice(0, 120))}
                    placeholder="לדוגמה: שיחה על אמונה ומדע…"
                    className="cage-edit-input"
                  />
                </div>

                {/* Stream URL */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)' }}>קישור לשידור (YouTube / Zoom / Spotify / אחר)</label>
                  <input
                    type="url"
                    value={liveUrl !== '' ? liveUrl : (profile.liveSession?.streamUrl || '')}
                    onChange={e => setLiveUrl(e.target.value.slice(0, 500))}
                    placeholder="https://…"
                    className="cage-edit-input"
                    dir="ltr"
                  />
                </div>

                {/* Save settings */}
                <button
                  type="button"
                  onClick={() => {
                    const next = {
                      ...(profile.liveSession || {}),
                      type: liveType || profile.liveSession?.type || 'audio',
                      title: liveTitle !== '' ? liveTitle : (profile.liveSession?.title || ''),
                      streamUrl: liveUrl !== '' ? liveUrl : (profile.liveSession?.streamUrl || ''),
                    };
                    const saved = { ...profile, liveSession: next };
                    saveCageProfile(subjectNorm, saved);
                    setProfile(saved);
                    setLiveTitle('');
                    setLiveUrl('');
                  }}
                  style={{
                    padding: '11px', borderRadius: 10, fontWeight: 800, fontSize: '0.84rem', cursor: 'pointer',
                    border: '1px solid rgba(99,102,241,0.4)',
                    background: 'rgba(99,102,241,0.18)', color: 'var(--accent)',
                  }}
                >
                  שמור הגדרות שידור
                </button>
              </div>
            ) : null}
          </div>
        </div>

      ) : galleryOpen ? (
        <div style={{ direction: 'rtl', display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 160px)', background: 'var(--bg)' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)', padding: '9px 14px', borderBottom: '1px solid var(--border-strong)' }}>
            <span style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--text)' }}>גלריית התמונות של {displayName}</span>
            <button type="button" onClick={() => setGalleryOpen(false)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.65)', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>

          {/* Upload (owner only) */}
          {isOwner && (
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                <span style={{ padding: '7px 16px', borderRadius: 7, fontSize: '0.8rem', fontWeight: 700, border: '1px solid var(--border-strong)', background: 'var(--card2)', color: 'var(--text-secondary)', userSelect: 'none' }}>
                  + הוסף תמונה
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={async e => {
                    const files = [...(e.target.files || [])];
                    e.target.value = '';
                    const cur = profile.galleryItems || [];
                    if (cur.length >= 40) { setToast('מקסימום 40 תמונות בגלריה'); window.setTimeout(() => setToast(''), 2500); return; }
                    const next = [...cur];
                    for (const f of files.slice(0, 40 - cur.length)) {
                      const url = await readFileAsDataUrl(f);
                      if (url) next.push({ id: `gi-${Date.now()}-${Math.random().toString(36).slice(2,8)}`, url, isPublic: false, ts: Date.now() });
                    }
                    persist({ ...profile, galleryItems: next });
                  }}
                />
              </label>
              <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{(profile.galleryItems || []).length} / 40 תמונות</span>
            </div>
          )}

          {/* Grid */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            {!(profile.galleryItems || []).length ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: '0.9rem' }}>🖼 אין תמונות בגלריה עדיין</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {(profile.galleryItems || []).map((item, idx) => (
                  <div key={item.id} style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-deep)', border: `1.5px solid ${item.isPublic ? 'rgba(168,85,247,0.6)' : 'var(--border)'}` }}>
                    <img src={item.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    {isOwner && (
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', gap: 3, padding: 4, background: 'rgba(0,0,0,0.55)' }}>
                        <button
                          type="button"
                          onClick={() => {
                            const next = (profile.galleryItems || []).map((it, i) => i === idx ? { ...it, isPublic: !it.isPublic } : it);
                            persist({ ...profile, galleryItems: next });
                          }}
                          style={{ flex: 1, padding: '3px 0', borderRadius: 4, fontSize: '0.6rem', fontWeight: 800, border: 'none', cursor: 'pointer', background: item.isPublic ? 'rgba(168,85,247,0.85)' : 'rgba(255,255,255,0.15)', color: '#fff' }}
                        >
                          {item.isPublic ? 'ציבורי' : 'פרטי'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const next = (profile.galleryItems || []).filter((_, i) => i !== idx);
                            persist({ ...profile, galleryItems: next });
                          }}
                          style={{ width: 22, borderRadius: 4, fontSize: '0.65rem', fontWeight: 800, border: 'none', cursor: 'pointer', background: 'rgba(239,68,68,0.75)', color: '#fff' }}
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      ) : <>

      {/* ── Openness line ── */}
      {profile.opennessLine ? (
        <div style={{
          padding: '10px 14px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          direction: 'rtl',
          color: 'var(--accent)',
          fontSize: '0.83rem',
          fontWeight: 650,
        }}>
          <span aria-hidden>👥</span>
          <span>{profile.opennessLine}</span>
        </div>
      ) : null}

      {/* ── Stat chips ── */}
      {(stats.score > 0 || stats.voiceDebates > 0 || stats.humanDebates > 0) && (
        <div style={{ display: 'flex', gap: 8, padding: '10px 14px', direction: 'rtl' }}>
          <StatChip value={stats.score} label="לייקים" />
          <StatChip value={stats.voiceDebates} label="דיונים קוליים" />
          <StatChip value={stats.humanDebates} label="דיונים" />
        </div>
      )}

      {/* ── Text sections ── */}
      {profile.whoAmI ? <SectionCard title="מי אני">{profile.whoAmI}</SectionCard> : null}

      {/* ── Personal info ── */}
      <section style={{ marginTop: 2 }}>
        <div style={{ background: 'var(--surface)', color: 'var(--text)', padding: '9px 14px', fontWeight: 800, fontSize: '0.82rem', direction: 'rtl', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>פרטים אישיים</span>
          {canEditProfile && (
            <button
              type="button"
              onClick={() => {
                if (editOpen && dirty) persist(profile);
                setEditOpen(o => !o);
              }}
              style={{
                fontSize: '0.78rem', fontWeight: 800,
                padding: '6px 14px', borderRadius: 8,
                border: '1px solid rgba(99,102,241,0.45)',
                background: editOpen ? 'rgba(99,102,241,0.22)' : 'rgba(99,102,241,0.12)',
                color: editOpen ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              {editOpen ? 'סגור עריכה ✕' : 'עריכת פרופיל ✎'}
            </button>
          )}
        </div>

        {canEditProfile && editOpen ? (
          <div
            ref={personalEditPanelRef}
            style={{
              padding: 14,
              background: 'var(--surface)',
              borderBottom: '1px solid var(--border)',
              scrollMarginTop: 'calc(var(--shell-top, 122px) + 10px)',
            }}
          >
            <button
              type="button"
              onClick={() => {
                disconnectSocket();
                setUser(null);
                resetDebate();
                navigate('/login');
              }}
              style={{ width: '100%', padding: 10, borderRadius: 'var(--radius-sm)', border: '1px solid rgba(244,63,94,0.4)', background: 'rgba(244,63,94,0.1)', color: '#f87171', fontWeight: 800, cursor: 'pointer', marginBottom: 14 }}
            >
              התנתק
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Avatar: image upload + icon picker side by side */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>תמונת פרופיל</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                    <span style={{
                      padding: '7px 16px', borderRadius: 7, fontSize: '0.8rem', fontWeight: 700,
                      border: '1px solid var(--border-strong)', background: 'var(--card2)',
                      color: 'var(--text-secondary)', userSelect: 'none',
                    }}>
                      תמונה
                    </span>
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={onAvatarPick} />
                  </label>
                  <button
                    type="button"
                    onClick={() => setEmojiPickerOpen(o => !o)}
                    style={{
                      padding: '7px 16px', borderRadius: 7, fontSize: '0.8rem', fontWeight: 700,
                      border: emojiPickerOpen ? '1.5px solid var(--accent)' : '1px solid var(--border-strong)',
                      background: emojiPickerOpen ? 'rgba(99,102,241,0.18)' : 'var(--card2)',
                      color: emojiPickerOpen ? 'var(--accent)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    {profile.avatarEmoji ? `${profile.avatarEmoji} אייקון` : 'אייקון'}
                  </button>
                  {profile.avatarEmoji && (
                    <button
                      type="button"
                      onClick={() => persist({ ...profile, avatarEmoji: '' })}
                      style={{ fontSize: '0.72rem', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                    >
                      נקה
                    </button>
                  )}
                </div>

                {emojiPickerOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 0' }}>
                    {AVATAR_EMOJI_GROUPS.map(group => (
                      <div key={group.label}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 700, marginBottom: 5 }}>{group.label}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {group.emojis.map(em => (
                            <button
                              key={em}
                              type="button"
                              onClick={() => { persist({ ...profile, avatarEmoji: em }); setEmojiPickerOpen(false); }}
                              style={{
                                width: 40, height: 40, borderRadius: 8, fontSize: '1.4rem',
                                border: profile.avatarEmoji === em ? '2px solid var(--accent)' : '1px solid var(--border-strong)',
                                background: profile.avatarEmoji === em ? 'rgba(99,102,241,0.2)' : 'var(--card2)',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'border-color 0.12s, background 0.12s',
                              }}
                            >
                              {em}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>הוספת תמונות לגלריה</span>
                <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                  <span style={{
                    padding: '7px 16px', borderRadius: 7, fontSize: '0.8rem', fontWeight: 700,
                    border: '1px solid var(--border-strong)', background: 'var(--card2)',
                    color: 'var(--text-secondary)', userSelect: 'none',
                  }}>
                    תמונות לגלריה
                  </span>
                  <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={onPhotosPick} />
                </label>
              </div>
              <p style={{ color: 'var(--muted)', fontSize: '0.72rem', margin: 0 }}>עד כ־1.4MB לכל תמונה.</p>

              {[
                ['news', 'חדשות / סטטוס'],
                ['opennessLine', 'שורת פתיחות להיכרויות'],
                ['gender', 'מין / מגדר'],
                ['region', 'אזור'],
                ['age', 'גיל'],
                ['maritalStatus', 'מצב משפחתי'],
                ['joinDateLabel', 'תאריך הצטרפות (טקסט חופשי)'],
              ].map(([k, lab]) => (
                <label key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.78rem', color: 'var(--muted)' }}>
                  {lab}
                  <input
                    type="text"
                    value={profile[k] || ''}
                    onChange={e => patchField(k, e.target.value)}
                    className="cage-edit-input"
                  />
                </label>
              ))}

              {[
                ['aboutMe', 'קצת עלי'],
                ['whoAmI', 'מי אני'],
              ].map(([k, lab]) => (
                <label key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.78rem', color: 'var(--muted)' }}>
                  {lab}
                  <textarea
                    value={profile[k] || ''}
                    onChange={e => patchField(k, e.target.value)}
                    rows={5}
                    className="cage-edit-textarea"
                  />
                </label>
              ))}

              {profile.photos?.length ? (
                <button
                  type="button"
                  onClick={() => patchField('photos', [])}
                  style={{ alignSelf: 'flex-start', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(248,113,113,0.45)', background: 'rgba(244,63,94,0.12)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  ניקוי גלריה
                </button>
              ) : null}

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
                <p style={{ color: 'var(--muted)', fontWeight: 800, margin: '0 0 10px' }}>פוסט חדש בבלוג</p>
                <input
                  type="text"
                  placeholder="כותרת"
                  value={blogTitle}
                  onChange={e => setBlogTitle(e.target.value.slice(0, 200))}
                  className="cage-edit-input"
                  style={{ marginBottom: 8 }}
                />
                <textarea
                  placeholder="תוכן המאמר…"
                  value={blogBody}
                  onChange={e => setBlogBody(e.target.value.slice(0, 20000))}
                  rows={5}
                  className="cage-edit-textarea"
                />
                <button
                  type="button"
                  onClick={addBlogPost}
                  style={{ marginTop: 8, padding: '9px 18px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.18)', background: PROF_BTN_PRIMARY, color: '#fff', fontWeight: 800, cursor: 'pointer' }}
                >
                  פרסום לבלוג
                </button>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => persist(profile)}
                  disabled={!dirty}
                  style={{
                    flex: 1, padding: 12, borderRadius: 'var(--radius-sm)',
                    border: dirty ? '1px solid rgba(255,255,255,0.11)' : '1px solid var(--border-strong)',
                    background: dirty
                      ? 'linear-gradient(175deg, rgba(16,185,129,0.88), rgba(5,46,34,0.97))'
                      : 'var(--card-hover)',
                    color: '#fff', fontWeight: 900,
                    cursor: dirty ? 'pointer' : 'not-allowed',
                    boxShadow: dirty ? 'var(--shadow-xs), 0 0 28px var(--atheist-glow)' : 'none',
                  }}
                >
                  שמור פרופיל
                </button>
                <button
                  type="button"
                  onClick={() => { setProfile(getMergedCageProfile(displayName)); setDirty(false); }}
                  style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  בטל
                </button>
              </div>

              <button
                type="button"
                onClick={() => persist({ ...emptyCageProfile(), joinDateLabel: profile.joinDateLabel || '' })}
                style={{ alignSelf: 'flex-start', fontSize: '0.74rem', color: 'var(--omg-yellow-peak)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >
                איפוס לשדות ריקים
              </button>
            </div>
          </div>
        ) : null}

        {!editOpen ? (
          <div>
            {infoStripes.map(([label, value], idx) => (
              <StripeRow key={label} label={label} value={value} stripeIndex={idx} />
            ))}
            {profile.aboutMe ? (
              <div style={{
                padding: '10px 14px', direction: 'rtl',
                background: 'var(--card2)',
                borderTop: '1px solid var(--border)',
                fontSize: '0.85rem', color: 'var(--text)',
                lineHeight: 1.6, whiteSpace: 'pre-wrap',
              }}>
                <div style={{ fontWeight: 800, fontSize: '0.75rem', color: 'var(--muted)', marginBottom: 5 }}>קצת עלי</div>
                {profile.aboutMe}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* ── News / dates / blog / message ── */}
      <section style={{ marginTop: 2 }}>
        <div style={{ background: 'var(--surface)', color: 'var(--text)', padding: '9px 14px', fontWeight: 800, fontSize: '0.82rem', direction: 'rtl', borderBottom: '1px solid var(--border)' }}>
          חדשות
        </div>
        <div>
          {profile.news ? <StripeRow label="סטטוס" value={profile.news} stripeIndex={0} /> : null}
          {updatedLabel ? <StripeRow label="תאריך עדכון" value={updatedLabel} stripeIndex={1} /> : null}
          {profile.joinDateLabel ? <StripeRow label="תאריך הצטרפות" value={profile.joinDateLabel} stripeIndex={2} /> : null}
        </div>
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            type="button"
            className="cage-blog-btn"
            onClick={() => setBlogOpen(true)}
          >
            {`הבלוג של ${displayName}`}
          </button>
          <button
            type="button"
            className="cage-blog-btn"
            onClick={() => setGalleryOpen(true)}
            style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.9), rgba(109,40,217,0.75))' }}
          >
            {`גלריית התמונות של ${displayName}`}
          </button>
          {!isOwner ? (
            <button
              type="button"
              className="cage-msg-btn"
              onClick={() => {
                if (!viewerNorm) {
                  setToast('יש להתחבר כדי לשלוח הודעה');
                  window.setTimeout(() => setToast(''), 2200);
                  return;
                }
                setMsgOpen(true);
              }}
            >
              <span aria-hidden>✉</span> שלח הודעה
            </button>
          ) : null}
        </div>
      </section>

      {/* ── Notes (viewer only) ── */}
      {viewerNorm && !isOwner ? (
        <SectionCard title={`הערות פרטיות אודות ${displayName} (רק אצלך)`}>
          <textarea
            value={privateNoteDraft}
            onChange={e => setPrivateNoteDraft(e.target.value.slice(0, 8000))}
            rows={4}
            placeholder="מה שתכתוב כאן נשמר במכשיר בלבד…"
            className="cage-edit-textarea"
            style={{ marginBottom: 8 }}
          />
          <button
            type="button"
            onClick={persistPrivateNote}
            style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', background: 'rgba(255,255,255,0.08)', color: 'var(--text)', fontWeight: 700, cursor: 'pointer' }}
          >
            שמור הערות
          </button>
        </SectionCard>
      ) : null}

      {/* ── Gallery ── */}
      {profile.photos?.length ? (
        <section style={{ marginTop: 2 }}>
          <div style={{ background: 'var(--surface)', color: 'var(--text)', padding: '9px 14px', fontWeight: 800, fontSize: '0.82rem', borderBottom: '1px solid var(--border)' }}>גלריה</div>
          <div style={{ background: 'var(--card2)', padding: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {profile.photos.map((src, i) => (
                <div key={`${i}-${src.slice(0, 40)}`} style={{ aspectRatio: '1', overflow: 'hidden', borderRadius: 'var(--radius-sm)', background: 'var(--bg-deep)' }}>
                  <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}


      {/* ── התנתק + עריכת פרופיל/סגור (תמיד בתחתית כשאפשר לערוך; תיבת השדות מתחת ל״פרטים אישיים״) ── */}
      {canEditProfile ? (
        <div style={{ padding: 14, background: 'var(--surface)', borderTop: '2px solid var(--border-strong)', marginTop: 2 }}>
          <button
            type="button"
            onClick={() => {
              disconnectSocket();
              setUser(null);
              resetDebate();
              navigate('/login');
            }}
            style={{ width: '100%', padding: 10, borderRadius: 'var(--radius-sm)', border: '1px solid rgba(244,63,94,0.4)', background: 'rgba(244,63,94,0.1)', color: '#f87171', fontWeight: 800, cursor: 'pointer', marginBottom: 10 }}
          >
            התנתק
          </button>
          <button
            type="button"
            onClick={() => {
              if (editOpen) {
                if (dirty) persist(profile);
                setEditOpen(false);
              } else {
                setEditOpen(true);
              }
            }}
            style={{
              width: '100%', padding: '6px 10px',
              borderRadius: 8, fontWeight: 800, fontSize: '0.78rem',
              border: '1px solid rgba(99,102,241,0.45)',
              background: editOpen ? 'rgba(99,102,241,0.22)' : 'rgba(99,102,241,0.12)',
              color: editOpen ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
              marginBottom: editOpen ? 14 : 0,
            }}
          >
            {editOpen ? 'סגור עריכה ✕' : 'עריכת פרופיל ✎'}
          </button>
        </div>
      ) : null}

      {/* ── Footer ── */}
      <div style={{ padding: '44px 16px', textAlign: 'center', fontSize: '0.74rem', color: 'var(--muted)' }}>
        {subjectNorm === normalizeProfileUsername(DEMO_PROFILE_USERNAME) && !viewerNorm ? (
          <p style={{ margin: 0 }}>
            פרופיל הדגמה של «{DEMO_PROFILE_USERNAME}» — בהתחברות בשם זה תוכלו לשכתב ולשמור גרסה משלכם.
          </p>
        ) : null}
      </div>

      </> /* end of msgOpen ternary */}

      {/* ── FAB ── */}
      <button type="button" className="cage-prof-fab" aria-label="מעבר לצ׳אט" title="צ׳אט" onClick={() => navigate('/faith#chat')}>
        💬
      </button>


      {/* ── Toast ── */}
      {toast ? (
        <div style={{
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--card2)', border: '1px solid var(--border-strong)',
          color: 'var(--text)', padding: '10px 20px', borderRadius: 'var(--radius-sm)',
          zIndex: 1000, maxWidth: '90%', fontSize: '0.85rem', textAlign: 'center',
          boxShadow: 'var(--shadow-md)',
        }}>
          {toast}
        </div>
      ) : null}
    </div>
  );
}
