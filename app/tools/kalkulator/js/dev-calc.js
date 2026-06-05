/* app/tools/kalkulator/js/dev-calc.js */

// --- Pure JS MD5 Implementation (Zero Dependency) ---
function md5(string) {
  function k(d, c, b, a, h, f, g) {
    return e(c & b | ~c & a, d, c, h, f, g);
  }
  function l(d, c, b, a, h, f, g) {
    return e(c & a | b & ~a, d, c, h, f, g);
  }
  function m(d, c, b, a, h, f, g) {
    return e(c ^ b ^ a, d, c, h, f, g);
  }
  function n(d, c, b, a, h, f, g) {
    return e(b ^ (c | ~a), d, c, h, f, g);
  }
  function e(q, d, c, b, a, h) {
    q = g(g(d, q), g(b, h));
    return g(q << a | q >>> 32 - a, c);
  }
  function g(a, c) {
    var b = (a & 65535) + (c & 65535), d = (a >> 16) + (c >> 16) + (b >> 16);
    return d << 16 | b & 65535;
  }
  var c = [], b;
  for (b = 0; 64 > b; b++) c[b] = 4294967296 * Math.abs(Math.sin(b + 1)) | 0;
  var a = function(I) {
    var p = [], u = 8 * I.length, t;
    for (t = 0; u > t; t += 8) p[t >> 5] |= (I.charCodeAt(t / 8) & 255) << t % 32;
    p[u >> 5] |= 128 << u % 32;
    p[(u + 64 >>> 9 << 4) + 14] = u;
    var x = 1732584193, w = -271733879, v = -1732584194, r = 271733878, h;
    for (h = 0; h < p.length; h += 16) {
      var d = x, o = w, q = v, s = r;
      x = k(x, w, v, r, p[h + 0], 7, c[0]);
      r = k(r, x, w, v, p[h + 1], 12, c[1]);
      v = k(v, r, x, w, p[h + 2], 17, c[2]);
      w = k(w, v, r, x, p[h + 3], 22, c[3]);
      x = k(x, w, v, r, p[h + 4], 7, c[4]);
      r = k(r, x, w, v, p[h + 5], 12, c[5]);
      v = k(v, r, x, w, p[h + 6], 17, c[6]);
      w = k(w, v, r, x, p[h + 7], 22, c[7]);
      x = k(x, w, v, r, p[h + 8], 7, c[8]);
      r = k(r, x, w, v, p[h + 9], 12, c[9]);
      v = k(v, r, x, w, p[h + 10], 17, c[10]);
      w = k(w, v, r, x, p[h + 11], 22, c[11]);
      x = k(x, w, v, r, p[h + 12], 7, c[12]);
      r = k(r, x, w, v, p[h + 13], 12, c[13]);
      v = k(v, r, x, w, p[h + 14], 17, c[14]);
      w = k(w, v, r, x, p[h + 15], 22, c[15]);
      x = l(x, w, v, r, p[h + 1], 5, c[16]);
      r = l(r, x, w, v, p[h + 6], 9, c[17]);
      v = l(v, r, x, w, p[h + 11], 14, c[18]);
      w = l(w, v, r, x, p[h + 0], 20, c[19]);
      x = l(x, w, v, r, p[h + 5], 5, c[20]);
      r = l(r, x, w, v, p[h + 10], 9, c[21]);
      v = l(v, r, x, w, p[h + 15], 14, c[22]);
      w = l(w, v, r, x, p[h + 4], 20, c[23]);
      x = l(x, w, v, r, p[h + 9], 5, c[24]);
      r = l(r, x, w, v, p[h + 14], 9, c[25]);
      v = l(v, r, x, w, p[h + 3], 14, c[26]);
      w = l(w, v, r, x, p[h + 8], 20, c[27]);
      x = l(x, w, v, r, p[h + 13], 5, c[28]);
      r = l(r, x, w, v, p[h + 2], 9, c[29]);
      v = l(v, r, x, w, p[h + 7], 14, c[30]);
      w = l(w, v, r, x, p[h + 12], 20, c[31]);
      x = m(x, w, v, r, p[h + 5], 4, c[32]);
      r = m(r, x, w, v, p[h + 8], 11, c[33]);
      v = m(v, r, x, w, p[h + 11], 16, c[34]);
      w = m(w, v, r, x, p[h + 14], 23, c[35]);
      x = m(x, w, v, r, p[h + 1], 4, c[36]);
      r = m(r, x, w, v, p[h + 4], 11, c[37]);
      v = m(v, r, x, w, p[h + 7], 16, c[38]);
      w = m(w, v, r, x, p[h + 10], 23, c[39]);
      x = m(x, w, v, r, p[h + 13], 4, c[40]);
      r = m(r, x, w, v, p[h + 0], 11, c[41]);
      v = m(v, r, x, w, p[h + 3], 16, c[42]);
      w = m(w, v, r, x, p[h + 6], 23, c[43]);
      x = m(x, w, v, r, p[h + 9], 4, c[44]);
      r = m(r, x, w, v, p[h + 12], 11, c[45]);
      v = m(v, r, x, w, p[h + 15], 16, c[46]);
      w = m(w, v, r, x, p[h + 2], 23, c[47]);
      x = n(x, w, v, r, p[h + 0], 6, c[48]);
      r = n(r, x, w, v, p[h + 7], 10, c[49]);
      v = n(v, r, x, w, p[h + 14], 15, c[50]);
      w = n(w, v, r, x, p[h + 5], 21, c[51]);
      x = n(x, w, v, r, p[h + 12], 6, c[52]);
      r = n(r, x, w, v, p[h + 3], 10, c[53]);
      v = n(v, r, x, w, p[h + 10], 15, c[54]);
      w = n(w, v, r, x, p[h + 1], 21, c[55]);
      x = n(x, w, v, r, p[h + 8], 6, c[56]);
      r = n(r, x, w, v, p[h + 15], 10, c[57]);
      v = n(v, r, x, w, p[h + 6], 15, c[58]);
      w = n(w, v, r, x, p[h + 13], 21, c[59]);
      x = n(x, w, v, r, p[h + 4], 6, c[60]);
      r = n(r, x, w, v, p[h + 11], 10, c[61]);
      v = n(v, r, x, w, p[h + 2], 15, c[62]);
      w = n(w, v, r, x, p[h + 9], 21, c[63]);
      x = g(x, d);
      w = g(w, o);
      v = g(v, q);
      r = g(r, s);
    }
    return [x, w, v, r];
  };

  var d = a(string);
  var f = "";
  var h;
  for (h = 0; 4 > h; h++) {
    var g = d[h];
    f += "0123456789abcdef".charAt(g >> 0 & 15) +
         "0123456789abcdef".charAt(g >> 4 & 15) +
         "0123456789abcdef".charAt(g >> 8 & 15) +
         "0123456789abcdef".charAt(g >> 12 & 15) +
         "0123456789abcdef".charAt(g >> 16 & 15) +
         "0123456789abcdef".charAt(g >> 20 & 15) +
         "0123456789abcdef".charAt(g >> 24 & 15) +
         "0123456789abcdef".charAt(g >> 28 & 15);
  }
  return f;
}

// --- JSON formatting ---
export function formatJSON(str, space = 2) {
  try {
    const obj = JSON.parse(str);
    return {
      valid: true,
      formatted: JSON.stringify(obj, null, parseInt(space)),
      error: null
    };
  } catch (e) {
    return {
      valid: false,
      formatted: str,
      error: e.message
    };
  }
}

export function minifyJSON(str) {
  try {
    const obj = JSON.parse(str);
    const minified = JSON.stringify(obj);
    const origSize = str.length;
    const miniSize = minified.length;
    const reduction = origSize > 0 ? ((origSize - miniSize) / origSize) * 100 : 0;
    return {
      valid: true,
      minified,
      origSize,
      miniSize,
      reduction: parseFloat(reduction.toFixed(1))
    };
  } catch (e) {
    return {
      valid: false,
      minified: str,
      error: e.message
    };
  }
}

// --- Base64 Encoding/Decoding ---
export function base64Encode(str) {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch (e) {
    return 'Error: Gagal mengenkode ke Base64.';
  }
}

export function base64Decode(str) {
  try {
    return decodeURIComponent(escape(atob(str)));
  } catch (e) {
    return 'Error: Format Base64 tidak valid.';
  }
}

// --- URL Encode/Decode ---
export function urlEncode(str) {
  return encodeURIComponent(str);
}

export function urlDecode(str) {
  return decodeURIComponent(str);
}

// --- Hash Generation (Client-Side) ---
export async function generateHashes(text) {
  const md5Val = md5(text);
  
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  
  async function computeWebCryptoHash(algorithm) {
    try {
      const buffer = await crypto.subtle.digest(algorithm, data);
      return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    } catch (e) {
      return 'Tidak didukung browser';
    }
  }

  const sha1Val = await computeWebCryptoHash('SHA-1');
  const sha256Val = await computeWebCryptoHash('SHA-256');
  const sha512Val = await computeWebCryptoHash('SHA-512');

  return {
    md5: md5Val,
    sha1: sha1Val,
    sha256: sha256Val,
    sha512: sha512Val
  };
}

// --- Epoch Timestamp ---
export function convertTimestamp(tsStr) {
  const val = parseFloat(tsStr);
  if (isNaN(val)) return 'Invalid Input';
  // Check if seconds or milliseconds
  const isMs = tsStr.length > 11;
  const date = new Date(isMs ? val : val * 1000);
  if (isNaN(date.getTime())) return 'Invalid Date';
  return date.toString();
}

export function dateToTimestamp(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return {
    seconds: Math.floor(d.getTime() / 1000),
    ms: d.getTime()
  };
}

// --- UUID / NanoID Generator ---
export function generateUUIDv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function generateUUIDv7() {
  // Simple time-ordered UUID v7 approximation
  const now = Date.now();
  const ts = now.toString(16).padStart(12, '0');
  const rand = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${ts.slice(0,8)}-${ts.slice(8,12)}-7${rand.slice(0,3)}-8${rand.slice(3,6)}-${rand.slice(6)}`;
}

export function generateNanoID(alphabet = 'usecomplete_26_alphabet_numeric_here', size = 21) {
  const chars = alphabet || 'usecomplete_26_alphabet_numeric_here';
  let id = '';
  for (let i = 0; i < size; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

// --- Cron Translator (Simple) ---
export function explainCron(cronStr) {
  const parts = cronStr.trim().split(/\s+/);
  if (parts.length < 5) return 'Format Cron tidak valid (harus minimal 5 field)';
  
  const [min, hour, dom, month, dow] = parts;
  
  let explanation = 'Setiap ';
  if (min === '*' && hour === '*') {
    explanation += 'menit ';
  } else if (min !== '*' && hour === '*') {
    explanation += `menit ke-${min} `;
  } else if (min !== '*' && hour !== '*') {
    explanation += `pukul ${hour.padStart(2, '0')}:${min.padStart(2, '0')} `;
  }
  
  if (dom !== '*') {
    explanation += `pada hari ke-${dom} setiap bulan `;
  }
  if (month !== '*') {
    explanation += `di bulan ke-${month} `;
  }
  if (dow !== '*') {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    explanation += `pada hari ${dow.split(',').map(d => days[parseInt(d)] || d).join(', ')}`;
  }
  
  return explanation;
}

// --- Regex tester ---
export function testRegex(pattern, flags, testString) {
  try {
    const re = new RegExp(pattern, flags);
    const matches = [];
    let match;
    
    // Reset test string index for safety
    if (flags.includes('g')) {
      re.lastIndex = 0;
      while ((match = re.exec(testString)) !== null) {
        matches.push({
          value: match[0],
          index: match.index,
          groups: match.slice(1)
        });
        if (match[0] === '') re.lastIndex++; // Prevent infinite loop
      }
    } else {
      match = re.exec(testString);
      if (match) {
        matches.push({
          value: match[0],
          index: match.index,
          groups: match.slice(1)
        });
      }
    }
    
    return {
      valid: true,
      matches,
      count: matches.length
    };
  } catch (e) {
    return {
      valid: false,
      error: e.message
    };
  }
}
