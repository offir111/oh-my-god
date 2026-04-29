/**
 * נושאים למעקב פופולריות בשיחות (אדם–אדם ואדם–AI).
 * ספירה: לכל הודעת טקסט — עד נקודה אחת לכל נושא שהמילות מפתח שלו מופיעות בה.
 */

/** id יציב לשמירה ב־snapshot; keywords בעברית לחיפוש תת־מחרוזת */
export const TOPIC_DEFINITIONS = [
  { id: 'watchmaker', label: 'טיעון השען', keywords: ['טיעון השען', 'טיעון השעון', 'שען עיוור', 'עיצוב תוכניי'] },
  { id: 'exodus', label: 'יציאת מצרים', keywords: ['יציאת מצרים', 'יציאה ממצרים', 'עשר המכות', 'ים סוף'] },
  { id: 'generations_chain', label: 'אבא מעביר לבן · שרשרת דורות', keywords: ['שרשרת הדורות', 'אבא מעביר לבן', 'משיח מאדם', 'תולדות משיח', 'מספר השען'] },
  { id: 'god_existence', label: 'אלוהים', keywords: ['אלוהים', 'אלוקים', 'השם', 'בורא העולם', 'בורא'] },
  { id: 'big_bang', label: 'המפץ הגדול', keywords: ['המפץ הגדול', 'מפץ גדול', 'Big Bang', 'big bang'] },
  { id: 'evolution', label: 'אבולוציה', keywords: ['אבולוציה', 'דארווין', 'ברירה טבעית', 'מוטציה', 'הסתגלות'] },
  { id: 'bible_creation', label: 'בריאה לפי התנ״ך', keywords: ['בראשית', 'שישה ימים', 'בריאת העולם', 'יום ראשון', 'מתי נברא'] },
  { id: 'bible_general', label: 'תנ״ך ופרשנות', keywords: ['תנ״ך', 'מקרא', 'פרשנות', 'פסוקים', 'נביאים'] },
  { id: 'carbon14', label: 'תארוך פחמן־14', keywords: ['פחמן 14', 'פחמן-14', 'פחמן14', 'תארוך פחמן', 'C14'] },
  { id: 'dna_chimp', label: 'DNA והשימפנזה', keywords: ['DNA', 'דנ״א', 'שימפנזה', 'גנטיקה', 'אחוזים מהגנום'] },
  { id: 'abiogenesis', label: 'אביוגנזה · מוצא החיים', keywords: ['אביוגנזה', 'חיים מדומם', 'ספונטני'] },
  { id: 'fine_tuning', label: 'כוונון עדין של היקום', keywords: ['כוונון עדין', 'fine tuning', 'קבועים פיזיקליים'] },
  { id: 'dinosaurs', label: 'דינוזאורים וגיל השכבות', keywords: ['דינוזאורים', 'דינוזאור', 'שכבות סלע', 'זמן גיאולוגי'] },
  { id: 'oral_torah', label: 'תורה שבעל פה', keywords: ['חז״ל', 'תורה שבעל פה', 'משנה', 'תלמוד', 'גמרא'] },
  { id: 'morality', label: 'מוסר ומצפון', keywords: ['מוסר אובייקטיבי', 'מוסר', 'מצפון', 'טוב ורע'] },
];

export function recordMessageTopics(store, text) {
  if (!text || typeof text !== 'string') return false;
  const t = text.normalize('NFC');
  let changed = false;
  for (const topic of TOPIC_DEFINITIONS) {
    const hit = topic.keywords.some((kw) => t.includes(kw));
    if (!hit) continue;
    const id = topic.id;
    const prev = store.topicCounts.get(id) || 0;
    store.topicCounts.set(id, prev + 1);
    changed = true;
  }
  return changed;
}
