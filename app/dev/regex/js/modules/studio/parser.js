// app/dev/regex/js/modules/studio/parser.js

export function parseRegex(pattern) {
  let index = 0;
  
  function peek() {
    return pattern[index];
  }
  
  function next() {
    return pattern[index++];
  }
  
  function parseDisjunction() {
    let left = parseAlternative();
    if (peek() === '|') {
      next(); // consume '|'
      let right = parseDisjunction();
      return {
        type: 'Disjunction',
        left,
        right
      };
    }
    return left;
  }
  
  function parseAlternative() {
    let expressions = [];
    while (index < pattern.length && peek() !== ')' && peek() !== '|') {
      let expr = parseTerm();
      if (expr) expressions.push(expr);
    }
    return {
      type: 'Alternative',
      expressions
    };
  }
  
  function parseTerm() {
    let expr = parseFactor();
    if (!expr) return null;
    
    // Check for quantifiers
    let nextChar = peek();
    if (nextChar === '*' || nextChar === '+' || nextChar === '?') {
      next();
      let greedy = true;
      if (peek() === '?') {
        next();
        greedy = false;
      }
      return {
        type: 'Repetition',
        expression: expr,
        quantifier: {
          type: 'Quantifier',
          kind: nextChar,
          greedy,
          raw: nextChar + (greedy ? '' : '?')
        }
      };
    } else if (nextChar === '{') {
      // Range quantifier
      let startIdx = index;
      next(); // consume '{'
      let rangeStr = '';
      while (index < pattern.length && peek() !== '}') {
        rangeStr += next();
      }
      next(); // consume '}'
      let greedy = true;
      if (peek() === '?') {
        next();
        greedy = false;
      }
      let parts = rangeStr.split(',');
      let from = parseInt(parts[0]);
      let to = parts.length > 1 ? (parts[1] ? parseInt(parts[1]) : undefined) : from;
      
      return {
        type: 'Repetition',
        expression: expr,
        quantifier: {
          type: 'Quantifier',
          kind: 'Range',
          from,
          to,
          greedy,
          raw: `{${rangeStr}}` + (greedy ? '' : '?')
        }
      };
    }
    return expr;
  }
  
  function parseFactor() {
    let char = peek();
    if (!char) return null;
    
    if (char === '(') {
      next(); // consume '('
      let capturing = true;
      let raw = '(';
      if (pattern.substring(index, index + 2) === '?:') {
        index += 2;
        capturing = false;
        raw += '?:';
      }
      let expression = parseDisjunction();
      next(); // consume ')'
      raw += ')';
      return {
        type: 'Group',
        capturing,
        expression,
        raw
      };
    } else if (char === '[') {
      next(); // consume '['
      let negative = false;
      let raw = '[';
      if (peek() === '^') {
        next();
        negative = true;
        raw += '^';
      }
      let expressions = [];
      let classContent = '';
      while (index < pattern.length && peek() !== ']') {
        classContent += next();
      }
      next(); // consume ']'
      raw += classContent + ']';
      
      // Parse ranges like a-z
      for (let i = 0; i < classContent.length; i++) {
        if (classContent[i+1] === '-' && classContent[i+2]) {
          expressions.push({
            type: 'ClassRange',
            from: { value: classContent[i] },
            to: { value: classContent[i+2] }
          });
          i += 2;
        } else {
          expressions.push({
            type: 'Char',
            value: classContent[i]
          });
        }
      }
      
      return {
        type: 'CharacterClass',
        negative,
        expressions,
        raw
      };
    } else if (char === '\\') {
      next(); // consume '\\'
      let escaped = next();
      let raw = '\\' + escaped;
      if (['d', 'D', 'w', 'W', 's', 'S'].includes(escaped)) {
        return {
          type: 'Char',
          kind: 'meta',
          value: raw,
          raw
        };
      }
      return {
        type: 'Char',
        kind: 'escaped',
        value: escaped,
        raw
      };
    } else if (['^', '$'].includes(char)) {
      next();
      return {
        type: 'Assertion',
        kind: char,
        raw: char
      };
    } else if (char === '.') {
      next();
      return {
        type: 'Char',
        kind: 'meta',
        value: '.',
        raw: '.'
      };
    } else {
      next();
      return {
        type: 'Char',
        kind: 'simple',
        value: char,
        raw: char
      };
    }
  }
  
  return {
    body: parseDisjunction()
  };
}
