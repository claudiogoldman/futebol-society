const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'app', 'page.js');
let source = fs.readFileSync(file, 'utf8');

const domainImport = "import { drawTeams, isGoalkeeper as isGoleiro, physicalScore } from '../lib/domain/game';\nimport { averageRatingFor as avgRatingFor, computeGameHighlights as computeGameDestaques, computeRanking } from '../lib/domain/ranking';\n";

if (!source.includes("from '../lib/domain/game'")) {
  const marker = "import { NATIONALITIES, countryFlag } from '../lib/countries';\n";
  if (!source.includes(marker)) throw new Error('Domain import anchor not found');
  source = source.replace(marker, marker + domainImport);
}

function findFunctionRange(text, name) {
  const signature = `function ${name}(`;
  const start = text.indexOf(signature);
  if (start < 0) return null;

  const open = text.indexOf('{', start);
  if (open < 0) throw new Error(`Opening brace not found for ${name}`);

  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = open; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (lineComment) {
      if (ch === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === '*' && next === '/') {
        blockComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '/' && next === '/') {
      lineComment = true;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      blockComment = true;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        let end = i + 1;
        while (text[end] === '\n' || text[end] === '\r') end += 1;
        return { start, end };
      }
    }
  }

  throw new Error(`Closing brace not found for ${name}`);
}

const helpers = [
  'isGoleiro',
  'physicalScore',
  'drawTeams',
  'avgRatingFor',
  'computeGameDestaques',
  'computeRanking',
];

for (const name of helpers) {
  const range = findFunctionRange(source, name);
  if (!range) {
    if (source.includes(`function ${name}(`)) throw new Error(`Could not parse ${name}`);
    continue;
  }
  source = source.slice(0, range.start) + source.slice(range.end);
}

fs.writeFileSync(file, source);
console.log('Domain helpers centralized in lib/domain.');
