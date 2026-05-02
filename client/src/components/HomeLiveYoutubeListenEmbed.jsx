import React, { useMemo } from 'react';
import { youtubeEmbedIdFromClip } from '../lib/youtubeEmbedId.js';

/**
 * נגן YouTube מוטמע לשמיעה — אותו מקור כמו «רב VS מדען», ללא מסך מלא;
 * הווידאון מוסתר ככל האפשר (חיתוך ויזואלי של ה־iframe).
 */
export default function HomeLiveYoutubeListenEmbed({ youtubeId = '', watchUrl = '' }) {
  const embedId = useMemo(
    () => youtubeEmbedIdFromClip({ youtubeId: youtubeId?.trim(), watchUrl: watchUrl?.trim() }),
    [youtubeId, watchUrl],
  );

  if (!embedId) return null;

  const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(embedId)}?rel=0&modestbranding=1&playsinline=1&iv_load_policy=3`;

  return (
    <div className="home-live-yt-listen">
      <p className="home-live-yt-listen-label">שמע מיוטיוב (לחצו ▶ בנגן)</p>
      <div className="home-live-yt-listen-shell">
        <iframe
          className="home-live-yt-listen-frame"
          src={src}
          title="שמע — YouTube"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; web-share"
          loading="lazy"
        />
      </div>
    </div>
  );
}
