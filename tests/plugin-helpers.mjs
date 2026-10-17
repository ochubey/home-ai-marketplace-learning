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
export const EXPECTED_VERSIONS = {
  'engineering-paved-path': '1.1.0', 'research-tools': '1.0.0', 'architecture-review': '1.0.0', 'sdd-engineering': '1.0.0',
};

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
// A skill that is excluded everywhere except in the one plugin that owns it.
export const EXCLUDED_SKILL_OWNERS = { 'engineering-insights': 'sdd-engineering' };
export const WRITE_TOOLS = ['Write', 'Edit', 'NotebookEdit', 'Bash', 'Agent'];

// Agents that may write. Every agent not listed here stays under the read-only rule.
// `tools` is exact; `disallowed` lists the tools that must be present in `disallowedTools`.
export const AGENT_POLICIES = {
  'sdd-engineering/spec-creator': {
    tools: ['Read', 'Grep', 'Glob', 'Write'],
    disallowed: ['Edit', 'NotebookEdit', 'Bash', 'Agent'],
  },
  'sdd-engineering/implementer': {
    tools: ['Read', 'Grep', 'Glob', 'Write', 'Edit', 'Bash'],
    disallowed: ['NotebookEdit', 'Agent'],
  },
};

// Files that a skill names but that live in the target repository at run time, not in the skill.
// Exact "<skill file> -> <reference>" pairs only; each pair carries the reason.
export const RUNTIME_REPO_REFS = new Set([
  // engineering-insights: instruction files and the notes file live in the target repository at run time
  'plugins/sdd-engineering/skills/engineering-insights/SKILL.md -> AGENTS.md',
  'plugins/sdd-engineering/skills/engineering-insights/SKILL.md -> CLAUDE.md',
  'plugins/sdd-engineering/skills/engineering-insights/SKILL.md -> INSIGHTS.md',
  // run-plan: the target repository's instruction files document its check commands
  'plugins/sdd-engineering/skills/run-plan/SKILL.md -> AGENTS.md',
  'plugins/sdd-engineering/skills/run-plan/SKILL.md -> CLAUDE.md',
  // workflow-retro: the notes file and the retro ledger are created in the target repository at run time
  'plugins/sdd-engineering/skills/workflow-retro/SKILL.md -> INSIGHTS.md',
  'plugins/sdd-engineering/skills/workflow-retro/SKILL.md -> docs/retros/ledger.md',
]);

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
// The plugin that ships a skill folder or an agent file (second path segment under plugins/).
export const ownerOf = (absPath) => rel(absPath).split('/')[1];
// The plugin whose namespace prefix a shipped skill name must carry in agent text.
export function skillOwner(skill) {
  if (INCLUDED_SKILLS.includes(skill) || DEFERRED_SKILLS.includes(skill)) return PAVED;
  const folder = skillFolders().find((s) => path.basename(s) === skill);
  return folder ? ownerOf(folder) : PAVED;
}
export const agentFiles = () =>
  pluginNames().flatMap((p) =>
    existsSync(path.join(pluginDir(p), 'agents'))
      ? readdirSync(path.join(pluginDir(p), 'agents')).filter((f) => f.endsWith('.md')).map((f) => path.join(pluginDir(p), 'agents', f))
      : [],
  );
