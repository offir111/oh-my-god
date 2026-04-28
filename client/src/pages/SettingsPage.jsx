import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore.js';
import {
  loadPreferences,
  savePreferences,
  applyPreferencesToDocument,
  DEFAULT_PREFERENCES,
} from '../lib/appPreferences.js';

function ToggleRow({ id, label, description, checked, onChange, disabled }) {
  return (
    <label
      htmlFor={id}
      className="settings-row"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
        padding: '16px 18px',
        borderRadius: 14,
        border: '1px solid var(--border)',
        background: 'rgba(255,255,255,0.03)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', marginBottom: 4 }}>{label}</span>
        {description && (
          <span style={{ display: 'block', fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.45 }}>{description}</span>
        )}
      </span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
        className="settings-toggle"
        style={{ width: 22, height: 22, flexShrink: 0, marginTop: 2, accentColor: 'var(--accent)' }}
      />
    </label>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const user = useAppStore(s => s.user);
  const home = user ? '/lobby' : '/';
  const [prefs, setPrefs] = useState(() => loadPreferences());

  useEffect(() => {
    applyPreferencesToDocument(prefs);
    savePreferences(prefs);
  }, [prefs]);

  function patch(partial) {
    setPrefs(prev => ({ ...prev, ...partial }));
  }

  function resetAll() {
    setPrefs({ ...DEFAULT_PREFERENCES });
  }

  return (
    <div className="page page-no-nav">
      <style>{`
        .settings-page h2 {
          font-size: 0.78rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--muted);
          margin: 28px 0 12px;
        }
        .settings-page h2:first-of-type { margin-top: 8px; }
        .settings-seg {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding: 4px 0 8px;
        }
        .settings-seg button {
          flex: 1;
          min-width: 88px;
          padding: 10px 14px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.04);
          color: var(--text-secondary);
          font-weight: 700;
          font-size: 0.88rem;
          font-family: var(--font-sans);
          transition: background 0.15s, border-color 0.15s, color 0.15s;
        }
        .settings-seg button[aria-pressed="true"] {
          border-color: var(--accent);
          background: var(--accent-soft);
          color: var(--text);
        }
        .settings-seg button:hover:not([aria-pressed="true"]) {
          background: rgba(255,255,255,0.08);
          color: var(--text);
        }
      `}</style>

      <div className="container settings-page" style={{ maxWidth: 520, paddingBottom: 40 }}>
        <p style={{ marginBottom: 20 }}>
          <button type="button" className="ui-back-button" onClick={() => navigate(-1)}>
            ← חזרה
          </button>
        </p>

        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 8, letterSpacing: '0.02em' }}>הגדרות</h1>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 8, fontSize: '0.95rem' }}>
          התאמות נפוצות לנוחות, נגישות ומראה. השינויים נשמרים במכשיר זה.
        </p>

        <h2>נגישות</h2>
        <ToggleRow
          id="pref-motion"
          label="הפחתת תנועה ואנימציה"
          description="מקצר מעברים ומבטל אנימציות רוב הזמן — מומלץ לרגישות לתנועה או למכשירים חלשים."
          checked={prefs.reduceMotion}
          onChange={v => patch({ reduceMotion: v })}
        />

        <h2>תצוגה</h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: 8 }}>גודל טקסט בממשק</p>
        <div className="settings-seg" role="group" aria-label="גודל טקסט">
          {[
            { id: 'normal', label: 'רגיל' },
            { id: 'large', label: 'גדול' },
            { id: 'xlarge', label: 'גדול מאוד' },
          ].map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-pressed={prefs.fontScale === id}
              onClick={() => patch({ fontScale: id })}
            >
              {label}
            </button>
          ))}
        </div>

        <ToggleRow
          id="pref-calm"
          label="רקע נקי יותר"
          description="מחליש גרדיאנטים ברקע לשקט ויזואלי ולקריאות טובה יותר."
          checked={prefs.calmBackground}
          onChange={v => patch({ calmBackground: v })}
        />

        <h2>סאונד</h2>
        <ToggleRow
          id="pref-sound"
          label="צלילי ממשק (כשיהיו זמינים)"
          description="כשיופעלו אפקטים קוליים קלים בפעולות — ההעדפה כבר נשמרת."
          checked={prefs.uiSounds}
          onChange={v => patch({ uiSounds: v })}
        />

        <h2>איפוס</h2>
        <button type="button" className="btn btn-ghost" onClick={resetAll} style={{ marginTop: 4 }}>
          איפוס כל ההגדרות לברירת מחדל
        </button>

        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: 32 }}>
          <Link to={home} style={{ color: 'var(--accent)', fontWeight: 600 }}>מעבר ל{user ? 'לובי' : 'דף הבית'}</Link>
          {' · '}
          <Link to="/terms" style={{ color: 'var(--muted)' }}>תקנון</Link>
          {' · '}
          <Link to="/contact" style={{ color: 'var(--muted)' }}>צור קשר</Link>
        </p>
      </div>
    </div>
  );
}
