/**
 * ═══════════════════════════════════════════════════════════════════════
 * עורך ראשי — שידורים חיים בדף הכניסה (טאבי אמונה / אתאיזם)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * לחיצה על טאב בדף הכניסה: מפעילה או עוצרת שמע (קובץ או יוטיוב) בלי לפתוח פאנל.
 *
 * עורך OMG: מילה «עריכה» קטנה מתחת ל«שידורים חיים:» → בחירת טאב + שדות לינק; שמירה ב־localStorage
 * (מפתח omg_home_live_broadcast_listen_v1 ב־utils/homeLiveBroadcastEditorStorage.js).
 *
 * שמע — אפשר אחד או שניים יחד:
 *
 *   listenAudioUrl   — קישור ישיר להרצאה קולית (mp3, m4a, wav, ogg…).
 *                      מומלץ לקובץ ציבורי (CDN, אתר, Google Drive עם קישור ישיר לשמע).
 *
 *   listenYoutubeId  — מזהה YouTube בלבד, למשל: 'dQw4w9WgXcQ'
 *   listenYoutubeUrl — או קישור מלא: https://www.youtube.com/watch?v=… / youtu.be / shorts
 *   tabLabel (שמירה מקומית) — שם מותאם לכפתור הטאב אחרי שמילאו מקור האזנה
 *
 * סדר תצוגה: קודם נגן הקובץ (אם יש), אחריו נגן יוטיוב ממוזער (אם יש).
 * השדות יכולים להישאר ריקים — אז לא יוצג נגן מאותו סוג.
 */

/** @typedef {'faith' | 'atheism'} HomeLiveVariant */

/**
 * @typedef {{
 *   title: string,
 *   badge: string,
 *   lines: string[],
 *   search: string,
 *   variant: HomeLiveVariant,
 *   listenAudioUrl?: string,
 *   listenYoutubeId?: string,
 *   listenYoutubeUrl?: string,
 *   tabLabel?: string,
 * }} HomeLiveBroadcastEntry
 */

/** @type {Record<string, HomeLiveBroadcastEntry>} */
export const HOME_LIVE_BROADCAST_BY_KEY = {
  'faith-1': {
    title: 'הרב זמיר כהן',
    badge: 'אמונה',
    lines: [
      'שידור חי: תורה, אמונה והלכה למעשה.',
      'נושאי הערב ושעת הפתיחה יפורסמו מראש בעמוד האירועים.',
    ],
    search: '?homeFaith=1',
    variant: 'faith',
    listenAudioUrl: '',
    /** ברירת מחדל — פרק «מדעים ויהדות» (הידברות); ניתן להחליף בעורך OMG */
    listenYoutubeId: '3pSAfw3dlWg',
    listenYoutubeUrl: '',
  },
  'faith-2': {
    title: 'שידור LIVE — אמונה',
    badge: 'אמונה · 2',
    lines: ['פרטי השידור יעודכנו בקרוב.', 'לחצו למטה לעמוד האירועים החיים.'],
    search: '?homeFaith=2',
    variant: 'faith',
    listenAudioUrl: '',
    listenYoutubeId: '',
    listenYoutubeUrl: '',
  },
  'faith-3': {
    title: 'שידור LIVE — אמונה',
    badge: 'אמונה · 3',
    lines: ['פרטי השידור יעודכנו בקרוב.', 'לחצו למטה לעמוד האירועים החיים.'],
    search: '?homeFaith=3',
    variant: 'faith',
    listenAudioUrl: '',
    listenYoutubeId: '',
    listenYoutubeUrl: '',
  },
  'atheism-1': {
    title: 'הקו האתאיסטי',
    badge: 'אתאיזם',
    lines: [
      'שידור חי: דיון ותכנים מזווית חילונית־מדעית.',
      'כותרת הפרק וקישור ישיר יופיעו בעמוד האירועים כשיהיו זמינים.',
    ],
    search: '?homeAtheism=1',
    variant: 'atheism',
    listenAudioUrl: '',
    /** ברירת מחדל — דיבייט מצולם; ניתן להחליף בעורך OMG */
    listenYoutubeId: '8p9tyW0wroE',
    listenYoutubeUrl: '',
  },
  'atheism-2': {
    title: 'שידור LIVE — אתאיזם',
    badge: 'אתאיזם · 2',
    lines: ['פרטי השידור יעודכנו בקרוב.', 'לחצו למטה לעמוד האירועים החיים.'],
    search: '?homeAtheism=2',
    variant: 'atheism',
    listenAudioUrl: '',
    listenYoutubeId: '',
    listenYoutubeUrl: '',
  },
  'atheism-3': {
    title: 'שידור LIVE — אתאיזם',
    badge: 'אתאיזם · 3',
    lines: ['פרטי השידור יעודכנו בקרוב.', 'לחצו למטה לעמוד האירועים החיים.'],
    search: '?homeAtheism=3',
    variant: 'atheism',
    listenAudioUrl: '',
    listenYoutubeId: '',
    listenYoutubeUrl: '',
  },
};
