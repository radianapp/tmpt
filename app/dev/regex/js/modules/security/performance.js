// app/dev/regex/js/modules/security/performance.js

export function analyzePerformance(pattern, flags = '') {
  if (!pattern) return null;

  try {
    const regex = new RegExp(pattern, flags);
    const sizes = [100, 1000, 5000];
    const results = [];

    for (const size of sizes) {
      // Generate some mock test string of target size
      const baseStr = 'abcde fghij klmno pqrst uvwxy z ';
      const testStr = baseStr.repeat(Math.ceil(size / baseStr.length)).slice(0, size);

      const trials = 100;
      const start = performance.now();
      for (let i = 0; i < trials; i++) {
        regex.test(testStr);
      }
      const elapsed = performance.now() - start;

      results.push({
        size,
        avgMs: (elapsed / trials).toFixed(4),
        totalMs: elapsed.toFixed(2)
      });
    }

    return {
      success: true,
      results
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}
