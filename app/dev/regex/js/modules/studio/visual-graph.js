// app/dev/regex/js/modules/studio/visual-graph.js
import { parseRegex } from './parser.js';

export function regexToMermaid(pattern, flags = '') {
  try {
    const cleanPattern = pattern.replace(/^\/|\/[a-z]*$/g, '');
    const ast = parseRegex(cleanPattern);
    
    const nodes = [];
    const edges = [];
    let nodeId = 0;

    function addNode(label, shape = 'rect') {
      const id = `n${++nodeId}`;
      const escapedLabel = label.replace(/"/g, "'").replace(/[\[\]\(\)\{\}]/g, '\\$&');
      const formatted = shape === 'round'
        ? `${id}("${escapedLabel}")`
        : `${id}["${escapedLabel}"]`;
      nodes.push(formatted);
      return id;
    }

    function processNode(astNode, prevId) {
      if (!astNode) return prevId;

      switch (astNode.type) {
        case 'Alternative': {
          let current = prevId;
          if (astNode.expressions) {
            astNode.expressions.forEach(expr => {
              current = processNode(expr, current);
            });
          }
          return current;
        }

        case 'Disjunction': {
          const splitId = addNode('OR (Cabang)', 'round');
          edges.push(`${prevId} --> ${splitId}`);
          
          const leftEnd = processNode(astNode.left, splitId);
          const rightEnd = processNode(astNode.right, splitId);
          
          const joinId = addNode('Gabung', 'round');
          edges.push(`${leftEnd} --> ${joinId}`);
          edges.push(`${rightEnd} --> ${joinId}`);
          return joinId;
        }

        case 'Group': {
          const label = astNode.capturing ? `Grup Tangkap #${astNode.number || ''}` : 'Grup';
          const groupId = addNode(label);
          edges.push(`${prevId} --> ${groupId}`);
          const innerEnd = processNode(astNode.expression, groupId);
          return innerEnd;
        }

        case 'Repetition': {
          const repLabel = astNode.quantifier ? `Perulangan: ${astNode.quantifier.raw}` : 'Perulangan';
          const repId = addNode(repLabel, 'round');
          edges.push(`${prevId} --> ${repId}`);
          const innerEnd = processNode(astNode.expression, repId);
          edges.push(`${innerEnd} --> ${repId}`); // loop edge
          return repId;
        }

        case 'CharacterClass': {
          const classLabel = (astNode.negative ? 'Bukan: ' : 'Salah Satu: ') + astNode.raw;
          const classId = addNode(classLabel);
          edges.push(`${prevId} --> ${classId}`);
          return classId;
        }

        case 'Char': {
          const label = astNode.raw || astNode.value;
          const charId = addNode(label);
          edges.push(`${prevId} --> ${charId}`);
          return charId;
        }

        case 'Assertion': {
          const assertId = addNode(`Batasan: ${astNode.raw || astNode.kind}`);
          edges.push(`${prevId} --> ${assertId}`);
          return assertId;
        }

        default: {
          const genericId = addNode(astNode.type);
          edges.push(`${prevId} --> ${genericId}`);
          return genericId;
        }
      }
    }

    const startId = addNode('MULAI', 'round');
    const lastId = processNode(ast.body, startId);
    const endId = addNode('SELESAI', 'round');
    edges.push(`${lastId} --> ${endId}`);

    return `flowchart LR\n${nodes.join('\n')}\n${edges.join('\n')}`;
  } catch (err) {
    return `flowchart LR\nerr["Gagal merender diagram: ${err.message}"]`;
  }
}
