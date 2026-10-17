#!/usr/bin/env node
// Deterministic quality gate for the cost experiment: checks the spec written by
// spec-creator and the plan returned by implementation-planner. No model calls.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SPEC_NAME = /^(\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const AC_START = /^\s*(?:[-*+]\s*|\|\s*|#+\s*)?[*_`]*AC-(\d+)\b/;
const CYRILLIC = new RegExp(`[${String.fromCharCode(0x400)}-${String.fromCharCode(0x4ff)}]`);

const ok = (detail = '') => ({ pass: true, detail });
const bad = (detail) => ({ pass: false, detail });

/** Split a spec into AC blocks: an AC line plus its continuation lines (until the next AC or heading). */
export function parseAcBlocks(text) {
  const blocks = [];
  let cur = null;
  for (const line of text.split('\n')) {
    const m = AC_START.exec(line);
    if (m) {
      cur = { id: `AC-${m[1]}`, text: line };
      blocks.push(cur);
    } else if (/^#{1,6}\s/.test(line)) {
      cur = null;
    } else if (cur) {
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
 * A verification hint is the word verif* or test in the AC block (the spec-creator template
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

  const noHint = acs.filter((b) => !/verif|\btest/i.test(b.text)).map((b) => b.id);
  checks.ac_verification = acs.length > 0 && noHint.length === 0
    ? ok()
    : bad(acs.length ? `no verification hint: ${noHint.join(', ')}` : 'no ACs');

  checks.untrusted_inputs = /^#{1,6}\s*untrusted inputs\b/im.test(text) ? ok() : bad('no "Untrusted inputs" heading');
  checks.no_cyrillic = CYRILLIC.test(text) ? bad('Cyrillic characters found') : ok();

  const limitAc = acs.filter((b) => /\b40\b/.test(b.text));
  const failAc = acs.filter((b) => /(non-?zero|exit(s|ing)?( with)?( status| code)? 1|status 1)/i.test(b.text));
  checks.too_long_name_ac = limitAc.length && failAc.length
    ? ok(`limit ${limitAc.map((b) => b.id).join(', ')}; exit ${failAc.map((b) => b.id).join(', ')}`)
    : bad(!limitAc.length ? 'no AC mentions the 40 character limit' : 'no AC states the failing exit status');

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

  // Every AC needs a task line that also names a test: "-> AC-n -> <test>".
  const testLine = (l) => /->\s*AC-[^>]*->\s*\S/.test(l);
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

/** Run the full gate on a temp repo and the two saved JSON outputs. */
export function checkQuality({ repoDir, specJsonPath, planJsonPath }) {
  const files = listSpecFiles(repoDir);
  const specText = files.length === 1 ? readFileSync(path.join(repoDir, 'specs', files[0]), 'utf8') : '';
  const checks = Object.fromEntries(Object.entries(checkSpec(specText, files)).map(([k, v]) => [`spec.${k}`, v]));

  const planJson = planJsonPath ? readJson(planJsonPath) : null;
  const status = gitStatusLines(repoDir);
  const planChecks = checkPlan(
    typeof planJson?.result === 'string' ? planJson.result : '',
    acceptanceCriteria(specText).map((b) => b.id),
    status ?? ['(git status failed)'],
  );
  for (const [k, v] of Object.entries(planChecks)) checks[`plan.${k}`] = v;
  if (!planJson) checks['plan.json'] = bad('planner JSON missing or unreadable');
  if (specJsonPath && !readJson(specJsonPath)) checks['spec.json'] = bad('spec-creator JSON missing or unreadable');
  return { pass: Object.values(checks).every((c) => c.pass), checks };
}

function main(argv) {
  const [repoDir, specJson, planJson] = argv;
  if (!repoDir || !specJson || !planJson) {
    console.error('usage: check-quality.mjs <repo-dir> <spec.json> <plan.json>');
    return 2;
  }
  const result = checkQuality({ repoDir, specJsonPath: specJson, planJsonPath: planJson });
  console.log(JSON.stringify(result, null, 2));
  return result.pass ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
