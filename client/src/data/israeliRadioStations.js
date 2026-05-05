/**
 * זרמי שידור חי לתחנות מרכזיות בישראל.
 * כל URL הוא זרם Icecast/MP3 ישיר שעובר דרך פרוקסי בשרת.
 * סדר ברירת מחדל: 103 → 100 → 102 ת״א → 102 דרום → רשת ב (95) → רשת ג → גלגלץ → 99 → שאר התחנות.
 */
export const ISRAELI_RADIO_STATIONS = [
  {
    id: 'radio103',
    name: 'רדיו 103 FM',
    streamUrl: 'https://cdn.cybercdn.live/103FM/Live/icecast.audio',
  },
  {
    id: 'radius100',
    name: '100FM',
    streamUrl: 'https://100fm.streamgates.net/100Fm/mp3/icecast.audio',
  },
  {
    id: 'telaviv102',
    name: 'רדיו תל אביב 102',
    streamUrl: 'https://102fm.streamgates.net/102fm/mp3/icecast.audio',
  },
  {
    id: 'radio-darom',
    name: 'רדיו דרום 102',
    streamUrl: 'https://102.streamgates.net/RadioDaromLevant/mp3/icecast.audio',
  },
  {
    id: 'kan-bet',
    name: 'כאן ב (רשת ב)',
    streamUrl: 'https://radiokan.streamgates.net/kanbet/mp3/icecast.audio',
  },
  {
    id: 'kan-gimmel',
    name: 'כאן ג (רשת ג)',
    streamUrl: 'https://kan24.streamgates.net/kangimmel/mp3/icecast.audio',
  },
  {
    id: 'galgalatz',
    name: 'גלגלץ (כאן 88)',
    streamUrl: 'https://radiokan.streamgates.net/kan88/mp3/icecast.audio',
  },
  {
    id: 'eco99',
    name: 'Eco 99 FM',
    streamUrl: 'https://eco99fm.streamgates.net/Eco99fm/mp3/icecast.audio',
  },
  {
    id: 'glz',
    name: 'גל"צ (גלי צה"ל)',
    streamUrl: 'https://glz.streamgates.net/glz_mp3/icecast.audio',
  },
  {
    id: 'kol-berama',
    name: 'קול ברמה',
    streamUrl: 'https://kolberama.streamgates.net/KolBerama/mp3/icecast.audio',
  },
  {
    id: 'kol-chai',
    name: 'קול חי',
    streamUrl: 'https://kolchai.streamgates.net/KolChai/mp3/icecast.audio',
  },
  {
    id: 'arutz7',
    name: 'ערוץ 7 (אורות)',
    streamUrl: 'https://cdnout.arutz7.co.il/radio/aacp/arutz7.aac',
  },
  {
    id: 'kol-emunah',
    name: 'קול אמונה',
    streamUrl: 'https://kolemunah.streamgates.net/KolEmunah/mp3/icecast.audio',
  },
  {
    id: 'kol-neshama',
    name: 'קול נשמה',
    streamUrl: 'https://kolneshama.streamgates.net/KolNeshama/mp3/icecast.audio',
  },
  {
    id: 'kan-main',
    name: 'כאן — רדיו תוכן עברי',
    streamUrl: 'https://radiokan.streamgates.net/kankan/mp3/icecast.audio',
  },
];
