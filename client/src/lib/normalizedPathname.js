/**
 * pathname מ־useLocation (בלי query); מנקה סלאש בסוף לעקביות השוואה ל-/settings וכדומה.
 */
export default function normalizedPathname(pathname) {
  let p = String(pathname ?? '/').trim();
  const q = p.indexOf('?');
  if (q !== -1) p = p.slice(0, q);
  const h = p.indexOf('#');
  if (h !== -1) p = p.slice(0, h);
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p || '/';
}
