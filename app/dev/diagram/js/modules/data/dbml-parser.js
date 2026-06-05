// app/dev/diagram/js/modules/data/dbml-parser.js

export function parseDBML(dbmlText) {
  const tables = [];
  const refs = [];
  const lines = dbmlText.split('\n').map(l => l.trim()).filter(Boolean);
  let currentTable = null;

  for (const line of lines) {
    // Abaikan komentar
    if (line.startsWith('//')) continue;

    // Definisikan Table
    const tableMatch = line.match(/^[Tt]able\s+(\w+)\s*\{/i);
    if (tableMatch) {
      currentTable = { name: tableMatch[1], columns: [], note: '' };
      tables.push(currentTable);
      continue;
    }

    // Akhir block tabel
    if (line === '}' && currentTable) {
      currentTable = null;
      continue;
    }

    // Definisikan Kolom di dalam tabel
    if (currentTable) {
      const colMatch = line.match(/^(\w+)\s+(\w+(?:\(\d+(?:,\d+)?\))?)\s*(\[.*?\])?/i);
      if (colMatch) {
        const constraints = parseConstraints(colMatch[3] || '');
        currentTable.columns.push({
          name: colMatch[1],
          type: colMatch[2],
          constraints: constraints.flags,
          note: constraints.note,
          ref: constraints.ref
        });
        
        // Jika ada referensi inline, tambahkan ke list refs
        if (constraints.ref) {
          const refMatch = constraints.ref.match(/([<>-])\s*(\w+)\.(\w+)/);
          if (refMatch) {
            refs.push({
              source_table: currentTable.name,
              source_col: colMatch[1],
              type: mapRefType(refMatch[1]),
              target_table: refMatch[2],
              target_col: refMatch[3]
            });
          }
        }
      }
      continue;
    }

    // Definisikan Referensi eksplisit di luar tabel
    // Contoh: Ref: orders.user_id > users.id
    const refMatch = line.match(/^[Rr]ef:\s*(\w+)\.(\w+)\s*([<>-])\s*(\w+)\.(\w+)/i);
    if (refMatch) {
      refs.push({
        source_table: refMatch[1],
        source_col: refMatch[2],
        type: mapRefType(refMatch[3]),
        target_table: refMatch[4],
        target_col: refMatch[5]
      });
    }
  }

  return { tables, refs };
}

function parseConstraints(bracketStr) {
  const flags = [];
  let note = '', ref = '';

  if (bracketStr.includes('pk')) flags.push('pk');
  if (bracketStr.includes('unique')) flags.push('unique');
  if (bracketStr.includes('not null')) flags.push('not null');
  if (bracketStr.includes('increment')) flags.push('increment');

  const noteMatch = bracketStr.match(/note:\s*['"](.+?)['"]/);
  if (noteMatch) note = noteMatch[1];

  const refMatch = bracketStr.match(/ref:\s*([<>-])\s*(\w+)\.(\w+)/);
  if (refMatch) ref = `${refMatch[1]} ${refMatch[2]}.${refMatch[3]}`;

  return { flags, note, ref };
}

function mapRefType(char) {
  switch (char) {
    case '>': return 'many-to-one';
    case '<': return 'one-to-many';
    case '-': return 'one-to-one';
    default: return 'one-to-many';
  }
}
