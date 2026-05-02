/**
 * טעינה חד־פעמית של https://www.youtube.com/iframe_api — תומך במספר מבקשים במקביל.
 */
const YT_API_RESOLVERS = [];
let YT_API_SCRIPT_INSERTED = false;

export function ensureYoutubeIframeAPI() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.YT && window.YT.Player) return Promise.resolve();

  return new Promise(resolve => {
    YT_API_RESOLVERS.push(resolve);

    if (!YT_API_SCRIPT_INSERTED) {
      YT_API_SCRIPT_INSERTED = true;
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      tag.onerror = () => {
        YT_API_SCRIPT_INSERTED = false;
        const pending = YT_API_RESOLVERS.splice(0, YT_API_RESOLVERS.length);
        pending.forEach(r => {
          try {
            r();
          } catch {
            /* ignore */
          }
        });
      };
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        try {
          if (typeof prev === 'function') prev();
        } catch {
          /* ignore */
        }
        const pending = YT_API_RESOLVERS.splice(0, YT_API_RESOLVERS.length);
        pending.forEach(r => {
          try {
            r();
          } catch {
            /* ignore */
          }
        });
      };
      document.head.appendChild(tag);
    }
  });
}
