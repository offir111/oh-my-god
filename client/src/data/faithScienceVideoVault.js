/**
 * מאגר תכנים סביב אמונה / מדע / אבולוציה מערוצים שונים.
 * title — כותרת ראשית (מופיעה למעלה בכרטיס).
 * channelLabel — שם הערוץ/יוזר ביוטיוב (מוצג כהשמה: נלקח מ־…).
 */

export const ROSH_BEROSH_CHANNEL_URL = 'https://www.youtube.com/@roshberosh';

/** @typedef {{ id: string, kind: 'video', title: string, href: string, youtubeId?: string, channelLabel: string }} VaultVideo */
/** @typedef {{ id: string, kind: 'channelBrowse' | 'search', title: string, href: string, channelLabel?: string }} VaultLink */

/** @type {(VaultVideo | VaultLink)[]} */
export const FAITH_SCIENCE_VIDEO_VAULT = [
  {
    id: 'vault-amnon-mhn',
    kind: 'video',
    channelLabel: 'זיכוי הרבים — לא רשמי (סגור בשבת וחג)',
    title: 'אמנון יצחק VS מהנדס חילוני — זיכוי הרבים',
    href: 'https://www.youtube.com/watch?v=kMq1J-YC6vM',
    youtubeId: 'kMq1J-YC6vM',
  },
  {
    id: 'vault-amnon-kangaroo-au',
    kind: 'video',
    channelLabel: 'הרב אמנון יצחק צדיק האמת',
    title: 'איך הגיע הקנגורו לאוסטרליה — הרב אמנון יצחק',
    href: 'https://www.youtube.com/watch?v=omO8d0sRbTM',
    youtubeId: 'omO8d0sRbTM',
  },
  {
    id: 'vault-amnon-atheist-tech',
    kind: 'video',
    channelLabel: 'הרב אמנון יצחק ! [לא רשמי]',
    title: 'ויכוח משעשע מול אתאיסט חכמולוג — הרב אמנון יצחק',
    href: 'https://www.youtube.com/watch?v=WSRoYKFzX1Y',
    youtubeId: 'WSRoYKFzX1Y',
  },
  {
    id: 'rb-01',
    kind: 'video',
    channelLabel: 'ראש בראש',
    title: 'לייב — האם ישראל צריכה להיות דתית או חילונית',
    href: 'https://www.youtube.com/watch?v=6uSmo9hrMoI',
  },
  {
    id: 'rb-02',
    kind: 'video',
    channelLabel: 'ראש בראש',
    title: 'מה חשבתי על כל העימותים',
    href: 'https://www.youtube.com/watch?v=vLkgBhw0b1g',
  },
  {
    id: 'rb-03',
    kind: 'video',
    channelLabel: 'ראש בראש',
    title: 'פרק 14 — אבולוציה',
    href: 'https://www.youtube.com/watch?v=GqeD-aiLVYM',
  },
  {
    id: 'rb-04',
    kind: 'video',
    channelLabel: 'ראש בראש',
    title: 'פרק 13 — בחירה חופשית? (מיכאל מול אביב, סיבוב שני)',
    href: 'https://www.youtube.com/watch?v=92PyqrxV1uU',
  },
  {
    id: 'rb-05',
    kind: 'video',
    channelLabel: 'ראש בראש',
    title: 'פרק 12 — גיוס חרדים',
    href: 'https://www.youtube.com/watch?v=bsbwMQpnOTE',
  },
  {
    id: 'rb-06',
    kind: 'video',
    channelLabel: 'ראש בראש',
    title: 'פרק 11 — טבעונות',
    href: 'https://www.youtube.com/watch?v=vaDu5uqqYnQ',
  },
  {
    id: 'rb-07',
    kind: 'video',
    channelLabel: 'ראש בראש',
    title: 'פרק 10 — האם נשמה קיימת?',
    href: 'https://www.youtube.com/watch?v=Y0ZrqUyjDAc',
  },
  {
    id: 'rb-08',
    kind: 'video',
    channelLabel: 'ראש בראש',
    title: 'פרק 9 — האם האדם גורם למשבר אקלים?',
    href: 'https://www.youtube.com/watch?v=Vt2zFYvv_2Y',
  },
  {
    id: 'rb-09',
    kind: 'video',
    channelLabel: 'ראש בראש',
    title: 'העל־טבעי — האם רוחות ושדים קיימים במציאות?',
    href: 'https://www.youtube.com/watch?v=8p9tyW0wroE',
  },
  {
    id: 'rb-10',
    kind: 'video',
    channelLabel: 'ראש בראש',
    title: 'ספיישל — האם האנושות יכולה לוותר על הכסף?',
    href: 'https://www.youtube.com/watch?v=38B5zS9vysQ',
  },
  {
    id: 'rb-11',
    kind: 'video',
    channelLabel: 'ראש בראש',
    title: 'יש אמת באסטרולוגיה?',
    href: 'https://www.youtube.com/watch?v=ebBXx89wUH8',
  },
  {
    id: 'rb-12',
    kind: 'video',
    channelLabel: 'ראש בראש',
    title: 'הרפורמה המשפטית',
    href: 'https://www.youtube.com/watch?v=hTLl7QT1aDY',
  },
  {
    id: 'rb-13',
    kind: 'video',
    channelLabel: 'ראש בראש',
    title: 'האם אמונה באל רציונלית?',
    href: 'https://www.youtube.com/watch?v=LVTmRwitEUI',
  },
  {
    id: 'rb-14',
    kind: 'video',
    channelLabel: 'ראש בראש',
    title: 'בחמישי — האם אמונה באל רציונלית? (קצר)',
    href: 'https://www.youtube.com/shorts/rab8zGgpfD0',
  },
  {
    id: 'rb-15',
    kind: 'video',
    channelLabel: 'ראש בראש',
    title: 'קובי VS לברון',
    href: 'https://www.youtube.com/watch?v=QVHqJS3efxQ',
  },
  {
    id: 'rb-16',
    kind: 'video',
    channelLabel: 'ראש בראש',
    title: 'מעמד הר סיני — קרה באמת?',
    href: 'https://www.youtube.com/watch?v=yUtrunmq8JQ',
  },
  {
    id: 'rb-17',
    kind: 'video',
    channelLabel: 'ראש בראש',
    title: 'כדור הארץ עגול או שהארץ שטוחה?',
    href: 'https://www.youtube.com/watch?v=fsEGf7jsqp0',
  },
  {
    id: 'ex-01',
    kind: 'video',
    channelLabel: 'פודקאסט על המשמעות — תמיר דורטל',
    title:
      'נאור נרקיס VS דולב דוידוביץ׳ — האסטרטגיה החילונית לפירוק מהחברה החרדית',
    href: 'https://www.youtube.com/watch?v=8xZOmzkt-lc',
  },
  {
    id: 'ex-02',
    kind: 'video',
    channelLabel: 'Alex Tseitlin · אלכס צייטלין',
    title: 'טענת השעון — הוכחת קיום אלוהים (עם פרופ׳ אבי שגיא)',
    href: 'https://www.youtube.com/watch?v=t_90OqMCfZ4',
  },
  {
    id: 'ex-03',
    kind: 'video',
    channelLabel: 'iGod.co.il',
    title: 'המומחה הגדול לספרות חז״ל — פרופ׳ שנאן וההלכה הרבנית',
    href: 'https://www.youtube.com/watch?v=9Li8YbeN2OE',
  },
  {
    id: 'more-ch',
    kind: 'channelBrowse',
    channelLabel: 'ראש בראש',
    title: 'גלילה בהעלאות הערוץ',
    href: `${ROSH_BEROSH_CHANNEL_URL}/videos`,
  },
  ...[
    'ראש בראש מלא',
    'אמונה ומדע עברית',
    'אבולוציה יוטיוב עברית',
    'בריאתניות מול מדע',
    'תורת הגדולים מול מדע',
    'אתיאיזם עברית',
    'יהדות רציונליות',
    'פרימיטיביזם כדור הארץ עברית',
    'ביולוגיה אבולוציה הסבר עברית',
  ].map((q, i) => ({
    id: `sch-${i + 1}`,
    kind: 'search',
    channelLabel: 'יוטיוב · חיפוש',
    title: `הרחבת מאגר · ${q}`,
    href: `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
  })),
];
