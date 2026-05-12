import React, { useState, useRef, useEffect } from 'react';
import { useTypewriter } from '../../hooks/useTypewriter.js';

// כל פרשיות הזוהר המאורגנות לפי ספרי התורה + חלקים מיוחדים
const ZOHAR_STRUCTURE = [
  {
    book: 'בראשית',
    color: '#f59e0b',
    parashiyot: [
      { he: 'פרשת בראשית', en: 'Zohar.Bereshit', sections: 240 },
      { he: 'פרשת נח', en: 'Zohar.Noach', sections: 120 },
      { he: 'פרשת לך לך', en: 'Zohar.Lech-Lecha', sections: 110 },
      { he: 'פרשת וירא', en: 'Zohar.Vayera', sections: 130 },
      { he: 'פרשת חיי שרה', en: 'Zohar.Chayei_Sara', sections: 60 },
      { he: 'פרשת תולדות', en: 'Zohar.Toldot', sections: 80 },
      { he: 'פרשת ויצא', en: 'Zohar.Vayetze', sections: 90 },
      { he: 'פרשת וישלח', en: 'Zohar.Vayishlach', sections: 90 },
      { he: 'פרשת וישב', en: 'Zohar.Vayeshev', sections: 100 },
      { he: 'פרשת מקץ', en: 'Zohar.Miketz', sections: 100 },
      { he: 'פרשת ויגש', en: 'Zohar.Vayigash', sections: 50 },
      { he: 'פרשת ויחי', en: 'Zohar.Vayechi', sections: 140 },
    ],
  },
  {
    book: 'שמות',
    color: '#10b981',
    parashiyot: [
      { he: 'פרשת שמות', en: 'Zohar.Shemot', sections: 100 },
      { he: 'פרשת וארא', en: 'Zohar.Vaera', sections: 70 },
      { he: 'פרשת בא', en: 'Zohar.Bo', sections: 100 },
      { he: 'פרשת בשלח', en: 'Zohar.Beshalach', sections: 120 },
      { he: 'פרשת יתרו', en: 'Zohar.Yitro', sections: 100 },
      { he: 'פרשת משפטים', en: 'Zohar.Mishpatim', sections: 160 },
      { he: 'פרשת תרומה', en: 'Zohar.Terumah', sections: 280 },
      { he: 'פרשת תצוה', en: 'Zohar.Tetzaveh', sections: 80 },
      { he: 'פרשת כי תשא', en: 'Zohar.Ki_Tisa', sections: 100 },
      { he: 'פרשת ויקהל', en: 'Zohar.Vayakhel', sections: 110 },
      { he: 'פרשת פקודי', en: 'Zohar.Pekudei', sections: 130 },
    ],
  },
  {
    book: 'ויקרא',
    color: '#8b5cf6',
    parashiyot: [
      { he: 'פרשת ויקרא', en: 'Zohar.Vayikra', sections: 50 },
      { he: 'פרשת צו', en: 'Zohar.Tzav', sections: 60 },
      { he: 'פרשת שמיני', en: 'Zohar.Shmini', sections: 50 },
      { he: 'פרשת תזריע', en: 'Zohar.Tazria', sections: 50 },
      { he: 'פרשת מצרע', en: 'Zohar.Metzora', sections: 30 },
      { he: 'פרשת אחרי מות', en: 'Zohar.Acharei_Mot', sections: 90 },
      { he: 'פרשת קדשים', en: 'Zohar.Kedoshim', sections: 80 },
      { he: 'פרשת אמור', en: 'Zohar.Emor', sections: 130 },
      { he: 'פרשת בהר', en: 'Zohar.Behar', sections: 30 },
      { he: 'פרשת בחקתי', en: 'Zohar.Bechukotai', sections: 30 },
    ],
  },
  {
    book: 'במדבר',
    color: '#f43f5e',
    parashiyot: [
      { he: 'פרשת במדבר', en: 'Zohar.Bamidbar', sections: 30 },
      { he: 'פרשת נשא', en: 'Zohar.Naso', sections: 200 },
      { he: 'פרשת בהעלותך', en: 'Zohar.Beha\'alotcha', sections: 70 },
      { he: 'פרשת שלח', en: 'Zohar.Shelach', sections: 70 },
      { he: 'פרשת קרח', en: 'Zohar.Korach', sections: 50 },
      { he: 'פרשת חקת', en: 'Zohar.Chukat', sections: 50 },
      { he: 'פרשת בלק', en: 'Zohar.Balak', sections: 100 },
      { he: 'פרשת פנחס', en: 'Zohar.Pinchas', sections: 200 },
      { he: 'פרשת מטות', en: 'Zohar.Matot', sections: 30 },
      { he: 'פרשת מסעי', en: 'Zohar.Masei', sections: 30 },
    ],
  },
  {
    book: 'דברים',
    color: '#0ea5e9',
    parashiyot: [
      { he: 'פרשת דברים', en: 'Zohar.Devarim', sections: 30 },
      { he: 'פרשת ואתחנן', en: 'Zohar.Vaetchanan', sections: 30 },
      { he: 'פרשת עקב', en: 'Zohar.Eikev', sections: 30 },
      { he: 'פרשת ראה', en: 'Zohar.Re\'eh', sections: 30 },
      { he: 'פרשת שפטים', en: 'Zohar.Shoftim', sections: 20 },
      { he: 'פרשת כי תצא', en: 'Zohar.Ki_Tetze', sections: 30 },
      { he: 'פרשת כי תבוא', en: 'Zohar.Ki_Tavo', sections: 20 },
      { he: 'פרשת נצבים', en: 'Zohar.Nitzavim', sections: 20 },
      { he: 'פרשת האזינו', en: 'Zohar.Haazinu', sections: 30 },
      { he: 'פרשת וזאת הברכה', en: 'Zohar.Vezot_HaBracha', sections: 20 },
    ],
  },
  {
    book: 'חלקים מיוחדים',
    color: '#fbbf24',
    parashiyot: [
      { he: 'ספרא דצניעותא', en: 'Zohar.Sifra_DeTzniuta', sections: 6 },
      { he: 'אידרא רבא', en: 'Zohar.Idra_Rabba', sections: 60 },
      { he: 'אידרא זוטא', en: 'Zohar.Idra_Zuta', sections: 40 },
      { he: 'רעיא מהימנא', en: 'Zohar.Raya_Mehemna', sections: 80 },
      { he: 'זוהר חדש — בראשית', en: 'Zohar_Chadash.Bereshit', sections: 50 },
      { he: 'זוהר חדש — שיר השירים', en: 'Zohar_Chadash.Shir_HaShirim', sections: 40 },
      { he: 'תיקוני זוהר', en: 'Tikkunei_Zohar', sections: 70 },
    ],
  },
];

const QUICK_CHIPS = [
  'בראשית ברא',
  'עשר ספירות',
  'שכינה',
  'מלכות',
  'תפארת',
  'חסד וגבורה',
  'אדם קדמון',
  'עולמות עליונים',
  'גן עדן עליון',
  'רזין דרזין',
];

const ZOHAR_HARDCODED = {
  'בראשית ברא': {
    explanation: 'פרשת בראשית פותחת את הזוהר בפרשנות עמוקה לשלוש המילים הראשונות בתורה — "בְּרֵאשִׁית בָּרָא אֱלֹהִים". הזוהר רואה בהן לא תיאור כרונולוגי של בריאה אלא מפה מיסטית לתהליך האלוהי הנצחי של בריאת המציאות מתוך האין-סוף.',
    results: [
      { ref: 'ב׳ של "בראשית"', text: 'מדוע התורה פותחת ב"ב" ולא ב"א"? הזוהר: "א" היא אות האין-סוף הנסתר, "ב" היא ספירת חכמה — תחילת הגילוי. "בית" = בית, מקום. הבריאה היא "בית" לאלוהות.', context: 'זוהר, פרשת בראשית' },
      { ref: 'רֵאשִׁית = חכמה', text: '"בראשית" — "ב+ראשית". "ראשית" בזוהר מתפרש כחכמה, הספירה השנייה. "ברא" — אלוהים ברא על ידי חכמה. כל הבריאה נאצלה דרך ספירת חכמה.', context: 'זוהר א:ב, עמ׳ ב' },
      { ref: 'שית — ו׳ ספירות', text: '"בראשית" = ברא + שית. "שית" בארמית = שש. ו׳ הספירות (חסד, גבורה, תפארת, נצח, הוד, יסוד) נבראו ביחד. הבריאה התחוללה בו-זמנית בכל שש הספירות האמצעיות.', context: 'זוהר — דרשת "בראשית ברא"' },
      { ref: 'שלושה ספרים', text: 'הזוהר: "שלושה ספרים נפתחו בבריאה — ספר חכמה, ספר עולמות, ספר אדם". כל הבריאה נכתבה מראש ב"ספרים" אלה לפני שנגלתה לחוויה.', context: 'זוהר, פרשת בראשית' },
    ],
  },
  'עשר ספירות': {
    explanation: 'הזוהר מתאר את עשר הספירות כ"לבושי המלך" — הדרכים שבהן האין-סוף מתלבש ומתגלה. הספירות אינן נפרדות מהאל — הן כאש שיוצאת מהגחלת: האש נראית נפרדת, אך מחוברת לגחלת תמיד.',
    results: [
      { ref: 'ספר יצירה — מקור הרעיון', text: '"עשר ספירות בלי מה" (ספר יצירה א:ב). המונח "ספירות" הופיע לראשונה בספר יצירה (המאה ה-3 לספה"נ). הזוהר (המאה ה-13) פיתח אותו לשיטה שלמה.', context: 'ספר יצירה' },
      { ref: 'יחוד הספירות', text: 'הזוהר מדגיש: "הוא ושמו אחד" — האין-סוף והספירות אחד הם, כמו אש ובעירתה. אין הספירות יצורים עצמאיים — הן גילויים של עצמות אחת.', context: 'זוהר, האזינו' },
      { ref: 'ה׳ ו-ה׳ — זכר ונקבה', text: 'בשם הוי"ה: יו"ד = חכמה (אבא), ה"א = בינה (אמא), ו"ו = תפארת + ה׳ ספירות, ה"א = מלכות. כל האותיות של שם ה׳ הן מפה לעשר ספירות.', context: 'זוהר, פרשת יתרו' },
    ],
  },
  'שכינה': {
    explanation: 'בזוהר, השכינה היא אחת הדמויות המרכזיות ביותר — ה"כנסת ישראל", ספירת המלכות, ה"נוקבא". היא הנוכחות האלוהית השורה בעולם, בעם ישראל ובכל מקום קדוש. גלות ישראל היא גלות השכינה — ותיקון העולם הוא שיבת השכינה לחיבורה עם "זעיר אנפין".',
    results: [
      { ref: 'השכינה בגלות', text: '"בכל אתר דאינון גלאן שכינתא עמהון" (בכל מקום שהם גולים, השכינה עמהם — זוהר, שמות). השכינה לא עזבה את ישראל בגלות — היא גולה עמהם.', context: 'זוהר, פרשת שמות' },
      { ref: 'שבת — יחוד השכינה', text: 'כניסת שבת = חיבור השכינה (מלכות) עם קוב"ה (תפארת). "לקבל שבת" — לקבל פני השכינה הנכנסת. לכן קבלת שבת נאמרת בשירה ובשמחה — חתונה אלוהית.', context: 'זוהר, פרשת יתרו ומשפטים' },
      { ref: 'השכינה ותפילה', text: 'כאשר האדם מתפלל בכוונה — השכינה שורה עליו. "שכינה מדברת מתוך גרונו של משה" (זוהר, ויקרא). התפילה היא ממש דיבור השכינה דרך האדם.', context: 'זוהר ופרשת ויקרא' },
    ],
  },
  'מלכות': {
    explanation: 'מלכות היא הספירה העשירית והאחרונה — נקודת המגע של האלוהות עם עולמנו. היא מכונה "שכינה", "כנסת ישראל", "כלה", "לילה", "ירח". בניגוד לספירות העליונות שיש בהן אור עצמי — מלכות מקבלת אורה מהן, כירח המקבל אור מהשמש.',
    results: [
      { ref: 'מלכות — "אין לה מעצמה כלום"', text: 'הזוהר: ספירת מלכות "אית לה מגרמה כלום" — אין לה מעצמה כלום אלא מה שניתן לה מהספירות. זהו תיאור ה"כלי המושלם" — ריקנות שיכולה לקבל הכל.', context: 'זוהר, פרשת בראשית' },
      { ref: 'מלכות ודוד', text: 'דוד המלך מזוהה עם ספירת המלכות. לכן ספר תהילים — שירת דוד — הוא ספר המלכות. "דוד מלך ישראל חי וקיים" — השכינה חיה לעד.', context: 'זוהר ומדרש' },
      { ref: 'חיבור מלכות ותפארת', text: 'יחוד מלכות (נוקבא) ותפארת (זעיר אנפין) = יחוד ה׳ ושמו, ה׳ ושכינתו. כל מצווה ותפילה מחברת את הזוג האלוהי — "לשם ייחוד קודשא בריך הוא ושכינתיה".', context: 'זוהר — יחוד' },
    ],
  },
  'תפארת': {
    explanation: 'תפארת (= יופי, הדר) היא הספירה השישית — לב עץ הספירות, "עמוד התווך". היא מקבלת מחסד (ימין) וגבורה (שמאל) ומאחדת אותם להרמוניה. מזוהה עם שם הוי"ה, עם יעקב האבות, עם "הקב"ה" בלשון הזוהר.',
    results: [
      { ref: 'תפארת — לב הספירות', text: 'תפארת עומדת במרכז: מחסד ימינה, מגבורה שמאלה, מבינה למעלה, ממלכות למטה. היא "תיווך" אלוהי — לא ימין קיצוני של אהבה ולא שמאל קיצוני של דין, אלא הרמוניה.', context: 'עץ הספירות' },
      { ref: 'תפארת ויעקב', text: '"ויאהב ישראל את יוסף מכל בניו" — יעקב (= ישראל = תפארת) ויוסף (= יסוד). הזוהר רואה ביחסי האבות ובניהם השתקפות של יחסי הספירות.', context: 'זוהר, פרשת וישב' },
      { ref: 'שם הוי"ה = תפארת', text: 'שם י-ה-ו-ה מתייחס בעיקרו לתפארת. "אמצע" הספירות = אמצע השם. לכן בתפילה: "ה׳ שפתי תפתח" — פתיחת הפה של תפארת המדבר.', context: 'זוהר ופרדס רמונים' },
    ],
  },
  'חסד וגבורה': {
    explanation: 'חסד וגבורה הם שתי הידיים האלוהיות — ימין ושמאל, נתינה וגבול, אהבה ודין. חסד (= חסד, אהבה, ימין) הוא כוח הנתינה האין-סופי. גבורה (= דין, שמאל) הוא כוח הגבול, הצמצום והמשמעת. ביחד הם יוצרים את האיזון שמאפשר את הבריאה.',
    results: [
      { ref: 'אברהם = חסד', text: 'אברהם האבות מזוהה עם ספירת החסד. "ותתן אמת ליעקב, חסד לאברהם" (מיכה ז:כ). הכנסת האורחים, הנתינה, "לך לך" — כולם ביטויים של חסד ללא גבול.', context: 'זוהר, פרשת לך לך' },
      { ref: 'יצחק = גבורה', text: 'יצחק מזוהה עם גבורה — הדין. העקדה: יצחק נמסר לדין (הקרבה) ועמד בה. "פחד יצחק" (בראשית לא:מב) — השם "פחד" מבטא את מידת הגבורה/דין.', context: 'זוהר, פרשת וירא' },
      { ref: 'חסד וגבורה בתפילה', text: 'גשם = גבורות (דין המביא לחיים). חם = חסדים (אהבה). "גבורות גשמים" — תפילת שני הניגודים שבחיבורם מגיע הגשם. המוסף של ימות הגשמים פותח "משיב הרוח ומוריד הגשם".', context: 'זוהר ותפילה' },
    ],
  },
  'אדם קדמון': {
    explanation: 'בזוהר מופיעה דמות "אדם קדמוניאה" — האדם הקדמוני האלוהי שממנו נאצלו עולמות. הוא "גוף" האלוהות, המכיל את כל הספירות. בניגוד לאדם הראשון (הביולוגי) — אדם קדמון הוא מבנה מיסטי טרנסצנדנטי.',
    results: [
      { ref: 'צלם אלוהים', text: '"ויברא אלוהים את האדם בצלמו" (בראשית א:כז) — הזוהר: "צלם" = אדם קדמון. האדם הגשמי נברא בדמות מבנה הספירות. לכן האנטרופומורפיזם בתנ"ך אינו תיאור גשמי — הוא מפה לאדם קדמון.', context: 'זוהר, פרשת בראשית' },
      { ref: 'אדם קדמון בעולמות', text: 'כל עולם (אצילות, בריאה, יצירה, עשיה) מכיל עשר ספירות בצורת "אדם קדמון" ייחודי לו. ארבעה עולמות = ארבעה "אדם קדמון" — מהגבוה לנמוך.', context: 'קבלת האר"י — עץ חיים' },
    ],
  },
  'עולמות עליונים': {
    explanation: 'הקבלה וספר הזוהר מתארים ארבעה עולמות עיקריים: אצילות (אצל האל), בריאה (ברואים עליונים), יצירה (מלאכים), עשיה (עולמנו הגשמי). כל עולם מכיל עשר ספירות — וכולם "ירדו" מהאין-סוף בדרגות הולכות ומתגשמות.',
    results: [
      { ref: 'אצילות — עולם האלוהות', text: 'עולם האצילות הוא הגבוה — שם הספירות עצמן, שם שם הוי"ה שולט. אין בו נפרדות מהאל. המלאכים הגבוהים ביותר (חיות הקודש, אופנים) שורים בגבול בין אצילות לבריאה.', context: 'זוהר — עולם האצילות' },
      { ref: 'בריאה יצירה עשיה', text: 'בריאה (שם: א-להים, "כסא הכבוד") — עולם הנשמות הגבוהות. יצירה (שם: צבאות, "היכל") — עולם המלאכים. עשיה (שם: א-דני, "עולם השפל") — עולמנו הגשמי.', context: 'פרדס רמונים, עץ חיים' },
      { ref: 'ירידה לצורך עלייה', text: 'הזוהר: ירידת הנשמה לעולם הגשמי ("עשיה") היא ירידה לצורך עלייה — כדי לתקן ניצוצות שנפלו. כאשר הנשמה משלימה תיקונה — היא עולה חזרה דרך העולמות.', context: 'זוהר ותניא' },
    ],
  },
  'גן עדן עליון': {
    explanation: 'בזוהר ישנם שני גנות עדן: גן עדן תחתון (נשמות בני אדם לאחר פטירה) וגן עדן עליון (מדרגה נעלית יותר לנשמות הגדולות). גן עדן התחתון מזוהה עם עולם היצירה וגן עדן עליון עם עולם הבריאה.',
    results: [
      { ref: 'גן עדן תחתון — מקום הנשמות', text: 'לאחר פטירה, הנשמה עוברת תהליך טיהור ועולה לגן עדן תחתון. שם היא "לובשת" גוף עדין ונהנית מ"זיו השכינה". כל נשמה נהנית מהאור שהצליחה לצבור בחייה.', context: 'זוהר, פרשת וישלח ובא' },
      { ref: 'גן עדן עליון — בינה', text: 'גן עדן עליון מזוהה עם ספירת הבינה — "אמא עילאה". שם שורות נשמות הצדיקים הגדולים. "אין עין ראתה אלוהים זולתך יעשה למחכה לו" (ישעיהו סד:ג) — נאמר על גן עדן עליון.', context: 'זוהר, האזינו' },
      { ref: 'גן עדן בשבת', text: 'בשבת, הזוהר מלמד, נשמות הצדיקים עולות לגן עדן עליון לשמוע תורה מפי "הסבא דסבין". לכן שבת היא "מעין עולם הבא" — מגע עם גן עדן עליון.', context: 'זוהר, פרשת תרומה' },
    ],
  },
  'רזין דרזין': {
    explanation: '"רזין דרזין" (= "סודות הסודות" בארמית) הוא הביטוי בזוהר לחלקים הסתומים ביותר — סודות שאין לגלותם לכל. הם מהווים את ה"פנים" הנסתרות של הזוהר, הנגלות רק לבעלי רוח הקודש.',
    results: [
      { ref: 'זוהר — ספר הסודות', text: 'שם "זוהר" = זוהר, אור זוהר. "ספר הזוהר" נכתב על ידי ר׳ שמעון בר יוחאי (לפי המסורת) במאה ה-2 לספה"נ, ועלה לאור בספרד במאה ה-13. הספר מלא "רזין דרזין" שאסורים לגלות לכולם.', context: 'הקדמת הזוהר' },
      { ref: 'רשב"י ורזי הזוהר', text: 'הזוהר מספר שר׳ שמעון בר יוחאי גילה בפני חבריו "רזין עילאין" (סודות עליונים) שגרמו לכך שהאש המקיפה אותם לא כבתה שלושים יום. גילוי הסוד הגדול = חוויה רוחנית אינטנסיבית.', context: 'זוהר, אידרא זוטא' },
      { ref: 'מה שמותר ומה שאסור', text: 'חכמי הקבלה קבעו: קבלה ניתן ללמד רק לבוגר מגיל 40, נשוי, ובעל יסוד בתורה. ה"רזין דרזין" — הסודות הפנימיים ביותר — אסורים לגמרי ברבים. "אין מסרין רזי תורה אלא למי שלבו דואג בקרבו".', context: 'זוהר ותלמוד — חגיגה יד.' },
    ],
  },
};

function SkeletonLoader() {
  return (
    <div style={{ padding: '4px 0' }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 10,
          padding: '12px 14px',
          marginBottom: 10,
          background: 'linear-gradient(90deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.09) 50%,rgba(255,255,255,0.04) 100%)',
          backgroundSize: '200% 100%',
          animation: 'zh-shimmer 1.4s infinite',
        }} />
      ))}
    </div>
  );
}

export function ZoharPanel({ embedded = false, onClose }) {
  const [query, setQuery] = useState('');
  const [searchedQuery, setSearchedQuery] = useState('');
  const [groqData, setGroqData] = useState(null);
  const { displayed: typedExplanation, isDone: explanationDone } = useTypewriter(groqData?.explanation || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedRef, setCopiedRef] = useState(null);

  // ניווט 3 רמות: ספר → פרשה → סעיף
  const [selectedBook, setSelectedBook] = useState(null);   // index in ZOHAR_STRUCTURE
  const [selectedParasha, setSelectedParasha] = useState(null); // parashah object
  const [selectedSection, setSelectedSection] = useState(null); // section number
  const [sectionText, setSectionText] = useState(null);
  const [sectionLoading, setSectionLoading] = useState(false);

  const searchRef = useRef();
  const answerPanelRef = useRef();

  useEffect(() => { searchRef.current?.focus(); }, []);

  useEffect(() => {
    if (groqData && answerPanelRef.current) answerPanelRef.current.scrollTop = 0;
  }, [groqData]);

  function closeAnswerPanel() { setGroqData(null); setError(''); }

  function resetNav() {
    setSelectedBook(null);
    setSelectedParasha(null);
    setSelectedSection(null);
    setSectionText(null);
  }

  async function loadSection(parasha, sec) {
    setSectionLoading(true);
    setSectionText(null);
    setSelectedSection(sec);
    try {
      const ref = `${parasha.en}.${sec}`;
      const res = await fetch(
        `https://www.sefaria.org/api/texts/${encodeURIComponent(ref)}?lang=he&commentary=0`
      );
      if (!res.ok) throw new Error('sefaria failed');
      const data = await res.json();

      function extractStrings(val) {
        if (!val) return [];
        if (typeof val === 'string') return val.trim() ? [val] : [];
        if (Array.isArray(val)) return val.flatMap(extractStrings);
        return [];
      }

      let arr = extractStrings(data.he);
      if (!arr.length) arr = extractStrings(data.text);
      setSectionText(arr);
    } catch {
      setSectionText([]);
    }
    setSectionLoading(false);
  }

  async function handleSearch(q = query) {
    const trimmed = (q || query).trim();
    if (!trimmed) return;
    closeAnswerPanel();
    resetNav();
    setSearchedQuery(trimmed);
    setLoading(true);
    try {
      const BASE = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${BASE}/api/zohar-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
      });
      if (!res.ok) throw new Error('zohar search failed');
      const data = await res.json();
      setGroqData(data);
    } catch {
      setError('לא ניתן להשלים את החיפוש. נסה שנית.');
    }
    setLoading(false);
  }

  function copyToClipboard(ref, text) {
    navigator.clipboard?.writeText(`${ref}\n${text}`).then(() => {
      setCopiedRef(ref);
      setTimeout(() => setCopiedRef(null), 1800);
    });
  }

  const showAnswerPanel = (loading || groqData !== null || error) && !selectedParasha;
  const bookColor = selectedBook !== null ? ZOHAR_STRUCTURE[selectedBook].color : '#fbbf24';

  return (
    <div className={embedded ? 'zh-sheet zh-sheet-embedded' : 'zh-sheet'} role={embedded ? undefined : 'dialog'}>
      <style>{`
        @keyframes zh-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes zh-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .zh-sheet {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--surface, #18181b);
          border-radius: 16px;
          overflow: hidden;
          font-family: inherit;
        }
        .zh-sheet-embedded {
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.08);
        }
        .zh-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 13px 16px 11px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          direction: rtl;
          flex-shrink: 0;
          gap: 10px;
        }
        .zh-title {
          font-size: 1rem;
          font-weight: 900;
          color: #fbbf24;
          letter-spacing: 0.02em;
        }
        .zh-title-sub {
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--muted, #8a8a9a);
          margin-right: 8px;
        }
        .zh-close {
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
        .zh-close:hover { background: rgba(255,255,255,0.12); }
        .zh-search {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          flex-shrink: 0;
          direction: rtl;
        }
        .zh-search input {
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
        .zh-search input:focus { border-color: rgba(251,191,36,0.45); }
        .zh-search input::placeholder { color: var(--muted, #8a8a9a); }
        .zh-search-btn {
          padding: 8px 13px;
          border-radius: 9px;
          border: 1px solid rgba(251,191,36,0.35);
          background: rgba(251,191,36,0.1);
          color: #fbbf24;
          font-size: 1rem;
          cursor: pointer;
          font-family: inherit;
          transition: background 0.12s;
          touch-action: manipulation;
        }
        .zh-search-btn:hover { background: rgba(251,191,36,0.2); }
        .zh-clear-btn {
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
        .zh-chips-wrap {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          padding: 6px 14px 4px;
          scrollbar-width: none;
          direction: rtl;
          flex-shrink: 0;
        }
        .zh-chips-wrap::-webkit-scrollbar { display: none; }
        .zh-chip {
          font-size: 0.73rem;
          font-weight: 700;
          padding: 5px 11px;
          border-radius: 20px;
          border: 1px solid rgba(251,191,36,0.28);
          background: rgba(251,191,36,0.07);
          color: #fbbf24;
          cursor: pointer;
          white-space: nowrap;
          touch-action: manipulation;
          font-family: inherit;
          flex-shrink: 0;
          transition: background 0.12s;
        }
        .zh-chip:hover { background: rgba(251,191,36,0.18); }
        .zh-hint {
          font-size: 0.71rem;
          color: var(--muted, #8a8a9a);
          text-align: center;
          padding: 4px 12px 2px;
          direction: rtl;
          line-height: 1.6;
          flex-shrink: 0;
        }
        .zh-hint strong { color: var(--text-secondary, #b4b4c0); }
        .zh-body {
          flex: 1;
          overflow-y: auto;
          position: relative;
          direction: rtl;
        }
        .zh-body-inner { padding: 12px 14px 16px; }
        /* ספרי תורה */
        .zh-book-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin-bottom: 8px;
        }
        .zh-special-grid {
          margin-top: 4px;
        }
        .zh-book-card {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          padding: 14px 14px 12px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.03);
          cursor: pointer;
          font-family: inherit;
          direction: rtl;
          transition: background 0.13s, border-color 0.13s;
          touch-action: manipulation;
          text-align: right;
          width: 100%;
        }
        .zh-book-card:hover { background: rgba(255,255,255,0.07); }
        .zh-book-name {
          font-size: 1rem;
          font-weight: 900;
          margin-bottom: 4px;
        }
        .zh-book-count {
          font-size: 0.7rem;
          color: var(--muted, #8a8a9a);
        }
        /* פרשיות */
        .zh-parasha-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }
        .zh-parasha-btn {
          padding: 8px 13px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
          color: var(--text, #f4f4f8);
          font-size: 0.83rem;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          touch-action: manipulation;
          transition: background 0.12s, border-color 0.13s;
          direction: rtl;
        }
        .zh-parasha-btn:hover { background: rgba(255,255,255,0.09); }
        /* סעיפים */
        .zh-section-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 8px;
        }
        .zh-section-btn {
          width: 44px; height: 38px;
          border-radius: 9px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
          color: var(--text-secondary, #b4b4c0);
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          touch-action: manipulation;
          transition: background 0.12s, border-color 0.12s, color 0.12s;
        }
        .zh-section-btn:hover {
          background: rgba(251,191,36,0.12);
          border-color: rgba(251,191,36,0.4);
          color: #fbbf24;
        }
        /* טקסט */
        .zh-verse-card {
          padding: 10px 12px;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px;
          margin-bottom: 8px;
          direction: rtl;
        }
        .zh-verse-num {
          font-size: 0.68rem;
          font-weight: 700;
          color: #fbbf24;
          margin-left: 8px;
        }
        .zh-verse-text {
          font-size: 0.93rem;
          line-height: 1.95;
          color: var(--text, #f4f4f8);
        }
        /* back */
        .zh-back {
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
        }
        .zh-section-label {
          font-size: 0.7rem;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin: 10px 0 8px;
        }
        /* answer panel */
        .zh-answer-panel {
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
        .zh-ap-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 11px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          flex-shrink: 0;
          direction: rtl;
          gap: 8px;
        }
        .zh-ap-title {
          font-size: 0.83rem;
          font-weight: 800;
          color: #fbbf24;
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .zh-ap-close {
          width: 32px; height: 32px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.06);
          color: var(--text-secondary, #b4b4c0);
          font-size: 0.88rem;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          font-family: inherit;
          flex-shrink: 0;
          transition: background 0.12s;
        }
        .zh-ap-close:hover { background: rgba(255,255,255,0.12); }
        .zh-ap-body {
          flex: 1;
          overflow-y: auto;
          padding: 14px 14px 18px;
          direction: rtl;
        }
        .zh-summary-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.75rem;
          font-weight: 800;
          padding: 5px 12px;
          border-radius: 20px;
          background: linear-gradient(90deg,rgba(251,191,36,0.18) 0%,rgba(245,158,11,0.1) 100%);
          border: 1px solid rgba(251,191,36,0.35);
          color: #fbbf24;
          margin-bottom: 14px;
        }
        .zh-explanation {
          font-size: 0.92rem;
          line-height: 1.85;
          color: var(--text, #f4f4f8);
          margin-bottom: 16px;
          padding: 13px 15px;
          background: rgba(251,191,36,0.06);
          border-radius: 10px;
          border-right: 3px solid #fbbf24;
        }
        .zh-did-you-know {
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
        .zh-did-you-know::before { content: "✡"; flex-shrink: 0; }
        .zh-citations-label {
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
        .zh-ai-tag {
          font-size: 0.62rem;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 4px;
          background: rgba(251,191,36,0.18);
          color: #fbbf24;
          letter-spacing: 0.06em;
        }
        .zh-result-card {
          padding: 11px 13px;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px;
          margin-bottom: 9px;
          direction: rtl;
        }
        .zh-result-ref {
          font-size: 0.8rem;
          font-weight: 900;
          color: #fbbf24;
          margin-bottom: 6px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .zh-result-text {
          font-size: 0.92rem;
          line-height: 1.9;
          color: var(--text, #f4f4f8);
        }
        .zh-result-context {
          font-size: 0.78rem;
          color: var(--muted, #8a8a9a);
          margin-top: 7px;
          padding-top: 7px;
          border-top: 1px solid rgba(255,255,255,0.06);
        }
        .zh-copy-btn {
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
          flex-shrink: 0;
          transition: background 0.12s;
        }
        .zh-copy-btn.copied { color: #34d399; border-color: rgba(52,211,153,0.35); background: rgba(52,211,153,0.08); }
        .zh-related-wrap {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin: 14px 0;
          direction: rtl;
        }
        .zh-related-chip {
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
          transition: background 0.12s;
        }
        .zh-related-chip:hover {
          background: rgba(251,191,36,0.1);
          border-color: rgba(251,191,36,0.3);
          color: #fbbf24;
        }
        .zh-error { color: #f87171; font-size: 0.85rem; text-align: center; padding: 16px; }
        .zh-empty { color: var(--muted,#8a8a9a); font-size: 0.85rem; text-align: center; padding: 16px; }
      `}</style>

      {/* HEADER */}
      <div className="zh-header">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 0 }}>
          <span className="zh-title">ספר הזוהר</span>
          <span className="zh-title-sub">· ארמית ועברית · Sefaria</span>
        </div>
        {!embedded && onClose && (
          <button type="button" className="zh-close" onClick={onClose}>✕</button>
        )}
      </div>

      {/* SEARCH */}
      <div className="zh-search">
        <input
          ref={searchRef}
          placeholder="חפש מושג, פרשה, רעיון… בראשית ברא, שכינה, מלכות"
          value={query}
          onChange={e => { setQuery(e.target.value); closeAnswerPanel(); }}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        <button type="button" className="zh-search-btn" onClick={() => handleSearch()}>🔍</button>
        {query && (
          <button type="button" className="zh-clear-btn" onClick={() => { setQuery(''); closeAnswerPanel(); searchRef.current?.focus(); }}>נקה</button>
        )}
      </div>

      {!query.trim() && (
        <>
          <p className="zh-hint"><strong>חפש:</strong> מושגי זוהר, פרשיות, ספירות, מדרשי קבלה</p>
          <div className="zh-chips-wrap">
            {QUICK_CHIPS.map(chip => (
              <button key={chip} type="button" className="zh-chip" onClick={() => {
                setQuery(chip);
                if (ZOHAR_HARDCODED[chip]) {
                  closeAnswerPanel();
                  resetNav();
                  setSearchedQuery(chip);
                  setGroqData(ZOHAR_HARDCODED[chip]);
                } else {
                  handleSearch(chip);
                }
              }}>{chip}</button>
            ))}
          </div>
        </>
      )}

      {/* BODY */}
      <div className="zh-body">

        {/* לוח תשובות AI */}
        {showAnswerPanel && (
          <div className="zh-answer-panel">
            <div className="zh-ap-header">
              <span className="zh-ap-title">📖 {searchedQuery}</span>
              <button type="button" className="zh-ap-close" onClick={closeAnswerPanel}>✕</button>
            </div>
            <div className="zh-ap-body" ref={answerPanelRef}>
              {loading && <SkeletonLoader />}
              {error && !loading && <div className="zh-error">{error}</div>}
              {groqData && !loading && (
                <div>
                  {groqData.summary && <div className="zh-summary-badge">✨ {groqData.summary}</div>}
                  {groqData.explanation && (
                    <div className="zh-explanation">
                      {typedExplanation}
                      {!explanationDone && <span style={{ borderRight: '2px solid #fbbf24', marginRight: 2, animation: 'zh-blink 0.7s step-end infinite' }}>&nbsp;</span>}
                    </div>
                  )}
                  {groqData.results && groqData.results.length > 0 && (
                    <>
                      <div className="zh-citations-label">
                        <span className="zh-ai-tag">AI</span>
                        מקורות מהזוהר · {groqData.results.length} ציטוטים
                      </div>
                      {groqData.results.map((r, i) => (
                        <div key={i} className="zh-result-card">
                          <div className="zh-result-ref">
                            <span>{r.ref}</span>
                            <button type="button" className={`zh-copy-btn${copiedRef === r.ref ? ' copied' : ''}`}
                              onClick={() => copyToClipboard(r.ref, r.text)}>
                              {copiedRef === r.ref ? '✓ הועתק' : 'העתק'}
                            </button>
                          </div>
                          <div className="zh-result-text">{r.text}</div>
                          {r.context && <div className="zh-result-context">{r.context}</div>}
                        </div>
                      ))}
                    </>
                  )}
                  {groqData.relatedTopics && groqData.relatedTopics.length > 0 && (
                    <>
                      <div className="zh-citations-label" style={{ marginTop: 18 }}>נושאים קשורים</div>
                      <div className="zh-related-wrap">
                        {groqData.relatedTopics.map((t, i) => (
                          <button key={i} type="button" className="zh-related-chip"
                            onClick={() => { setQuery(t); handleSearch(t); }}>{t}</button>
                        ))}
                      </div>
                    </>
                  )}
                  {groqData.didYouKnow && <div className="zh-did-you-know">{groqData.didYouKnow}</div>}
                  {(!groqData.results || groqData.results.length === 0) && !groqData.explanation && (
                    <div className="zh-empty">לא נמצאו תוצאות — נסה לנסח אחרת</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* תצוגת סעיף */}
        {selectedSection !== null && selectedParasha && (
          <div className="zh-body-inner">
            <button type="button" className="zh-back" onClick={() => { setSelectedSection(null); setSectionText(null); }}>
              ← {selectedParasha.he}
            </button>
            <p className="zh-section-label" style={{ color: bookColor }}>
              {selectedParasha.he} · סעיף {selectedSection}
            </p>
            {sectionLoading && (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)' }}>
                <div className="spinner" />
              </div>
            )}
            {sectionText && sectionText.length === 0 && !sectionLoading && (
              <div className="zh-empty">הטקסט אינו זמין כרגע מ-Sefaria עבור סעיף זה</div>
            )}
            {sectionText && sectionText.map((v, i) => (
              <div key={i} className="zh-verse-card">
                <span className="zh-verse-num">{i + 1}</span>
                <span className="zh-verse-text"
                  dangerouslySetInnerHTML={{ __html: typeof v === 'string' ? v : '' }} />
              </div>
            ))}
          </div>
        )}

        {/* בחירת סעיף */}
        {selectedParasha && selectedSection === null && (
          <div className="zh-body-inner">
            <button type="button" className="zh-back" onClick={() => setSelectedParasha(null)}>
              ← {ZOHAR_STRUCTURE[selectedBook].book}
            </button>
            <p className="zh-section-label" style={{ color: bookColor }}>{selectedParasha.he} — בחר סעיף</p>
            <div className="zh-section-grid">
              {Array.from({ length: selectedParasha.sections }, (_, i) => i + 1).map(sec => (
                <button type="button" key={sec} className="zh-section-btn"
                  onClick={() => loadSection(selectedParasha, sec)}>{sec}</button>
              ))}
            </div>
          </div>
        )}

        {/* בחירת פרשה */}
        {selectedBook !== null && !selectedParasha && (
          <div className="zh-body-inner">
            <button type="button" className="zh-back" onClick={() => setSelectedBook(null)}>← ספרי הזוהר</button>
            <p className="zh-section-label" style={{ color: bookColor }}>
              {ZOHAR_STRUCTURE[selectedBook].book} — בחר פרשה
            </p>
            <div className="zh-parasha-grid">
              {ZOHAR_STRUCTURE[selectedBook].parashiyot.map(p => (
                <button type="button" key={p.en} className="zh-parasha-btn"
                  style={{ borderColor: bookColor + '55' }}
                  onClick={() => setSelectedParasha(p)}>
                  {p.he}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* רשימת ספרים ראשית */}
        {selectedBook === null && !showAnswerPanel && (
          <div className="zh-body-inner">
            <p className="zh-section-label" style={{ color: '#fbbf24' }}>חמשת חומשי תורה</p>
            <div className="zh-book-grid">
              {ZOHAR_STRUCTURE.filter(b => b.book !== 'חלקים מיוחדים').map((b, idx) => (
                <button type="button" key={b.book} className="zh-book-card"
                  style={{ borderColor: b.color + '55' }}
                  onClick={() => setSelectedBook(idx)}>
                  <span className="zh-book-name" style={{ color: b.color }}>{b.book}</span>
                  <span className="zh-book-count">{b.parashiyot.length} פרשיות</span>
                </button>
              ))}
            </div>
            <p className="zh-section-label" style={{ color: '#fbbf24', marginTop: 14 }}>חלקים מיוחדים</p>
            <div className="zh-special-grid">
              {ZOHAR_STRUCTURE.filter(b => b.book === 'חלקים מיוחדים').map((b, idx) => {
                const realIdx = ZOHAR_STRUCTURE.indexOf(b);
                return (
                  <div key={b.book} className="zh-parasha-grid">
                    {b.parashiyot.map(p => (
                      <button type="button" key={p.en} className="zh-parasha-btn"
                        style={{ borderColor: b.color + '55' }}
                        onClick={() => { setSelectedBook(realIdx); setSelectedParasha(p); }}>
                        {p.he}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ZoharModal({ onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="bm-overlay" role="presentation">
      <ZoharPanel onClose={onClose} />
    </div>
  );
}
