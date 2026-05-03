/**
 * סדר תצוגה ברשימת הנגן: 100 → 102 ת״א → 102 דרום → 95 רשת ב → רשת גימל → גלגלץ → 99 → כל השאר.
 * מבוסס התאמת שם (גם אחרי displayStationNameHebrewPrefer).
 */

/** @param {{ name?: string }} s */
export function radioStationIsraelMenuPriority(s) {
  const name = String(s?.name || '');
  const n = name.toLowerCase();

  // 1 — 100 FM
  if (/\b100\b/.test(n) && /fm|רדיוס|radius|100fm/i.test(name)) return 0;
  if (/^100\s*fm$/i.test(name.trim())) return 0;

  // 2 — רדיו תל אביב 102
  if (/102/.test(n) && /תל\s*אביב|tel[\s-]*aviv|תל-?אביב|רדיו\s*תל/i.test(name)) return 1;

  // 3 — רדיו דרום 102
  if (/102/.test(n) && /דרום|darom|levant|נגב|radio\s*darom|רדיו\s*דרום/i.test(name)) return 2;

  // 4 — 95 / רשת ב / כאן ב
  if (/\b95\b/.test(n)) return 3;
  if (/רשת\s*ב|כאן\s*ב|kan\s*bet|כאן-ב/i.test(name)) return 3;

  // 5 — רשת גימל / כאן ג (לא «גלגל»)
  if (/גימל|כאן\s*ג|gimmel|kan\s*g\b|קאן\s*ג/i.test(name) && !/גלגל/i.test(name)) return 4;
  if (/רשת\s*ג\s*\)|רשת\s*ג$/i.test(name)) return 4;

  // 6 — גלגלץ / כאן 88 (לא גל״צ צה״ל)
  if (/גלגלץ|galgalatz|כאן\s*88\b/i.test(name) && !/צה["״]ל|גל["״]צ|גלי\s*צה/i.test(name)) return 5;

  // 7 — 99 FM / Eco 99
  if (/eco\s*99|אקו\s*99/i.test(name)) return 6;
  if (/\b99\b/.test(n) && /fm|eco|אקו/i.test(name)) return 6;

  return 1000;
}

/** @param {{ name?: string }[]} stations */
export function sortIsraelRadioStationsForMenu(stations) {
  const copy = stations.slice();
  copy.sort((a, b) => {
    const da = radioStationIsraelMenuPriority(a);
    const db = radioStationIsraelMenuPriority(b);
    if (da !== db) return da - db;
    return String(a.name || '').localeCompare(String(b.name || ''), 'he');
  });
  return copy;
}
