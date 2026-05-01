/**
 * הלכות שבת לפי תאריך עברי — יום וחודש כפי שמחזיר Hebcal בשדה hm (שם חודש באנגלית) ו-hd (יום בחודש).
 * ניתן להרחיב את המאגר בכל עת — המפתח הוא `${hm}-${hd}` לחזרתיות מדי שנה.
 */

/** @typedef {{ labelHe: string; cardNum?: number; title: string; body: string; sources?: string }} ShabbatHalachaEntry */

/** @type {Record<string, ShabbatHalachaEntry>} */
export const SHABBAT_HALACHA_BY_HEBREW_MONTH_DAY = {
  // יום ראשון ב׳ באייר תשפ״ו — מתוך סדרת לוחות הלכה יומית / כרטיסיות שבת (כפי שסופקו)
  'Iyyar-2': {
    labelHe: 'ב׳ באייר תשפ״ו',
    cardNum: 2,
    title: 'מלאכת מלבן',
    body:
      'מלאכת מלבן פירושה, ניקוי צמר מעודפים מהכבש, מהלכלוך שנדבק בו, וכן פשתן וכיוצא בזה.\n\n' +
      'התולדה של המלאכה היא כיבוס של בגד, ויש בכך איסור מהתורה אפילו אם אינו מכבס את כל הבגד, אלא מנקה רק כתם אחד מהבגד, וכן אם סוחט בגד מהמים הבלועים בו, יש בכך איסור כיבוס, כיון שהסחיטה גם היא מצורכי הכיבוס.',
    sources:
      '(רמב״ם הל׳ שבת פרק ט הל׳ י, יא; משנ״ב סימן ש״ב ס״ק לח)',
  },
  // יום חמישי י״ג באייר תשפ״ו
  'Iyyar-13': {
    labelHe: 'י״ג באייר תשפ״ו',
    cardNum: 13,
    title: 'ניקוי בגד שהתלכלך ממאכל',
    body:
      'אף נפל תבשיל (לח) על בגד, מותר להסיר את הלכלוך שעל הבגד על ידי סכין או ציפורן, או לנקותו עם נייר טישו, אבל אסור לגרד את התבשיל היטב עד שלא ישאר שום רושם של לכלוך בבגד, ויזהר שלא לסחוט את הבגד.\n\n' +
      'וכן אסור לשפשף את חלקי הבגד זה בזה או לשפשף את הבגד עם מטלית או מגבת יבשה (כיון שזה דומה לכיבוס).',
    sources:
      '(שו״ע סימן ש״ב סעיף ז; משנ״ב שם ס״ק לו; ביאור הלכה סימן ש״ב סעיף א ד״ה יהא; שש״כ ח״א פרק ט״ו כז; אורחות שבת ח״א פרק י״ג כג)',
  },
};

/** רשימת כל ההלכות למצבי תצוגה / הרחבה */
export function listShabbatHalachaArchive() {
  return Object.entries(SHABBAT_HALACHA_BY_HEBREW_MONTH_DAY).map(([key, entry]) => ({ key, ...entry }));
}

export function lookupShabbatHalacha(hebcalConverterJson) {
  if (!hebcalConverterJson?.hm || hebcalConverterJson.hd == null) return null;
  const key = `${hebcalConverterJson.hm}-${hebcalConverterJson.hd}`;
  return SHABBAT_HALACHA_BY_HEBREW_MONTH_DAY[key] || null;
}
