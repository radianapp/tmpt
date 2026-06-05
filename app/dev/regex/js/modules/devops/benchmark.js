// app/dev/regex/js/modules/devops/benchmark.js

export function benchmarkRegex(patternA, patternB, testStrings = [], iterations = 1000) {
  if (!patternA || !patternB) return null;

  try {
    const regexA = new RegExp(patternA);
    const regexB = new RegExp(patternB);

    if (testStrings.length === 0) {
      testStrings = ['quick brown fox jumps', 'lazy dog sleeping', 'test@example.com', '0812345678', 'abcde12345'];
    }

    // Warmup
    testStrings.forEach(str => {
      regexA.test(str);
      regexB.test(str);
    });

    // Run A
    const startA = performance.now();
    for (let i = 0; i < iterations; i++) {
      testStrings.forEach(str => regexA.test(str));
    }
    const elapsedA = performance.now() - startA;

    // Run B
    const startB = performance.now();
    for (let i = 0; i < iterations; i++) {
      testStrings.forEach(str => regexB.test(str));
    }
    const elapsedB = performance.now() - startB;

    const ratio = elapsedA > elapsedB ? (elapsedA / elapsedB) : (elapsedB / elapsedA);
    const faster = elapsedA < elapsedB ? 'A' : 'B';

    return {
      elapsedA: elapsedA.toFixed(2),
      elapsedB: elapsedB.toFixed(2),
      faster,
      ratio: ratio.toFixed(1)
    };
  } catch (err) {
    return { error: err.message };
  }
}
