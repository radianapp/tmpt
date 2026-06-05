// app/dev/regex/js/modules/library/cheatsheet.js

export function getCheatsheetData() {
  return [
    { token: '\\d', label: 'Digit angka', desc: 'Mencocokkan angka [0-9]' },
    { token: '\\D', label: 'Bukan digit', desc: 'Mencocokkan apa saja selain angka' },
    { token: '\\w', label: 'Alfanumerik', desc: 'Huruf, angka, atau garis bawah [a-zA-Z0-9_]' },
    { token: '\\W', label: 'Bukan alfanumerik', desc: 'Karakter selain huruf, angka, atau _' },
    { token: '\\s', label: 'Spasi', desc: 'Whitespace (spasi, tab, ganti baris)' },
    { token: '\\S', label: 'Bukan spasi', desc: 'Karakter selain whitespace' },
    { token: '.', label: 'Karakter apa saja', desc: 'Mencocokkan apa saja kecuali baris baru' },
    { token: '^', label: 'Awal baris', desc: 'Menegaskan posisi di awal baris' },
    { token: '$', label: 'Akhir baris', desc: 'Menegaskan posisi di akhir baris' },
    { token: '\\b', label: 'Batas kata', desc: 'Pencocokan pada batas antar kata' },
    { token: '*', label: '0 atau lebih', desc: 'Mengulang 0 kali atau lebih (greedy)' },
    { token: '+', label: '1 atau lebih', desc: 'Mengulang 1 kali atau lebih (greedy)' },
    { token: '?', label: 'Opsional', desc: 'Mengulang 0 atau 1 kali saja' },
    { token: '{n}', label: 'Tepat n kali', desc: 'Mengulang kecocokan tepat sebanyak n kali' },
    { token: '(...)', label: 'Grup tangkap', desc: 'Menangkap teks cocok ke dalam kelompok' },
    { token: '(?:...)', label: 'Grup non-tangkap', desc: 'Mengelompokkan karakter tanpa ditangkap' }
  ];
}
