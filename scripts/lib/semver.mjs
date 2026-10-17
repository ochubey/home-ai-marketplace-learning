// SemVer 2.0.0 (semver.org regex) and a syntax-only range check.

export const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

export function isSemver(v) {
  return typeof v === 'string' && SEMVER_RE.test(v);
}

const NUM = String.raw`(?:\d+|[xX*])`;
const PARTIAL = String.raw`${NUM}(?:\.${NUM}(?:\.${NUM}(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)?)?`;
const COMPARATOR = String.raw`(?:\^|~|[<>]=?|=)?\s*${PARTIAL}`;
const HYPHEN = String.raw`${PARTIAL}\s+-\s+${PARTIAL}`;
const RANGE_SET = String.raw`(?:${HYPHEN}|${COMPARATOR}(?:\s+${COMPARATOR})*)`;
const RANGE_RE = new RegExp(String.raw`^\s*${RANGE_SET}(?:\s*\|\|\s*${RANGE_SET})*\s*$`);

/** Syntax check only; versions are never matched against a range. */
export function isRangeSyntax(v) {
  return typeof v === 'string' && RANGE_RE.test(v);
}
