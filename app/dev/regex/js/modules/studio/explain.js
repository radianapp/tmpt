// app/dev/regex/js/modules/studio/explain.js
import { parseRegex } from './parser.js';

export function explainRegex(pattern, flags = '') {
  const explanations = [];
  try {
    const cleanPattern = pattern.replace(/^\/|\/[a-z]*$/g, '');
    const ast = parseRegex(cleanPattern);
    
    walkAST(ast.body, explanations);
  } catch (err) {
    explanations.push({
      token: pattern,
      type: 'Error',
      desc: 'Gagal mem-parse pola: ' + err.message
    });
  }
  return explanations;
}

function walkAST(node, explanations) {
  if (!node) return;

  switch (node.type) {
    case 'Alternative':
      if (node.expressions) {
        node.expressions.forEach(expr => walkAST(expr, explanations));
      }
      break;

    case 'Disjunction':
      walkAST(node.left, explanations);
      explanations.push({
        token: '|',
        type: 'Alternation (Alternasi)',
        desc: 'Mencocokkan salah satu dari sisi kiri atau sisi kanan (OR).'
      });
      walkAST(node.right, explanations);
      break;

    case 'Group':
      explanations.push({
        token: node.raw || '(...)',
        type: node.capturing ? `Capture Group #${node.number || ''}` : 'Non-capturing Group',
        desc: node.capturing 
          ? `Menangkap teks cocok untuk referensi grup tangkapan ${node.number ? 'nomor ' + node.number : ''}.`
          : 'Mengelompokkan karakter tanpa membuat tangkapan grup.'
      });
      if (node.expression) {
        walkAST(node.expression, explanations);
      }
      break;

    case 'CharacterClass':
      explanations.push({
        token: node.raw || '[...]',
        type: 'Character Class (Koleksi Karakter)',
        desc: (node.negative ? 'Mencocokkan karakter apa saja KECUALI yang terdaftar: ' : 'Mencocokkan salah satu karakter dari daftar: ') + describeClass(node.expressions)
      });
      break;

    case 'Repetition':
      if (node.quantifier) {
        explanations.push({
          token: node.quantifier.raw || '*',
          type: 'Quantifier (Jumlah Kecocokan)',
          desc: describeQuantifier(node.quantifier)
        });
      }
      if (node.expression) {
        walkAST(node.expression, explanations);
      }
      break;

    case 'Assertion':
      explanations.push({
        token: node.raw || node.kind,
        type: 'Assertion (Batasan Posisi)',
        desc: describeAssertion(node.kind)
      });
      break;

    case 'Char':
      explanations.push({
        token: node.raw || node.value,
        type: 'Literal Character',
        desc: describeChar(node)
      });
      break;

    default:
      explanations.push({
        token: node.raw || node.type,
        type: node.type,
        desc: 'Pola regex terdeteksi.'
      });
  }
}

function describeClass(expressions) {
  if (!expressions || !expressions.length) return '';
  return expressions.map(expr => {
    if (expr.type === 'ClassRange') {
      return `${expr.from.value} sampai ${expr.to.value}`;
    }
    return expr.raw || expr.value;
  }).join(', ');
}

function describeQuantifier(q) {
  const greedyText = q.greedy ? ' (greedy)' : ' (lazy/non-greedy)';
  if (q.kind === '*') {
    return 'Cocok 0 kali atau lebih' + greedyText + '.';
  } else if (q.kind === '+') {
    return 'Cocok 1 kali atau lebih' + greedyText + '.';
  } else if (q.kind === '?') {
    return 'Cocok 0 atau 1 kali' + greedyText + '.';
  } else if (q.kind === 'Range') {
    if (q.from === q.to) {
      return `Tepat cocok sebanyak ${q.from} kali.`;
    }
    if (q.to === undefined) {
      return `Cocok minimal sebanyak ${q.from} kali atau lebih.`;
    }
    return `Cocok sebanyak ${q.from} sampai ${q.to} kali.`;
  }
  return q.raw || 'Jumlah tak tentu';
}

function describeAssertion(kind) {
  switch (kind) {
    case '^':
      return 'Awal baris atau awal teks.';
    case '$':
      return 'Akhir baris atau akhir teks.';
    case 'Boundary':
      return 'Batasan kata (Word boundary).';
    case 'NotBoundary':
      return 'Bukan batasan kata (Non-word boundary).';
    case 'Lookahead':
      return 'Lookahead positif (memeriksa kecocokan ke depan).';
    case 'NegativeLookahead':
      return 'Lookahead negatif (memastikan tidak ada kecocokan ke depan).';
    default:
      return 'Batasan pencocokan posisi.';
  }
}

function describeChar(node) {
  if (node.kind === 'meta') {
    if (node.value === '\\d') return 'Digit angka [0-9].';
    if (node.value === '\\D') return 'Bukan digit angka.';
    if (node.value === '\\w') return 'Huruf, angka, atau garis bawah [a-zA-Z0-9_].';
    if (node.value === '\\W') return 'Bukan huruf, angka, atau garis bawah.';
    if (node.value === '\\s') return 'Karakter spasi/whitespace.';
    if (node.value === '\\S') return 'Bukan karakter spasi/whitespace.';
    if (node.value === '.') return 'Karakter apa saja kecuali baris baru.';
  }
  return `Karakter literal '${node.value}'.`;
}
