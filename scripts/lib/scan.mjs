// Secret and absolute-path scan over text files.
import { readText } from './files.mjs';
import { problem } from './report.mjs';

const GH_PREFIX = 'gh[pousr]_';
// Rules are applied per line in this order; an overlapping span is reported by the first rule only.
export const LINE_RULES = [
  {
    id: 'secret-private-key',
    re: /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/g,
    label: 'private key block',
    secret: true,
  },
  { id: 'secret-github', re: new RegExp(String.raw`\b${GH_PREFIX}[A-Za-z0-9]{36,255}\b`, 'g'), label: 'GitHub token', secret: true },
  { id: 'secret-github', re: /\bgithub_pat_[A-Za-z0-9_]{22,}\b/g, label: 'GitHub token', secret: true },
  { id: 'secret-aws', re: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, label: 'AWS access key id', secret: true },
  { id: 'secret-anthropic', re: /\bsk-ant-[A-Za-z0-9_-]{20,}/g, label: 'Anthropic API key', secret: true },
  { id: 'secret-openai', re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}/g, label: 'OpenAI API key', secret: true },
  { id: 'secret-slack', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g, label: 'Slack token', secret: true },
  {
    id: 'secret-generic-assign',
    re: /(api_key|secret|token|passwd|password)\s*[:=]\s*["']([^"'\s]{16,})["']/gi,
    label: 'hard-coded credential assignment',
    secret: true,
    group: 2,
  },
  {
    id: 'abs-path',
    re: /(?:^|[\s"'`(=:,[])(\/Users\/[^/\s<>]+\/|\/home\/[^/\s<>]+\/|[A-Za-z]:\\Users\\[^\\\s<>]+)/g,
    label: 'machine-specific absolute path',
    secret: false,
    group: 1,
  },
];

const PLACEHOLDER_RE = /example|your|xxx|<|\$\{|\.\.\./i;
const ENV_FILE_RE = /^\.env(?:\..+)?$/;
const ENV_OK_RE = /^\.env\.(?:example|sample|template)$/;

function isEnvFile(rel) {
  const base = rel.slice(rel.lastIndexOf('/') + 1);
  return ENV_FILE_RE.test(base) && !ENV_OK_RE.test(base);
}

function describe(rule, value) {
  if (!rule.secret) return `${rule.label} "${value}"`;
  return `likely ${rule.label} (starts with "${value.slice(0, 4)}", ${value.length} chars)`;
}

/**
 * Scans text files. Returns { findings, scanned } where findings are
 * { file, line, rule, text, value, problem }.
 */
export function scanFiles(root, files) {
  const findings = [];
  let scanned = 0;
  for (const rel of files) {
    const text = readText(root, rel);
    if (text === null) continue;
    scanned++;
    if (isEnvFile(rel)) {
      findings.push({
        file: rel,
        line: undefined,
        rule: 'secret-env-file',
        text: '',
        value: rel,
        problem: problem(rel, 'secret-env-file', 'environment file must not be committed', 'delete it, add it to .gitignore and commit a .env.example instead'),
      });
    }
    const lines = text.split(/\r?\n/);
    lines.forEach((lineText, idx) => {
      const taken = [];
      for (const rule of LINE_RULES) {
        rule.re.lastIndex = 0;
        for (const m of lineText.matchAll(rule.re)) {
          const value = rule.group ? m[rule.group] : m[0];
          const start = m.index + m[0].indexOf(value);
          const end = start + value.length;
          if (taken.some(([s, e]) => start < e && s < end)) continue;
          taken.push([start, end]);
          if (rule.secret && PLACEHOLDER_RE.test(value)) continue;
          findings.push({
            file: rel,
            line: idx + 1,
            rule: rule.id,
            text: lineText,
            value,
            problem: problem(
              rel,
              rule.id,
              describe(rule, value),
              rule.secret ? 'remove the value, rotate it if it was real, and use a placeholder' : 'use a placeholder such as /Users/<name>/ or a relative path',
              idx + 1,
            ),
          });
        }
      }
    });
  }
  return { findings, scanned };
}
