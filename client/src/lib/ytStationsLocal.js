/** תחנות YouTube משורת המיני — נשמרות ב־localStorage (משותף ל־MiniRadioBar, לתפריט ולדף וידיאו+LIVE). */

export const LS_YT = 'omg_yt_stations_v1';

const DEFAULT_ATHEIST_LINE_URL = 'https://www.youtube.com/watch?v=9MOoGH_JCyY';

export const DEFAULT_YT = [
  { id: 1, name: 'הקו האתאיסטי', url: DEFAULT_ATHEIST_LINE_URL },
  { id: 2, name: 'אמנון יצחק', url: '' },
  { id: 3, name: 'הרב זמיר כהן', url: '' },
  { id: 4, name: 'שידור 4', url: '' },
  { id: 5, name: 'שידור 5', url: '' },
  { id: 6, name: 'שידור 6', url: '' },
  { id: 7, name: 'שידור 7', url: '' },
  { id: 8, name: 'שידור 8', url: '' },
  { id: 9, name: 'שידור 9', url: '' },
  { id: 10, name: 'שידור 10', url: '' },
];

export function readYtStations() {
  try {
    const r = localStorage.getItem(LS_YT);
    if (r) {
      const list = JSON.parse(r);
      if (Array.isArray(list) && list[0]?.id === 1 && !String(list[0]?.url || '').trim()) {
        return list.map((row, i) =>
          i === 0 ? { ...row, url: DEFAULT_ATHEIST_LINE_URL } : row,
        );
      }
      return list;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_YT;
}

export function saveYtStations(list) {
  try {
    localStorage.setItem(LS_YT, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/**
 * לאחר לחיצת משתמש (▶ / תפריט): ביטול השתקה וסאונד בנגן המוטמע.
 * פרמטר volume ב-query אינו נתמך ב-iframe של YouTube — הוסר כאן אם היה.
 */
export function applyYoutubeEmbedPlaybackParams(embedUrl) {
  if (!embedUrl || typeof embedUrl !== 'string') return embedUrl;
  try {
    const u = new URL(embedUrl);
    u.searchParams.delete('volume');
    u.searchParams.set('mute', '0');
    u.searchParams.set('playsinline', '1');
    if (!u.searchParams.has('autoplay')) u.searchParams.set('autoplay', '1');
    if (!u.searchParams.has('enablejsapi')) u.searchParams.set('enablejsapi', '1');
    if (typeof window !== 'undefined' && window.location?.origin) {
      u.searchParams.set('origin', window.location.origin);
    }
    return u.toString();
  } catch {
    return embedUrl;
  }
}

/** כתובת iframe להטמעה (עם autoplay לשימוש ב־video-live). */
export function ytEmbedUrl(raw) {
  if (!raw?.trim()) return null;
  try {
    const u = new URL(raw.trim());
    if (u.hostname === 'youtu.be') return `https://www.youtube.com/embed${u.pathname}?autoplay=1&enablejsapi=1`;
    const v = u.searchParams.get('v');
    if (v) return `https://www.youtube.com/embed/${v}?autoplay=1&enablejsapi=1`;
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts[0] === 'live' && parts[1]) return `https://www.youtube.com/embed/${parts[1]}?autoplay=1&enablejsapi=1`;
    if (parts[0] === 'channel' && parts[1]?.startsWith('UC'))
      return `https://www.youtube.com/embed/live_stream?channel=${parts[1]}&autoplay=1&enablejsapi=1`;
  } catch {
    /* ignore */
  }
  return null;
}

export const LS_YT_SELECTED = 'omg_yt_selected_id';

export function readYtSelectedStationId() {
  try {
    const v = parseInt(localStorage.getItem(LS_YT_SELECTED) || '1', 10);
    return Number.isFinite(v) && v > 0 ? v : 1;
  } catch {
    return 1;
  }
}

export function writeYtSelectedStationId(id) {
  try {
    localStorage.setItem(LS_YT_SELECTED, String(id));
  } catch {
    /* ignore */
  }
}

/**
 * כמו לחיצת ▶ יוטיוב בשורת המיני — מעדכן את ה־URL ב־store לדף וידיאו+LIVE.
 * @returns {boolean} האם נמצא קישור תקין והוגדר נגן
 */
export function launchYoutubeTvFromStoredStations(setYtTvUrl, _volume01 = 0.85) {
  const stations = readYtStations();
  const selId = readYtSelectedStationId();
  const activeYt = stations.find(s => s.id === selId) ?? stations[0];
  if (!activeYt) return false;
  const embedUrl = ytEmbedUrl(activeYt.url);
  if (!embedUrl) return false;
  setYtTvUrl(applyYoutubeEmbedPlaybackParams(embedUrl));
  return true;
}
