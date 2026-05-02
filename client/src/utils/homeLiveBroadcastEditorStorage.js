/**
 * עורך OMG — לינקי שמע/יוטיוב לטאבי שידור חי בדף הכניסה.
 * נשמר ב־localStorage במכשיר זה בלבד (לא נשלח לשרת).
 */

export const HOME_LIVE_EDITOR_STORAGE_KEY = 'omg_home_live_broadcast_listen_v1';

/** @typedef {{ listenAudioUrl?: string, listenYoutubeId?: string, listenYoutubeUrl?: string, tabLabel?: string }} HomeLiveListenOverride */

/** @returns {Record<string, HomeLiveListenOverride>} */
export function loadHomeLiveBroadcastOverrides() {
  try {
    const raw = localStorage.getItem(HOME_LIVE_EDITOR_STORAGE_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw);
    if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
    /** מפתחות עם כל שדות השמע ריקים נזרקים — אחרת הם דורסים את ברירת המחדל ולחיצה על טאב לא עושה כלום */
    const cleaned = {};
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
      const audio = typeof v.listenAudioUrl === 'string' ? v.listenAudioUrl.trim() : '';
      const yid = typeof v.listenYoutubeId === 'string' ? v.listenYoutubeId.trim() : '';
      const yurl = typeof v.listenYoutubeUrl === 'string' ? v.listenYoutubeUrl.trim() : '';
      const tabLabel = typeof v.tabLabel === 'string' ? v.tabLabel.trim() : '';
      if (!audio && !yid && !yurl) continue;
      cleaned[k] = {
        listenAudioUrl: audio,
        listenYoutubeId: yid,
        listenYoutubeUrl: yurl,
        ...(tabLabel ? { tabLabel } : {}),
      };
    }
    return cleaned;
  } catch {
    return {};
  }
}

/** @param {Record<string, HomeLiveListenOverride>} overrides */
export function saveHomeLiveBroadcastOverrides(overrides) {
  try {
    localStorage.setItem(HOME_LIVE_EDITOR_STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    /* אחסון לא זמין */
  }
}

export function clearAllHomeLiveBroadcastOverrides() {
  try {
    localStorage.removeItem(HOME_LIVE_EDITOR_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * @template T
 * @param {Record<string, T>} baseMap
 * @param {Record<string, HomeLiveListenOverride>} overrides
 */
export function mergeHomeLiveBroadcastWithOverrides(baseMap, overrides) {
  const out = {};
  for (const k of Object.keys(baseMap)) {
    const base = { ...baseMap[k] };
    const o = overrides[k];
    if (o && typeof o === 'object') {
      if ('listenAudioUrl' in o) base.listenAudioUrl = o.listenAudioUrl ?? '';
      if ('listenYoutubeId' in o) base.listenYoutubeId = o.listenYoutubeId ?? '';
      if ('listenYoutubeUrl' in o) base.listenYoutubeUrl = o.listenYoutubeUrl ?? '';
      if ('tabLabel' in o) {
        const tl = typeof o.tabLabel === 'string' ? o.tabLabel.trim() : '';
        if (tl) base.tabLabel = tl;
        else delete base.tabLabel;
      }
    }
    out[k] = base;
  }
  return out;
}
