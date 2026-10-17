// Commit and commit date of the built tree. Null when git or the repository is unavailable.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

export function readGitInfo(root) {
  const none = { commit: null, commitDate: null };
  if (!existsSync(path.join(root, '.git'))) return none;
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (k.startsWith('GIT_')) delete env[k];
  const git = (...args) =>
    execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'ignore'], timeout: 4000 }).trim();
  try {
    const commit = git('rev-parse', '--short=7', 'HEAD');
    const date = new Date(git('log', '-1', '--format=%cI', 'HEAD'));
    if (!/^[0-9a-f]{7,40}$/.test(commit) || Number.isNaN(date.getTime())) return none;
    return { commit, commitDate: date.toISOString() };
  } catch {
    return none;
  }
}
