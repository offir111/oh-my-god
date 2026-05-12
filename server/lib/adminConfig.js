/**
 * סיסמת מנהל OMG: חובה בדיוק 8 תווים ב־OMG_ADMIN_PASSWORD.
 * בפיתוח מקומי בלבד — אם לא הוגדר, נשתמש בסיסמת ברירת מחדל (נרשם באזהרה בקונסול).
 */
const DEV_FALLBACK_PASSWORD = 'devomg88';

let devFallbackWarned = false;

export function getOmgAdminPassword() {
  const raw = process.env.OMG_ADMIN_PASSWORD;
  if (typeof raw === 'string' && raw.length === 8) return raw;
  if (!devFallbackWarned) {
    devFallbackWarned = true;
    console.warn(
      `[admin] OMG_ADMIN_PASSWORD לא מוגדר או לא 8 תווים — משתמשים בסיסמת ברירת מחדל (${DEV_FALLBACK_PASSWORD}). מומלץ להגדיר OMG_ADMIN_PASSWORD ב-Railway`,
    );
  }
  return DEV_FALLBACK_PASSWORD;
}

export function isOmgAdminConfigured() {
  return getOmgAdminPassword().length === 8;
}
