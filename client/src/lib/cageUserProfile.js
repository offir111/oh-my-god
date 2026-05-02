/**
 * פרופיל משתמש בסגנון «הכלוב» — נתונים אישיים ובלוג, נשמרים במכשיר לפי שם משתמש.
 */

const STORAGE_KEY_PREFIX = 'cage_profile_v2:';
const PRIVATE_NOTE_PREFIX = 'cage_profile_note_v1:';
export const DEMO_PROFILE_USERNAME = 'still here';

/** @typedef {{ id: string, title: string, body: string, ts: number }} CageBlogPost */

/**
 * @typedef {{ id: string, url: string, isPublic: boolean, ts: number }} CageGalleryItem
 */

/** ערך התחלה לכל פרופיל (לפני מיזוג שמירה ודמו) */
export function emptyCageProfile() {
  return {
    avatarDataUrl: '',
    /** חדשות / סטטוס קצר */
    news: '',
    /** קו מצב מתחת לשם */
    opennessLine: '',
    gender: '',
    region: '',
    age: '',
    maritalStatus: '',
    /** טקסט לשורה «נראה לאחרונה» */
    lastSeenLabel: '',
    joinDateLabel: '',
    updatedAtTs: Date.now(),
    whoAmI: '',
    viewsOnControl: '',
    boundaries: '',
    /** @type {string[]} Data URLs תמונות (legacy gallery) */
    photos: [],
    /** @type {CageGalleryItem[]} גלריה ציבורית/פרטית */
    galleryItems: [],
    /** @type {CageBlogPost[]} */
    blogPosts: [],
  };
}

/** דמו בסיסי לפרופיל still here — מתמזג כשאין נתונים שמורים */
export function demoStillHereProfile() {
  const ts = Date.now();
  return {
    ...emptyCageProfile(),
    news: 'פתוח לקשר ולהיכרות ✌️',
    opennessLine: 'פתוח להיכרויות חדשות',
    gender: 'גבר',
    region: 'השרון והסביבה',
    age: '29',
    maritalStatus: 'רווק',
    lastSeenLabel: 'נמצא עכשיו בכלוב',
    joinDateLabel: `28 בדצמבר ${new Date(ts).getFullYear() - 1}`,
    whoAmI:
      'בן 29, אוהב גלישה, את הים ואימונים — מחפש חיבור שיכול לנוע משיחה עמוקה ועד כימיה פיזית, בקצב שמתאים לשני הצדדים.',
    viewsOnControl:
      'מפריד בין פנטזיה למציאות, חשוב לי קצב והקשבה הדדית. מתעניין גם במשחקי הערצה כשיש אמון.',
    boundaries:
      'פחות מתחבר לדרישות מיידיות בלי כבוד. גבולות קשיחים: דברים קיצוניים, דם, או כאב לשם כאב.',
    blogPosts: [
      {
        id: 'demo-way',
        title: 'דרך חדשה',
        body:
          'קצת מחשבות אישיות על דרך חדשה — לבחון את עצמי, את הקהילה, ואת מה שחשוב לשמור בדרך.',
        ts: ts - 7 * 24 * 60 * 60 * 1000,
      },
    ],
  };
}

function storageKey(usernameNorm) {
  return `${STORAGE_KEY_PREFIX}${usernameNorm}`;
}

function privateNoteKey(viewerNorm, subjectNorm) {
  return `${PRIVATE_NOTE_PREFIX}${viewerNorm}:${subjectNorm}`;
}

export function normalizeProfileUsername(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase();
}

export function readCageProfile(usernameNorm) {
  const key = storageKey(usernameNorm);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || typeof p !== 'object') return null;
    return mergeValidProfile(p);
  } catch {
    return null;
  }
}

function mergeValidProfile(partial) {
  const base = emptyCageProfile();
  const out = { ...base, ...partial };
  if (!Array.isArray(out.photos)) out.photos = [];
  if (!Array.isArray(out.blogPosts)) out.blogPosts = [];
  if (!Array.isArray(out.galleryItems)) out.galleryItems = [];
  out.photos = out.photos.filter(x => typeof x === 'string' && x.startsWith('data:image/'));
  out.galleryItems = out.galleryItems
    .filter(x => x && typeof x.url === 'string' && x.url.startsWith('data:image/'))
    .map(x => ({
      id: typeof x.id === 'string' ? x.id : `gi-${Math.random().toString(36).slice(2, 11)}`,
      url: x.url.slice(0, 2_500_000),
      isPublic: Boolean(x.isPublic),
      ts: typeof x.ts === 'number' ? x.ts : Date.now(),
    }))
    .slice(0, 40);
  out.blogPosts = out.blogPosts
    .filter(x => x && typeof x.title === 'string' && typeof x.body === 'string')
    .map(x => ({
      id: typeof x.id === 'string' ? x.id : `post-${Math.random().toString(36).slice(2, 11)}`,
      title: x.title.slice(0, 200),
      body: x.body.slice(0, 20000),
      ts: typeof x.ts === 'number' ? x.ts : Date.now(),
    }))
    .slice(0, 80);
  if (typeof out.updatedAtTs !== 'number') out.updatedAtTs = Date.now();
  const str = k => (typeof out[k] === 'string' ? out[k].slice(0, 5000) : '');
  out.news = str('news');
  out.opennessLine = str('opennessLine');
  out.gender = str('gender').slice(0, 80);
  out.region = str('region').slice(0, 120);
  out.age = str('age').slice(0, 20);
  out.maritalStatus = str('maritalStatus').slice(0, 80);
  out.lastSeenLabel = str('lastSeenLabel').slice(0, 200);
  out.joinDateLabel = str('joinDateLabel').slice(0, 120);
  out.whoAmI = str('whoAmI').slice(0, 12000);
  out.viewsOnControl = str('viewsOnControl').slice(0, 12000);
  out.boundaries = str('boundaries').slice(0, 12000);
  out.avatarDataUrl =
    typeof out.avatarDataUrl === 'string' && out.avatarDataUrl.startsWith('data:image/')
      ? out.avatarDataUrl.slice(0, 2_500_000)
      : '';
  out.photos = out.photos.slice(0, 24);
  return out;
}

/**
 * פרופיל מוצג למשתמש — שילוב ממורא + דמו ל־still here
 */
export function getMergedCageProfile(displayUsername) {
  const norm = normalizeProfileUsername(displayUsername);
  const stored = readCageProfile(norm);
  if (stored) return stored;
  if (norm === normalizeProfileUsername(DEMO_PROFILE_USERNAME)) {
    return demoStillHereProfile();
  }
  return emptyCageProfile();
}

/** תמונת פרופיל מהמכשיר (אם קיימת) לפי שם תצוגה — לשימוש ב־UI לפני השם */
export function getCageAvatarDataUrlForDisplayName(displayName) {
  const url = getMergedCageProfile(displayName).avatarDataUrl;
  return typeof url === 'string' && url.startsWith('data:image/') ? url : '';
}

export function saveCageProfile(usernameNorm, profile) {
  const merged = mergeValidProfile({ ...profile, updatedAtTs: Date.now() });
  try {
    localStorage.setItem(storageKey(usernameNorm), JSON.stringify(merged));
    return merged;
  } catch {
    return null;
  }
}

export function readPrivateNote(viewerNorm, subjectNorm) {
  try {
    const v = localStorage.getItem(privateNoteKey(viewerNorm, subjectNorm));
    return typeof v === 'string' ? v.slice(0, 8000) : '';
  } catch {
    return '';
  }
}

export function savePrivateNote(viewerNorm, subjectNorm, text) {
  try {
    const t = typeof text === 'string' ? text.slice(0, 8000) : '';
    if (!t.trim()) localStorage.removeItem(privateNoteKey(viewerNorm, subjectNorm));
    else localStorage.setItem(privateNoteKey(viewerNorm, subjectNorm), t);
    return true;
  } catch {
    return false;
  }
}

/** מחזיר את כל התמונות הציבוריות מכל הפרופילים השמורים במכשיר */
export function getAllPublicPhotos() {
  const results = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(STORAGE_KEY_PREFIX)) continue;
    const username = key.slice(STORAGE_KEY_PREFIX.length);
    if (!username) continue;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const p = JSON.parse(raw);
      if (!p || !Array.isArray(p.galleryItems)) continue;
      for (const item of p.galleryItems) {
        if (item?.isPublic && typeof item.url === 'string' && item.url.startsWith('data:image/')) {
          results.push({ id: item.id, url: item.url, ts: item.ts || 0, username });
        }
      }
    } catch {}
  }
  return results.sort((a, b) => b.ts - a.ts);
}

export async function readFileAsDataUrl(file, maxBytes = 1_400_000) {
  if (!file?.type?.startsWith('image/')) return null;
  if (file.size > maxBytes) return null;
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === 'string' ? r.result : null);
    r.onerror = () => reject(new Error('read'));
    r.readAsDataURL(file);
  });
}
