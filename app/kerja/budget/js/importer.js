// app/kerja/budget/js/importer.js
import { putToStore, getAllByIndexFromStore } from './budget-db.js';

export const BANK_CONFIGS = {
  gopay: {
    dateCol: 'Tanggal Transaksi',
    descCol: 'Keterangan',
    amountCol: 'Jumlah',
    typeCol: 'Tipe',
    expenseVal: 'Pengeluaran',
    incomeVal: 'Pemasukan'
  },
  bca: {
    dateCol: 'TANGGAL',
    descCol: 'KETERANGAN',
    debitCol: 'DEBET',
    creditCol: 'KREDIT'
  },
  generic: {
    dateCol: 'Tanggal',
    descCol: 'Deskripsi',
    amountCol: 'Jumlah',
    typeCol: 'Tipe' // 'income' / 'expense'
  }
};

/**
 * Mem-parse baris CSV secara sederhana
 */
export function parseCSVText(text) {
  const lines = [];
  let row = [""];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (c === '"') {
      if (inQuotes && next === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push('');
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') i++;
      lines.push(row);
      row = [''];
    } else {
      row[row.length - 1] += c;
    }
  }
  if (row.length > 1 || row[0] !== '') lines.push(row);
  return lines;
}

/**
 * Melakukan auto-categorize sederhana berdasarkan kata kunci deskripsi transaksi.
 */
export function autoMatchCategory(desc, items) {
  const descUpper = desc.toUpperCase();
  const rules = [
    { keys: ['PLN', 'LISTRIK'], target: 'listrik' },
    { keys: ['CBN', 'INDIHOME', 'BIZNET', 'WIFI'], target: 'internet' },
    { keys: ['GOPAY', 'OVO', 'DANA', 'LINKAJA'], target: 'ewallet' },
    { keys: ['ALFAMART', 'INDOMARET', 'GRAB', 'GOJEK'], target: 'rutin' },
    { keys: ['TRANSFER', 'KREDIT', 'DEBET'], target: 'cicilan' }
  ];

  for (let rule of rules) {
    if (rule.keys.some(k => descUpper.includes(k))) {
      const match = items.find(item => item.name.toLowerCase().includes(rule.target) || item.name.toLowerCase().includes(rule.keys[0].toLowerCase()));
      if (match) return match.id;
    }
  }
  return null;
}
