// app/dev/regex/js/modules/devops/sql-gen.js

export function regexToSQL(pattern, columnName = 'kolom', dialect = 'postgresql') {
  if (!pattern) return '';

  const safePattern = pattern.replace(/'/g, "''");

  switch (dialect) {
    case 'postgresql':
      return `-- PostgreSQL POSIX regex match
SELECT * FROM tabel WHERE ${columnName} ~ '${safePattern}';

-- PostgreSQL POSIX case-insensitive match
SELECT * FROM tabel WHERE ${columnName} ~* '${safePattern}';`;

    case 'mysql':
      return `-- MySQL REGEXP operator
SELECT * FROM tabel WHERE ${columnName} REGEXP '${safePattern}';`;

    case 'sqlite':
      return `-- SQLite REGEXP function (requires regexp extension)
SELECT * FROM tabel WHERE ${columnName} REGEXP '${safePattern}';`;

    default:
      return `-- Dialek SQL tidak dikenal.`;
  }
}
