/**
 * זמני כניסת שבת (נרות) ויציאת שבת (הבדלה) מ־Hebcal — לפי קואורדינטות מקומיות.
 * מקור ציבורי יציב: https://www.hebcal.com/home/195/jewish-calendar-rest-api
 */

export const HEBCAL_SHABBAT_LOCATIONS = [
  { key: 'telaviv', label: 'תל אביב', short: 'ת״א', lat: 32.0853, lon: 34.7818 },
  { key: 'jerusalem', label: 'ירושלים', short: 'י-ם', lat: 31.7683, lon: 35.2137 },
  { key: 'beerSheva', label: 'באר שבע', short: 'ב״ש', lat: 31.2518, lon: 34.7915 },
];

/** דקות לפני השקיעה — כמו שמופיע ברוב לוחות מודפסים בישראל (~רבנות / רחב) */
const CANDLE_MINUTES_BEFORE_SUNSET = 18;

function parseCandleItem(items) {
  if (!Array.isArray(items)) return null;
  return items.find((i) => i.category === 'candles') || null;
}

function parseParashaItem(items) {
  if (!Array.isArray(items)) return null;
  return items.find((i) => i.category === 'parashat') || null;
}

function parseHavdalahItem(items) {
  if (!Array.isArray(items)) return null;
  return items.find((i) => i.category === 'havdalah') || null;
}

function formatClock(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatWeekDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short' });
}

/**
 * @param {{ lat: number, lon: number, label?: string }} location
 * @param {AbortSignal} [signal]
 */
export async function fetchShabbatCandleForLocation(location, signal) {
  const { lat, lon } = location;
  const url = `https://www.hebcal.com/shabbat?cfg=json&latitude=${lat}&longitude=${lon}&m=${CANDLE_MINUTES_BEFORE_SUNSET}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const candle = parseCandleItem(data.items);
  const havdalah = parseHavdalahItem(data.items);
  const parasha = parseParashaItem(data.items);
  return {
    ...location,
    candleIso: candle?.date || null,
    candleTitle: candle?.title || candle?.hebrew || '',
    havdalahIso: havdalah?.date || null,
    havdalahTitle: havdalah?.title || havdalah?.hebrew || '',
    parashaHebrew: parasha?.hebrew || '',
    parashaDate: parasha?.date || '',
    /** כניסה — הדלקת נרות */
    timeLabel: formatClock(candle?.date),
    /** יציאה — הבדלה (לפי הפריט הראשון בטווח, כפי שמחזיר Hebcal) */
    havdalahTimeLabel: formatClock(havdalah?.date),
    eveLabel: formatWeekDate(candle?.date),
  };
}

/** טוען במקביל את שלוש הערים (כניסה + יציאה) */
export async function fetchIsraelShabbatCandles(signal) {
  const rows = await Promise.all(
    HEBCAL_SHABBAT_LOCATIONS.map((loc) => fetchShabbatCandleForLocation(loc, signal)),
  );
  return rows;
}
