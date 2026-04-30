import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import QuickNavInlineLinks from '../components/layout/QuickNavInlineLinks.jsx';
import { getApiBaseUrl } from '../lib/apiBaseUrl.js';

const CONTACT_EMAIL = 'omgomgo044@gmail.com';
/** לקישור wa.me */
const CONTACT_WHATSAPP_E164 = '972545770566';

const ORANGE_STRENGTH = 0.9;

function orangeWaveRgb(intensity) {
  const r0 = Math.round(250 + 5 * intensity);
  const g0 = Math.round(100 + 55 * intensity);
  const b0 = Math.round(20 + 35 * intensity);
  const w = 1 - ORANGE_STRENGTH;
  return `rgb(${Math.round(r0 * ORANGE_STRENGTH + 255 * w)}, ${Math.round(g0 * ORANGE_STRENGTH + 255 * w)}, ${Math.round(b0 * ORANGE_STRENGTH + 255 * w)})`;
}

function orangeGlowAlpha(a) {
  return Math.round(a * ORANGE_STRENGTH * 1000) / 1000;
}

function setAdminFetchError(setAdminError, err) {
  setAdminError(
    import.meta.env.DEV
      ? 'שגיאת רשת: הפעילו את השרת (בתיקיית server) וודאו שהדף נפתח מ־Vite, לא מקובץ מקומי.'
      : 'שגיאת רשת — נסו שוב או בדקו את החיבור.',
  );
  if (import.meta.env.DEV) console.warn('[admin fetch]', err);
}

const PAGES = {
  contact: {
    title: 'צור קשר',
  },
};

/** אסימון מנהל — localStorage (נשמר בין דפים/ניווט); גם ניקוי session ישן */
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

function persistAdminToken(token) {
  try {
    if (token) {
      localStorage.setItem(ADMIN_TOKEN_KEY, token);
      sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
    }
  } catch {
    try {
      if (token) sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
    } catch {
      // ignore
    }
  }
}

function clearStoredAdminToken() {
  try {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    // ignore
  }
}

function ContactContent() {
  const pStyle = {
    color: 'var(--text-secondary)',
    lineHeight: 1.85,
    fontSize: '0.98rem',
    margin: '0 0 18px',
  };
  const labelStyle = {
    display: 'block',
    fontWeight: 800,
    color: 'var(--text)',
    marginBottom: 6,
    fontSize: '0.92rem',
  };
  const linkStyle = {
    color: 'var(--accent)',
    fontWeight: 600,
    wordBreak: 'break-all',
  };

  const BASE = getApiBaseUrl();
  const [adminToken, setAdminToken] = useState(() => readStoredAdminToken());
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminUsers, setAdminUsers] = useState([]);
  const [noteDrafts, setNoteDrafts] = useState({});

  const authHeaders = useCallback(
    () => ({
      'Content-Type': 'application/json',
      ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
    }),
    [adminToken],
  );

  const loadAdminUsers = useCallback(async () => {
    if (!adminToken) return;
    const res = await fetch(`${BASE}/api/admin/users`, { headers: authHeaders() });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      if (res.status === 401) {
        clearStoredAdminToken();
        setAdminToken('');
      }
      return;
    }
    if (data?.users) {
      setAdminUsers(data.users);
      const drafts = {};
      for (const u of data.users) drafts[u.normalized] = u.note || '';
      setNoteDrafts(drafts);
    }
  }, [BASE, adminToken, authHeaders]);

  useEffect(() => {
    if (!adminToken) return;
    loadAdminUsers();
  }, [adminToken, BASE, loadAdminUsers]);

  async function handleAdminLogin(e) {
    e.preventDefault();
    setAdminError('');
    if (adminPassword.length !== 8) {
      setAdminError('הסיסמה חייבת להיות בדיוק 8 תווים');
      return;
    }
    setAdminBusy(true);
    try {
      const res = await fetch(`${BASE}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setAdminError(data?.error || 'התחברות נכשלה');
        return;
      }
      if (data?.token) {
        persistAdminToken(data.token);
        setAdminToken(data.token);
        setAdminPassword('');
      }
    } catch (err) {
      setAdminFetchError(setAdminError, err);
    } finally {
      setAdminBusy(false);
    }
  }

  function adminLogout() {
    clearStoredAdminToken();
    setAdminToken('');
    setAdminUsers([]);
    setAdminPassword('');
  }

  async function toggleBlock(usernameNorm, blocked) {
    setAdminBusy(true);
    setAdminError('');
    try {
      const res = await fetch(`${BASE}/api/admin/block`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ username: usernameNorm, blocked }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setAdminError(data?.error || 'פעולה נכשלה');
        return;
      }
      if (data?.users) setAdminUsers(data.users);
    } catch (err) {
      setAdminFetchError(setAdminError, err);
    } finally {
      setAdminBusy(false);
    }
  }

  async function saveNote(usernameNorm) {
    setAdminBusy(true);
    setAdminError('');
    try {
      const res = await fetch(`${BASE}/api/admin/note`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ username: usernameNorm, note: noteDrafts[usernameNorm] || '' }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setAdminError(data?.error || 'שמירה נכשלה');
        return;
      }
      if (data?.users) setAdminUsers(data.users);
    } catch (err) {
      setAdminFetchError(setAdminError, err);
    } finally {
      setAdminBusy(false);
    }
  }

  const adminPanelBorder = {
    marginTop: 20,
    padding: 18,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(0,0,0,0.2)',
  };

  const OMG_LETTERS = ['O', 'M', 'G'];

  return (
    <div style={{ marginBottom: 24 }}>
      <style>{`
        /* כתום–לבן כמו כותרת דף הכניסה — תנועה איטית */
        @keyframes contact-omg-orange-white-wave {
          0%, 100% {
            color: #ffffff;
            text-shadow: none;
          }
          7%, 18% {
            color: var(--wave-color, #fdba74);
            text-shadow: 0 0 var(--wave-glow, 14px) rgba(251, 146, 60, var(--wave-glow-alpha, 0.432));
          }
          27% {
            color: #ffffff;
            text-shadow: none;
          }
        }
        .contact-omg-block {
          margin-top: 28px;
          margin-bottom: 8px;
          text-align: center;
        }
        .contact-omg-letter {
          display: inline-block;
          font-weight: 900;
          font-size: clamp(2rem, 8vw, 3.25rem);
          letter-spacing: 0.14em;
          line-height: 1.1;
          color: #ffffff;
          animation: contact-omg-orange-white-wave 20s linear infinite;
          animation-delay: var(--wave-delay, 0s);
        }
        @media (prefers-reduced-motion: reduce) {
          .contact-omg-letter { animation: none; color: #fff; }
        }
        .contact-admin-details summary {
          cursor: pointer;
          color: var(--muted);
          font-size: 0.82rem;
          font-weight: 600;
          margin-top: 10px;
          list-style: none;
        }
        .contact-admin-details summary::-webkit-details-marker { display: none; }
      `}</style>

      <p style={{ ...pStyle, marginBottom: 22 }}>
        לשאלות, הצעות ודיווח על תוכן ניתן לפנות באימייל או בוואטסאפ:
      </p>
      <section style={{ marginBottom: 20 }}>
        <span style={labelStyle}>אימייל</span>
        <a href={`mailto:${CONTACT_EMAIL}`} style={linkStyle}>{CONTACT_EMAIL}</a>
      </section>
      <section>
        <span style={labelStyle}>וואטסאפ</span>
        <a
          href={`https://wa.me/${CONTACT_WHATSAPP_E164}`}
          target="_blank"
          rel="noopener noreferrer"
          style={linkStyle}
        >
          054-5770566
        </a>
      </section>

      <div className="contact-omg-block" dir="ltr" aria-label="מפעיל האתר OMG">
        {OMG_LETTERS.map((ch, index) => {
          const last = OMG_LETTERS.length - 1;
          const intensity = last > 0 ? 0.9 + (index / last) * 0.1 : 1;
          return (
            <span
              key={ch + index}
              className="contact-omg-letter"
              style={{
                '--wave-delay': `${index * 0.16}s`,
                '--wave-color': orangeWaveRgb(intensity),
                '--wave-glow': `${10 + 10 * intensity}px`,
                '--wave-glow-alpha': orangeGlowAlpha(0.35 + 0.2 * intensity),
              }}
            >
              {ch}
            </span>
          );
        })}
      </div>

      {!adminToken ? (
        <details className="contact-admin-details" style={{ marginTop: 4 }}>
          <summary>כניסת מנהל</summary>
          <form
            onSubmit={handleAdminLogin}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              maxWidth: 360,
              marginTop: 14,
              paddingTop: 14,
              borderTop: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <label style={{ ...labelStyle, fontSize: '0.88rem' }}>
              סיסמה (8 תווים)
              <input
                type="password"
                dir="ltr"
                inputMode="text"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value.slice(0, 8))}
                autoComplete="new-password"
                maxLength={8}
                style={{
                  marginTop: 6,
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: '1px solid var(--border-strong, rgba(255,255,255,0.14))',
                  background: 'rgba(10,10,16,0.75)',
                  color: 'var(--text)',
                  boxSizing: 'border-box',
                }}
              />
            </label>
            <button
              type="submit"
              disabled={adminBusy || adminPassword.length !== 8}
              style={{
                padding: '12px 18px',
                borderRadius: 12,
                fontWeight: 800,
                border: 'none',
                cursor: adminBusy || adminPassword.length !== 8 ? 'not-allowed' : 'pointer',
                background: 'var(--accent, #6366f1)',
                color: '#fff',
              }}
            >
              {adminBusy ? 'מתחבר…' : 'התחבר'}
            </button>
            {adminError ? <p style={{ color: '#f87171', fontWeight: 600, margin: 0 }}>{adminError}</p> : null}
          </form>
        </details>
      ) : (
        <section style={adminPanelBorder} aria-label="לוח ניהול מנהל">
          <p style={{ ...pStyle, marginBottom: 12 }}>מחובר כמנהל.</p>
          <button
            type="button"
            onClick={adminLogout}
            style={{
              padding: '8px 14px',
              borderRadius: 10,
              fontWeight: 700,
              marginBottom: 16,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            התנתק
          </button>
          {adminError ? <p style={{ color: '#f87171', fontWeight: 600, marginBottom: 12 }}>{adminError}</p> : null}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ textAlign: 'right', color: 'var(--muted)' }}>
                  <th style={{ padding: '8px 6px' }}>משתמש</th>
                  <th style={{ padding: '8px 6px' }}>חסום</th>
                  <th style={{ padding: '8px 6px' }}>הערה / אזהרה</th>
                </tr>
              </thead>
              <tbody>
                {adminUsers.map(u => (
                  <tr key={u.normalized} style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <td style={{ padding: '10px 6px', fontWeight: 700 }}>{u.username}</td>
                    <td style={{ padding: '10px 6px' }}>
                      {u.normalized === 'omg' ? (
                        <span style={{ color: 'var(--muted)' }}>—</span>
                      ) : (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={u.blocked}
                            disabled={adminBusy}
                            onChange={e => toggleBlock(u.normalized, e.target.checked)}
                          />
                          חסום
                        </label>
                      )}
                    </td>
                    <td style={{ padding: '10px 6px' }}>
                      {u.normalized === 'omg' ? (
                        <span style={{ color: 'var(--muted)' }}>—</span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <textarea
                            value={noteDrafts[u.normalized] ?? ''}
                            onChange={e => setNoteDrafts(d => ({ ...d, [u.normalized]: e.target.value.slice(0, 500) }))}
                            rows={2}
                            maxLength={500}
                            style={{
                              width: '100%',
                              padding: 8,
                              borderRadius: 8,
                              border: '1px solid rgba(255,255,255,0.12)',
                              background: 'rgba(0,0,0,0.35)',
                              color: 'var(--text)',
                              resize: 'vertical',
                              boxSizing: 'border-box',
                            }}
                          />
                          <button
                            type="button"
                            disabled={adminBusy}
                            onClick={() => saveNote(u.normalized)}
                            style={{
                              alignSelf: 'flex-start',
                              padding: '6px 12px',
                              borderRadius: 8,
                              fontWeight: 700,
                              border: 'none',
                              cursor: adminBusy ? 'not-allowed' : 'pointer',
                              background: 'rgba(99,102,241,0.35)',
                              color: 'var(--text)',
                            }}
                          >
                            שמירת הערה
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!adminUsers.length && !adminBusy ? (
            <p style={{ ...pStyle, marginTop: 12 }}>אין רשומים להצגה או טרם נטען.</p>
          ) : null}
        </section>
      )}
    </div>
  );
}

/** תקנון גנרי ותמציתי — כנהוג באפליקציות */
function TermsContent() {
  const blockStyle = { marginBottom: 22 };
  const hStyle = {
    fontSize: '1rem',
    fontWeight: 800,
    color: 'var(--text)',
    marginBottom: 10,
    letterSpacing: '0.02em',
  };
  const pStyle = {
    color: 'var(--text-secondary)',
    lineHeight: 1.75,
    fontSize: '0.95rem',
    margin: 0,
  };

  return (
    <div style={{ marginBottom: 8 }}>
      <p style={{ ...pStyle, marginBottom: 20 }}>
        האפליקציה מופעלת בידי <strong style={{ color: 'var(--text)' }}>חברת oh my</strong> — מותג הפועל במספר תחומים.
        השימוש בשירות מהווה הסכמה לתקנון זה, כפי שמקובל בשירותי אינטרנט ואפליקציות.
      </p>

      <section style={blockStyle}>
        <h2 style={hStyle}>שירות ושינויים</h2>
        <p style={pStyle}>
          השירות ניתן כמות שהוא («As Is»). אנו רשאים לעדכן, להשעות או להפסיק פיצ׳רים או את השירות כולו, מבלי להתחייב להודעה מוקדמת,
          בכפוף לדין החל.
        </p>
      </section>

      <section style={blockStyle}>
        <h2 style={hStyle}>התנהגות ותוכן</h2>
        <p style={pStyle}>
          חובה לשמור על דיון מכבד, ללא הטרדה, הסתה, תוכן בלתי חוקי או פוגעני.
          אנו רשאים להסיר תוכן או לחסום גישה במקרה של הפרה — לפי שיקול דעתנו ובהתאם לצורך.
        </p>
      </section>

      <section style={blockStyle}>
        <h2 style={hStyle}>מנהל האתר (OMG)</h2>
        <p style={pStyle}>
          מפעיל השירות פועל בין היתר באמצעות חשבון מנהל המסומן כ־<strong style={{ color: 'var(--text)' }}>OMG</strong>.
          למנהל האתר יש את מלוא הסמכויות הנדרשות לשמירה על השירות והקהילה, לרבות צפייה ברשימת הנרשמים, חסימת גישה למשתמשים,
          הסרת תוכן, מתן אזהרות והגבלת שימוש — במיוחד כאשר נחשדת הפרה של תקנון זה, של כללי הפורום, של תקנות לשון הרע החלות בישראל,
          או של כל דין אחר. המנהל רשאי גם לפנות או לדווח לגורמים רלוונטיים, ובכלל זה לרשויות מוסמכות, כאשר הדבר מוצדק לפי נסיבות העניין ולפי דין.
        </p>
      </section>

      <section style={blockStyle}>
        <h2 style={hStyle}>אחריות</h2>
        <p style={pStyle}>
          השימוש באפליקציה הוא באחריותך בלבד. אין אחריות לתוצאות דיונים, דיוק מידע או זמינות רציפה.
          לא נהיה אחראים לנזק ישיר או עקיף הנובע מהשימוש, במידה המרבית המותרת בחוק.
        </p>
      </section>

      <section style={blockStyle}>
        <h2 style={hStyle}>קניין רוחני</h2>
        <p style={pStyle}>
          זכויות במיתוג, בעיצוב ובתכנים של האפליקציה שמורות לחברת oh my או לבעלי הרישיון שלה.
          תוכן שתפרסם נשאר בבעלותך, אך אתה מעניק לנו רישיון מוגבל להציגו ולהפעילו במסגרת השירות.
        </p>
      </section>

      <section style={blockStyle}>
        <h2 style={hStyle}>פרטיות (תקציר)</h2>
        <p style={pStyle}>
          אנו מטפלים במידע בהתאם למדיניות הפרטיות של השירות. השימוש מהווה גם הסכמה לעיבוד נתונים הנדרש להפעלת האפליקציה.
        </p>
      </section>

      <section style={blockStyle}>
        <h2 style={hStyle}>עדכון התקנון</h2>
        <p style={pStyle}>
          רשאים לעדכן תקנון זה מעת לעת. המשך שימוש לאחר פרסום עדכון ייחשב הסכמה לנוסח המעודכן, אלא אם נדרש אחרת לפי דין.
        </p>
      </section>
    </div>
  );
}

export default function StaticInfoPage({ pageId }) {
  const navigate = useNavigate();
  const c = PAGES[pageId] || PAGES.contact;
  const isTerms = pageId === 'terms';

  return (
    <div className="page page-no-nav">
      <div className="container" style={{ maxWidth: 640 }}>
        <p style={{ marginBottom: 20 }}>
          <button
            type="button"
            className="ui-back-button"
            onClick={() => navigate('/')}
          >
            ← חזרה
          </button>
        </p>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 16, letterSpacing: '0.02em' }}>
          {isTerms ? 'תקנון שימוש' : c.title}
        </h1>
        {isTerms ? <TermsContent /> : <ContactContent />}
        <QuickNavInlineLinks style={{ marginTop: 28 }} />
      </div>
    </div>
  );
}
