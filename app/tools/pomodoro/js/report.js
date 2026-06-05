// app/tools/pomodoro/js/report.js

export function generateMarkdownReport(sessions, statsSummary, period = 'weekly') {
  const lines = [
    `# Laporan Produktivitas TMPT Pomodoro`,
    `**Periode:** ${period === 'weekly' ? 'Minggu Ini' : 'Bulan Ini'}`,
    `**Dibuat pada:** ${new Date().toLocaleString('id-ID')}`,
    ``,
    `## Ringkasan Eksekutif`,
    `| Metrik | Nilai |`,
    `|--------|-------|`,
    `| Total Sesi Fokus (Selesai) | ${statsSummary.total_completed} 🍅 |`,
    `| Total Waktu Fokus | ${Math.floor(statsSummary.total_focus_min / 60)}j ${statsSummary.total_focus_min % 60}m (${statsSummary.total_focus_min} menit) |`,
    `| Rata-rata Fokus Score | ${statsSummary.avg_focus_score}/100 |`,
    `| Total Interupsi | ${statsSummary.total_interruptions} |`,
    ``,
    `## Riwayat Sesi Fokus`,
    `| Tanggal | Mulai | Durasi Aktual | Tipe | Judul Tugas | Status | Interupsi |`,
    `|---------|-------|---------------|------|-------------|--------|-----------|`,
    ...sessions.map(s => {
      const time = new Date(s.started_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      return `| ${s.date} | ${time} | ${s.actual_min}m | ${s.type} | ${s.task_title || '-'} | ${s.status} | ${s.interruptions} |`;
    }),
    ``,
    `## Distribusi Waktu per Tugas`,
  ];

  // Group by task title
  const taskMinutes = {};
  sessions.forEach(s => {
    if (s.type === 'work' && s.status === 'completed') {
      const title = s.task_title || '(Tanpa Tugas)';
      taskMinutes[title] = (taskMinutes[title] || 0) + s.actual_min;
    }
  });

  lines.push(`| Nama Tugas | Waktu Fokus (menit) | Sesi Selesai |`);
  lines.push(`|------------|---------------------|--------------|`);
  Object.keys(taskMinutes).forEach(title => {
    const min = taskMinutes[title];
    const count = sessions.filter(s => s.type === 'work' && s.status === 'completed' && (s.task_title || '(Tanpa Tugas)') === title).length;
    lines.push(`| ${title} | ${min} menit | ${count} 🍅 |`);
  });

  return lines.join('\n');
}

export function generateCSVExport(sessions) {
  const headers = ['ID Sesi', 'Tanggal', 'Waktu Mulai', 'Tipe Sesi', 'Status Sesi', 'Durasi Setting (min)', 'Durasi Aktual (min)', 'ID Tugas', 'Judul Tugas', 'Interupsi'];
  const rows = sessions.map(s => [
    s.id,
    s.date,
    s.started_at,
    s.type,
    s.status,
    s.duration_min,
    s.actual_min,
    s.task_id || '',
    s.task_title || '',
    s.interruptions
  ]);
  
  // Format as CSV lines
  return [headers, ...rows]
    .map(row => row.map(val => {
      const strVal = String(val).replace(/"/g, '""');
      return strVal.includes(',') || strVal.includes('\n') || strVal.includes('"') ? `"${strVal}"` : strVal;
    }).join(','))
    .join('\n');
}

export function generateJSONExport(sessions, stats) {
  return JSON.stringify({
    exported_at: new Date().toISOString(),
    sessions,
    stats
  }, null, 2);
}

export function triggerDownload(content, filename, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
