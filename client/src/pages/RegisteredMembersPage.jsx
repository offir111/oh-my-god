import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getApiBaseUrl } from '../lib/apiBaseUrl.js';

export default function RegisteredMembersPage() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    const BASE = getApiBaseUrl();
    setLoading(true);
    setError('');
    fetch(`${BASE}/api/stats`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!d) {
          setError('לא ניתן לטעון את הרשימה');
          setList([]);
          setCount(0);
          return;
        }
        const arr = Array.isArray(d.registeredList) ? d.registeredList : [];
        setList(arr);
        setCount(Number(d.registered) || arr.length);
      })
      .catch(() => {
        setError('שגיאת רשת');
        setList([]);
        setCount(0);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function closePage() {
    if (typeof window !== 'undefined' && window.history.length > 1) navigate(-1);
    else navigate('/lobby');
  }

  return (
    <div
      className="registered-page"
      dir="rtl"
      style={{
        position: 'relative',
        maxWidth: 560,
        margin: '0 auto',
        padding: '20px var(--app-shell-gutter, 18px) 48px',
        boxSizing: 'border-box',
      }}
    >
      <style>{`
        .registered-page__close {
          position: absolute;
          top: 10px;
          left: 10px;
          z-index: 2;
          width: 40px;
          height: 40px;
          margin: 0;
          padding: 0;
          border-radius: 10px;
          border: 1px solid var(--border-strong, rgba(255,255,255,0.2));
          background: rgba(18, 18, 26, 0.92);
          color: var(--text-secondary, #c4c4d4);
          font-size: 1.35rem;
          font-weight: 700;
          line-height: 1;
          cursor: pointer;
          font-family: inherit;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .registered-page__close:hover {
          background: rgba(248, 113, 113, 0.18);
          border-color: rgba(248, 113, 113, 0.45);
          color: #fecaca;
        }
        .registered-page__title { font-size: clamp(1.1rem, 3.5vw, 1.35rem); font-weight: 900; color: var(--gold); margin: 0 0 8px; letter-spacing: 0.02em; }
        .registered-page__list { border-radius: 14px; border: 1px solid var(--border-strong); background: rgba(0,0,0,0.22); overflow: hidden; }
        .registered-page__row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
        .registered-page__row:last-child { border-bottom: none; }
        .registered-page__name { font-weight: 800; color: var(--text); font-size: 0.95rem; word-break: break-word; }
        .registered-page__actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .registered-page__link { color: var(--accent); font-weight: 700; font-size: 0.82rem; text-decoration: none; }
        .registered-page__link:hover { text-decoration: underline; }
        a.registered-page__msg { display: inline-flex; align-items: center; justify-content: center; padding: 8px 14px; border-radius: 10px; border: 1px solid rgba(244,63,94,0.45); background: rgba(244,63,94,0.12); color: #fecaca; font-size: 0.78rem; font-weight: 800; font-family: inherit; cursor: pointer; white-space: nowrap; text-decoration: none; }
        a.registered-page__msg:hover { background: rgba(244,63,94,0.2); }
      `}</style>

      <button
        type="button"
        className="registered-page__close"
        onClick={closePage}
        aria-label="סגור"
      >
        ×
      </button>
      <h1 className="registered-page__title">רשומים</h1>

      {loading && <p style={{ color: 'var(--muted)', fontWeight: 600 }}>טוען…</p>}
      {error && !loading && <p style={{ color: '#f87171', fontWeight: 700 }}>{error}</p>}

      {!loading && !error && (
        <>
          <p style={{ margin: '0 0 12px', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
            סה״כ: {count}
          </p>
          <div className="registered-page__list" role="list">
            {list.length === 0 ? (
              <div className="registered-page__row" style={{ color: 'var(--muted)', justifyContent: 'center' }}>
                אין משתמשים רשומים עדיין
              </div>
            ) : (
              list.map(name => (
                <div key={name} className="registered-page__row" role="listitem">
                  <span className="registered-page__name">{name}</span>
                  <div className="registered-page__actions">
                    <Link className="registered-page__link" to={`/profile/${encodeURIComponent(name)}`}>
                      פרופיל
                    </Link>
                    <Link
                      className="registered-page__msg"
                      to={`/profile/${encodeURIComponent(name)}?compose=1`}
                    >
                      שלח הודעה
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
