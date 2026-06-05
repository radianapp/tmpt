// app/dev/regex/js/modules/security/redos.js

const REDOS_PATTERNS = [
  {
    name: 'Nested Quantifiers (Quantifier Bertingkat)',
    pattern: /(\w+\+|\w+\*|\w+\?)\+|\(\w+\+\)\*|\(\w+\+\)\+/,
    severity: 'critical',
    description: 'Kombinasi perulangan bertingkat (misal: (a+)+) menyebabkan backtracking eksponensial.'
  },
  {
    name: 'Overlapping Alternation (Pilihan Tumpang Tindih)',
    pattern: /\([^|]+\|[^)]*\)\+|\([^|]+\|[^)]*\)\*/,
    severity: 'high',
    description: 'Pernyataan OR dengan opsi yang bertumpang tindih diikuti quantifier (misal: (a|aa)+).'
  },
  {
    name: 'Unbounded Wildcard (Wildcard Tanpa Batas)',
    pattern: /\.\*|\.\+/,
    severity: 'medium',
    description: 'Karakter wildcard tanpa batasan awal/akhir string (^ atau $) dapat menyebabkan pencarian berlebih.'
  }
];

export function detectReDoS(pattern) {
  const findings = [];
  
  if (!pattern) return { vulnerable: false, findings: [] };

  // Heuristic Scan
  REDOS_PATTERNS.forEach(vuln => {
    if (vuln.pattern.test(pattern)) {
      findings.push({
        name: vuln.name,
        severity: vuln.severity,
        description: vuln.description,
        exploit: generateExploitSuggestion(pattern, vuln.severity)
      });
    }
  });

  // Empirical Test
  const empirical = runEmpiricalReDoSTest(pattern);
  if (empirical.vulnerable) {
    findings.push({
      name: 'Empirical Backtracking Timeout',
      severity: 'critical',
      description: 'Pengujian langsung mendeteksi kelambatan CPU yang ekstrim (>100ms) pada input kecil.',
      exploit: `Input: "${empirical.input}"`
    });
  }

  const score = calculateRiskScore(findings);

  return {
    vulnerable: findings.length > 0,
    findings,
    empirical,
    score
  };
}

function runEmpiricalReDoSTest(pattern) {
  // Buat string bom pencocokan
  const bombs = [
    'a'.repeat(25) + '!',
    'a'.repeat(30) + '!',
    'aaaaaaaaaaaaaaaaaaaaaaaaa!'
  ];

  try {
    const regex = new RegExp(pattern);
    for (const bomb of bombs) {
      const start = performance.now();
      regex.test(bomb);
      const elapsed = performance.now() - start;
      if (elapsed > 80) { // 80ms is extremely slow for 25 characters
        return { vulnerable: true, elapsed, input: bomb };
      }
    }
  } catch (err) {
    // invalid regex
  }
  return { vulnerable: false };
}

function generateExploitSuggestion(pattern, severity) {
  if (severity === 'critical') {
    return 'aaaaaaaaaaaaaaaaaaaaa!';
  }
  return 'Teks panjang dengan sedikit perbedaan di akhir.';
}

function calculateRiskScore(findings) {
  if (findings.some(f => f.severity === 'critical')) return 'CRITICAL';
  if (findings.some(f => f.severity === 'high')) return 'HIGH';
  if (findings.some(f => f.severity === 'medium')) return 'MEDIUM';
  return 'SAFE';
}
