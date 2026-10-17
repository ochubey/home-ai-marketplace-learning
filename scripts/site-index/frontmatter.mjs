// Lenient reader for the leading `---` frontmatter block. Never throws; top-level keys only.

const BLOCK_RE = /^\uFEFF?---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/;
const KEY_RE = /^([A-Za-z0-9_-]+):(?:[ \t]+(.*))?$/;

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
  if (v === 'true' || v === 'false') return v === 'true';
  return unquote(v);
}

const indentOf = (line) => line.length - line.trimStart().length;

function parseLines(lines) {
  const data = Object.create(null);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const m = line.trim() === '' || line.trim().startsWith('#') || indentOf(line) > 0 ? null : KEY_RE.exec(line);
    if (!m) {
      i++;
      continue;
    }
    const [, key, rest] = m;
    const value = rest === undefined ? '' : rest.trim();
    if (/^[>|][+-]?$/.test(value)) {
      const folded = value[0] === '>';
      const parts = [];
      let j = i + 1;
      while (j < lines.length && (lines[j].trim() === '' || indentOf(lines[j]) > 0)) {
        parts.push(lines[j].trim());
        j++;
      }
      data[key] = parts.join(folded ? ' ' : '\n').trim();
      i = j;
    } else if (value !== '') {
      data[key] = scalar(value);
      i++;
    } else {
      let j = i + 1;
      const items = [];
      while (j < lines.length && (lines[j].trim() === '' || indentOf(lines[j]) > 0 || lines[j].startsWith('- '))) {
        const t = lines[j].trim();
        if (t.startsWith('- ')) items.push(unquote(t.slice(2)));
        j++;
      }
      data[key] = items.length ? items : '';
      i = j;
    }
  }
  return data;
}

/**
 * Splits `text` into { data, body, state }. `state` is 'none' (no frontmatter), 'ok' or 'unterminated'.
 * The body is the text after the closing `---` line, byte for byte.
 */
export function parseFrontmatter(text) {
  const m = BLOCK_RE.exec(text);
  if (!m) {
    const state = /^\uFEFF?---[ \t]*\r?\n/.test(text) ? 'unterminated' : 'none';
    return { data: Object.create(null), body: text.replace(/^\uFEFF/, ''), state };
  }
  return { data: parseLines((m[1] ?? '').split(/\r?\n/)), body: text.slice(m[0].length), state: 'ok' };
}
