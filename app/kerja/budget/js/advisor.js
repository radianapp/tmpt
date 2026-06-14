// app/kerja/budget/js/advisor.js

export function analyzeFinances(summary, cicilanActual = 0, needsActual = 0, savingsActual = 0) {
  const advice = [];
  const totalIncome = summary.actualIncome || summary.plannedIncome || 0;
  
  if (totalIncome === 0) {
    return [{
      type: 'info',
      icon: 'ℹ️',
      title: 'Pemasukan Kosong',
      message: 'Masukkan rencana atau realisasi pemasukan bulan ini untuk melihat analisis keuangan.',
      actions: ['Atur rencana pemasukan di Dashboard']
    }];
  }

  // 1. Debt to Income Ratio
  const debtRatio = (cicilanActual / totalIncome) * 100;
  if (debtRatio > 35) {
    advice.push({
      type: 'warning',
      icon: '⚠️',
      title: `Rasio Cicilan Tinggi (${debtRatio.toFixed(0)}%)`,
      message: `Rasio cicilan bulanan Anda mencapai ${debtRatio.toFixed(0)}% dari pemasukan. Batas aman rasio cicilan adalah maksimal 35% agar cash flow Anda tidak terganggu.`,
      actions: ['Tunda mengambil pinjaman baru', 'Fokus pada pelunasan hutang dengan bunga terbesar terlebih dahulu']
    });
  }

  // 2. Savings Rate
  const savingsRate = (savingsActual / totalIncome) * 100;
  if (savingsRate < 10) {
    advice.push({
      type: 'tip',
      icon: '💡',
      title: 'Rasio Tabungan Rendah',
      message: `Anda baru menyisihkan sekitar ${savingsRate.toFixed(0)}% dari total pendapatan periode ini untuk tabungan/investasi.`,
      actions: ['Upayakan menyisihkan minimal 10% - 20% di awal bulan sebelum dibelanjakan', 'Gunakan fitur Tujuan Keuangan untuk membantu konsistensi menabung']
    });
  } else {
    advice.push({
      type: 'success',
      icon: '✅',
      title: 'Pertahankan Tabungan Anda!',
      message: `Hebat! Anda berhasil menabung sebesar ${savingsRate.toFixed(0)}% dari pendapatan periode ini. Ini adalah kebiasaan finansial yang sangat sehat.`,
      actions: ['Konsisten lakukan setiap periode', 'Pertimbangkan menempatkan tabungan di instrumen reksa dana atau emas']
    });
  }

  // 3. Needs Ratio
  const needsRatio = (needsActual / totalIncome) * 100;
  if (needsRatio > 60) {
    advice.push({
      type: 'warning',
      icon: '🏠',
      title: `Biaya Kebutuhan Pokok Tinggi (${needsRatio.toFixed(0)}%)`,
      message: `Pengeluaran rutin/kebutuhan pokok Anda memakan ${needsRatio.toFixed(0)}% dari total pendapatan. Rekomendasi ideal adalah maksimal 50%.`,
      actions: ['Evaluasi tagihan berlangganan bulanan yang kurang penting', 'Cari alternatif akomodasi atau transportasi yang lebih ekonomis']
    });
  }

  // 4. General Financial Tips (Selalu Tampil sebagai Edukasi)
  advice.push({
    type: 'edu',
    icon: '📚',
    title: 'Prinsip Anggaran 50/30/20',
    message: 'Membagi pendapatan bersih menjadi 3 pos utama: 50% untuk Kebutuhan Pokok (Sewa, Makan, Tagihan), 30% untuk Keinginan (Hiburan, Hobi), dan 20% untuk Tabungan/Investasi & Proteksi.',
    actions: ['Gunakan template 50/30/20 di pemilih template', 'Tinjau kembali pembagian pos pengeluaran Anda']
  });

  advice.push({
    type: 'edu',
    icon: '🛡️',
    title: 'Pilar Dana Darurat',
    message: 'Sebelum berinvestasi secara agresif, pastikan Anda memiliki Dana Darurat yang cair (liquid) minimal setara 3 kali pengeluaran bulanan jika lajang, atau 6 kali jika sudah berkeluarga.',
    actions: ['Buat goal khusus "Dana Darurat" di tab Tujuan Keuangan', 'Setor rutin setiap bulan meskipun dalam nominal kecil']
  });

  return advice;
}

/**
 * Menghitung simulasi pelunasan hutang (Snowball / Avalanche)
 */
export function simulateDebtPayoff(totalDebt, annualRate, monthlyPay, extraPay = 0) {
  const r = annualRate / 12 / 100;
  const pay = monthlyPay + extraPay;
  let balance = totalDebt;
  let months = 0;
  let totalInterest = 0;

  while (balance > 0 && months < 360) {
    const interest = balance * r;
    const principal = Math.min(pay - interest, balance);
    balance -= principal;
    totalInterest += interest;
    months++;
  }

  return {
    months,
    totalInterest,
    totalPaid: totalDebt + totalInterest
  };
}
