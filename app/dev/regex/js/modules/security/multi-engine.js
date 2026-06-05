// app/dev/regex/js/modules/security/multi-engine.js

export async function loadEngineCompatibility() {
  try {
    const response = await fetch('./data/engine-compat.json');
    if (!response.ok) throw new Error('Gagal memuat matriks kompatibilitas.');
    const data = await response.json();
    return data.features;
  } catch (err) {
    console.error(err);
    return [];
  }
}

export function checkPortabilityIssues(pattern, features) {
  const issues = [];
  if (!pattern) return issues;

  // Analisis sederhana untuk portabilitas
  if (/\(\?<=/.test(pattern) || /\(\?<!/.test(pattern)) {
    issues.push({
      feature: 'Lookbehind',
      note: 'Lookbehind tidak didukung secara native oleh engine Go RE2 dan Rust regex.'
    });
  }

  if (/\(\?<[a-zA-Z0-9]+>/.test(pattern)) {
    issues.push({
      feature: 'Named Capture Groups',
      note: 'Sintaks penamaan kelompok tangkap di Python berbeda, menggunakan (?P<name>...).'
    });
  }

  if (/\\p\{[a-zA-Z]+\}/.test(pattern)) {
    issues.push({
      feature: 'Unicode Property Escapes',
      note: 'Unicode Property Escapes memerlukan flag u/v di JS dan tidak didukung secara default di Python.'
    });
  }

  return issues;
}
