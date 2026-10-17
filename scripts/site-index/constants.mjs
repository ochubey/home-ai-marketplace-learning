// Shared constants of the catalog-site indexer.
export const SCHEMA_VERSION = 1;
export const REPO_URL = 'https://github.com/ochubey/home-ai-marketplace-learning';
export const KIND_ORDER = ['plugin', 'skill', 'agent', 'command', 'hook', 'mcp'];
export const SEGMENT_RE = /^[a-z0-9][a-z0-9-]*$/;
export const SEARCH_TEXT_MAX = 20_000;
export const BODY_MAX_BYTES = 200 * 1024;
export const SUPPORTING_FILES_MAX = 500;

/** Frontmatter keys shown on the site, per kind (Decision 12). Everything else is dropped. */
export const FRONTMATTER_ALLOWLIST = {
  agent: ['tools', 'disallowedTools', 'model'],
  skill: ['allowed-tools', 'argument-hint', 'disable-model-invocation'],
  command: ['description', 'argument-hint'],
};
