// Runs `npm audit --json` for all packages and for runtime packages (--omit=dev), writes the
// count per severity to the job summary and fails only on high or critical runtime findings.
import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

const SEVERITIES = ['critical', 'high', 'moderate', 'low', 'info'];

function audit(extraArgs) {
  const r = spawnSync('npm', ['audit', '--json', ...extraArgs], { encoding: 'utf8', shell: process.platform === 'win32' });
  let data;
  try {
    data = JSON.parse(r.stdout);
  } catch {
    throw new Error(`npm audit ${extraArgs.join(' ')} did not return JSON: ${(r.stderr || r.stdout || '').slice(0, 300)}`);
  }
  const counts = data?.metadata?.vulnerabilities;
  if (!counts) {
    throw new Error(`npm audit ${extraArgs.join(' ')} returned no counts: ${JSON.stringify(data.error ?? data).slice(0, 300)}`);
  }
  return Object.fromEntries(SEVERITIES.map((s) => [s, Number(counts[s] ?? 0)]));
}

let all;
let runtime;
try {
  all = audit([]);
  runtime = audit(['--omit=dev']);
} catch (err) {
  console.error(`audit-summary: ${err.message}`);
  process.exit(1);
}

const lines = [
  '## npm audit',
  '',
  '| Severity | All packages | Runtime packages |',
  '|---|---|---|',
  ...SEVERITIES.map((s) => `| ${s} | ${all[s]} | ${runtime[s]} |`),
  '',
];
const failing = runtime.high + runtime.critical;
lines.push(failing > 0
  ? `Failed: ${failing} high or critical finding(s) in runtime packages.`
  : 'No high or critical findings in runtime packages.');
const summary = lines.join('\n') + '\n';

if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
process.stdout.write(summary);
process.exit(failing > 0 ? 1 : 0);
