// app/dev/regex/js/modules/studio/replace.js

export function applyReplace(pattern, flags, testString, replaceStr) {
  try {
    if (!pattern) return { success: true, replaced: testString, count: 0 };
    
    // Pastikan flag g disematkan untuk penggantian global
    const cleanFlags = flags.includes('g') ? flags : flags + 'g';
    const regex = new RegExp(pattern, cleanFlags);
    
    const count = (testString.match(new RegExp(pattern, flags)) || []).length;
    const replaced = testString.replace(regex, replaceStr);
    
    return {
      success: true,
      replaced,
      count
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}
