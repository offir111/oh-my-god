const HEB = /[\u0590-\u05FF]/;

function hasHebrew(s) {
  return HEB.test(s);
}

function hebrewLetterCount(s) {
  return (s.match(/[\u0590-\u05FF]/g) || []).length;
}

/**
 * שם תחנה לתצוגה: אם יש שני שמות (עברית / לטינית, מפריד, או סוגריים) — מציגים את העברית.
 * @param {string | null | undefined} raw
 * @returns {string}
 */
export function displayStationNameHebrewPrefer(raw) {
  if (raw == null || typeof raw !== 'string') return '';
  let s = raw.trim();
  if (!s) return '';

  const byStrongSep = s.split(/\s*(?:\||\/|–|—)\s+/).map(p => p.trim()).filter(Boolean);
  if (byStrongSep.length >= 2) {
    const heb = byStrongSep.filter(hasHebrew);
    if (heb.length === 1) return heb[0];
    if (heb.length > 1) {
      return [...heb].sort((a, b) => hebrewLetterCount(b) - hebrewLetterCount(a))[0];
    }
  }

  const byHyphen = s.split(/\s+-\s+/).map(p => p.trim()).filter(Boolean);
  if (byHyphen.length >= 2) {
    const heb = byHyphen.filter(hasHebrew);
    if (heb.length === 1) return heb[0];
    if (heb.length > 1) {
      return [...heb].sort((a, b) => hebrewLetterCount(b) - hebrewLetterCount(a))[0];
    }
  }

  const parenEnd = /\s*\(\s*([^)]*?)\s*\)\s*$/;
  const m = s.match(parenEnd);
  if (m) {
    const inner = m[1].trim();
    const outer = s.slice(0, m.index).trim();
    if (outer && hasHebrew(outer)) {
      if (!hasHebrew(inner) && /[A-Za-z]/.test(inner)) {
        return outer;
      }
    }
    if ((!outer || !hasHebrew(outer)) && hasHebrew(inner)) {
      return inner;
    }
  }

  return s;
}
