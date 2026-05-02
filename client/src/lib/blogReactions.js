export function getLikes(id) { try { return JSON.parse(localStorage.getItem(`omg_post_likes_${id}`) || '[]'); } catch { return []; } }
export function saveLikes(id, arr) { try { localStorage.setItem(`omg_post_likes_${id}`, JSON.stringify(arr)); } catch {} }
export function getComments(id) { try { return JSON.parse(localStorage.getItem(`omg_post_comments_${id}`) || '[]'); } catch { return []; } }
export function saveComments(id, arr) { try { localStorage.setItem(`omg_post_comments_${id}`, JSON.stringify(arr.slice(-300))); } catch {} }
export function getPositions(id) { try { return JSON.parse(localStorage.getItem(`omg_post_positions_${id}`) || '{}'); } catch { return {}; } }
export function savePositions(id, obj) { try { localStorage.setItem(`omg_post_positions_${id}`, JSON.stringify(obj)); } catch {} }

export function fmtDate(ts) {
  try {
    return new Date(ts).toLocaleString('he-IL', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return ''; }
}
