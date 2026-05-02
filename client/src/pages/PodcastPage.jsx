import React, { useState } from 'react';
import { useAppStore } from '../store/appStore.js';
import { getLikes, saveLikes, getComments, saveComments, fmtDate } from '../lib/blogReactions.js';

const EPISODES = [
  { num: 1, title: 'האם האל קיים? דיון פתוח', guest: 'רב יוסף כהן VS ד"ר אבי לוי', duration: '1:12:34', live: true },
  { num: 2, title: 'אבולוציה ובריאה — סתירה או שלום?', guest: 'פרופ׳ מרים שפירא VS הרב דוד רוזן', duration: '58:20', live: false },
  { num: 3, title: 'תפילה: פסיכולוגיה או קשר אמיתי?', guest: 'ד"ר נועה ברק VS הרב שמעון אלוש', duration: '1:04:11', live: false },
  { num: 4, title: 'המוסר ללא אלוהים — אפשרי?', guest: 'ד"ר ערן שושן VS הרב אריאל נבון', duration: '47:55', live: false },
  { num: 5, title: 'המפץ הגדול ותחילת הכל', guest: 'פרופ׳ גיל ארד VS הרב יצחק ברנד', duration: '1:01:08', live: false },
  { num: 6, title: 'קבלה ומדע הקוונטי', guest: 'ד"ר אלון מזרחי VS הרב נחמן פרידמן', duration: '53:44', live: false },
  { num: 7, title: 'האם יש חיים אחרי המוות?', guest: 'פרופ׳ רחל גולן VS הרב משה כץ', duration: '1:08:29', live: false },
  { num: 8, title: 'דת ומדינה — הפרדה נכונה?', guest: 'עו"ד דנה שמיר VS הרב אורי שרקי', duration: '44:17', live: false },
  { num: 9, title: 'ניסים — עובדה או פרשנות?', guest: 'ד"ר יובל טל VS הרב זלמן כהן', duration: '56:02', live: false },
  { num: 10, title: 'האדם הראשון — אדם וחוה או אבולוציה?', guest: 'פרופ׳ שירה בן דוד VS הרב בנימין לאו', duration: '1:15:48', live: false },
];

function EpisodeRow({ ep, idx, username }) {
  const epId = `podcast-ep-${ep.num}`;
  const [playing, setPlaying] = useState(false);
  const [likes, setLikes] = useState(() => getLikes(epId));
  const [comments, setComments] = useState(() => getComments(epId));
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [draft, setDraft] = useState('');

  const iLiked = username && likes.includes(username);
  const stripe = idx % 2 === 0 ? 'var(--card)' : 'var(--card2)';

  const handleLike = e => {
    e.stopPropagation();
    if (!username) return;
    const next = iLiked ? likes.filter(u => u !== username) : [...likes, username];
    saveLikes(epId, next);
    setLikes(next);
  };

  const handleComment = () => {
    const body = draft.trim();
    if (!body || !username) return;
    const c = { id: `c-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, author: username, body, ts: Date.now() };
    const next = [...comments, c];
    saveComments(epId, next);
    setComments(next);
    setDraft('');
  };

  return (
    <div style={{ borderBottom: '1px solid var(--border)', background: playing ? 'rgba(99,102,241,0.08)' : stripe }}>
      {/* Main row */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
          borderRight: playing ? '3px solid var(--accent)' : '3px solid transparent',
          cursor: 'pointer',
        }}
        onClick={() => setPlaying(p => !p)}
      >
        {/* Play button */}
        <div style={{
          width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: playing ? 'var(--accent)' : ep.live ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.07)',
          border: `1px solid ${playing ? 'var(--accent)' : ep.live ? 'rgba(239,68,68,0.5)' : 'var(--border-strong)'}`,
          fontSize: '0.95rem',
          color: playing ? '#fff' : ep.live ? '#fca5a5' : 'var(--text-secondary)',
        }}>
          {playing ? '⏸' : '▶'}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--muted)' }}>פרק {ep.num}</span>
            {ep.live && (
              <span style={{ fontSize: '0.6rem', fontWeight: 900, letterSpacing: '0.06em', padding: '1px 6px', borderRadius: 4, background: 'rgba(239,68,68,0.85)', color: '#fff', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff', display: 'inline-block', animation: 'livePulse 1.4s ease-in-out infinite' }} />
                LIVE
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ep.title}</div>
          <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ep.guest}</div>
        </div>

        {/* Duration + join */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{ep.duration}</span>
          <span style={{ fontSize: '0.65rem', color: 'var(--accent)', fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}>
            להאזנה לחץ כאן
          </span>
        </div>
      </div>

      {/* Reactions bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px 8px', borderTop: '1px solid var(--border)' }}>
        <button
          type="button"
          onClick={handleLike}
          style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6,
            border: 'none', cursor: username ? 'pointer' : 'default',
            background: iLiked ? 'rgba(244,63,94,0.12)' : 'transparent',
            color: iLiked ? '#f43f5e' : 'var(--text-secondary)',
            fontSize: '0.8rem', fontWeight: 700,
          }}
        >
          {iLiked ? '❤️' : '🤍'} {likes.length}
        </button>

        <button
          type="button"
          onClick={e => { e.stopPropagation(); setCommentsOpen(o => !o); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6,
            border: 'none', cursor: 'pointer',
            background: commentsOpen ? 'rgba(99,102,241,0.1)' : 'transparent',
            color: commentsOpen ? 'var(--accent)' : 'var(--text-secondary)',
            fontSize: '0.8rem', fontWeight: 700,
          }}
        >
          💬 {comments.length}
        </button>
      </div>

      {/* Comments section */}
      {commentsOpen && (
        <div style={{ padding: '0 14px 12px', direction: 'rtl' }}>
          {comments.length === 0 ? (
            <p style={{ margin: '0 0 10px', color: 'var(--muted)', fontSize: '0.8rem' }}>אין תגובות עדיין</p>
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
          {username ? (
            <div style={{ display: 'flex', gap: 8, paddingTop: 8, alignItems: 'flex-end' }}>
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value.slice(0, 1000))}
                rows={2}
                placeholder="כתוב תגובה…"
                style={{ flex: 1, resize: 'none', padding: '6px 9px', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--card)', color: 'var(--text)', fontFamily: 'inherit', fontSize: '0.83rem' }}
                onClick={e => e.stopPropagation()}
              />
              <button
                type="button"
                onClick={e => { e.stopPropagation(); handleComment(); }}
                disabled={!draft.trim()}
                style={{ padding: '7px 13px', borderRadius: 6, border: '1px solid rgba(99,102,241,0.4)', background: draft.trim() ? 'rgba(99,102,241,0.85)' : 'var(--card-hover)', color: '#fff', fontWeight: 800, fontSize: '0.8rem', cursor: draft.trim() ? 'pointer' : 'not-allowed', flexShrink: 0 }}
              >
                שלח
              </button>
            </div>
          ) : (
            <p style={{ margin: '8px 0 0', fontSize: '0.78rem', color: 'var(--muted)' }}>יש להתחבר כדי להגיב</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function PodcastPage() {
  const user = useAppStore(s => s.user);
  const pendingUser = useAppStore(s => s.pendingUser);
  const username = user?.username || pendingUser?.username || '';

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '16px 0 40px', direction: 'rtl' }}>
      <h1 style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--gold)', margin: '0 0 14px', padding: '0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        🎙 פודקאסט LIVE — אמונה מול מדע
      </h1>

      <div style={{ margin: '0 14px 16px', padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#ef4444', flexShrink: 0, animation: 'livePulse 1.4s ease-in-out infinite', display: 'inline-block' }} />
        <span style={{ fontWeight: 900, fontSize: '0.9rem', color: '#fca5a5', letterSpacing: '0.03em' }}>גולשים משדרים ON AIR</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {EPISODES.map((ep, idx) => (
          <EpisodeRow key={ep.num} ep={ep} idx={idx} username={username} />
        ))}
      </div>

      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 0.5; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
