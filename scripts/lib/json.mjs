// Strict JSON reading with BOM detection.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { problem } from './report.mjs';

/**
 * Reads and parses a JSON file. Appends json-bom / json-invalid problems.
 * Returns { ok: true, value } or { ok: false }. The caller handles a missing file.
 */
export function readJson(root, rel, problems, invalidRule = 'json-invalid') {
  const text = readFileSync(path.join(root, ...rel.split('/')), 'utf8');
  if (text.charCodeAt(0) === 0xfeff) {
    problems.push(problem(rel, 'json-bom', 'file starts with a UTF-8 BOM', 'save the file as UTF-8 without BOM'));
    return { ok: false };
  }
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (err) {
    problems.push(problem(rel, invalidRule, `invalid JSON: ${err.message}`, 'fix the JSON syntax'));
    return { ok: false };
  }
}

export function isObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
