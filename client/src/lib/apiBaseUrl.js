/**
 * בסיס לקריאות fetch ל־API:
 * - VITE_API_URL אם מוגדר
 * - ב־Vite dev: מחרוזת ריקה — כתובת יחסית `/api/...` עוברת ב־proxy ל־localhost:3001 (עובד גם מטלפון ב־LAN)
 * - בבילד לייצור בלי env: שרת הייצור
 */
export function getApiBaseUrl() {
  const raw = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
  if (raw) return raw;
  if (import.meta.env.DEV) return '';
  return 'https://oh-my-god-production.up.railway.app';
}
