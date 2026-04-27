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
          background: #000;
          color: #fff;
          font-family: Arial, sans-serif;
          direction: rtl;
          padding: 0 0 40px;
        }
        .args-header {
          text-align: center;
          padding: 24px 16px 16px;
          border-bottom: 1px solid #222;
        }
        .args-header h1 {
          font-size: clamp(1.4rem, 5vw, 2rem);
          font-weight: 900;
          margin-bottom: 6px;
        }
        .args-header p {
          color: #888;
          font-size: 0.85rem;
        }
        .args-back {
          position: absolute;
          top: 60px; left: 14px;
          background: none;
          border: 1px solid #333;
          color: #aaa;
          font-size: 0.8rem;
          padding: 5px 12px;
          border-radius: 8px;
          cursor: pointer;
          font-family: Arial, sans-serif;
        }
        .args-cats {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: 14px 16px;
          border-bottom: 1px solid #1a1a1a;
          scrollbar-width: none;
        }
        .args-cats::-webkit-scrollbar { display: none; }
        .args-cat-btn {
          white-space: nowrap;
          padding: 7px 16px;
          border-radius: 20px;
          border: 1px solid #333;
          background: #111;
          color: #aaa;
          font-size: 0.82rem;
          cursor: pointer;
          font-family: Arial, sans-serif;
          transition: all 0.15s;
        }
        .args-cat-btn.active {
          background: #fff;
          color: #000;
          border-color: #fff;
          font-weight: 700;
        }
        .args-columns {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0;
          max-width: 900px;
          margin: 0 auto;
        }
        .args-col {
          padding: 16px 14px;
          border-left: 1px solid #1a1a1a;
        }
        .args-col:first-child { border-left: none; }
        .args-col-title {
          font-size: 1rem;
          font-weight: 900;
          text-align: center;
          padding: 10px;
          border-radius: 10px;
          margin-bottom: 14px;
        }
        .col-pro .args-col-title { background: #1a0000; color: #ff6666; border: 1px solid #440000; }
        .col-con .args-col-title { background: #001a08; color: #44ff88; border: 1px solid #004422; }
        .arg-card {
          background: #111;
          border: 1px solid #222;
          border-radius: 10px;
          padding: 12px 14px;
          margin-bottom: 10px;
          font-size: 0.85rem;
          line-height: 1.55;
        }
        .arg-card-author {
          margin-top: 8px;
          font-size: 0.72rem;
          color: #555;
          text-align: left;
        }
        .args-special {
          margin-top: 20px;
          padding-top: 14px;
          border-top: 1px dashed #2a2a2a;
        }
        .args-special-title {
          font-size: 0.75rem;
          color: #666;
          margin-bottom: 10px;
          text-align: center;
        }
        .args-add-input {
          width: 100%;
          background: #111;
          border: 1px solid #333;
          border-radius: 8px;
          color: #fff;
          padding: 10px 12px;
          font-size: 0.82rem;
          font-family: Arial, sans-serif;
          direction: rtl;
          resize: vertical;
          min-height: 64px;
          box-sizing: border-box;
        }
        .args-add-btn {
          margin-top: 8px;
          width: 100%;
          padding: 9px;
          border-radius: 8px;
          border: none;
          font-weight: 700;
          font-size: 0.82rem;
          cursor: pointer;
          font-family: Arial, sans-serif;
        }
        .btn-pro { background: #660000; color: #fff; }
        .btn-con { background: #004422; color: #fff; }
        .special-badge {
          display: inline-block;
          font-size: 0.65rem;
          padding: 2px 8px;
          border-radius: 10px;
          margin-right: 6px;
          font-weight: 700;
        }
        .badge-rabbi { background: #440000; color: #ff8888; }
        .badge-scientist { background: #002244; color: #88aaff; }
        .editors-section {
          max-width: 900px;
          margin: 30px auto 0;
          padding: 20px 16px;
          border-top: 1px solid #1a1a1a;
        }
        .editors-title {
          text-align: center;
          color: #555;
          font-size: 0.82rem;
          margin-bottom: 16px;
        }
        .editors-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .editor-card {
          background: #0d0d0d;
          border: 1px solid #222;
          border-radius: 10px;
          padding: 12px;
          text-align: center;
          font-size: 0.8rem;
        }
        .editor-card .name { font-weight: 700; margin-bottom: 4px; }
        .editor-card .role { color: #555; font-size: 0.72rem; }
        @media (max-width: 560px) {
          .args-columns { grid-template-columns: 1fr; }
          .col-pro { border-left: none; border-bottom: 1px solid #1a1a1a; }
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
