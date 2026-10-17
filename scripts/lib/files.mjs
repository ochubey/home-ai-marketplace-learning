// File discovery and text reading. Git mode when <root>/.git exists, else a directory walk.
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, openSync, readSync, closeSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const SKIP_DIRS = new Set(['.git', 'node_modules']);
const BINARY_PROBE_BYTES = 8192;

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function gitList(root) {
  const out = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: root,
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return out
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .filter((rel) => {
      try {
        return lstatSync(path.join(root, rel)).isFile();
      } catch {
        return false; // deleted in the working tree
      }
    });
}

function walk(root, dir = '') {
  const result = [];
  for (const d of readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (d.isDirectory()) {
      if (!SKIP_DIRS.has(d.name)) result.push(...walk(root, path.join(dir, d.name)));
    } else if (d.isFile()) {
      result.push(path.join(dir, d.name));
    }
  }
  return result;
}

/** Returns { files } as sorted, POSIX-normalised root-relative paths. */
export function listFiles(root) {
  let list;
  if (existsSync(path.join(root, '.git'))) {
    try {
      list = gitList(root);
    } catch {
      list = undefined; // git unavailable: fall back to a walk
    }
  }
  list ??= walk(root);
  const files = [...new Set(list.map(toPosix))].sort();
  return { files };
}

export function isBinaryFile(abs) {
  const fd = openSync(abs, 'r');
  try {
    const buf = Buffer.alloc(BINARY_PROBE_BYTES);
    const n = readSync(fd, buf, 0, BINARY_PROBE_BYTES, 0);
    return buf.subarray(0, n).includes(0);
  } finally {
    closeSync(fd);
  }
}

/** Returns file text, or null for binary files. */
export function readText(root, rel) {
  const abs = path.join(root, ...rel.split('/'));
  if (isBinaryFile(abs)) return null;
  return readFileSync(abs, 'utf8');
}

export function exists(root, rel) {
  return existsSync(path.join(root, ...rel.split('/')));
}
