import React, { useState, useRef, useEffect } from 'react';
import { useTypewriter } from '../../hooks/useTypewriter.js';

const KABBALAH_BOOKS = [
  // ספרי יסוד
  { he: 'ספר יצירה', en: 'Sefer_Yetzirah', section: 'ספרי יסוד' },
  { he: 'בהיר', en: 'Bahir', section: 'ספרי יסוד' },

  // ספר הזוהר
  { he: 'זוהר — בראשית', en: 'Zohar.Bereshit', section: 'ספר הזוהר' },
  { he: 'זוהר — שמות', en: 'Zohar.Shemot', section: 'ספר הזוהר' },
  { he: 'זוהר — ויקרא', en: 'Zohar.Vayikra', section: 'ספר הזוהר' },
  { he: 'זוהר — במדבר', en: 'Zohar.Bamidbar', section: 'ספר הזוהר' },
  { he: 'זוהר — דברים', en: 'Zohar.Devarim', section: 'ספר הזוהר' },
  { he: 'זוהר — שיר השירים', en: 'Zohar.Shir_HaShirim', section: 'ספר הזוהר' },
  { he: 'זוהר חדש', en: 'Zohar_Chadash', section: 'ספר הזוהר' },

  // תניא וחסידות
  { he: 'תניא — ליקוטי אמרים', en: 'Tanya,_Part_I', section: 'חסידות' },
  { he: 'תניא — שער היחוד', en: 'Tanya,_Part_II', section: 'חסידות' },
  { he: 'תניא — אגרת התשובה', en: 'Tanya,_Part_III', section: 'חסידות' },
  { he: 'שערי קדושה', en: 'Shaarei_Kedushah', section: 'חסידות' },

  // קבלת האר״י
  { he: 'עץ חיים', en: 'Etz_Chaim', section: 'קבלת האר״י' },
  { he: 'שמונה שערים', en: 'Shemonah_Shearim', section: 'קבלת האר״י' },
];

const CHAPTER_COUNTS = {
  'Sefer_Yetzirah': 6,
  'Bahir': 12,
  'Zohar.Bereshit': 50,
  'Zohar.Shemot': 40,
  'Zohar.Vayikra': 30,
  'Zohar.Bamidbar': 36,
  'Zohar.Devarim': 34,
  'Zohar.Shir_HaShirim': 8,
  'Zohar_Chadash': 30,
  'Tanya,_Part_I': 53,
  'Tanya,_Part_II': 12,
  'Tanya,_Part_III': 12,
  'Shaarei_Kedushah': 16,
  'Etz_Chaim': 50,
  'Shemonah_Shearim': 30,
};

const SECTION_COLORS = {
  'ספרי יסוד': '#a78bfa',
  'ספר הזוהר': 'var(--gold, #fbbf24)',
  'חסידות': 'var(--accent, #38bdf8)',
  'קבלת האר״י': '#f472b6',
};

const QUICK_CHIPS = [
  'עשר ספירות',
  'עין סוף',
  'ספירת הכתר',
  'גלגול נשמות',
  'תיקון עולם',
  'קליפות',
  'צינצום',
  'אדם קדמון',
  'שכינה',
  'שמות האל',
];

const KABBALAH_HARDCODED = {
  'עשר ספירות': {
    explanation: 'עשר הספירות הן עשרת כלי הגילוי האלוהי בקבלה — הדרך שבה האין-סוף מתגלה ומנהיג את העולמות. הן אינן ישויות נפרדות אלא היבטים שונים של אחדות אלוהית אחת, כמו אור שעובר דרך פריזמה ומתפצל לצבעים.',
    results: [
      { ref: 'כתר — הרצון העליון', text: 'ספירת הכתר היא הראשונה והעליונה — הרצון הא-להי הקדמוני לפני כל מחשבה. נקראת גם "אין", "אין סוף" ו"רצון". היא גבוהה מדי מלהיתפס בשכל האנושי.', context: 'ראש עץ הספירות' },
      { ref: 'חכמה ובינה — מח ולב', text: 'חכמה (אבא) היא ניצוץ הרעיון הראשוני — "ברק" האינטואיציה. בינה (אמא) מרחיבה ומעבדת את הרעיון לכדי הבנה מלאה. ביחד הן "מוחין" — השכל העליון.', context: 'השלישייה העליונה' },
      { ref: 'חסד גבורה תפארת', text: 'חסד — אהבה ונתינה ללא גבול. גבורה — דין, גבול וצמצום. תפארת — הרמוניה ביניהם, יופי, לב. תפארת היא ספירת האמצע ומזוהה עם שם הוי"ה.', context: 'הספירות האמצעיות' },
      { ref: 'נצח הוד יסוד', text: 'נצח — נצחיות, ניצחון, רגש. הוד — הוד, הד, עניווה. יסוד — צינור ויסוד, מקשר עליון ותחתון, מזוהה עם ברית ויוסף הצדיק.', context: 'הספירות התחתונות' },
      { ref: 'מלכות — שכינה', text: 'מלכות היא הספירה האחרונה — נקודת המגע של האין-סוף עם עולמנו. מזוהה עם השכינה, כנסת ישראל ודוד המלך. היא "מקבלת" מכל הספירות ומגלה אותן לעולם.', context: 'ספירת המלכות' },
    ],
  },
  'עין סוף': {
    explanation: 'עין סוף (= "אין סוף") הוא שמו הקבלי של האל בהיותו נעלם לגמרי מכל השגה — לפני כל גילוי, לפני כל ספירה, לפני כל שם. האין-סוף מוחלט בפשטותו — אין בו ריבוי, שינוי, גבול או תוכן שניתן לתאר.',
    results: [
      { ref: 'לפני הבריאה', text: 'לפני הצמצום מילא האין-סוף את כל המציאות ללא מקום לשום דבר אחר. הבריאה התאפשרה רק דרך "הסתלקות" האין-סוף כדי לפנות מקום.', context: 'הבסיס הקוסמוגוני' },
      { ref: 'שלוש ה"אינים"', text: 'הקבלה מתארת שלוש רמות: אין (הפשוט המוחלט), אין-סוף (אינסופיות), אור אין-סוף (הקרינה הראשונה). אלו שלוש הדרגות שלפני הספירות.', context: 'ספר הזוהר וספר עץ חיים' },
      { ref: 'מדוע "אין"?', text: 'הנקודה הפרדוקסלית: האל נקרא "אין" לא כי אינו קיים — אלא כי ה"יש" האנושי אינו מסוגל לתפוס אותו. הוא "אין" ביחס לשכל שלנו, לא ביחס לאמת.', context: 'פרדוקס ה"אין"' },
    ],
  },
  'ספירת הכתר': {
    explanation: 'הכתר הוא הספירה הראשונה ועליית כל הספירות — נקודת המגע בין האין-סוף הנעלם לבין עולמות הגילוי. היא מכונה "אין", "לא מחשבה", "רצון" ו"תענוג עליון". כל הספירות מכוחה, כמו כתר שמעל הראש — חולש עליו אך אינו ממנו.',
    results: [
      { ref: 'כתר כרצון', text: 'הרצון הקדמוני של הבורא לברוא ולהיטיב — זהו תוכן ספירת הכתר. הוא קדם לחכמה ולבינה. הרב אשלג מכנה אותו "השתוקקות לתת".', context: 'בעל הסולם, עץ חיים' },
      { ref: 'כתר וכרובים', text: 'בית המקדש — כפורת הארון נשאה שני כרובים. חכמי הקבלה רואים בכרובים ייצוג של חכמה ובינה הנשקות מתחת לכתר — עולם האצילות מגולה בלב המקדש.', context: 'קבלה ומקדש' },
      { ref: 'כתר ואריך אנפין', text: 'בספרות הזוהר, פרצוף "אריך אנפין" (ארוך פנים — ממושך בסבלנות) הוא הביטוי של ספירת הכתר — הפרצוף האלוהי של הסבלנות והרחמים הגדולים.', context: 'זוהר, אידרא רבא' },
    ],
  },
  'גלגול נשמות': {
    explanation: 'גלגול נשמות (גלגול) הוא עקרון קבלי שלפיו הנשמה עוברת מגוף לגוף לאחר המוות — עד שהשלימה את תיקונה המלא. לא כל הנשמות מתגלגלות — רק אלו שלא מימשו את שליחותן, אך גם נשמות גדולות מתגלגלות מרצון לסייע לדורות.',
    results: [
      { ref: 'מקורות הגלגול', text: 'הרעיון אינו מופיע במפורש בתנ"ך, אך מיוחס לו בפרשנות קבלית. ספר "הגלגולים" של האר"י (מפי ר׳ חיים ויטאל) הוא המקור המפורט ביותר — מפרט גלגולי נשמות של מאות דמויות.', context: 'ספר הגלגולים — האר"י הקדוש' },
      { ref: 'גלגול ועיבור ועיבוד', text: 'גלגול — נשמה בגוף חדש. עיבור — נשמת צדיק מצטרפת לגוף קיים לסייע לאדם. איבה — נשמה שלילית המצטרפת להענשה. שלוש דרגות החיבורים הנשמתיים.', context: 'שער הגלגולים — האר"י' },
      { ref: 'ניצוצות נשמות', text: 'כל גוף עשוי להכיל חלקי נשמות שונים (ניצוצות) מגלגולים שונים. ייתכן שניצוץ קטן בלבד מגיע — ולא נשמה שלמה. רק ניתוח קבלי מעמיק חושף את הרכב הנשמה.', context: 'עץ חיים — האר"י הקדוש' },
    ],
  },
  'תיקון עולם': {
    explanation: 'תיקון עולם הוא אחד המושגים הנפוצים ביותר שיצאו מהקבלה לתרבות הכללית. בקבלה — עניינו "תיקון" השבירה הקוסמית שנוצרה בשבירת הכלים; כל מצווה ותפילה אוספת ניצוצות קדושה שפוזרו ומחזירה אותם לשורשם.',
    results: [
      { ref: 'שבירת הכלים — שורש הצורך לתיקון', text: 'לפי האר"י, בשלב מוקדם של הבריאה נשפע אור רב מדי לתוך "כלים" שלא יכלו להכילו — והם נשברו. ניצוצות קדושה נפלו לתוך "קליפות". תפקיד האדם לאסוף אותם.', context: 'עץ חיים — שבירת הכלים' },
      { ref: 'מצוות כתיקון', text: 'כל מצווה שאדם עושה "מעלה" ניצוץ קדושה מן הקליפות לקדושה. כל עברה "מורידה" ניצוץ לקליפות. לכן — לכל מצווה ועברה יש השפעה קוסמית ממשית.', context: 'תורת האר"י ותניא' },
      { ref: 'תיקון עולם בתפילה', text: 'נוסח "לתקן עולם במלכות שד"י" (מתוך תפילת "עלינו לשבח") — שמשמעותו בתפילה: ייחוד עולמות וגאולה. זהו תיקון הפנימי המוביל לתיקון החיצוני.', context: 'תפילת עלינו לשבח' },
    ],
  },
  'קליפות': {
    explanation: 'קליפות הן בקבלה כוחות הרשע, הטומאה והסטרא אחרא (הצד האחר). הן "קליפות" בכובד המשמעות — מחיצות המסתירות את האור האלוהי, כמו קליפת פרי המסתירה את תוכנו. אין הן ישויות עצמאיות — הן נבראו לצורך הבחירה החופשית.',
    results: [
      { ref: 'ארבע קליפות', text: 'הזוהר מתאר ארבע קליפות: שלוש הן "קליפות הטמאות" (רוח סערה, ענן גדול, אש מתלקחת — מיחזקאל א:ד), ורביעית — "קליפת נוגה" שבה יש גם ניצוצות קדושה.', context: 'זוהר, עץ חיים' },
      { ref: 'קליפות ויצר הרע', text: 'יצר הרע בקבלה אינו מקרה — הוא ניצב מהצד הנגדי כנגד כל ספירה. ל"חסד" יש קליפת "חסד דקליפה" (אהבה עצמית כפייתית). ל"גבורה" — אכזריות. הקליפות הן עיוות הספירות.', context: 'תניא — פרק א-ב' },
      { ref: 'תיקון הקליפות', text: 'על ידי מצוות ותורה — הניצוצות הכלואים בקליפות מתוקנים ועולים לקדושה. זהו "תיקון עולם". הגאולה השלמה תבוא כאשר כל הניצוצות יתוקנו.', context: 'תורת האר"י' },
    ],
  },
  'צינצום': {
    explanation: 'הצמצום (צינצום) הוא אחד הרעיונות הגדולים והפרדוקסליים ביותר בקבלה האריאנית. לפי האר"י, האין-סוף "צמצם" את עצמו — הסתלק ממרכז לצדדים — כדי לפנות "מקום" ריק (חלל) שבתוכו יתאפשר עולם נפרד. הצמצום הוא מעשה האהבה הקדמון.',
    results: [
      { ref: 'הצמצום — האר"י ור׳ חיים ויטאל', text: 'לפני הצמצום — האין-סוף מילא הכל. לאחר הצמצום — חלל עגול. לתוכו הוחדר "קו" של אור אין-סוף — ממנו הסתעפו הספירות. כל הבריאה היא בתוך אותו חלל.', context: 'עץ חיים, שער א' },
      { ref: 'צמצום כפשוטו או לא כפשוטו', text: 'מחלוקת גדולה: האם הצמצום היה "כפשוטו" — האל ממש הסתלק מאותו מקום? או "לא כפשוטו" — הצמצום היה רק "לגבינו", לא ביחס לאל עצמו? (שיטת הגר"א ובעל הסולם).', context: 'מחלוקת פילוסופית-קבלית' },
      { ref: 'צמצום ובחירה חופשית', text: 'הצמצום יצר "מקום" לאדם עם בחירה חופשית — כי אם אין-סוף מילא הכל, אין מקום לאחר. הסתלקות האין-סוף היא מה שאיפשר את קיום האדם כישות עצמאית הבוחרת.', context: 'תניא, שער היחוד והאמונה' },
    ],
  },
  'אדם קדמון': {
    explanation: 'אדם קדמון הוא הפרצוף הגבוה ביותר בקבלת האר"י — הביטוי הראשון של האור האלוהי לאחר הצמצום. הוא אינו אדם ביולוגי — הוא מבנה אלוהי ממנו מסתעפות כל הספירות ועולמות הבריאה. שמו נגזר מ"קדם" — קדמוני, ראשוני.',
    results: [
      { ref: 'אדם קדמון כ"גוף אלוהי"', text: 'בספרות האר"י, אדם קדמון מתואר במטפורת אנטרופומורפית: חלק ה"ראש" (כתר), ה"ידיים" (חסד וגבורה), ה"לב" (תפארת), ה"רגליים" (נצח והוד) — הגוף כמפה לאלוהות.', context: 'עץ חיים — שער אדם קדמון' },
      { ref: 'אדם קדמון ואדם הראשון', text: 'אדם קדמון שונה מאדם הראשון. אדם הראשון הוא האדם שנברא בגן עדן — בעל גוף ביולוגי. אדם קדמון הוא מעל אצילות, מעל כל העולמות — "אדם" שבדמיון אלוהי.', context: 'הבחנה קבלית בסיסית' },
      { ref: 'אורות אדם קדמון', text: 'מעיני, אוזני, אפו ופיו של "אדם קדמון" יצאו אורות — כל אחד יצר מערכות ספירות שונות. עיניים יצרו את "עולם הנקודים" שנשבר בשבירת הכלים.', context: 'עץ חיים — שבירת הכלים' },
    ],
  },
  'שכינה': {
    explanation: 'שכינה (שורש: שכן, לשכון) היא נוכחות האל בעולם — השכינה האלוהית השורה במקדש, בין ישראל, בכל מקום שיש בו קדושה. בקבלה, השכינה מזוהה עם ספירת המלכות — הביטוי האלוהי הנקבי המקבל מכל הספירות.',
    results: [
      { ref: 'שכינה בתנ"ך', text: '"וְשָׁכַנְתִּי בְּתוֹךְ בְּנֵי יִשְׂרָאֵל" (שמות כט:מה) — שורש הרעיון: האל שוכן בתוך עמו. "שְׁכִינַת כְּבוֹד ה׳ מָלְאָה אֶת הַמִּשְׁכָּן" (שמות מ:לד).', context: 'תנ"ך — בסיס הרעיון' },
      { ref: 'שכינה בגלות', text: 'חכמי התלמוד ואחריהם מקובלים לימדו שהשכינה גלתה עם ישראל לגלות — "בכל גלותם גלתי עמהם" (ברכות ג.). הגאולה היא גם שיבת השכינה למקומה.', context: 'תלמוד וזוהר' },
      { ref: 'שכינה כנוכחות נשית', text: 'בזוהר ובקבלה — השכינה היא ה"עטרת בעלה" (ספירת מלכות), הכלה המחכה לחתן (תפארת-זעיר אנפין). יחוד השכינה עם הקב"ה הוא יחוד הזכר והנקבה, ממנו יוצאות ברכות לעולמות.', context: 'זוהר ותניא' },
    ],
  },
  'שמות האל': {
    explanation: 'לפי הקבלה, לאל שמות רבים — וכל שם מבטא היבט שונה של ההתגלות האלוהית. שם הוי"ה (י-ה-ו-ה) הוא שם העצם — שם הרחמים. אלוהים — שם הדין. שד"י — שם ההגבלה. כל ספירה מזוהה עם שם אחד.',
    results: [
      { ref: 'שם הוי"ה — שם העצם', text: 'שם י-ה-ו-ה (מבוטא "אדוני" בקריאה) הוא "שם המפורש" — שם עצמות האל. ניקד האותיות: יוד=חכמה, הא=בינה, ו=תפארת (ו׳ ספירות), הא=מלכות. כל השם הוא עץ הספירות.', context: 'קבלת האר"י' },
      { ref: 'שם אלוהים — שם הדין', text: 'אלוהים מבטא את מידת הדין. גימטריה: אלהים = 86 = הטבע (86). לפי ספינוזה "Deus sive Natura" — אלוהים הוא הטבע. הזוהר: אלוהים = כינוי לשם הוי"ה מצד הדין.', context: 'זוהר, תניא, ספינוזה' },
      { ref: 'ע"ב שמות', text: 'שלושה פסוקים בשמות (יד:יט-כא) מכילים כל אחד 72 אותיות. מסדרים אותם לשורות ונוצרים 72 שמות של 3 אותיות — "ע"ב שמות" — שמות המלאכים ושמות האל השמושים בקמיעות ובמיסטיקה.', context: 'קבלה מעשית — ע"ב שמות' },
    ],
  },
};

function SkeletonLoader() {
  return (
    <div className="km-skeleton-wrap">
      <div className="km-skeleton km-skeleton-badge" />
      <div className="km-skeleton km-skeleton-line km-skeleton-line--80" />
      <div className="km-skeleton km-skeleton-line km-skeleton-line--100" />
      <div className="km-skeleton km-skeleton-line km-skeleton-line--90" />
      {[1, 2, 3].map(i => (
        <div key={i} className="km-skeleton-card">
          <div className="km-skeleton km-skeleton-line km-skeleton-line--50" style={{ marginBottom: 10 }} />
          <div className="km-skeleton km-skeleton-line km-skeleton-line--100" />
          <div className="km-skeleton km-skeleton-line km-skeleton-line--70" />
        </div>
      ))}
    </div>
  );
}

export function KabbalachPanel({ embedded = false, onClose }) {
  const [query, setQuery] = useState('');
  const [searchedQuery, setSearchedQuery] = useState('');
  const [groqData, setGroqData] = useState(null);
  const { displayed: typedExplanation, isDone: explanationDone } = useTypewriter(groqData?.explanation || '');
  const [loading, setLoading] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);
  const [chapter, setChapter] = useState(null);
  const [verses, setVerses] = useState(null);
  const [versesLoading, setVersesLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedRef, setCopiedRef] = useState(null);
  const searchRef = useRef();
  const answerPanelRef = useRef();

  useEffect(() => { searchRef.current?.focus(); }, []);

  useEffect(() => {
    if (groqData && answerPanelRef.current) {
      answerPanelRef.current.scrollTop = 0;
    }
  }, [groqData]);

  const bookQueryMatch = query.trim()
    ? KABBALAH_BOOKS.filter(b => b.he.includes(query) || b.section.includes(query))
    : KABBALAH_BOOKS;
  const filtered = bookQueryMatch.length > 0 ? bookQueryMatch : KABBALAH_BOOKS;
  const sections = [...new Set(filtered.map(b => b.section))];

  function closeAnswerPanel() {
    setGroqData(null);
    setError('');
  }

  async function loadChapter(book, ch) {
    setVersesLoading(true);
    setVerses(null);
    setChapter(ch);

    function extractStrings(val) {
      if (!val) return [];
      if (typeof val === 'string') return val.trim() ? [val] : [];
      if (Array.isArray(val)) return val.flatMap(extractStrings);
      if (typeof val === 'object') return extractStrings(Object.values(val));
      return [];
    }

    // Sefaria expects spaces, not underscores
    const sefariaBook = book.en.replace(/_/g, ' ');
    const ref = `${sefariaBook}.${ch}`;

    try {
      const BASE = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${BASE}/api/sefaria-text?ref=${encodeURIComponent(ref)}`);
      if (!res.ok) throw new Error('sefaria load failed');
      const data = await res.json();

      let heArr = extractStrings(data.he);
      if (!heArr.length) heArr = extractStrings(data.text);
      if (!heArr.length && Array.isArray(data.versions)) {
        for (const v of data.versions) {
          const t = extractStrings(v.text);
          if (t.length) { heArr = t; break; }
        }
      }
      setVerses(heArr);
    } catch {
      setVerses([]);
    }
    setVersesLoading(false);
  }

  async function handleSearch(q = query) {
    const trimmed = (q || query).trim();
    if (!trimmed) return;
    closeAnswerPanel();
    setSelectedBook(null);
    setChapter(null);
    setVerses(null);
    setSearchedQuery(trimmed);
    setLoading(true);
    try {
      const BASE = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${BASE}/api/kabbalah-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
      });
      if (!res.ok) throw new Error('kabbalah search failed');
      const data = await res.json();
      setGroqData(data);
    } catch {
      setError('לא ניתן להשלים את החיפוש. נסה שנית.');
    }
    setLoading(false);
  }

  function handleChipClick(chip) {
    setQuery(chip);
    if (KABBALAH_HARDCODED[chip]) {
      closeAnswerPanel();
      setSelectedBook(null);
      setChapter(null);
      setVerses(null);
      setSearchedQuery(chip);
      setGroqData(KABBALAH_HARDCODED[chip]);
      return;
    }
    handleSearch(chip);
  }

  function copyToClipboard(ref, text) {
    const toCopy = `${ref}\n${text}`;
    navigator.clipboard?.writeText(toCopy).then(() => {
      setCopiedRef(ref);
      setTimeout(() => setCopiedRef(null), 1800);
    });
  }

  const chapterCount = selectedBook ? (CHAPTER_COUNTS[selectedBook.en] ?? 20) : 0;
  const showAnswerPanel = (loading || groqData !== null || error) && !selectedBook;
  const showBookList = !selectedBook;
  const showChapter = selectedBook && chapter !== null;
  const showChapterPicker = selectedBook && chapter === null;

  return (
    <div className={embedded ? 'km-sheet km-sheet-embedded' : 'km-sheet'} role={embedded ? undefined : 'dialog'}>
      <style>{`
        .km-sheet {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--surface, #18181b);
          border-radius: 16px;
          overflow: hidden;
          font-family: inherit;
        }
        .km-sheet-embedded {
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.08);
        }
        .km-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          direction: rtl;
          flex-shrink: 0;
        }
        .km-title {
          font-size: 1rem;
          font-weight: 900;
          color: #a78bfa;
          letter-spacing: 0.02em;
        }
        .km-close {
          width: 30px; height: 30px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.06);
          color: var(--text-secondary, #b4b4c0);
          font-size: 0.85rem;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          font-family: inherit;
          transition: background 0.12s;
        }
        .km-close:hover { background: rgba(255,255,255,0.12); }
        .km-search {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          flex-shrink: 0;
          direction: rtl;
        }
        .km-search input {
          flex: 1;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 9px;
          padding: 9px 12px;
          color: var(--text, #f4f4f8);
          font-size: 0.87rem;
          font-family: inherit;
          direction: rtl;
          outline: none;
          transition: border-color 0.15s;
        }
        .km-search input:focus { border-color: rgba(167,139,250,0.5); }
        .km-search input::placeholder { color: var(--muted, #8a8a9a); }
        .km-search-btn {
          padding: 8px 13px;
          border-radius: 9px;
          border: 1px solid rgba(167,139,250,0.35);
          background: rgba(167,139,250,0.1);
          color: #a78bfa;
          font-size: 1rem;
          cursor: pointer;
          font-family: inherit;
          touch-action: manipulation;
          transition: background 0.12s;
        }
        .km-search-btn:hover { background: rgba(167,139,250,0.2); }
        .km-clear-btn {
          padding: 6px 10px;
          border-radius: 7px;
          border: 1px solid rgba(255,255,255,0.1);
          background: transparent;
          color: var(--muted, #8a8a9a);
          font-size: 0.75rem;
          cursor: pointer;
          font-family: inherit;
          touch-action: manipulation;
        }
        .km-chips-wrap {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          padding: 6px 14px 4px;
          scrollbar-width: none;
          direction: rtl;
          flex-shrink: 0;
        }
        .km-chips-wrap::-webkit-scrollbar { display: none; }
        .km-chip {
          font-size: 0.73rem;
          font-weight: 700;
          padding: 5px 11px;
          border-radius: 20px;
          border: 1px solid rgba(167,139,250,0.3);
          background: rgba(167,139,250,0.07);
          color: #a78bfa;
          cursor: pointer;
          white-space: nowrap;
          touch-action: manipulation;
          font-family: inherit;
          transition: background 0.12s;
          flex-shrink: 0;
        }
        .km-chip:hover { background: rgba(167,139,250,0.18); }
        .km-search-hint {
          font-size: 0.71rem;
          color: var(--muted, #8a8a9a);
          text-align: center;
          padding: 4px 12px 2px;
          direction: rtl;
          line-height: 1.6;
          flex-shrink: 0;
        }
        .km-search-hint strong { color: var(--text-secondary, #b4b4c0); }
        .km-body {
          flex: 1;
          overflow-y: auto;
          position: relative;
          padding: 12px 14px 16px;
          direction: rtl;
        }
        .km-section-label {
          font-size: 0.68rem;
          font-weight: 900;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin: 10px 0 6px;
          padding-right: 4px;
        }
        .km-book-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 6px;
        }
        .km-book-btn {
          padding: 7px 13px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.04);
          color: var(--text, #f4f4f8);
          font-size: 0.82rem;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          touch-action: manipulation;
          transition: background 0.12s, border-color 0.15s;
          direction: rtl;
        }
        .km-book-btn:hover { background: rgba(255,255,255,0.09); }
        .km-back {
          padding: 7px 14px;
          border-radius: 9px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: var(--text-secondary, #b4b4c0);
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          touch-action: manipulation;
          margin-bottom: 10px;
          display: inline-block;
          direction: rtl;
        }
        .km-chapter-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 8px;
        }
        .km-chapter-btn {
          width: 42px; height: 38px;
          border-radius: 9px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
          color: var(--text-secondary, #b4b4c0);
          font-size: 0.82rem;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          touch-action: manipulation;
          transition: background 0.12s, border-color 0.12s;
        }
        .km-chapter-btn:hover {
          background: rgba(167,139,250,0.12);
          border-color: rgba(167,139,250,0.4);
          color: #a78bfa;
        }
        .km-verse-card {
          padding: 10px 12px;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px;
          margin-bottom: 8px;
          direction: rtl;
        }
        .km-verse-num {
          font-size: 0.68rem;
          font-weight: 700;
          color: #a78bfa;
          margin-left: 8px;
        }
        .km-verse-text {
          font-size: 0.93rem;
          line-height: 1.9;
          color: var(--text, #f4f4f8);
        }
        .km-answer-panel {
          position: absolute;
          inset: 0;
          z-index: 10;
          background: var(--surface, #18181b);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 4px 32px rgba(0,0,0,0.45);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .km-ap-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 11px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          flex-shrink: 0;
          direction: rtl;
          gap: 8px;
        }
        .km-ap-title {
          font-size: 0.83rem;
          font-weight: 800;
          color: #a78bfa;
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .km-ap-close {
          width: 32px; height: 32px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.06);
          color: var(--text-secondary, #b4b4c0);
          font-size: 0.88rem;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          font-family: inherit;
          transition: background 0.12s;
          flex-shrink: 0;
        }
        .km-ap-close:hover { background: rgba(255,255,255,0.12); }
        .km-ap-body {
          flex: 1;
          overflow-y: auto;
          padding: 14px 14px 18px;
          direction: rtl;
        }
        .km-summary-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.75rem;
          font-weight: 800;
          padding: 5px 12px;
          border-radius: 20px;
          background: linear-gradient(90deg, rgba(167,139,250,0.18) 0%, rgba(99,102,241,0.12) 100%);
          border: 1px solid rgba(167,139,250,0.35);
          color: #a78bfa;
          margin-bottom: 14px;
        }
        .km-explanation {
          font-size: 0.92rem;
          line-height: 1.85;
          color: var(--text, #f4f4f8);
          margin-bottom: 16px;
          padding: 13px 15px;
          background: rgba(167,139,250,0.07);
          border-radius: 10px;
          border-right: 3px solid #a78bfa;
        }
        .km-did-you-know {
          font-size: 0.81rem;
          line-height: 1.7;
          color: var(--text-secondary, #b4b4c0);
          padding: 10px 13px;
          background: rgba(99,102,241,0.07);
          border-radius: 9px;
          border-right: 3px solid rgba(99,102,241,0.5);
          margin-top: 16px;
          direction: rtl;
          display: flex;
          gap: 8px;
          align-items: flex-start;
        }
        .km-did-you-know::before { content: "✨"; flex-shrink: 0; }
        .km-citations-label {
          font-size: 0.7rem;
          font-weight: 900;
          color: var(--muted, #8a8a9a);
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .km-ai-tag {
          font-size: 0.62rem;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 4px;
          background: rgba(167,139,250,0.2);
          color: #c4b5fd;
          letter-spacing: 0.06em;
        }
        .km-result-card {
          padding: 11px 13px;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px;
          margin-bottom: 9px;
          direction: rtl;
        }
        .km-result-ref {
          font-size: 0.8rem;
          font-weight: 900;
          color: #a78bfa;
          margin-bottom: 6px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .km-result-text {
          font-size: 0.92rem;
          line-height: 1.85;
          color: var(--text, #f4f4f8);
        }
        .km-result-context {
          font-size: 0.78rem;
          color: var(--muted, #8a8a9a);
          margin-top: 7px;
          padding-top: 7px;
          border-top: 1px solid rgba(255,255,255,0.06);
        }
        .km-copy-btn {
          padding: 3px 8px;
          border-radius: 6px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: var(--muted, #8a8a9a);
          font-size: 0.68rem;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          touch-action: manipulation;
          transition: background 0.12s, color 0.12s;
          flex-shrink: 0;
        }
        .km-copy-btn:hover { background: rgba(255,255,255,0.1); color: var(--text-secondary); }
        .km-copy-btn.copied { color: #34d399; border-color: rgba(52,211,153,0.35); background: rgba(52,211,153,0.08); }
        .km-related-wrap {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin: 14px 0;
          direction: rtl;
        }
        .km-related-chip {
          font-size: 0.74rem;
          font-weight: 700;
          padding: 5px 11px;
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.15);
          background: rgba(255,255,255,0.05);
          color: var(--text-secondary, #b4b4c0);
          cursor: pointer;
          touch-action: manipulation;
          font-family: inherit;
          transition: background 0.12s, border-color 0.12s, color 0.12s;
        }
        .km-related-chip:hover {
          background: rgba(167,139,250,0.12);
          border-color: rgba(167,139,250,0.35);
          color: #a78bfa;
        }
        .km-error { color: #f87171; font-size: 0.85rem; text-align: center; padding: 16px; }
        .km-skeleton-wrap { padding: 4px 0; }
        .km-skeleton {
          border-radius: 6px;
          background: linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 100%);
          background-size: 200% 100%;
          animation: km-shimmer 1.4s infinite;
        }
        @keyframes km-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes km-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .km-skeleton-badge { height: 22px; width: 130px; border-radius: 20px; margin-bottom: 14px; }
        .km-skeleton-line { height: 14px; margin-bottom: 8px; }
        .km-skeleton-line--100 { width: 100%; }
        .km-skeleton-line--90 { width: 90%; }
        .km-skeleton-line--80 { width: 80%; }
        .km-skeleton-line--70 { width: 70%; }
        .km-skeleton-line--50 { width: 50%; }
        .km-skeleton-card {
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px;
          padding: 12px 14px;
          margin-bottom: 10px;
        }
        .km-empty { color: var(--muted, #8a8a9a); font-size: 0.85rem; text-align: center; padding: 16px; }
      `}</style>

      <div className="km-header">
        <span className="km-title">✡ ספרי הקבלה</span>
        {onClose && (
          <button type="button" className="km-close" onClick={onClose} aria-label="סגור">✕</button>
        )}
      </div>

      <div className="km-search">
        <input
          ref={searchRef}
          placeholder="חפש מושג, ספירה, נושא… עשר ספירות, עין סוף, גלגול נשמות"
          value={query}
          onChange={e => { setQuery(e.target.value); closeAnswerPanel(); setSelectedBook(null); setChapter(null); setVerses(null); }}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        <button type="button" className="km-search-btn" onClick={() => handleSearch()} aria-label="חיפוש">🔍</button>
        {query && (
          <button type="button" className="km-clear-btn" onClick={() => { setQuery(''); closeAnswerPanel(); setSelectedBook(null); setChapter(null); setVerses(null); searchRef.current?.focus(); }}>נקה</button>
        )}
      </div>

      {!query.trim() && (
        <>
          <p className="km-search-hint">
            <strong>חפש:</strong> מושגי קבלה · ספירות · עולמות · טעמי מצוות קבליים
          </p>
          <div className="km-chips-wrap">
            {QUICK_CHIPS.map(chip => (
              <button key={chip} type="button" className="km-chip" onClick={() => handleChipClick(chip)}>
                {chip}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="km-body">

        {showAnswerPanel && (
          <div className="km-answer-panel">
            <div className="km-ap-header">
              <span className="km-ap-title">✡ {searchedQuery}</span>
              <button type="button" className="km-ap-close" onClick={closeAnswerPanel}>✕</button>
            </div>
            <div className="km-ap-body" ref={answerPanelRef}>
              {loading && <SkeletonLoader />}
              {error && !loading && <div className="km-error">{error}</div>}

              {groqData && !loading && (
                <div>
                  {groqData.summary && (
                    <div className="km-summary-badge">✨ {groqData.summary}</div>
                  )}
                  {groqData.explanation && (
                    <div className="km-explanation">
                      {typedExplanation}
                      {!explanationDone && <span style={{ borderRight: '2px solid #a78bfa', marginRight: 2, animation: 'km-blink 0.7s step-end infinite' }}>&nbsp;</span>}
                    </div>
                  )}

                  {groqData.results && groqData.results.length > 0 && (
                    <>
                      <div className="km-citations-label">
                        <span className="km-ai-tag">AI</span>
                        מקורות מספרי הקבלה · {groqData.results.length} ציטוטים
                      </div>
                      {groqData.results.map((r, i) => (
                        <div key={i} className="km-result-card">
                          <div className="km-result-ref">
                            <span>{r.ref}</span>
                            <button
                              type="button"
                              className={`km-copy-btn${copiedRef === r.ref ? ' copied' : ''}`}
                              onClick={() => copyToClipboard(r.ref, r.text)}
                            >
                              {copiedRef === r.ref ? '✓ הועתק' : 'העתק'}
                            </button>
                          </div>
                          <div className="km-result-text">{r.text}</div>
                          {r.context && <div className="km-result-context">{r.context}</div>}
                        </div>
                      ))}
                    </>
                  )}

                  {groqData.relatedTopics && groqData.relatedTopics.length > 0 && (
                    <>
                      <div className="km-citations-label" style={{ marginTop: 18 }}>נושאים קשורים</div>
                      <div className="km-related-wrap">
                        {groqData.relatedTopics.map((t, i) => (
                          <button key={i} type="button" className="km-related-chip"
                            onClick={() => { setQuery(t); handleSearch(t); }}>
                            {t}
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {groqData.didYouKnow && (
                    <div className="km-did-you-know">{groqData.didYouKnow}</div>
                  )}

                  {(!groqData.results || groqData.results.length === 0) && !groqData.explanation && (
                    <div className="km-empty">לא נמצאו תוצאות — נסה לנסח אחרת</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {showChapter && (
          <div>
            <button type="button" className="km-back" onClick={() => { setChapter(null); setVerses(null); }}>
              ← {selectedBook.he}
            </button>
            <p className="km-section-label" style={{ color: SECTION_COLORS[selectedBook.section] }}>
              {selectedBook.he} · פרק {chapter}
            </p>
            {versesLoading && (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)' }}>
                <div className="spinner" />
              </div>
            )}
            {verses && verses.length === 0 && !versesLoading && (
              <div className="km-empty" style={{ lineHeight: 1.7 }}>
                <div style={{ marginBottom: 12 }}>הטקסט לפרק זה אינו זמין — חפש הסבר מעמיק:</div>
                <button
                  type="button"
                  className="km-search-btn"
                  style={{ fontSize: '0.82rem', padding: '8px 16px' }}
                  onClick={() => {
                    setSelectedBook(null);
                    setChapter(null);
                    setVerses(null);
                    const q = selectedBook.he;
                    setQuery(q);
                    setSearchedQuery(q);
                    handleSearch(q);
                  }}
                >
                  🔍 חפש עם AI
                </button>
              </div>
            )}
            {verses && verses.map((v, i) => (
              <div key={i} className="km-verse-card">
                <span className="km-verse-num">{i + 1}</span>
                <span
                  className="km-verse-text"
                  dangerouslySetInnerHTML={{ __html: typeof v === 'string' ? v : '' }}
                />
              </div>
            ))}
          </div>
        )}

        {showChapterPicker && (
          <div>
            <button type="button" className="km-back" onClick={() => setSelectedBook(null)}>← רשימת ספרים</button>
            <p className="km-section-label" style={{ color: SECTION_COLORS[selectedBook.section] }}>
              {selectedBook.he} — בחר פרק
            </p>
            <div className="km-chapter-grid">
              {Array.from({ length: chapterCount }, (_, i) => i + 1).map(ch => (
                <button type="button" key={ch} className="km-chapter-btn" onClick={() => loadChapter(selectedBook, ch)}>{ch}</button>
              ))}
            </div>
          </div>
        )}

        {showBookList && sections.map(sec => (
          <div key={sec}>
            <p className="km-section-label" style={{ color: SECTION_COLORS[sec] }}>{sec}</p>
            <div className="km-book-grid">
              {filtered.filter(b => b.section === sec).map(b => (
                <button
                  type="button"
                  key={b.en}
                  className="km-book-btn"
                  style={{ borderColor: SECTION_COLORS[b.section] + '55' }}
                  onClick={() => { setSelectedBook(b); setChapter(null); setVerses(null); }}
                >
                  {b.he}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function KabbalachModal({ onClose }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="bm-overlay" role="presentation">
      <KabbalachPanel onClose={onClose} />
    </div>
  );
}
