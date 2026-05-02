/**
 * דיבייטים מצולמים לדף «רב VS מדען».
 *
 * - youtubeId — מזהה מהכתובת watch?v=… (מוצג רק הנגן המוטמע, לא דף יוטיוב מלא).
 * - watchUrl (אופציונלי) — אם אין youtubeId, המזהה יימשך מהכתובת לצורך iframe.
 * - channelLabel — מקור/ערוץ (מוצג מתחת לכותרת, קטן ובצבע תכלת).
 */
export const LIVE_YOUTUBE_DEBATES = [
  { id: '1', label: 'ד"ר משה רט VS רזי טלון', youtubeId: '8p9tyW0wroE', channelLabel: 'ראש בראש' },
  { id: '2', label: 'הרב מיקי אברהם VS אביב פרנקו', youtubeId: 'LVTmRwitEUI', channelLabel: 'ראש בראש' },
  {
    id: '3',
    label: 'נאור נרקיס VS. דולב דוידוביץ׳',
    youtubeId: '8xZOmzkt-lc',
    channelLabel: 'פודקאסט על המשמעות — תמיר דורטל',
  },
  { id: '4', label: 'פרופ\' אבי שגיא - טענת השעון', youtubeId: 't_90OqMCfZ4', channelLabel: 'Alex Tseitlin · אלכס צייטלין' },
  { id: '5', label: 'פרופ\' שנאן -חז"ל', youtubeId: '9Li8YbeN2OE', channelLabel: 'iGod.co.il' },
];
