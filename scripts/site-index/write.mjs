// Writes the data files into a temp dir next to the target, then swaps it in with a rename.
import { mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync, writeFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';

export const stringify = (value) => JSON.stringify(value, null, 2) + '\n';

/** Throws when `out` is the repository root, one of its parents, or a non-empty dir that is not indexer output. */
function checkTarget(out, root) {
  if (root === out || root.startsWith(out + path.sep)) throw new Error(`refusing to write into ${out}: it contains the repository`);
  if (!existsSync(out)) return;
  if (!statSync(out).isDirectory()) throw new Error(`refusing to replace ${out}: it is not a directory`);
  const entries = readdirSync(out);
  if (entries.length > 0 && !entries.includes('index.json')) {
    throw new Error(`refusing to replace ${out}: it is not empty and holds no index.json from a previous run`);
  }
}

/** files: Map<relative POSIX path, string>. */
export function writeData(outDir, root, files) {
  const out = path.resolve(outDir);
  checkTarget(out, path.resolve(root));
  const parent = path.dirname(out);
  mkdirSync(parent, { recursive: true });
  const stage = mkdtempSync(path.join(parent, `.${path.basename(out)}-stage-`));
  try {
    for (const [rel, content] of files) {
      const abs = path.resolve(stage, ...rel.split('/'));
      if (!abs.startsWith(stage + path.sep)) throw new Error(`refusing to write outside the output dir: ${rel}`);
      mkdirSync(path.dirname(abs), { recursive: true });
      writeFileSync(abs, content);
    }
    rmSync(out, { recursive: true, force: true });
    renameSync(stage, out);
  } catch (e) {
    rmSync(stage, { recursive: true, force: true });
    throw e;
  }
}
