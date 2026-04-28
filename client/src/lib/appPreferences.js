const STORAGE_KEY = 'omg_prefs';

export const DEFAULT_PREFERENCES = {
  /** אנימציות ומעברים מינימליים */
  reduceMotion: false,
  /** normal | large | xlarge */
  fontScale: 'normal',
  /** רקע עם פחות גרדיאנטים ו״רעש״ ויזואלי */
  calmBackground: false,
  /** שמור לעתיד — כרגע האפליקציה כמעט לא משמיעה צלילים */
  uiSounds: false,
};

export function loadPreferences() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function savePreferences(prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch { /* ignore */ }
}

/** מחיל על <html> — לקרוא בטעינה ובכל שינוי */
export function applyPreferencesToDocument(prefs) {
  const root = document.documentElement;
  if (prefs.reduceMotion) root.setAttribute('data-reduce-motion', 'on');
  else root.removeAttribute('data-reduce-motion');

  const scale = ['normal', 'large', 'xlarge'].includes(prefs.fontScale) ? prefs.fontScale : 'normal';
  root.setAttribute('data-font-scale', scale);

  if (prefs.calmBackground) root.setAttribute('data-calm-bg', 'on');
  else root.removeAttribute('data-calm-bg');

  if (prefs.uiSounds) root.setAttribute('data-ui-sounds', 'on');
  else root.removeAttribute('data-ui-sounds');
}
