const SERVER = 'https://oh-my-god-production.up.railway.app';

const usernames = [
  'אברהם_כהן', 'יצחק_לוי', 'יעקב_מזרחי', 'משה_פרץ',
  'שלמה_ביטון', 'אלון_שמיר', 'ניר_גולן', 'ירון_אבידן', 'גיל_שפירא',
  'שרה_כהן', 'רבקה_לוי', 'מיכל_אברהם',
];

const res = await fetch(`${SERVER}/api/admin/set-permanent-online`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ usernames }),
});
const data = await res.json();
console.log('תוצאה:', JSON.stringify(data, null, 2));

// Verify
const stats = await (await fetch(`${SERVER}/api/stats`)).json();
console.log(`\nאונליין: ${stats.online}`);
console.log('רשימת אונליין:', stats.onlineList);
