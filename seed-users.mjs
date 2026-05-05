/**
 * seed-users.mjs — registers 12 fictional Israeli users via /api/register
 * Run: node seed-users.mjs
 */

const SERVER = 'https://oh-my-god-production.up.railway.app';

const USERS = [
  // 9 male
  { username: 'אברהם_כהן',    password: 'av12' },
  { username: 'יצחק_לוי',     password: 'yt34' },
  { username: 'יעקב_מזרחי',   password: 'yv56' },
  { username: 'משה_פרץ',      password: 'ms78' },
  { username: 'שלמה_ביטון',   password: 'sh12' },
  { username: 'אלון_שמיר',    password: 'al34' },
  { username: 'ניר_גולן',     password: 'nr56' },
  { username: 'ירון_אבידן',   password: 'yr78' },
  { username: 'גיל_שפירא',    password: 'gl90' },
  // 3 female
  { username: 'שרה_כהן',      password: 'sr12' },
  { username: 'רבקה_לוי',     password: 'rb34' },
  { username: 'מיכל_אברהם',   password: 'mk56' },
];

async function registerUser({ username, password }) {
  const res = await fetch(`${SERVER}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (res.ok) {
    console.log(`✅ ${username} — רשומים כעת: ${data.registered}`);
  } else {
    console.log(`⚠️  ${username} — ${data.error}`);
  }
}

console.log(`🌱 מרשים ${USERS.length} יוזרים ל-${SERVER}\n`);
for (const u of USERS) {
  await registerUser(u);
}
console.log('\n✅ סיום הרשמה');
