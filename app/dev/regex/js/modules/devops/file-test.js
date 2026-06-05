// app/dev/regex/js/modules/devops/file-test.js

export async function testRegexOnFile(file, pattern, flags) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = function(e) {
      const text = e.target.result;
      try {
        const regex = new RegExp(pattern, flags.includes('g') ? flags : flags + 'g');
        const lines = text.split('\n');
        
        let totalMatches = 0;
        let matchedLinesCount = 0;
        const previewMatches = [];

        lines.forEach((line, index) => {
          const matchCount = (line.match(regex) || []).length;
          if (matchCount > 0) {
            totalMatches += matchCount;
            matchedLinesCount++;
            if (previewMatches.length < 100) {
              previewMatches.push({
                lineNumber: index + 1,
                content: line
              });
            }
          }
        });

        resolve({
          totalLines: lines.length,
          matchedLines: matchedLinesCount,
          totalMatches,
          previewMatches
        });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error('Gagal membaca file.'));
    reader.readAsText(file);
  });
}
