// app/dev/regex/js/modules/devops/unit-test.js

export function runTestSuite(pattern, flags, testCases) {
  if (!pattern) return { results: [], passed: 0, failed: 0, total: 0 };

  let passed = 0;
  let failed = 0;
  const results = [];

  try {
    const regex = new RegExp(pattern, flags);
    
    testCases.forEach((tc) => {
      const match = regex.test(tc.input);
      const isPass = (tc.expect === 'match' && match) || (tc.expect === 'no-match' && !match);
      
      if (isPass) passed++;
      else failed++;

      results.push({
        id: tc.id,
        input: tc.input,
        expect: tc.expect,
        actual: match ? 'match' : 'no-match',
        passed: isPass
      });
    });
  } catch (err) {
    // pattern error
  }

  return {
    results,
    passed,
    failed,
    total: testCases.length
  };
}
