#!/usr/bin/env node
// Deterministic quality gate for the cost experiment: checks the spec written by
// spec-creator and the plan returned by implementation-planner. No model calls.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SPEC_NAME = /^(\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const AC_START = /^\s*(?:(?:[-*+]|\d+[.)]|\||#+)\s*)*[*_`]*AC-(\d+)\b/;
const LIST_LINE = /^\s*(?:[-*+]|\d+[.)])\s/;
const BOLD_ONLY = /^\s*(?:\*\*[^*]+\*\*|__[^_]+__):?\s*$/;
const TABLE_SEPARATOR = /^\s*\|[\s:|-]+\|?\s*$/;
const tableCells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
const CYRILLIC = new RegExp(`[${String.fromCharCode(0x400)}-${String.fromCharCode(0x4ff)}]`);

const LIMIT = /\b40\b|\blimit\b/i;
const EXIT_FAIL = new RegExp([
  '\\bnon-?zero\\s+(?:exit|status|code)\\b',
  '\\bexit(?:s|ing)?\\s+(?:with\\s+)?(?:an?\\s+)?non-?zero\\b',
  '\\bexit(?:s|ing)?\\s+(?:with\\s+)?(?:(?:an?|the)\\s+)?(?:(?:status|code)\\s+)?`?1`?(?!\\d|\\.\\d)',
  '\\bset\\s+the\\s+exit\\s+status\\s+to\\s+`?1`?(?!\\d|\\.\\d)',
].join('|'), 'i');

const ok = (detail = '') => ({ pass: true, detail });
const bad = (detail) => ({ pass: false, detail });

/**
 * Split a spec into AC blocks: an AC line plus its continuation lines. A block ends at the next AC,
 * a heading, a table row, a bold-only line, or a blank line followed by a non-indented non-list line.
 * Table rows under a header with a Verification/Verify column get `verification: true` when that cell is filled.
 */
export function parseAcBlocks(text) {
  const blocks = [];
  const lines = text.split('\n');
  let cur = null;
  let header = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isTable = line.trim().startsWith('|');
    if (isTable && TABLE_SEPARATOR.test(line)) {
      header = i > 0 && lines[i - 1].trim().startsWith('|') ? tableCells(lines[i - 1]) : null;
      cur = null;
      continue;
    }
    if (!isTable) header = null;
    const m = AC_START.exec(line);
    if (m) {
      cur = { id: `AC-${m[1]}`, text: line };
      if (isTable && header) {
        const col = header.findIndex((h) => /verif/i.test(h));
        const cell = col >= 0 ? tableCells(line)[col] : undefined;
        if (cell && !/^(?:-+|n\/a|none|tbd)$/i.test(cell)) cur.verification = true;
      }
      blocks.push(cur);
    } else if (/^#{1,6}\s/.test(line) || isTable || BOLD_ONLY.test(line)) {
      cur = null;
    } else if (cur) {
      if (!line.trim()) {
        const next = lines[i + 1];
        if (next !== undefined && next.trim() && !/^\s/.test(next) && !LIST_LINE.test(next)) {
          cur = null;
          continue;
        }
      }
      cur.text += `\n${line}`;
    }
  }
  return blocks;
}

/** AC blocks that carry the EARS marker `shall`, one per id. */
export function acceptanceCriteria(text) {
  const seen = new Set();
  return parseAcBlocks(text).filter((b) => {
    if (!/\bshall\b/i.test(b.text) || seen.has(b.id)) return false;
    seen.add(b.id);
    return true;
  });
}

export function countClarifications(text) {
  return (text.match(/\[NEEDS CLARIFICATION\]/g) ?? []).length;
}

/**
 * Spec checks. fileNames = entries found under specs/ of the temp repo.
 * A verification hint is the word verif* or test in the AC block, or a filled Verification column cell (the spec-creator template
 * asks for "a verification hint per AC: what test or check would prove it").
 */
export function checkSpec(text, fileNames) {
  const checks = {};
  const names = fileNames ?? [];
  const nameOk = names.length === 1 && SPEC_NAME.test(names[0]);
  checks.spec_file = nameOk
    ? ok(names[0])
    : bad(`expected exactly one specs/NN-<kebab>.md, found: ${JSON.stringify(names)}`);

  const nn = nameOk ? SPEC_NAME.exec(names[0])[1] : null;
  const idRe = nn ? new RegExp(`SPEC-${nn}\\b`) : /SPEC-\d{2}\b/;
  checks.spec_id = idRe.test(text) ? ok() : bad(`missing ${nn ? `SPEC-${nn}` : 'SPEC-NN'}`);

  const acs = acceptanceCriteria(text);
  checks.ac_count = acs.length >= 3 ? ok(`${acs.length} ACs`) : bad(`${acs.length} AC lines with "shall" (need >= 3)`);

  const noHint = acs.filter((b) => !b.verification && !/verif|\btest/i.test(b.text)).map((b) => b.id);
  checks.ac_verification = acs.length > 0 && noHint.length === 0
    ? ok()
    : bad(acs.length ? `no verification hint: ${noHint.join(', ')}` : 'no ACs');

  checks.untrusted_inputs = /^#{1,6}\s*untrusted inputs\b/im.test(text) ? ok() : bad('no "Untrusted inputs" heading');
  checks.no_cyrillic = CYRILLIC.test(text) ? bad('Cyrillic characters found') : ok();

  // One AC must mention the limit and a failing exit status, or an AC with the limit must be
  // immediately followed by an AC that states the failing exit status.
  const limitAc = acs.filter((b) => LIMIT.test(b.text));
  const same = acs.filter((b) => LIMIT.test(b.text) && EXIT_FAIL.test(b.text));
  const pair = acs.slice(0, -1).find((b, k) => LIMIT.test(b.text) && EXIT_FAIL.test(acs[k + 1].text));
  checks.too_long_name_ac = same.length || pair
    ? ok(same.length ? `limit and exit status in ${same[0].id}` : `limit ${pair.id}, exit status in next AC`)
    : bad(!limitAc.length ? 'no AC mentions the 40 character limit' : 'no AC with the limit also states the failing exit status, and the next AC does not either');

  const n = countClarifications(text);
  checks.needs_clarification = { pass: true, detail: `${n} marker(s) (counted, not a failure)`, count: n };
  return checks;
}

/** Plan checks. acIds = AC ids of the spec; statusLines = `git status --porcelain` lines. */
export function checkPlan(planText, acIds, statusLines) {
  const checks = {};
  const text = planText ?? '';
  const lines = text.split('\n');

  const tableLines = lines.filter((l) => l.trim().startsWith('|'));
  const tableText = tableLines.join('\n');
  const missingTable = acIds.filter((id) => !new RegExp(`${id}(?!\\d)`).test(tableText));
  checks.coverage_table = tableLines.length && !missingTable.length && acIds.length
    ? ok()
    : bad(!tableLines.length ? 'no table found' : `AC ids missing from table: ${missingTable.join(', ') || '(spec has no ACs)'}`);

  const taskLines = lines.filter((l) => /^\s*(?:[-*]\s*)?(?:\[[ xX]\]\s*)?\**T\d+\b/.test(l));
  const missingTask = acIds.filter((id) => !taskLines.some((l) => new RegExp(`${id}(?!\\d)`).test(l)));
  checks.tasks_cover_acs = taskLines.length && !missingTask.length && acIds.length
    ? ok(`${taskLines.length} tasks`)
    : bad(!taskLines.length ? 'no task lines (T<n>)' : `AC ids with no task: ${missingTask.join(', ') || '(spec has no ACs)'}`);

  // Every AC needs a task line that also names a test: "-> AC-n -> <test>" (or the unicode arrow).
  const testLine = (l) => /(?:->|\u2192)\s*AC-[^>\u2192]*(?:->|\u2192)\s*\S/.test(l);
  const noTestFor = acIds.filter((id) => !taskLines.some((l) => new RegExp(`${id}(?!\\d)`).test(l) && testLine(l)));
  checks.tasks_have_tests = taskLines.length && acIds.length && !noTestFor.length
    ? ok()
    : bad(taskLines.length ? `AC ids with no task naming a test: ${noTestFor.join(', ') || '(spec has no ACs)'}` : 'no task lines');

  const dirty = (statusLines ?? []).filter((l) => !l.slice(3).startsWith('specs/'));
  checks.repo_unchanged = dirty.length ? bad(`changes outside specs/: ${dirty.join('; ')}`) : ok();
  return checks;
}

export function gitStatusLines(repoDir) {
  const r = spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: repoDir, encoding: 'utf8' });
  if (r.status !== 0) return null;
  return r.stdout.split('\n').filter(Boolean);
}

export function listSpecFiles(repoDir) {
  const dir = path.join(repoDir, 'specs');
  return existsSync(dir) ? readdirSync(dir).sort() : [];
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

export function assemble({ specText, files, planJson, specJsonOk, statusLines }) {
  const checks = Object.fromEntries(Object.entries(checkSpec(specText, files)).map(([k, v]) => [`spec.${k}`, v]));
  const planChecks = checkPlan(
    typeof planJson?.result === 'string' ? planJson.result : '',
    acceptanceCriteria(specText).map((b) => b.id),
    statusLines,
  );
  for (const [k, v] of Object.entries(planChecks)) checks[`plan.${k}`] = v;
  // Attribute a missing plan: the planner refuses to plan a spec that still has open markers, which is the spec's fault.
  const noPlan = !checks['plan.coverage_table'].pass && !checks['plan.tasks_cover_acs'].pass;
  const openMarkers = checks['spec.needs_clarification']?.count ?? 0;
  checks['plan.no_plan_cause'] = {
    pass: true,
    detail: noPlan ? (openMarkers > 0 ? `no plan; the spec has ${openMarkers} open [NEEDS CLARIFICATION] marker(s)` : 'no plan; the spec has no open markers') : '',
  };
  if (!planJson) checks['plan.json'] = bad('planner JSON missing or unreadable');
  if (!specJsonOk) checks['spec.json'] = bad('spec-creator JSON missing or unreadable');
  return checks;
}

/** Run the full gate on a temp repo and the two saved JSON outputs. */
export function checkQuality({ repoDir, specJsonPath, planJsonPath }) {
  const files = listSpecFiles(repoDir);
  const specText = files.length === 1 ? readFileSync(path.join(repoDir, 'specs', files[0]), 'utf8') : '';
  const checks = assemble({
    specText,
    files,
    planJson: planJsonPath ? readJson(planJsonPath) : null,
    specJsonOk: !specJsonPath || Boolean(readJson(specJsonPath)),
    statusLines: gitStatusLines(repoDir) ?? ['(git status failed)'],
  });
  return { pass: Object.values(checks).every((c) => c.pass), checks };
}

/**
 * Re-grade a finished run from <out>/<label>-run<i>-spec.md and -plan.json.
 * repo_unchanged cannot be re-computed (the temp repo is gone), so it is taken from the stored quality record.
 */
export function checkFromSaved(dir, label, i) {
  const base = path.join(dir, `${label}-run${i}`);
  if (!existsSync(`${base}-spec.md`)) throw new Error(`no saved spec at ${base}-spec.md`);
  const specText = readFileSync(`${base}-spec.md`, 'utf8');
  const stored = readJson(`${base}-quality.json`);
  const storedName = stored?.spec_file ?? (stored?.quality?.checks?.['spec.spec_file']?.pass ? stored.quality.checks['spec.spec_file'].detail : null);
  const checks = assemble({
    specText,
    files: storedName ? [storedName] : [],
    planJson: readJson(`${base}-plan.json`),
    specJsonOk: Boolean(readJson(`${base}-spec.json`)),
    statusLines: [],
  });
  checks['plan.repo_unchanged'] = stored?.quality?.checks?.['plan.repo_unchanged']
    ?? bad('no stored quality record to take repo_unchanged from');
  return { pass: Object.values(checks).every((c) => c.pass), checks };
}

function main(argv) {
  if (argv[0] === '--from-saved') {
    const [, dir, label, i] = argv;
    if (!dir || !label || !/^\d+$/.test(i ?? '')) {
      console.error('usage: check-quality.mjs --from-saved <out-dir> <label> <run-number>');
      return 2;
    }
    try {
      const result = checkFromSaved(dir, label, Number(i));
      console.log(JSON.stringify(result, null, 2));
      return result.pass ? 0 : 1;
    } catch (e) {
      console.error(e.message);
      return 2;
    }
  }
  const [repoDir, specJson, planJson] = argv;
  if (!repoDir || !specJson || !planJson) {
    console.error('usage: check-quality.mjs <repo-dir> <spec.json> <plan.json>\n       check-quality.mjs --from-saved <out-dir> <label> <run-number>');
    return 2;
  }
  const result = checkQuality({ repoDir, specJsonPath: specJson, planJsonPath: planJson });
  console.log(JSON.stringify(result, null, 2));
  return result.pass ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
