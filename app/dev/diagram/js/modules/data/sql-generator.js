// app/dev/diagram/js/modules/data/sql-generator.js

export function generateSQL(tables, refs, dialect = 'postgresql') {
  const statements = [];

  tables.forEach(table => {
    const cols = table.columns.map(col => {
      const constraints = [
        col.constraints.includes('pk') ? 'PRIMARY KEY' : '',
        col.constraints.includes('not null') ? 'NOT NULL' : '',
        col.constraints.includes('unique') ? 'UNIQUE' : '',
        col.constraints.includes('increment') ? autoIncrement(dialect) : ''
      ].filter(Boolean).join(' ');

      return `  ${col.name} ${mapType(col.type, dialect)} ${constraints}`.trimEnd();
    });

    statements.push(`CREATE TABLE ${table.name} (\n${cols.join(',\n')}\n);`);
  });

  // Foreign key constraints
  refs.forEach((ref, idx) => {
    const constraintName = `fk_${ref.source_table}_${ref.source_col}_${idx}`;
    statements.push(
      `ALTER TABLE ${ref.source_table}\n` +
      `  ADD CONSTRAINT ${constraintName}\n` +
      `  FOREIGN KEY (${ref.source_col})\n` +
      `  REFERENCES ${ref.target_table}(${ref.target_col});`
    );
  });

  return statements.join('\n\n');
}

function autoIncrement(dialect) {
  switch (dialect) {
    case 'postgresql': return 'SERIAL';
    case 'mysql': return 'AUTO_INCREMENT';
    case 'sqlite': return 'AUTOINCREMENT';
    case 'mssql': return 'IDENTITY(1,1)';
    default: return 'AUTO_INCREMENT';
  }
}

function mapType(type, dialect) {
  type = type.toLowerCase();
  // Map varchar, int, integer, text, boolean, datetime, etc.
  if (dialect === 'sqlite') {
    if (type.includes('varchar') || type === 'text') return 'TEXT';
    if (type === 'int' || type === 'integer') return 'INTEGER';
    if (type === 'boolean') return 'INTEGER'; // SQLite uses integer 0/1
  }
  return type.toUpperCase();
}
