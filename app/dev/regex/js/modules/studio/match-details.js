// app/dev/regex/js/modules/studio/match-details.js

export function getMatchDetails(text, pattern, flags) {
  if (!pattern || !text) return [];

  const details = [];
  try {
    const cleanFlags = flags.includes('g') ? flags : flags + 'g';
    const regex = new RegExp(pattern, cleanFlags);
    let match;
    let matchIndex = 0;

    // Reset index
    regex.lastIndex = 0;

    while ((match = regex.exec(text)) !== null) {
      if (match.index === regex.lastIndex) {
        regex.lastIndex++;
      }

      const fullMatch = match[0];
      const groups = match.slice(1);
      const start = match.index;
      const end = start + fullMatch.length;

      details.push({
        index: matchIndex,
        fullMatch,
        start,
        end,
        groups: groups.map((g, i) => ({
          number: i + 1,
          value: g !== undefined ? g : '(tidak ditangkap)',
          start: g !== undefined ? start + fullMatch.indexOf(g) : null,
          end: g !== undefined ? start + fullMatch.indexOf(g) + g.length : null
        }))
      });

      matchIndex++;
      if (matchIndex > 1000) break; // performance limit
    }
  } catch (err) {
    // pattern error
  }
  return details;
}
