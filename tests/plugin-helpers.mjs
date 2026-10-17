// Shared helpers for the plugin test files.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './helpers.mjs';
import { parseFrontmatter, toList } from './frontmatter.mjs';

export const PLUGINS_DIR = path.join(REPO_ROOT, 'plugins');
export const MARKETPLACE = 'home-ai-marketplace-learning';
export const PAVED = 'engineering-paved-path';
export const DEFERRED_SKILLS = ['next-best-practices'];
export const INCLUDED_SKILLS = [
  'fastify-best-practices', 'drizzle-orm-patterns', 'postgresql-table-design', 'zod',
  'typescript-expert', 'react-best-practices', 'react-testing-library', 'security', 'mermaid-diagram',
  'next-dev-loop', 'next-cache-components-adoption',
];
export const NEW_SKILLS_1_1 = INCLUDED_SKILLS.slice(4);
export const COURSE_SKILLS = ['react-best-practices', 'react-testing-library', 'security', 'mermaid-diagram'];
export const NEXT_SKILLS = ['next-dev-loop', 'next-cache-components-adoption'];
export const EXPECTED_VERSIONS = { 'engineering-paved-path': '1.1.0', 'research-tools': '1.0.0', 'architecture-review': '1.0.0' };

// Skills imported verbatim keep upstream quirks. Each exception names the exact place and why it is accepted.
export const COURSE_REPO_URL = 'github.com/ai-agentic-engineering-neo/dev-digest';
export const VERBATIM_DENY_EXCEPTIONS = new Set([
  // generic example error message in an upstream security example, not a reference to this project
  'plugins/engineering-paved-path/skills/security/examples.md:287',
]);
export const VERBATIM_DANGLING_REFS = new Set([
  // upstream names files that are not part of the skill; they are not shipped
  'plugins/engineering-paved-path/skills/mermaid-diagram/SKILL.md -> references.md',
  'plugins/engineering-paved-path/skills/next-cache-components-adoption/SKILL.md -> AGENTS.md',
  'plugins/engineering-paved-path/skills/next-cache-components-adoption/SKILL.md -> node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-components.md',
]);
export const EXCLUDED_SKILLS = ['onion-architecture', 'ui-architecture', 'pr-self-review', 'engineering-insights'];
export const WRITE_TOOLS = ['Write', 'Edit', 'NotebookEdit', 'Bash', 'Agent'];

export const DENY_LIST = new RegExp(
  [
    'devdigest', 'dev-digest', 'reviewer-core', 'repo-intel', '@devdigest', 'server/src', 'client/src', 'server/docs',
    'client/docs', 'vendor/shared', 'onion-architecture', 'ui-architecture', 'pr-self-review',
  ].join('|'),
  'i',
);

export const rel = (p) => path.relative(REPO_ROOT, p).split(path.sep).join('/');
export const read = (p) => readFileSync(p, 'utf8');

export function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, d.name);
    if (d.isDirectory()) out.push(...walk(abs));
    else if (d.isFile()) out.push(abs);
  }
  return out;
}

export const subdirs = (dir) =>
  existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort() : [];

export const pluginNames = () => subdirs(PLUGINS_DIR);
export const pluginDir = (name) => path.join(PLUGINS_DIR, name);
export const allPluginFiles = () => walk(PLUGINS_DIR).filter((f) => rel(f) !== 'plugins/README.md');
export const skillFolders = () =>
  pluginNames().flatMap((p) => subdirs(path.join(pluginDir(p), 'skills')).map((s) => path.join(pluginDir(p), 'skills', s)));
export const agentFiles = () =>
  pluginNames().flatMap((p) =>
    existsSync(path.join(pluginDir(p), 'agents'))
      ? readdirSync(path.join(pluginDir(p), 'agents')).filter((f) => f.endsWith('.md')).map((f) => path.join(pluginDir(p), 'agents', f))
      : [],
  );
