// Chinese font data for jsPDF
// This is a simplified approach - in production you'd want to use a proper Chinese font file

export const chineseFontBase64 = `data:font/truetype;base64,AAEAAAAOAIAAAwBgT1MvMj3hSQEAAADsAAAATmNtYXDQEhm3AAABPAAAAUpjdnQgBkFyZgAAAWAAAAA+ZnBnbYoKeDsAAAGIAAAJkWdhc3AAAAAQAAAAEAAAAAjZ2x5ZqJwJ2EAAABAAAAA`;

// Alternative approach: Use a web font that supports Chinese
export const chineseFontUrl = 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap';

// Font family names that support Chinese characters
export const chineseFontFamilies = [
  'Noto Sans SC',
  'Microsoft YaHei',
  'SimSun',
  'SimHei',
  'Arial Unicode MS',
  'sans-serif'
];
