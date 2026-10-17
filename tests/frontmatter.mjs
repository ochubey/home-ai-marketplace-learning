// Minimal reader for the leading `---` frontmatter block of a Markdown file.
// Supports: `key: value` (plain, single- or double-quoted), `key:` followed by `- item`
// lists, `key:` followed by an indented nested map, and inline `[a, b]` lists.
// Also supports folded (`>`) and literal (`|`) block scalars (indent-continued lines).
// Throws when the block is missing or unterminated.

function unquote(raw) {
  const v = raw.trim();
  if (v.length >= 2 && ((v[0] === '"' && v.at(-1) === '"') || (v[0] === "'" && v.at(-1) === "'"))) {
    const inner = v.slice(1, -1);
    return v[0] === '"' ? inner.replace(/\\(["\\])/g, '$1') : inner.replace(/''/g, "'");
  }
  return v;
}

function scalar(raw) {
  const v = raw.trim();
  if (v.startsWith('[') && v.endsWith(']')) {
    const inner = v.slice(1, -1).trim();
    return inner === '' ? [] : inner.split(',').map(unquote);
  }
  return unquote(v);
}

const indentOf = (line) => line.length - line.trimStart().length;

function parseBlock(lines, start, indent) {
  const out = {};
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '' || line.trim().startsWith('#')) {
      i++;
      continue;
    }
    if (indentOf(line) < indent) break;
    const m = /^(\s*)([A-Za-z0-9_-]+):(?:\s+(.*))?$/.exec(line);
    if (!m) throw new Error(`frontmatter: cannot parse line ${JSON.stringify(line)}`);
    const [, , key, rest] = m;
    if (rest !== undefined && /^[>|][+-]?$/.test(rest.trim())) {
      const folded = rest.trim()[0] === '>';
      const parts = [];
      let j = i + 1;
      while (j < lines.length && (lines[j].trim() === '' || indentOf(lines[j]) > indentOf(line))) {
        parts.push(lines[j].trim());
        j++;
      }
      out[key] = parts.join(folded ? ' ' : '\n').trim();
      i = j;
      continue;
    }
    if (rest !== undefined && rest.trim() !== '') {
      out[key] = scalar(rest);
      i++;
      continue;
    }
    // value on following lines: a list or a nested map
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === '') j++;
    if (j < lines.length && lines[j].trimStart().startsWith('- ') && indentOf(lines[j]) >= indent) {
      const items = [];
      while (j < lines.length && lines[j].trimStart().startsWith('- ')) {
        items.push(unquote(lines[j].trimStart().slice(2)));
        j++;
      }
      out[key] = items;
      i = j;
    } else if (j < lines.length && indentOf(lines[j]) > indentOf(line)) {
      const [nested, next] = parseBlock(lines, j, indentOf(lines[j]));
      out[key] = nested;
      i = next;
    } else {
      out[key] = '';
      i++;
    }
  }
  return [out, i];
}

/** Returns { data, body }. Throws if the file has no terminated frontmatter block. */
export function parseFrontmatter(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines[0] !== '---') throw new Error('frontmatter: file does not start with ---');
  const end = lines.indexOf('---', 1);
  if (end === -1) throw new Error('frontmatter: unterminated block');
  const [data] = parseBlock(lines.slice(1, end), 0, 0);
  return { data, body: lines.slice(end + 1).join('\n') };
}

/** Normalises a `tools`-style value (comma string or list) to an array of names. */
export function toList(value) {
  if (value === undefined) return [];
  if (Array.isArray(value)) return value;
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
