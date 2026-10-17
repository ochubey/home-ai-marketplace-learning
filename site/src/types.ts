// Data contract of the indexer output (schemaVersion 1).
export const KINDS = ['plugin', 'skill', 'agent', 'command', 'hook', 'mcp'] as const;
export type Kind = (typeof KINDS)[number];

export interface Dependency {
  name: string;
  marketplace: string | null;
  range: string | null;
  inCatalog: boolean;
}

export type KindCounts = Record<Exclude<Kind, 'plugin'>, number>;

export interface PluginRecord {
  id: string;
  name: string;
  version: string;
  description: string | null;
  author: { name?: string; email?: string; url?: string } | null;
  dependencies: Dependency[];
  usedBy: string[];
  counts: KindCounts;
  hasReadme: boolean;
  sourcePath: string;
}

export type FrontmatterValue = string | boolean | string[];

export interface Artifact {
  id: string;
  kind: Kind;
  plugin: string;
  name: string;
  namespacedName: string;
  description: string | null;
  frontmatter: Record<string, FrontmatterValue>;
  details: { events?: string[]; transport?: string } | null;
  sourcePath: string;
  supportingFiles: string[];
  hasBody: boolean;
  searchText: string;
}

export interface CatalogIndex {
  schemaVersion: 1;
  marketplace: { name: string; owner: string; description: string };
  source: { repoUrl: string; commit: string | null; commitDate: string | null };
  plugins: PluginRecord[];
  artifacts: Artifact[];
}

export interface Release {
  plugin: string;
  version: string;
  date: string | null;
  isCurrent: boolean;
  body: string;
}

export interface ReleasesFile {
  schemaVersion: 1;
  releases: Release[];
}

export interface StatsFile {
  schemaVersion: 1;
  plugins: number;
  counts: Record<Kind, number>;
  dependencyEdges: number;
  releases: number;
  commit: string | null;
  commitDate: string | null;
}

export interface CatalogData {
  index: CatalogIndex;
  releases: ReleasesFile;
  stats: StatsFile;
}
