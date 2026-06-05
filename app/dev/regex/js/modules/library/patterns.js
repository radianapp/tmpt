// app/dev/regex/js/modules/library/patterns.js

export async function loadBuiltInPatterns() {
  try {
    const response = await fetch('./data/patterns.json');
    if (!response.ok) throw new Error('Gagal memuat pustaka pola.');
    return await response.json();
  } catch (err) {
    console.error(err);
    return [];
  }
}

export function filterPatterns(patterns, query) {
  if (!query) return patterns;
  const lowerQuery = query.toLowerCase().trim();
  
  return patterns.filter(p => 
    p.title.toLowerCase().includes(lowerQuery) ||
    p.description.toLowerCase().includes(lowerQuery) ||
    p.pattern.toLowerCase().includes(lowerQuery) ||
    p.category.toLowerCase().includes(lowerQuery)
  );
}
