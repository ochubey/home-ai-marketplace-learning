// Filesystem helpers. Every read goes through a context that only allows `plugins/` and
// `.claude-plugin/`, and nothing follows symbolic links.
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

export const toPosix = (p) => p.split(path.sep).join('/');
export const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** 'file' | 'dir' | 'symlink' | 'other' | null (missing). Never follows links. */
export function statKind(abs) {
  try {
    const s = lstatSync(abs);
    if (s.isSymbolicLink()) return 'symlink';
    if (s.isFile()) return 'file';
    if (s.isDirectory()) return 'dir';
    return 'other';
  } catch {
    return null;
  }
}

export function createContext(root) {
  const absRoot = path.resolve(root);
  const allowed = [path.join(absRoot, 'plugins'), path.join(absRoot, '.claude-plugin')];
  const warnings = [];

  const rel = (abs) => toPosix(path.relative(absRoot, abs));
  const guard = (abs) => {
    const ok = allowed.some((a) => abs === a || abs.startsWith(a + path.sep));
    if (!ok) throw new Error(`refusing to read outside plugins/ and .claude-plugin/: ${rel(abs)}`);
  };

  return {
    root: absRoot,
    warnings,
    rel,
    warn: (msg) => warnings.push(msg),
    abs: (...parts) => path.join(absRoot, ...parts),
    /** Text of a file inside the allowed folders; throws on read errors. */
    readText(abs) {
      guard(abs);
      return readFileSync(abs, 'utf8');
    },
    /** Sorted Dirent list of a real directory; [] for a missing one; warns and returns [] for a symlink. */
    listDir(abs) {
      guard(abs);
      const kind = statKind(abs);
      if (kind === null) return [];
      if (kind === 'symlink') {
        warnings.push(`${rel(abs)}: symlink skipped`);
        return [];
      }
      if (kind !== 'dir') return [];
      return readdirSync(abs, { withFileTypes: true }).sort((a, b) => cmp(a.name, b.name));
    },
  };
}
