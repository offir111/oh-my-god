import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore.js';

const SPECIAL_RABBIS = ['הרב מאיר', 'הרב שלמה', 'הרב יצחק'];
const SPECIAL_SCIENTISTS = ['פרופ׳ דניאל', 'פרופ׳ רחל', 'פרופ׳ אמיר'];
const ALL_SPECIAL = [...SPECIAL_RABBIS, ...SPECIAL_SCIENTISTS];

const INITIAL_DATA = {
  'קיום האלוהים': {
    pro: [
      { text: 'כל דבר שקיים חייב להיות לו סיבה — היקום קיים, אז חייב להיות לו בורא (הוכחת הסיבתיות).', author: 'מסורת פילוסופית' },
      { text: 'היקום מכוון בדיוק כדי לאפשר חיים — קבועי הטבע מדויקים להפליא. הסתברות אפסית לאקראיות (Fine-Tuning).', author: 'מדע ואמונה' },
      { text: 'המורכבות הבלתי מצמצמת של התא החי — מנגנונים שלא יכולים להתפתח בשלבים כי כל שלב בפני עצמו אינו פונקציונלי.', author: 'מיכאל ביהי' },
      { text: 'קיום המוסר האובייקטיבי מחייב מקור עליון — ללא אלוהים, אין בסיס אובייקטיבי לטוב ורע.', author: 'ויליאם קרייג' },
      { text: 'חוויות רוחניות ועדויות אישיות של מיליארדי בני אדם לאורך ההיסטוריה — עדות מצטברת שקשה להתעלם ממנה.', author: 'מחקר פנומנולוגי' },
      { text: 'הוכחה האונטולוגית: האל הוא הישות השלמה ביותר שניתן לחשוב עליה — ובהכרח קיים, כי קיום הוא מתכונות השלמות.', author: 'אנסלם מקנטרברי' },
      { text: 'תחיית המתים של ישוע — מאות עדים, עובדה היסטורית שאין לה הסבר טבעי משכנע.', author: 'מחקר היסטורי' },
      { text: 'הנבואות המדויקות בתנ״ך — פרטים שנכתבו מאות שנים לפני התרחשותם ואומתו היסטורית.', author: 'מסורת יהודית' },
    ],
    con: [
      { text: 'אם כל דבר צריך סיבה — מי ברא את האלוהים? הטיעון מוביל לנסיגה אינסופית ואינו פותר דבר.', author: 'ברטרנד ראסל' },
      { text: 'בעיית הרוע: אם האל כל יכול, כל טוב וכל יודע — מדוע קיים סבל, מחלות ורצח ילדים תמימים?', author: 'דייוויד יום' },
      { text: 'הדת היא המצאה אנושית — כל תרבות יצרה אלים בצלם עצמה, המשקפים את ערכיה ופחדיה.', author: 'לודוויג פוירבך' },
      { text: 'מוסר קיים גם ללא אלוהים — אבולוציה הולידה אמפתיה ושיתוף פעולה כאסטרטגיה הישרדותית.', author: 'פרנס דה ואל' },
      { text: 'אם האל בלתי ניתן לזיהוי בניסוי — הוא מחוץ לתחום המדע, ועל כן אין ראיות אמפיריות לקיומו.', author: 'קארל פופר' },
      { text: 'הנוירולוגיה מסבירה חוויות רוחניות — גירוי אזורים מסוימים במוח מחולל חוויות "מיסטיות" זהות.', author: 'מחקר נוירולוגי' },
    ],
  },
  'מקור היקום': {
    pro: [
      { text: 'המפץ הגדול מחייב "לפני" — יש רגע אפס, ומה שהיה לפניו? המדע לא יכול לענות. הדת עונה: בורא.', author: 'ויליאם קרייג' },
      { text: 'חוקי הפיזיקה עצמם — מאיפה הגיעו? מישהו צריך היה "להתקין" אותם. הם לא יצרו את עצמם.', author: 'פיזיקת מכניקת קוונטים' },
      { text: 'הקבוע הקוסמולוגי מדויק ב-120 מקומות אחרי הנקודה — סטייה קלה הייתה מונעת היווצרות גלקסיות וכוכבים.', author: 'פיזיקה תיאורטית' },
      { text: '"מאין חוקי הטבע ומאין החומר הראשוני?" — שאלות שמדע לא יענה לעולם ומשאירות מקום לבורא.', author: 'פילוסופיה של מדע' },
    ],
    con: [
      { text: 'תיאוריית המולטיוורס — יקומים רבים קיימים, ואנחנו חיים ביקום שבו הקבועים מתאימים לחיים. ברירה טבעית של יקומים.', author: 'מקס טגמרק' },
      { text: 'מכניקת הקוונטים מאפשרת "בריאה יש מאין" — חלקיקים קיימים ונעלמים ללא סיבה. המפץ הגדול לא מחייב בורא.', author: 'סטיבן הוקינג' },
      { text: 'פיזיקת הזמן — לפני המפץ הגדול לא היה זמן. שאלת "מה היה לפניו" חסרת משמעות, כמו "מה צפונה מהקוטב הצפוני".', author: 'סטיבן הוקינג' },
      { text: 'ריבוי יקומים (Multiverse) — אם יש אינסוף יקומים, חייב להיות אחד עם הקבועים שלנו. לא נדרש תכנון.', author: 'בריאן גרין' },
    ],
  },
  'אבולוציה': {
    pro: [
      { text: 'פיצוץ הקמבריון — מינים רבים הופיעו בבת אחת לפני 540 מיליון שנה, ללא אבות משותפים מוכחים. סותר אבולוציה הדרגתית.', author: 'סטיבן גולד' },
      { text: 'מורכבות הביוכימיה — מנגנון הדם הקרישי, העין, הציוט — מערכות שלא יכלו להתפתח בשלבים כי פגומות הן לא פונקציונליות.', author: 'מיכאל ביהי' },
      { text: 'היעדר חוליות ביניים — חרף מיליוני מאובנים שנמצאו, חוליות מעבר בין מינים עיקריים כמעט אינן קיימות.', author: 'ביקורת מדעית' },
      { text: 'אבוגנזה — אבולוציה לא מסבירה את ראשית החיים. מהדומם לחי — פער עצום שמדע טרם גישר עליו.', author: 'פילוסופיה של ביולוגיה' },
    ],
    con: [
      { text: '99% מה-DNA של האדם והשימפנזה זהה — ראיה גנטית מובהקת לאב משותף לפני כ-6 מיליון שנה.', author: 'פרויקט הגנום האנושי' },
      { text: 'רטרו-וירוסים משותפים — אותם וירוסים שהשתלבו בדיוק באותם מקומות ב-DNA של אדם ושימפנזה. ראיה חותכת לאב משותף.', author: 'ויירולוגיה אבולוציונית' },
      { text: 'עשרות אלפי מאובנים — כולל Tiktaalik, Archaeopteryx, Homo Habilis — מראים מעבר הדרגתי בין מינים.', author: 'פלאונטולוגיה' },
      { text: 'אבולוציה נצפתה בזמן אמת — חיידקים מפתחים עמידות לאנטיביוטיקה, גפינים גדלים באיים מבודדים, פרחים משתנים.', author: 'ביולוגיה ניסויית' },
      { text: 'האיברים הוסטיגיאליים — שרידי איברים שאיבדו תפקוד (זנב האדם, הנחיריים בלווייתן) מוכיחים אבולוציה מאבות קדמונים.', author: 'אנטומיה השוואתית' },
    ],
  },
  'גיל העולם': {
    pro: [
      { text: 'על פי התנ״ך, גיל העולם כ-5784 שנה (תשפ״ד). ספירת הדורות ב"בראשית" מדויקת ועקבית לאורך הדורות.', author: 'מסורת יהודית' },
      { text: 'שגיאות בתארוך פחמן 14 — השיטה מניחה הנחות על ריכוז פחמן קבוע בעבר, מה שנתקף על ידי חוקרים שמרנים.', author: 'ביקורת מדעית' },
      { text: 'הלם מהתאריכים: מאובנים "בני מיליוני שנים" שנמצאו בשכבות גיאולוגיות "צעירות" — מעיד על בעיות בשיטות התארוך.', author: 'קריאייניסטים' },
    ],
    con: [
      { text: 'תארוך רדיומטרי (פחמן-14, אורניום-עופרת, אשלגן-ארגון) — שלוש שיטות עצמאיות מראות גיל כדור הארץ 4.54 מיליארד שנה.', author: 'גיאולוגיה וגרעינית' },
      { text: 'קמעות אור מגלקסיות רחוקות — אור שנסע מיליארדי שנות אור מוכיח שהיקום בן לפחות 13.8 מיליארד שנה.', author: 'אסטרונומיה' },
      { text: 'שכבות גיאולוגיות — קצב שקיעת סלעים נמדד ומחושב. הרי שכבות האנחה, הגרנד קניון — עשרות מיליוני שנים.', author: 'גיאולוגיה' },
      { text: 'טבעות עצים (Dendrochronology) — עצים חיים ומאובנים נותנים שרשרת רציפה של למעלה מ-12,000 שנה.', author: 'דנדרוכרונולוגיה' },
    ],
  },
  'ניסים ומוסר': {
    pro: [
      { text: 'קריעת ים סוף — עדות של מיליוני בני ישראל, מאורע שנשמר בזיכרון הלאומי דורות רבים ולא ניתן להסביר טבעית.', author: 'מסורת יהודית' },
      { text: 'הרפואה מכירה בתופעות ריפוי בלתי מוסברות (Spontaneous Remission) — ייתכן שחלקם בזכות תפילה ואמונה.', author: 'מחקר רפואי' },
      { text: 'ניסיון ספי-המוות (NDE) — מיליוני אנשים מתארים חוויות זהות שאין להן הסבר נוירולוגי שלם.', author: 'מחקר של ד"ר אבן אלכסנדר' },
      { text: 'ללא האל — מוסר הוא יחסי וסובייקטיבי. המאה ה-20 הוכיחה לאן מגיע אתאיזם פוליטי: סטלין, פול פוט, 100 מיליון קורבן.', author: 'ביקורת היסטורית' },
    ],
    con: [
      { text: 'אף ניס לא תועד ואומת בתנאים מבוקרים מדעית. כל "ניס" מוסבר בדיעבד על ידי טבע, אשליה, או אפקט פלסבו.', author: 'ג׳יימס ראנדי' },
      { text: 'מוסר אבולוציוני — אמפתיה ושיתוף פעולה הם כלי הישרדות. פרימטים מגלים התנהגות מוסרית ללא דת.', author: 'פרנס דה ואל' },
      { text: 'פשעים בשם הדת — אינקוויזיציה, ג׳יהאד, מלחמות דת. הדת שימשה כלי לגיטימציה לאלימות יותר מכל אידיאולוגיה.', author: 'היסטוריה של הדת' },
      { text: 'NDE מוסבר נוירולוגית — חסך חמצן, שחרור DMT טבעי במוח, ודפוסי תקשורת שיוריים הפוכים.', author: 'נוירולוגיה' },
    ],
  },
};

const STORAGE_KEY = 'omg_arguments';

function loadArguments() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
}

function saveArguments(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export default function ArgumentsPage() {
  const user = useAppStore(s => s.user);
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState(Object.keys(INITIAL_DATA)[0]);
  const [customArgs, setCustomArgs] = useState(loadArguments);
  const [newPro, setNewPro] = useState('');
  const [newCon, setNewCon] = useState('');

  const isSpecial = ALL_SPECIAL.includes(user?.username);
  const isRabbi = SPECIAL_RABBIS.includes(user?.username);
  const isScientist = SPECIAL_SCIENTISTS.includes(user?.username);

  function getArgs(category, side) {
    const base = INITIAL_DATA[category]?.[side] || [];
    const custom = customArgs[category]?.[side] || [];
    return [...base, ...custom];
  }

  function addArg(side) {
    const text = side === 'pro' ? newPro.trim() : newCon.trim();
    if (!text) return;
    const updated = {
      ...customArgs,
      [activeCategory]: {
        pro: customArgs[activeCategory]?.pro || [],
        con: customArgs[activeCategory]?.con || [],
        [side]: [...(customArgs[activeCategory]?.[side] || []), { text, author: user.username }],
      },
    };
    setCustomArgs(updated);
    saveArguments(updated);
    if (side === 'pro') setNewPro('');
    else setNewCon('');
  }

  const categories = Object.keys(INITIAL_DATA);

  return (
    <>
      <style>{`
        .args-page {
          min-height: calc(100vh - 52px);
          background: transparent;
          color: var(--text);
          direction: rtl;
          padding: 0 0 48px;
        }
        .args-header {
          position: relative;
          text-align: center;
          padding: 28px 16px 22px;
          border-bottom: 1px solid var(--border);
          background: linear-gradient(180deg, rgba(255,255,255,0.04), transparent);
        }
        .args-header h1 {
          font-size: clamp(1.45rem, 5vw, 2.05rem);
          font-weight: 900;
          margin-bottom: 8px;
          letter-spacing: 0.02em;
        }
        .args-header p {
          color: var(--muted);
          font-size: 0.9rem;
          max-width: 420px;
          margin: 0 auto;
          line-height: 1.5;
        }
        .args-back {
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
          transition: background 0.2s, color 0.2s, border-color 0.2s;
        }
        .args-back:hover {
          color: var(--text);
          background: rgba(255,255,255,0.1);
          border-color: var(--border-strong);
        }
        .args-cats {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: 16px 16px;
          border-bottom: 1px solid var(--border);
          scrollbar-width: none;
        }
        .args-cats::-webkit-scrollbar { display: none; }
        .args-cat-btn {
          white-space: nowrap;
          padding: 9px 18px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.04);
          color: var(--muted);
          font-size: 0.84rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s, color 0.2s, border-color 0.2s, transform 0.12s;
        }
        .args-cat-btn:hover {
          color: var(--text);
          background: rgba(255,255,255,0.08);
        }
        .args-cat-btn.active {
          background: linear-gradient(145deg, #fff, #d8d8e4);
          color: #0a0a10;
          border-color: rgba(255,255,255,0.4);
          font-weight: 800;
          box-shadow: 0 6px 24px rgba(255,255,255,0.1);
        }
        .args-columns {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0;
          max-width: 960px;
          margin: 0 auto;
        }
        .args-col {
          padding: 20px 16px;
          border-left: 1px solid var(--border);
        }
        .args-col:first-child { border-left: none; }
        .args-col-title {
          font-size: 0.95rem;
          font-weight: 900;
          text-align: center;
          padding: 12px 14px;
          border-radius: 14px;
          margin-bottom: 16px;
          letter-spacing: 0.03em;
        }
        .col-pro .args-col-title {
          background: linear-gradient(165deg, rgba(229,57,53,0.25), rgba(92,16,16,0.9));
          color: #ffcdd2;
          border: 1px solid rgba(229,57,53,0.45);
        }
        .col-con .args-col-title {
          background: linear-gradient(165deg, rgba(0,200,83,0.2), rgba(0,61,26,0.92));
          color: #b9f6ca;
          border: 1px solid rgba(0,200,83,0.4);
        }
        .arg-card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 14px 16px;
          margin-bottom: 12px;
          font-size: 0.88rem;
          line-height: 1.6;
          box-shadow: var(--shadow-xs);
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .arg-card:hover {
          border-color: var(--border-strong);
          box-shadow: var(--shadow-sm);
        }
        .arg-card-author {
          margin-top: 10px;
          font-size: 0.74rem;
          color: var(--muted);
          text-align: left;
          font-weight: 600;
        }
        .args-special {
          margin-top: 22px;
          padding-top: 16px;
          border-top: 1px dashed var(--border-strong);
        }
        .args-special-title {
          font-size: 0.78rem;
          color: var(--muted);
          margin-bottom: 12px;
          text-align: center;
          font-weight: 700;
        }
        .args-add-input {
          width: 100%;
          background: var(--card2);
          border: 1px solid var(--border-strong);
          border-radius: 12px;
          color: var(--text);
          padding: 12px 14px;
          font-size: 0.86rem;
          direction: rtl;
          resize: vertical;
          min-height: 72px;
          box-sizing: border-box;
        }
        .args-add-btn {
          margin-top: 10px;
          width: 100%;
          padding: 11px;
          border-radius: 12px;
          border: none;
          font-weight: 800;
          font-size: 0.86rem;
          cursor: pointer;
          transition: filter 0.15s, transform 0.12s;
        }
        .args-add-btn:active { transform: scale(0.98); }
        .btn-pro {
          background: linear-gradient(180deg, #ef5350, var(--believer));
          color: #fff;
          box-shadow: 0 0 20px var(--believer-glow);
        }
        .btn-con {
          background: linear-gradient(180deg, #69f0ae, var(--atheist));
          color: #031a0c;
          box-shadow: 0 0 20px var(--atheist-glow);
        }
        .special-badge {
          display: inline-block;
          font-size: 0.65rem;
          padding: 3px 9px;
          border-radius: 8px;
          margin-right: 6px;
          font-weight: 800;
        }
        .badge-rabbi { background: rgba(229,57,53,0.25); color: #ffcdd2; border: 1px solid rgba(229,57,53,0.35); }
        .badge-scientist { background: rgba(99,102,241,0.2); color: #c7d2fe; border: 1px solid rgba(99,102,241,0.35); }
        .editors-section {
          max-width: 960px;
          margin: 36px auto 0;
          padding: 24px 16px;
          border-top: 1px solid var(--border);
        }
        .editors-title {
          text-align: center;
          color: var(--muted);
          font-size: 0.84rem;
          margin-bottom: 18px;
          font-weight: 700;
          letter-spacing: 0.04em;
        }
        .editors-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        .editor-card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 16px;
          text-align: center;
          font-size: 0.84rem;
          box-shadow: var(--shadow-xs);
        }
        .editor-card .name { font-weight: 800; margin-bottom: 6px; }
        .editor-card .role { color: var(--muted); font-size: 0.76rem; line-height: 1.4; }
        @media (max-width: 560px) {
          .args-back { position: static; margin: 0 auto 12px; display: block; }
          .args-columns { grid-template-columns: 1fr; }
          .args-col { border-left: none; border-bottom: 1px solid var(--border); }
          .args-col:last-child { border-bottom: none; }
          .editors-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="args-page">
        <div className="args-header">
          <button className="args-back" onClick={() => navigate(-1)}>← חזרה</button>
          <h1>⚖️ בעד ונגד</h1>
          <p>ויקיפדיה של טענות — אמונה, מדע, ומה שביניהם</p>
        </div>

        <div className="args-cats">
          {categories.map(cat => (
            <button
              key={cat}
              className={`args-cat-btn${activeCategory === cat ? ' active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >{cat}</button>
          ))}
        </div>

        <div className="args-columns">
          {/* Pro — belief */}
          <div className="args-col col-pro">
            <div className="args-col-title">✡️ בעד אמונה</div>
            {getArgs(activeCategory, 'pro').map((arg, i) => (
              <div className="arg-card" key={i}>
                <div>{arg.text}</div>
                <div className="arg-card-author">
                  {SPECIAL_RABBIS.includes(arg.author) && <span className="special-badge badge-rabbi">🕍 רב</span>}
                  {SPECIAL_SCIENTISTS.includes(arg.author) && <span className="special-badge badge-scientist">🔬 מדען</span>}
                  {arg.author}
                </div>
              </div>
            ))}
            {isSpecial && (
              <div className="args-special">
                <div className="args-special-title">
                  {isRabbi ? '🕍 הוסף טענה בעד אמונה' : '🔬 הוסף טענה בעד אמונה'}
                </div>
                <textarea
                  className="args-add-input"
                  placeholder="כתוב את הטענה כאן..."
                  value={newPro}
                  onChange={e => setNewPro(e.target.value)}
                />
                <button className="args-add-btn btn-pro" onClick={() => addArg('pro')}>➕ הוסף</button>
              </div>
            )}
          </div>

          {/* Con — science */}
          <div className="args-col col-con">
            <div className="args-col-title">🔬 בעד מדע</div>
            {getArgs(activeCategory, 'con').map((arg, i) => (
              <div className="arg-card" key={i}>
                <div>{arg.text}</div>
                <div className="arg-card-author">
                  {SPECIAL_RABBIS.includes(arg.author) && <span className="special-badge badge-rabbi">🕍 רב</span>}
                  {SPECIAL_SCIENTISTS.includes(arg.author) && <span className="special-badge badge-scientist">🔬 מדען</span>}
                  {arg.author}
                </div>
              </div>
            ))}
            {isSpecial && (
              <div className="args-special">
                <div className="args-special-title">
                  {isScientist ? '🔬 הוסף טענה מדעית' : '🕍 הוסף טענה מדעית'}
                </div>
                <textarea
                  className="args-add-input"
                  placeholder="כתוב את הטענה כאן..."
                  value={newCon}
                  onChange={e => setNewCon(e.target.value)}
                />
                <button className="args-add-btn btn-con" onClick={() => addArg('con')}>➕ הוסף</button>
              </div>
            )}
          </div>
        </div>

        {/* Editors section */}
        <div className="editors-section">
          <div className="editors-title">עורכים מורשים — בלבד הם יכולים להוסיף טענות</div>
          <div className="editors-grid">
            {SPECIAL_RABBIS.map(name => (
              <div className="editor-card" key={name}>
                <div className="name">🕍 {name}</div>
                <div className="role">רב מוביל — עורך טענות אמונה</div>
              </div>
            ))}
            {SPECIAL_SCIENTISTS.map(name => (
              <div className="editor-card" key={name}>
                <div className="name">🔬 {name}</div>
                <div className="role">מדען מוביל — עורך טענות מדע</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
