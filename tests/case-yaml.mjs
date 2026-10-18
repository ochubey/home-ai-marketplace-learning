// Minimal reader for the case.yaml subset used by the eval cases in this repository.
// Supports: `key: value` scalars (plain, quoted, booleans, numbers), inline `[a, b]` lists,
// nested maps by indentation, lists of maps (`- key: value` plus indented keys) and
// literal/folded block scalars. Full-line `#` comments are skipped. Throws on anything else.

const indentOf = (line) => line.length - line.trimStart().length;

function unquote(raw) {
  const v = raw.trim();
  if (v.length >= 2 && ((v[0] === '"' && v.at(-1) === '"') || (v[0] === "'" && v.at(-1) === "'"))) {
    return v[0] === '"' ? v.slice(1, -1).replace(/\\(["\\])/g, '$1') : v.slice(1, -1).replace(/''/g, "'");
  }
  return v;
}

function scalar(raw) {
  const v = raw.trim();
  if (v.startsWith('[') && v.endsWith(']')) {
    const inner = v.slice(1, -1).trim();
    return inner === '' ? [] : inner.split(',').map((s) => scalar(s));
  }
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return unquote(v);
}

function blockScalar(lines, i, parentIndent, folded) {
  const parts = [];
  let j = i;
  while (j < lines.length && (lines[j].trim() === '' || indentOf(lines[j]) > parentIndent)) {
    parts.push(lines[j].trim());
    j++;
  }
  return [parts.join(folded ? ' ' : '\n').trim(), j];
}

function parseMap(lines, start, indent) {
  const out = {};
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '' || line.trim().startsWith('#')) {
      i++;
      continue;
    }
    if (indentOf(line) < indent) break;
    if (indentOf(line) > indent) throw new Error(`case.yaml: unexpected indent in ${JSON.stringify(line)}`);
    const m = /^\s*([A-Za-z0-9_-]+):(?:\s+(.*))?$/.exec(line);
    if (!m) throw new Error(`case.yaml: cannot parse line ${JSON.stringify(line)}`);
    const [, key, rest] = m;
    if (rest !== undefined && /^[>|][+-]?$/.test(rest.trim())) {
      const [text, next] = blockScalar(lines, i + 1, indent, rest.trim()[0] === '>');
      out[key] = text;
      i = next;
    } else if (rest !== undefined && rest.trim() !== '') {
      out[key] = scalar(rest);
      i++;
    } else {
      let j = i + 1;
      while (j < lines.length && (lines[j].trim() === '' || lines[j].trim().startsWith('#'))) j++;
      if (j < lines.length && lines[j].trimStart().startsWith('- ') && indentOf(lines[j]) >= indent) {
        const [items, next] = parseList(lines, j, indentOf(lines[j]));
        out[key] = items;
        i = next;
      } else if (j < lines.length && indentOf(lines[j]) > indent) {
        const [nested, next] = parseMap(lines, j, indentOf(lines[j]));
        out[key] = nested;
        i = next;
      } else {
        out[key] = '';
        i++;
      }
    }
  }
  return [out, i];
}

function parseList(lines, start, indent) {
  const items = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '' || line.trim().startsWith('#')) {
      i++;
      continue;
    }
    if (indentOf(line) !== indent || !line.trimStart().startsWith('- ')) break;
    // rewrite "- key: v" as a map line indented two columns deeper and parse the item as a map
    const item = [' '.repeat(indent + 2) + line.trimStart().slice(2)];
    let j = i + 1;
    while (j < lines.length && (lines[j].trim() === '' || indentOf(lines[j]) > indent)) {
      item.push(lines[j]);
      j++;
    }
    const first = item[0].trim();
    if (/^[A-Za-z0-9_-]+:(\s|$)/.test(first)) items.push(parseMap(item, 0, indent + 2)[0]);
    else items.push(scalar(first));
    i = j;
  }
  return [items, i];
}

export function parseCaseYaml(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  return parseMap(lines, 0, 0)[0];
}
