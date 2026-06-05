// app/dev/json/js/tools.js

// Dynamic script loader helper
const loadedScripts = new Set();
async function lazyLoadScript(src) {
  if (loadedScripts.has(src)) return;
  return new Promise((resolve, reject) => {
    // Temporarily hide define to avoid AMD collision (caused by Monaco Editor)
    const tempDefine = window.define;
    window.define = undefined;

    const script = document.createElement('script');
    script.src = src;
    script.onload = () => {
      window.define = tempDefine;
      loadedScripts.add(src);
      resolve();
    };
    script.onerror = (err) => {
      window.define = tempDefine;
      reject(err);
    };
    document.head.appendChild(script);
  });
}

// ── 1. Validation & Schema Validation ──
export async function validateJSON(text) {
  if (!text || !text.trim()) return { valid: true, error: null };
  try {
    JSON.parse(text);
    return { valid: true, error: null };
  } catch (err) {
    // Attempt to extract position
    const match = err.message.match(/position (\d+)/) || err.message.match(/at line (\d+) column (\d+)/);
    let line = 1;
    let col = 1;
    if (match) {
      const pos = parseInt(match[1]);
      if (!isNaN(pos)) {
        const sub = text.substring(0, pos);
        const lines = sub.split('\n');
        line = lines.length;
        col = lines[lines.length - 1].length + 1;
      }
    }
    return {
      valid: false,
      error: {
        message: err.message,
        line,
        column: col
      }
    };
  }
}

export async function validateWithSchema(jsonText, schemaText, draft = 'draft-07') {
  await lazyLoadScript('./vendor/ajv.min.js');
  await lazyLoadScript('./vendor/ajv-formats.min.js');
  
  let ajvInstance;
  
  // Setup correct Ajv instance based on draft version
  try {
    if (draft === 'draft-2020-12') {
      ajvInstance = new window.Ajv2020({ allErrors: true });
    } else {
      ajvInstance = new window.Ajv({ allErrors: true, strict: false });
    }
    if (window.ajvFormats) {
      window.ajvFormats(ajvInstance);
    }
  } catch(e) {
    // Fallback to simple Ajv
    ajvInstance = new window.Ajv({ allErrors: true, strict: false });
  }

  let schema, data;
  try {
    schema = JSON.parse(schemaText);
  } catch (e) {
    return { valid: false, error: 'Schema JSON tidak valid: ' + e.message };
  }

  try {
    data = JSON.parse(jsonText);
  } catch (e) {
    return { valid: false, error: 'Data JSON tidak valid: ' + e.message };
  }

  try {
    const validate = ajvInstance.compile(schema);
    const valid = validate(data);
    return {
      valid,
      errors: valid ? [] : validate.errors.map(err => ({
        path: err.instancePath || '(root)',
        message: err.message,
        keyword: err.keyword,
        params: JSON.stringify(err.params)
      }))
    };
  } catch (err) {
    return { valid: false, error: 'Kesalahan Schema: ' + err.message };
  }
}

// ── 2. Format / Minify / Compress ──
export function formatJSON(jsonText, options = {}) {
  const { indent = 2, sortKeys = false } = options;
  if (!jsonText.trim()) return '';
  const parsed = JSON.parse(jsonText);
  
  if (sortKeys) {
    return JSON.stringify(sortObjectKeys(parsed), null, indent);
  }
  return JSON.stringify(parsed, null, indent);
}

function sortObjectKeys(obj) {
  if (Array.isArray(obj)) return obj.map(sortObjectKeys);
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, sortObjectKeys(v)])
    );
  }
  return obj;
}

export function minifyJSON(jsonText) {
  if (!jsonText.trim()) return '';
  const parsed = JSON.parse(jsonText);
  return JSON.stringify(parsed);
}

export async function compressJSONStats(jsonText) {
  const sizeOriginal = new Blob([jsonText]).size;
  const minified = minifyJSON(jsonText);
  const sizeMinified = new Blob([minified]).size;

  // Compression estimates
  const gzipSize = Math.round(sizeMinified * 0.22); // Typical gzip compression ratio
  const deflateSize = Math.round(sizeMinified * 0.24);
  const brotliSize = Math.round(sizeMinified * 0.18);

  return {
    original: sizeOriginal,
    minified: sizeMinified,
    gzip: gzipSize,
    deflate: deflateSize,
    brotli: brotliSize
  };
}

// ── 3. Repair JSON ──
export async function repairJSON(brokenText) {
  await lazyLoadScript('./vendor/jsonrepair.min.js');
  try {
    const repaired = window.JSONRepair.jsonrepair(brokenText);
    return {
      success: true,
      repaired
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

// ── 4. JSON Diff ──
export function diffJSON(a, b, options = {}) {
  const { ignoreOrder = false, ignoreCase = false } = options;
  const findings = [];

  function getJSONType(val) {
    if (val === null) return 'null';
    if (Array.isArray(val)) return 'array';
    return typeof val;
  }

  function compare(path, valA, valB) {
    const typeA = getJSONType(valA);
    const typeB = getJSONType(valB);

    if (typeA !== typeB) {
      findings.push({ type: 'type_change', path, from: typeA, to: typeB, old: valA, new: valB });
      return;
    }

    if (typeA === 'object') {
      const keysA = new Set(Object.keys(valA));
      const keysB = new Set(Object.keys(valB));

      // Added keys
      [...keysB].filter(k => !keysA.has(k)).forEach(k => {
        findings.push({ type: 'added', path: `${path}.${k}`, value: valB[k] });
      });

      // Removed keys
      [...keysA].filter(k => !keysB.has(k)).forEach(k => {
        findings.push({ type: 'removed', path: `${path}.${k}`, value: valA[k] });
      });

      // Common keys comparison
      [...keysA].filter(k => keysB.has(k)).forEach(k => {
        compare(`${path}.${k}`, valA[k], valB[k]);
      });
    } else if (typeA === 'array') {
      if (ignoreOrder) {
        // Sort arrays of primitives or simple representation for comparison
        const sortedA = [...valA].sort();
        const sortedB = [...valB].sort();
        if (JSON.stringify(sortedA) !== JSON.stringify(sortedB)) {
          findings.push({ type: 'changed', path, old: valA, new: valB });
        }
      } else {
        const maxLen = Math.max(valA.length, valB.length);
        for (let i = 0; i < maxLen; i++) {
          if (i >= valA.length) {
            findings.push({ type: 'added', path: `${path}[${i}]`, value: valB[i] });
          } else if (i >= valB.length) {
            findings.push({ type: 'removed', path: `${path}[${i}]`, value: valA[i] });
          } else {
            compare(`${path}[${i}]`, valA[i], valB[i]);
          }
        }
      }
    } else {
      let match = valA === valB;
      if (ignoreCase && typeof valA === 'string' && typeof valB === 'string') {
        match = valA.toLowerCase() === valB.toLowerCase();
      }
      if (!match) {
        findings.push({ type: 'changed', path, old: valA, new: valB });
      }
    }
  }

  compare('$', a, b);
  return findings;
}

// ── 5. Query (JSONPath, JMESPath, jq subset, JS) ──
export async function runQuery(data, expression, engine) {
  if (engine === 'jsonpath') {
    await lazyLoadScript('./vendor/jsonpath-plus.min.js');
    try {
      const result = window.JSONPath.JSONPath({ path: expression, json: data });
      return { success: true, result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  } else if (engine === 'jmespath') {
    await lazyLoadScript('./vendor/jmespath.min.js');
    try {
      const result = window.jmespath.search(data, expression);
      return { success: true, result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  } else if (engine === 'jq') {
    // jq subset: translate common jq to JSONPath
    await lazyLoadScript('./vendor/jsonpath-plus.min.js');
    try {
      let jpath = expression.trim();
      if (jpath.startsWith('.')) {
        jpath = '$' + jpath;
      }
      jpath = jpath.replace(/\[\]/g, '[*]');
      const result = window.JSONPath.JSONPath({ path: jpath, json: data });
      return { success: true, result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  } else if (engine === 'js') {
    try {
      const filterFunc = new Function('data', `return (${expression});`);
      const result = filterFunc(data);
      return { success: true, result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  return { success: false, error: 'Engine kueri tidak dikenal.' };
}

// ── 6. Transform ──
export async function runTransform(data, expression) {
  await lazyLoadScript('./vendor/jsonata.min.js');
  try {
    const expr = window.jsonata(expression);
    const result = await expr.evaluate(data);
    return { success: true, result };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ── 7. Converters ──
export async function csvToJSON(csvText) {
  await lazyLoadScript('./vendor/papaparse.min.js');
  return new Promise((resolve) => {
    window.Papa.parse(csvText, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve({ success: true, data: results.data });
      },
      error: (err) => {
        resolve({ success: false, error: err.message });
      }
    });
  });
}

export async function jsonToCSV(jsonData) {
  await lazyLoadScript('./vendor/papaparse.min.js');
  try {
    const csv = window.Papa.unparse(jsonData);
    return { success: true, data: csv };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function yamlToJSON(yamlText) {
  await lazyLoadScript('./vendor/js-yaml.min.js');
  try {
    const data = window.jsyaml.load(yamlText);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function jsonToYAML(jsonData) {
  await lazyLoadScript('./vendor/js-yaml.min.js');
  try {
    const yaml = window.jsyaml.dump(jsonData, { indent: 2 });
    return { success: true, data: yaml };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function xmlToJSON(xmlText) {
  await lazyLoadScript('./vendor/fast-xml-parser.min.js');
  try {
    const parser = new window.XMLParser({ ignoreAttributes: false });
    const data = parser.parse(xmlText);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function jsonToXML(jsonData) {
  await lazyLoadScript('./vendor/fast-xml-parser.min.js');
  try {
    const builder = new window.XMLBuilder({ format: true, ignoreAttributes: false });
    const xml = builder.build(jsonData);
    return { success: true, data: xml };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function tomlToJSON(tomlText) {
  await lazyLoadScript('./vendor/smol-toml.min.js');
  try {
    const data = window.TOML.parse(tomlText);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function jsonToTOML(jsonData) {
  await lazyLoadScript('./vendor/smol-toml.min.js');
  try {
    const toml = window.TOML.stringify(jsonData);
    return { success: true, data: toml };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export function jsonToSQLInsert(data, tableName = 'users') {
  try {
    const rows = Array.isArray(data) ? data : [data];
    if (rows.length === 0) return '';
    
    // Get unique column list
    const columns = Array.from(new Set(rows.flatMap(Object.keys)));
    
    const escapeSQLValue = (val) => {
      if (val === null || val === undefined) return 'NULL';
      if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
      if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
      if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
      return val;
    };

    const sqlStatements = rows.map(row => {
      const values = columns.map(col => escapeSQLValue(row[col])).join(', ');
      return `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values});`;
    });

    return sqlStatements.join('\n');
  } catch (err) {
    return 'Gagal generate SQL: ' + err.message;
  }
}

// ── 8. Schema Generator ──
export function generateJSONSchema(data) {
  function makeSchema(val) {
    if (val === null) return { type: 'null' };
    if (Array.isArray(val)) {
      if (val.length === 0) return { type: 'array', items: {} };
      // Deduplicate array item schemas
      const subSchemas = val.map(item => makeSchema(item));
      return { type: 'array', items: subSchemas[0] }; // Use first item schema as template
    }
    if (typeof val === 'object') {
      const properties = {};
      const required = Object.keys(val);
      Object.entries(val).forEach(([k, v]) => {
        properties[k] = makeSchema(v);
      });
      return {
        type: 'object',
        properties,
        required
      };
    }
    return { type: typeof val };
  }
  
  const schema = makeSchema(data);
  schema['$schema'] = 'http://json-schema.org/draft-07/schema#';
  return schema;
}

// ── 9. REST API Tester ──
export async function sendRESTRequest(request) {
  const { method, url, headers, body, auth } = request;
  const finalHeaders = new Headers();

  // Apply JSON-based header list
  if (headers) {
    try {
      const pHeaders = JSON.parse(headers);
      Object.entries(pHeaders).forEach(([k, v]) => {
        finalHeaders.set(k, v);
      });
    } catch(e){}
  }

  // Apply Auth
  if (auth && auth.type === 'bearer' && auth.token) {
    finalHeaders.set('Authorization', `Bearer ${auth.token}`);
  } else if (auth && auth.type === 'basic' && auth.username) {
    const creds = btoa(`${auth.username}:${auth.password || ''}`);
    finalHeaders.set('Authorization', `Basic ${creds}`);
  }

  // Content-Type default
  if (['POST', 'PUT', 'PATCH'].includes(method) && !finalHeaders.has('Content-Type')) {
    finalHeaders.set('Content-Type', 'application/json');
  }

  const startTime = performance.now();
  try {
    const response = await fetch(url, {
      method,
      headers: finalHeaders,
      body: ['GET', 'HEAD'].includes(method) ? undefined : body
    });

    const duration = Math.round(performance.now() - startTime);
    const text = await response.text();
    
    let jsonResp = null;
    try {
      jsonResp = JSON.parse(text);
    } catch(e){}

    const headersObj = {};
    response.headers.forEach((v, k) => {
      headersObj[k] = v;
    });

    return {
      success: true,
      status: response.status,
      statusText: response.statusText,
      duration,
      headers: headersObj,
      body: text,
      json: jsonResp
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      duration: Math.round(performance.now() - startTime)
    };
  }
}

// ── 10. Security Scan (PII) ──
const PII_PATTERNS = [
  { name: 'Password / Kredensial', regex: /"pass(word)?"\s*:\s*"[^"]+"/i, severity: 'critical' },
  { name: 'API Key / Rahasia', regex: /"api[-_]?key"\s*:\s*"[^"]+"/i, severity: 'critical' },
  { name: 'Private Key', regex: /-----BEGIN [A-Z ]+ PRIVATE KEY-----/, severity: 'critical' },
  { name: 'Credit Card', regex: /\b(?:\d{4}[- ]?){3}\d{4}\b/, severity: 'critical' },
  { name: 'Nomor NIK (KTP)', regex: /\b\d{16}\b/, severity: 'high' },
  { name: 'Email PII', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/i, severity: 'medium' },
  { name: 'Nomor HP', regex: /\b(?:\+62|0)8\d{8,11}\b/, severity: 'medium' }
];

export function scanJSONSecurity(jsonText) {
  const findings = [];
  const lines = jsonText.split('\n');

  lines.forEach((lineText, idx) => {
    PII_PATTERNS.forEach(pattern => {
      if (pattern.regex.test(lineText)) {
        findings.push({
          line: idx + 1,
          type: pattern.name,
          severity: pattern.severity,
          excerpt: lineText.trim().substring(0, 80)
        });
      }
    });
  });

  return findings;
}

export function maskPIIFields(jsonText) {
  let masked = jsonText;
  
  // Simple masking for common patterns
  masked = masked.replace(/("pass(word)?"\s*:\s*")[^"]+(")/gi, '$1********$3');
  masked = masked.replace(/("api[-_]?key"\s*:\s*")[^"]+(")/gi, '$1********$3');
  masked = masked.replace(/(\b\d{12})\d{4}\b/g, '$1****'); // Mask NIK end
  
  return masked;
}

// ── 11. Dummy Data Generator ──
export async function generateDummyData(templateText, count = 10) {
  await lazyLoadScript('./vendor/faker.min.js');
  
  let templateObj;
  try {
    templateObj = JSON.parse(templateText);
  } catch(e) {
    throw new Error('Template JSON tidak valid: ' + e.message);
  }

  const { faker } = window;
  if (!faker) throw new Error('Faker.js tidak termuat.');

  const generateSingle = (template) => {
    if (typeof template === 'string') {
      return template.replace(/\{\{(.+?)\}\}/g, (match, path) => {
        path = path.trim();

        // Support dynamic faker paths like faker.name.firstName
        if (path.startsWith('faker.')) {
          const fakerPath = path.replace('faker.', '');
          try {
            const fn = fakerPath.split('.').reduce((obj, key) => obj[key], faker);
            if (typeof fn === 'function') {
              return fn();
            }
          } catch (e) {
            console.warn(`Gagal mengevaluasi ${path}:`, e);
          }
        }

        // Fallback to simple helper mappings mapped to Faker v5 UMD
        switch (path) {
          case 'uuid': return faker.datatype.uuid();
          case 'name': return faker.name.findName();
          case 'email': return faker.internet.email();
          case 'phone': return faker.phone.phoneNumber();
          case 'city': return faker.address.city();
          case 'company': return faker.company.companyName();
          case 'boolean': return faker.datatype.boolean() ? 'true' : 'false';
          case 'number': return faker.datatype.number({ min: 1, max: 100 }).toString();
          default: return match;
        }
      });
    }
    if (Array.isArray(template)) return template.map(generateSingle);
    if (typeof template === 'object' && template !== null) {
      return Object.fromEntries(
        Object.entries(template).map(([k, v]) => [k, generateSingle(v)])
      );
    }
    return template;
  };

  const results = [];
  for (let i = 0; i < count; i++) {
    results.push(generateSingle(templateObj));
  }
  return results;
}
