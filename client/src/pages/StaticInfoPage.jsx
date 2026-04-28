import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore.js';

const PAGES = {
  contact: {
    title: 'צור קשר',
    text: 'לשאלות, הצעות ודיווח על תוכן: השתמשו בערוצי התמיכה שיפורסמו כאן.',
  },
};

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
  const user = useAppStore(s => s.user);
  const c = PAGES[pageId] || PAGES.contact;
  const home = user ? '/lobby' : '/';
  const isTerms = pageId === 'terms';

  return (
    <div className="page page-no-nav">
      <div className="container" style={{ maxWidth: 640 }}>
        <p style={{ marginBottom: 20 }}>
          <button
            type="button"
            className="ui-back-button"
            onClick={() => navigate(-1)}
          >
            ← חזרה
          </button>
        </p>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 16, letterSpacing: '0.02em' }}>
          {isTerms ? 'תקנון שימוש' : c.title}
        </h1>
        {isTerms ? <TermsContent /> : (
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.85, marginBottom: 24 }}>{c.text}</p>
        )}
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
          <Link to={home} style={{ color: 'var(--accent)', fontWeight: 600 }}>מעבר ל{user ? 'לובי' : 'דף הבית'}</Link>
          {' · '}
          <Link to="/settings" style={{ color: 'var(--muted)' }}>הגדרות</Link>
          {' · '}
          <Link to="/arguments" style={{ color: 'var(--muted)' }}>בעד ונגד</Link>
          {' · '}
          <Link to="/live-events" style={{ color: 'var(--muted)' }}>אירועים</Link>
        </p>
      </div>
    </div>
  );
}
