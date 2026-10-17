// Problem model and plain-text report formatting.

/** @typedef {{file: string, line?: number, rule: string, message: string, hint: string}} Problem */

export function problem(file, rule, message, hint, line) {
  return line === undefined ? { file, rule, message, hint } : { file, line, rule, message, hint };
}

function compare(a, b) {
  if (a.file !== b.file) return a.file < b.file ? -1 : 1;
  const la = a.line ?? 0;
  const lb = b.line ?? 0;
  if (la !== lb) return la - lb;
  if (a.rule !== b.rule) return a.rule < b.rule ? -1 : 1;
  if (a.message !== b.message) return a.message < b.message ? -1 : 1;
  return 0;
}

export function sortProblems(problems) {
  return [...problems].sort(compare);
}

export function formatProblem(p) {
  const where = p.line === undefined ? p.file : `${p.file}:${p.line}`;
  return `ERROR ${where} [${p.rule}] ${p.message} - fix: ${p.hint}`;
}

export function formatReport(problems, stats) {
  const lines = sortProblems(problems).map(formatProblem);
  const tail = `${stats.plugins} plugins checked, ${stats.files} files scanned`;
  lines.push(
    problems.length === 0
      ? `validate-marketplace: OK - ${tail}`
      : `validate-marketplace: FAILED - ${problems.length} problems, ${tail}`,
  );
  return lines.join('\n') + '\n';
}
