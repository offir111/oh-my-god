import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FAITH_AD_SLOTS } from '../data/faithAdSlots.js';
import { FaithSubnavTabs } from '../components/faith/FaithSubnavTabs.jsx';

export default function FaithAdvertisersPage() {
  const navigate = useNavigate();

  return (
    <>
      <style>{`
        .faith-page {
          min-height: calc(100vh - var(--shell-top));
          background: transparent;
          color: var(--text);
          direction: rtl;
          padding: 0 0 52px;
        }
        .faith-header {
          position: relative;
          text-align: center;
          padding: 26px 16px 20px;
          border-bottom: 1px solid var(--border);
          background: linear-gradient(180deg, rgba(255,255,255,0.04), transparent);
        }
        .faith-header h1 {
          font-size: clamp(1.5rem, 5.2vw, 2.15rem);
          font-weight: 900;
          margin: 0 0 8px;
          letter-spacing: 0.02em;
        }
        .faith-header p {
          color: var(--muted);
          font-size: 0.88rem;
          max-width: 460px;
          margin: 0 auto;
          line-height: 1.55;
        }
        .faith-back {
          position: absolute;
          top: 16px;
          left: 12px;
          background: rgba(255,255,255,0.06);
          border: 1px solid var(--border);
          color: var(--muted);
          font-size: 0.82rem;
          font-weight: 600;
          padding: 8px 14px;
          border-radius: 10px;
          cursor: pointer;
        }
        .faith-back:hover {
          color: var(--text);
          background: rgba(255,255,255,0.1);
        }
        .faith-cats-wrap {
          position: relative;
          border-bottom: 1px solid var(--border);
        }
        .faith-cats {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          scroll-behavior: smooth;
          padding: 14px 16px 18px;
          scrollbar-width: none;
        }
        .faith-cats::-webkit-scrollbar { display: none; }
        .faith-cat-btn {
          white-space: nowrap;
          padding: 9px 18px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.04);
          color: rgba(245,247,255,0.86);
          font-size: 0.84rem;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.2s, color 0.2s, border-color 0.2s;
        }
        .faith-cat-btn:hover {
          color: #fff;
          background: rgba(255,255,255,0.08);
        }
        .faith-cat-btn.active {
          background: linear-gradient(145deg, #fff, #d8d8e4);
          color: #0a0a10;
          border-color: rgba(255,255,255,0.4);
          font-weight: 800;
        }
        .faith-ad-section {
          max-width: min(1100px, calc(100% - 24px));
          margin: 20px auto 0;
          padding: 0 12px;
        }
        .faith-ad-section-title {
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted);
          margin: 0 0 14px;
          text-align: center;
        }
        .faith-ad-banners {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
        }
        @media (min-width: 520px) {
          .faith-ad-banners {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (min-width: 900px) {
          .faith-ad-banners {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        .faith-ad-banner {
          border-radius: 14px;
          border: 1px solid var(--border);
          background: linear-gradient(145deg, rgba(255,255,255,0.07), rgba(0,0,0,0.22));
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-shadow: 0 8px 28px rgba(0,0,0,0.35);
        }
        .faith-ad-video {
          position: relative;
          aspect-ratio: 16 / 9;
          background:
            linear-gradient(180deg, rgba(244,63,94,0.14), transparent 45%),
            linear-gradient(0deg, rgba(16,185,129,0.1), transparent 40%),
            var(--card2, #1a1a24);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .faith-ad-play {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: rgba(255,255,255,0.12);
          border: 2px solid rgba(255,255,255,0.35);
          color: var(--text);
          font-size: 1.25rem;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 6px 24px rgba(0,0,0,0.4);
          pointer-events: none;
        }
        .faith-ad-badge {
          position: absolute;
          top: 8px;
          inset-inline-end: 8px;
          font-size: 0.62rem;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: rgba(15,15,20,0.95);
          background: var(--gold, #fbbf24);
          padding: 4px 8px;
          border-radius: 6px;
        }
        .faith-ad-body {
          padding: 12px 14px 14px;
          text-align: right;
        }
        .faith-ad-label {
          font-size: 1.02rem;
          font-weight: 900;
          margin: 0 0 4px;
          color: var(--text);
        }
        .faith-ad-hint {
          font-size: 0.8rem;
          color: var(--muted);
          line-height: 1.45;
          margin: 0 0 6px;
        }
        .faith-ad-disclaimer {
          font-size: 0.68rem;
          font-weight: 700;
          color: rgba(251, 191, 36, 0.85);
          margin: 0;
          letter-spacing: 0.03em;
        }
        @media (max-width: 560px) {
          .faith-back { position: static; display: block; margin: 0 auto 14px; }
        }
      `}</style>

      <div className="faith-page">
        <header className="faith-header">
          <button type="button" className="faith-back" onClick={() => navigate(-1)}>
            ← חזרה
          </button>
          <h1>מפרסמים</h1>
          <p>באנרי וידאו לדוגמה — בעלי מקצוע המעוניינים בפרסום</p>
        </header>

        <FaithSubnavTabs activeTab="ads" />

        <section className="faith-ad-section" aria-label="שטחי פרסום לדוגמה">
          <p className="faith-ad-section-title">דוגמאות לשטחי פרסום</p>
          <div className="faith-ad-banners">
            {FAITH_AD_SLOTS.map((slot) => (
              <article key={slot.id} className="faith-ad-banner">
                <div className="faith-ad-video" aria-hidden="true">
                  <span className="faith-ad-badge">דוגמה בלבד</span>
                  <span className="faith-ad-play" title="מיקום לסרטון">
                    ▶
                  </span>
                </div>
                <div className="faith-ad-body">
                  <h2 className="faith-ad-label">{slot.label}</h2>
                  <p className="faith-ad-hint">{slot.hint}</p>
                  <p className="faith-ad-disclaimer">
                    שטח פרסום לתשלום — יאוחד בעתיד עם מפרסמים אמיתיים
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
