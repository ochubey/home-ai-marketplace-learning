// CODEOWNERS checks: default rule exists, every plugin has a more specific owned rule.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { problem } from './report.mjs';

export const CODEOWNERS_FILE = '.github/CODEOWNERS';
const DEFAULT_PATTERNS = new Set(['*', '/**']);

function globToRegExp(pattern) {
  let p = pattern;
  const dirOnly = p.endsWith('/');
  if (dirOnly) p = p.slice(0, -1);
  const anchored = p.startsWith('/') || p.includes('/');
  if (p.startsWith('/')) p = p.slice(1);
  let body = '';
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === '*') {
      if (p[i + 1] === '*') {
        if (p[i + 2] === '/') {
          body += '(?:.*/)?';
          i += 2;
        } else {
          body += '.*';
          i += 1;
        }
      } else {
        body += '[^/]*';
      }
    } else if (c === '?') {
      body += '[^/]';
    } else {
      body += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${anchored ? '' : '(?:.*/)?'}${body}${dirOnly ? '/.*' : '(?:/.*)?'}$`);
}

function parse(text) {
  const rules = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [pattern, ...rest] = line.split(/\s+/);
    const owners = [];
    for (const t of rest) {
      if (t.startsWith('#')) break;
      owners.push(t);
    }
    rules.push({ pattern, owners, re: globToRegExp(pattern) });
  }
  return rules;
}

export function checkCodeowners(root, files, catalog, problems) {
  if (!files.includes(CODEOWNERS_FILE)) {
    problems.push(
      problem(CODEOWNERS_FILE, 'codeowners-missing', 'CODEOWNERS file is missing', `create ${CODEOWNERS_FILE} with a "* @owner" default rule`),
    );
    return;
  }
  const rules = parse(readFileSync(path.join(root, ...CODEOWNERS_FILE.split('/')), 'utf8'));
  if (!rules.some((r) => DEFAULT_PATTERNS.has(r.pattern) && r.owners.length > 0)) {
    problems.push(
      problem(CODEOWNERS_FILE, 'codeowners-default', 'no default owner rule ("*" or "/**" with an owner)', 'add the line "* @owner"'),
    );
  }
  for (const e of catalog.entries) {
    if (!e.sourceOk) continue;
    const probe = `plugins/${e.name}/.claude-plugin/plugin.json`;
    const last = [...rules].reverse().find((r) => r.re.test(probe));
    if (!last || DEFAULT_PATTERNS.has(last.pattern) || last.owners.length === 0) {
      problems.push(
        problem(CODEOWNERS_FILE, 'codeowners-plugin', `plugin directory plugins/${e.name}/ has no specific CODEOWNERS rule with an owner`, `add "/plugins/${e.name}/ @owner" after the default rule`),
      );
    }
  }
}
