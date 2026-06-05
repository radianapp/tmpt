/* app/tools/kalkulator/js/math-calc.js */

// --- Percentage functions ---
export function calculatePercentageVal(percent, total) {
  return (total * percent) / 100;
}

export function calculatePercentageOf(val1, val2) {
  if (val2 === 0) return 0;
  return (val1 / val2) * 100;
}

export function calculatePercentageChange(val1, val2) {
  if (val1 === 0) return 0;
  return ((val2 - val1) / val1) * 100;
}

// --- Statistics functions ---
export function parseNumberList(str) {
  return str.split(/[\s,;\n\r]+/)
    .map(x => parseFloat(x))
    .filter(x => !isNaN(x));
}

export function calculateStatistics(nums) {
  if (nums.length === 0) return null;
  
  const sorted = [...nums].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((a, b) => a + b, 0);
  const min = sorted[0];
  const max = sorted[count - 1];
  const mean = sum / count;
  const range = max - min;

  // Median
  let median;
  const mid = Math.floor(count / 2);
  if (count % 2 !== 0) {
    median = sorted[mid];
  } else {
    median = (sorted[mid - 1] + sorted[mid]) / 2;
  }

  // Mode
  const freqs = {};
  let maxFreq = 0;
  nums.forEach(n => {
    freqs[n] = (freqs[n] || 0) + 1;
    if (freqs[n] > maxFreq) maxFreq = freqs[n];
  });
  const modes = [];
  Object.keys(freqs).forEach(k => {
    if (freqs[k] === maxFreq && maxFreq > 1) {
      modes.push(parseFloat(k));
    }
  });

  // Variance & StdDev
  const variance = nums.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / count;
  const stdDev = Math.sqrt(variance);

  // Quartiles
  const getMedian = (arr) => {
    const l = arr.length;
    if (l === 0) return 0;
    const m = Math.floor(l / 2);
    return l % 2 !== 0 ? arr[m] : (arr[m - 1] + arr[m]) / 2;
  };

  const q1 = getMedian(sorted.slice(0, Math.floor(count / 2)));
  const q3 = getMedian(sorted.slice(Math.ceil(count / 2)));
  const iqr = q3 - q1;

  return {
    count,
    sum,
    mean,
    median,
    mode: modes.length > 0 ? modes.join(', ') : 'Tidak ada',
    min,
    max,
    range,
    variance,
    stdDev,
    q1,
    q3,
    iqr
  };
}
