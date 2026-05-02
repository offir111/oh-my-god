/**
 * מזהה סרטון YouTube להטמעה — מזהה גולמי או מכתובת watch / shorts / youtu.be
 * @param {{ youtubeId?: string, watchUrl?: string }} clip
 * @returns {string}
 */
export function youtubeEmbedIdFromClip(clip) {
  const direct = clip.youtubeId?.trim();
  if (direct) return direct;
  const raw = clip.watchUrl?.trim();
  if (!raw) return '';
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').split('/')[0];
      return id || '';
    }
    if (host.endsWith('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return v.trim();
      const m = u.pathname.match(/\/embed\/([^/?]+)/);
      if (m) return m[1];
      const s = u.pathname.match(/\/shorts\/([^/?]+)/);
      if (s) return s[1];
    }
  } catch {
    /* לא כתובת תקינה */
  }
  return '';
}
