// app/dev/regex/js/modules/studio/highlight.js

export function highlightMatches(text, pattern, flags) {
  if (!pattern || !text) {
    return escapeHtml(text);
  }

  try {
    // Pastikan flag g diaktifkan agar loop tidak membeku
    const cleanFlags = flags.includes('g') ? flags : flags + 'g';
    const regex = new RegExp(pattern, cleanFlags);
    
    const MATCH_COLORS = ['#ffd700', '#90ee90', '#87ceeb', '#ffb6c1', '#e6e6fa'];
    let result = '';
    let lastEnd = 0;
    let match;
    let matchIndex = 0;

    // Reset regex index
    regex.lastIndex = 0;

    while ((match = regex.exec(text)) !== null) {
      // Cegah infinite loop untuk zero-width matches
      if (match.index === regex.lastIndex) {
        regex.lastIndex++;
      }

      const matchText = match[0];
      const start = match.index;
      const end = start + matchText.length;

      // Tambah teks non-match sebelumnya
      result += escapeHtml(text.slice(lastEnd, start));

      // Tambah teks match dengan warna highlight
      const color = MATCH_COLORS[matchIndex % MATCH_COLORS.length];
      result += `<mark class="regex-match" style="background: ${color};" data-match="${matchIndex}" title="Kecocokan ${matchIndex + 1}: ${escapeHtml(matchText)}">${escapeHtml(matchText)}</mark>`;

      lastEnd = end;
      matchIndex++;
      
      // Batasi untuk performa
      if (matchIndex > 1000) break;
    }

    result += escapeHtml(text.slice(lastEnd));
    
    // Pastikan jika teks diakhiri baris baru, kita menambahkan spasi/br agar tinggi backdrop dan textarea tetap sama
    if (text.endsWith('\n')) {
      result += ' ';
    }

    return result;
  } catch (err) {
    return escapeHtml(text);
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
