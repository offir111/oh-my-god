/**
 * כתובת הבסיס לשיתוף קישורים (צפייה בדיון וכו').
 * בפרודקשן משתמשים בכתובת הקנונית של Vercel כדי שהנמען תמיד יגיע לאפליקציה החיה (לא למאגר קוד או דומיין זמני).
 * ניתן לדרוס עם VITE_PUBLIC_APP_ORIGIN אם יש דומיין אחר.
 */
const CANONICAL_APP_ORIGIN = 'https://client-offir1.vercel.app';

export function getShareOrigin() {
  const env = import.meta.env.VITE_PUBLIC_APP_ORIGIN;
  if (typeof env === 'string' && /^https?:\/\//i.test(env.trim())) {
    return env.trim().replace(/\/$/, '');
  }
  if (import.meta.env.PROD) {
    return CANONICAL_APP_ORIGIN;
  }
  return typeof window !== 'undefined' ? window.location.origin : CANONICAL_APP_ORIGIN;
}
