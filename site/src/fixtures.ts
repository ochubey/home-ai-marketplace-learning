import type { Artifact, CatalogData, CatalogIndex, PluginRecord, Release } from './types';

const zeroCounts = { skill: 0, agent: 0, command: 0, hook: 0, mcp: 0 };

const plugin = (p: Partial<PluginRecord> & { name: string }): PluginRecord => ({
  id: p.name,
  version: '1.0.0',
  description: `${p.name} description`,
  author: { name: 'Fixture Author' },
  dependencies: [],
  usedBy: [],
  counts: { ...zeroCounts },
  hasReadme: true,
  sourcePath: `plugins/${p.name}`,
  ...p,
});

const artifact = (a: Partial<Artifact> & Pick<Artifact, 'kind' | 'plugin' | 'name'>): Artifact => ({
  id: a.kind === 'plugin' ? a.name : `${a.plugin}/${a.kind}/${a.name}`,
  namespacedName: a.kind === 'plugin' ? a.name : `${a.plugin}:${a.name}`,
  description: null,
  frontmatter: {},
  details: null,
  sourcePath: a.kind === 'plugin' ? `plugins/${a.name}` : `plugins/${a.plugin}/${a.kind}s/${a.name}.md`,
  supportingFiles: [],
  hasBody: true,
  searchText: '',
  ...a,
});

const plugins: PluginRecord[] = [
  plugin({ name: 'paved-path', version: '1.1.0', description: 'Shared engineering skills.', usedBy: ['sdd-flow'], counts: { ...zeroCounts, skill: 2 } }),
  plugin({
    name: 'sdd-flow',
    description: 'Spec driven workflow.',
    dependencies: [
      { name: 'paved-path', marketplace: 'fixture-market', range: '^1.1.0', inCatalog: true },
      { name: 'outside-lib', marketplace: null, range: null, inCatalog: false },
    ],
    counts: { ...zeroCounts, skill: 1, agent: 1, hook: 1, mcp: 1 },
  }),
  plugin({ name: 'lonely', description: null, author: null, hasReadme: false }),
];

const artifacts: Artifact[] = [
  artifact({ kind: 'plugin', plugin: 'lonely', name: 'lonely', description: null, hasBody: false }),
  artifact({ kind: 'plugin', plugin: 'paved-path', name: 'paved-path', description: 'Shared engineering skills.', searchText: 'Skills for validation and typing.' }),
  artifact({ kind: 'plugin', plugin: 'sdd-flow', name: 'sdd-flow', description: 'Spec driven workflow.', searchText: 'Writes specs and plans.' }),
  artifact({
    kind: 'skill',
    plugin: 'paved-path',
    name: 'zod',
    description: 'Schema validation with Zod.',
    searchText: 'Parse unknown input with schemas and infer types. Mentions zebracorn only here.',
    frontmatter: { 'allowed-tools': 'Read, Grep', 'disable-model-invocation': true },
    supportingFiles: ['plugins/paved-path/skills/zod/references/api.md'],
    sourcePath: 'plugins/paved-path/skills/zod/SKILL.md',
  }),
  artifact({ kind: 'skill', plugin: 'paved-path', name: 'typescript', description: 'TypeScript patterns.', searchText: 'Types and generics.' }),
  artifact({ kind: 'skill', plugin: 'sdd-flow', name: 'run-plan', description: 'Run a plan step by step.', searchText: 'Executes the plan.' }),
  artifact({
    kind: 'agent',
    plugin: 'sdd-flow',
    name: 'spec-creator',
    description: 'Creates a spec from a request.',
    searchText: 'Interviews and writes the spec.',
    frontmatter: { tools: ['Read', 'Write'], model: 'sonnet' },
  }),
  artifact({ kind: 'hook', plugin: 'sdd-flow', name: 'hooks', details: { events: ['PreToolUse', 'Stop'] }, hasBody: false, sourcePath: 'plugins/sdd-flow/hooks/hooks.json' }),
  artifact({ kind: 'mcp', plugin: 'sdd-flow', name: 'docs-server', details: { transport: 'http' }, hasBody: false, sourcePath: 'plugins/sdd-flow/.mcp.json' }),
];

const releases: Release[] = [
  { plugin: 'paved-path', version: '1.0.0', date: null, isCurrent: false, body: 'First release.' },
  { plugin: 'paved-path', version: '1.1.0', date: null, isCurrent: true, body: 'Added **zod**.' },
  { plugin: 'sdd-flow', version: '1.0.0', date: '2026-10-01', isCurrent: true, body: 'Initial release.' },
];

export const fixtureIndex: CatalogIndex = {
  schemaVersion: 1,
  marketplace: { name: 'fixture-market', owner: 'Fixture Owner', description: 'A fixture marketplace.' },
  source: { repoUrl: 'https://github.com/example/fixture-market', commit: 'abc1234', commitDate: '2026-10-17T10:00:00.000Z' },
  plugins,
  artifacts,
};

export const fixtureData: CatalogData = {
  index: fixtureIndex,
  releases: { schemaVersion: 1, releases },
  stats: {
    schemaVersion: 1,
    plugins: 3,
    counts: { plugin: 3, skill: 3, agent: 1, command: 0, hook: 1, mcp: 1 },
    dependencyEdges: 1,
    releases: 3,
    commit: 'abc1234',
    commitDate: '2026-10-17T10:00:00.000Z',
  },
};

export const emptyData: CatalogData = {
  index: { ...fixtureIndex, plugins: [], artifacts: [] },
  releases: { schemaVersion: 1, releases: [] },
  stats: {
    schemaVersion: 1,
    plugins: 0,
    counts: { plugin: 0, skill: 0, agent: 0, command: 0, hook: 0, mcp: 0 },
    dependencyEdges: 0,
    releases: 0,
    commit: null,
    commitDate: null,
  },
};
