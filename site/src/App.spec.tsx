import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { emptyData, fixtureData } from './fixtures';
import { resetThemeForTests } from './theme';
import { cleanup, click, makeFetch, mount, press, setHash, settle, text, type } from './test-utils';
import type { CatalogData } from './types';

async function boot(hash: string, data: CatalogData = fixtureData, bodies: Record<string, string> = {}) {
  history.replaceState(null, '', hash === '' ? location.pathname : hash);
  const fetchFn = makeFetch(data, bodies);
  const c = await mount(<App fetchFn={fetchFn} base="/" />);
  await settle();
  return { c, fetchFn };
}

beforeEach(() => {
  resetThemeForTests();
  document.title = '';
});
afterEach(async () => {
  await cleanup();
  vi.unstubAllGlobals();
  history.replaceState(null, '', location.pathname);
});

describe('shell', () => {
  it('has the skip link first, landmarks, one h1 and a polite live region', async () => {
    const { c } = await boot('#/');
    const first = c.querySelector('a, button, input, [tabindex="0"]')!;
    expect(first.classList.contains('skip-link')).toBe(true);
    expect(text(first)).toBe('Skip to content');
    expect(c.querySelector('header')).not.toBeNull();
    expect(c.querySelector('header nav[aria-label="Main"]')).not.toBeNull();
    expect(c.querySelector('main#main-content')).not.toBeNull();
    expect(c.querySelector('footer')).not.toBeNull();
    expect(c.querySelectorAll('h1')).toHaveLength(1);
    const live = c.querySelector('[data-live-region]')!;
    expect(live.getAttribute('role')).toBe('status');
    expect(live.getAttribute('aria-live')).toBe('polite');
  });

  it('gives icon-only buttons accessible names', async () => {
    const { c } = await boot('#/');
    for (const b of c.querySelectorAll('button')) expect((b.getAttribute('aria-label') ?? b.textContent ?? '').trim().length).toBeGreaterThan(0);
  });

  it('sets the document title per screen', async () => {
    const { c } = await boot('#/');
    expect(document.title).toBe('Home - Marketplace Catalog');
    await setHash('#/getting-started');
    expect(document.title).toBe('Getting started - Marketplace Catalog');
    await setHash('#/plugins/sdd-flow');
    expect(document.title).toBe('sdd-flow - Marketplace Catalog');
    await setHash('#/plugins/sdd-flow/agent/spec-creator');
    expect(document.title).toBe('spec-creator - Marketplace Catalog');
    expect(c.querySelectorAll('h1')).toHaveLength(1);
  });

  it('moves focus to the main heading when the route changes', async () => {
    const { c } = await boot('#/');
    await setHash('#/whats-new');
    expect(document.activeElement).toBe(c.querySelector('h1'));
    expect(text(c.querySelector('h1'))).toBe("What's new");
  });

  it('shows commit and date in the footer, with a repository link', async () => {
    const { c } = await boot('#/');
    const footer = c.querySelector('footer')!;
    expect(text(footer)).toContain('abc1234');
    expect(text(footer)).toContain('2026-10-17');
    expect(footer.querySelector('a')?.getAttribute('href')).toBe('https://github.com/example/fixture-market');
  });

  it('shows unknown when the commit is null', async () => {
    const data: CatalogData = { ...fixtureData, index: { ...fixtureData.index, source: { repoUrl: 'https://github.com/example/fixture-market', commit: null, commitDate: null } } };
    const { c } = await boot('#/', data);
    expect(text(c.querySelector('footer'))).toContain('unknown');
  });

  it('toggles the theme from the header button', async () => {
    const { c } = await boot('#/');
    expect(document.documentElement.dataset.theme).toBe('dark');
    await click(c.querySelector('[data-theme-toggle]')!);
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});

describe('loading and error states', () => {
  it('shows a busy main region while data loads', async () => {
    history.replaceState(null, '', '#/');
    const pending = () => new Promise<Response>(() => undefined);
    const c = await mount(<App fetchFn={pending} base="/" />);
    expect(c.querySelector('main')?.getAttribute('aria-busy')).toBe('true');
    expect(text(c.querySelector('main'))).toContain('Loading');
  });

  it('names the failed file and retries', async () => {
    history.replaceState(null, '', '#/');
    let fail = true;
    const good = makeFetch();
    const fetchFn = async (url: string) => (fail && url.endsWith('releases.json') ? new Response('', { status: 404 }) : good(url));
    const c = await mount(<App fetchFn={fetchFn} base="/" />);
    await settle();
    const main = c.querySelector('main')!;
    expect(main.getAttribute('aria-busy')).not.toBe('true');
    expect(main.querySelector('[role="alert"]')).not.toBeNull();
    expect(text(main)).toContain('releases.json');
    fail = false;
    await click(main.querySelector('button')!);
    await settle();
    expect(c.querySelector('[role="alert"]')).toBeNull();
    expect(text(c.querySelector('h1'))).toBe('Marketplace catalog');
  });

  it('reports malformed JSON by file name', async () => {
    history.replaceState(null, '', '#/');
    const fetchFn = async (url: string) => (url.endsWith('stats.json') ? new Response('{oops') : makeFetch()(url));
    const c = await mount(<App fetchFn={fetchFn} base="/" />);
    await settle();
    expect(text(c.querySelector('[role="alert"]'))).toContain('stats.json');
  });
});

describe('home', () => {
  it('shows search, stats, plugin cards, recent releases and the getting-started link', async () => {
    const { c } = await boot('#/');
    expect(c.querySelector('main input[data-search-input]')).not.toBeNull();
    const stats = [...c.querySelectorAll('[data-stats] > div')].map((d) => `${text(d.querySelector('dt'))} ${text(d.querySelector('dd'))}`);
    expect(stats).toEqual(['Plugins 3', 'Skills 3', 'Agents 1', 'Hooks 1', 'MCP servers 1']);
    expect(c.querySelectorAll('[data-plugins] .card')).toHaveLength(3);
    expect(c.querySelectorAll('[data-recent] li')).toHaveLength(3);
    expect(c.querySelector('a[href="#/getting-started"][data-getting-started]')).not.toBeNull();
  });

  it('shows at most five releases', async () => {
    const releases = Array.from({ length: 8 }, (_, i) => ({ plugin: 'paved-path', version: `1.${i}.0`, date: null, isCurrent: false, body: 'x' }));
    const { c } = await boot('#/', { ...fixtureData, releases: { schemaVersion: 1, releases } });
    expect(c.querySelectorAll('[data-recent] li')).toHaveLength(5);
  });

  it('shows the empty state without sample items for an empty catalog', async () => {
    const { c } = await boot('#/', emptyData);
    expect(text(c.querySelector('main'))).toContain('The catalog is empty');
    expect(c.querySelector('a[href$="/blob/main/CONTRIBUTING.md"]')).not.toBeNull();
    expect(c.querySelectorAll('.card')).toHaveLength(0);
  });
});

describe('search screen', () => {
  it('restores the query and facets from the route and filters the results', async () => {
    const { c } = await boot('#/search?q=zod&kind=skill');
    const names = [...c.querySelectorAll('[data-results] .card h3')].map(text);
    expect(names).toEqual(['zod']);
    const header = c.querySelector('header input[data-search-input]') as HTMLInputElement;
    expect(header.value).toBe('zod');
    const kind = c.querySelector('input[data-facet="kind"][value="skill"]') as HTMLInputElement;
    expect(kind.checked).toBe(true);
  });

  it('lists all artifacts when the query is empty and disables kinds with no results', async () => {
    const { c } = await boot('#/search');
    expect(c.querySelectorAll('[data-results] .card')).toHaveLength(fixtureData.index.artifacts.length);
    const command = c.querySelector('input[data-facet="kind"][value="command"]') as HTMLInputElement;
    expect(command.disabled).toBe(true);
    expect(text(command.closest('label'))).toContain('(0)');
    const skill = c.querySelector('input[data-facet="kind"][value="skill"]') as HTMLInputElement;
    expect(text(skill.closest('label'))).toContain('(3)');
  });

  it('updates the hash when a facet is toggled and when the query is typed', async () => {
    const { c } = await boot('#/search');
    await click(c.querySelector('input[data-facet="kind"][value="agent"]')!);
    expect(location.hash).toBe('#/search?kind=agent');
    expect(c.querySelectorAll('[data-results] .card')).toHaveLength(1);
    await type(c.querySelector('header input[data-search-input]') as HTMLInputElement, 'spec');
    expect(location.hash).toBe('#/search?q=spec&kind=agent');
  });

  it('announces the result count in the live region', async () => {
    const { c } = await boot('#/search?q=zod');
    expect(text(c.querySelector('[data-live-region]'))).toMatch(/results? shown/);
  });

  it('shows a no-results state that names the query, offers to clear facets and links to the catalog', async () => {
    const { c } = await boot('#/search?q=qqqqzzzz&kind=skill');
    const main = c.querySelector('main')!;
    expect(text(main)).toContain('qqqqzzzz');
    expect(main.querySelector('[data-clear-facets]')).not.toBeNull();
    expect(main.querySelector('a[href="#/search"]')).not.toBeNull();
    await click(main.querySelector('[data-clear-facets]')!);
    expect(location.hash).toBe('#/search?q=qqqqzzzz');
    expect(main.querySelector('[data-clear-facets]')).toBeNull();
  });

  it('ignores unknown plugin values in the route', async () => {
    const { c } = await boot('#/search?plugin=ghost-plugin');
    expect(c.querySelectorAll('[data-results] .card')).toHaveLength(fixtureData.index.artifacts.length);
  });

  it('typing in the header search from another screen opens the search route', async () => {
    const { c } = await boot('#/getting-started');
    await type(c.querySelector('header input[data-search-input]') as HTMLInputElement, 'zod');
    expect(location.hash).toBe('#/search?q=zod');
  });

  it('shows the empty-catalog state instead of results for an empty catalog', async () => {
    const { c } = await boot('#/search', emptyData);
    expect(text(c.querySelector('main'))).toContain('The catalog is empty');
    expect(c.querySelectorAll('.card')).toHaveLength(0);
  });
});

describe('/ shortcut', () => {
  it('focuses the header search when focus is not in a text field', async () => {
    const { c } = await boot('#/getting-started');
    const event = await press(document.body, '/');
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(c.querySelector('header input[data-search-input]'));
  });

  it('does nothing while typing in a text field', async () => {
    const { c } = await boot('#/getting-started');
    const input = c.querySelector('header input[data-search-input]') as HTMLInputElement;
    input.focus();
    const event = await press(input, '/');
    expect(event.defaultPrevented).toBe(false);
  });
});

describe('plugin detail', () => {
  it('shows fields, install, dependencies, used by, artifacts, README and links', async () => {
    const { c, fetchFn } = await boot('#/plugins/sdd-flow', fixtureData, { 'sdd-flow': '# Readme heading\n\nHello [link](references/a.md)' });
    const main = c.querySelector('main')!;
    expect(text(main.querySelector('h1'))).toBe('sdd-flow');
    expect(text(main)).toContain('1.0.0');
    expect(text(main)).toContain('Fixture Author');
    expect(text(main)).toContain('Spec driven workflow.');
    expect(main.querySelector('pre')?.textContent).toContain('claude plugin install sdd-flow@home-ai-marketplace-learning');
    expect(main.querySelector('[data-readme] h2')?.textContent).toBe('Readme heading');
    expect(main.querySelector('[data-readme] a')?.getAttribute('href')).toBe('https://github.com/example/fixture-market/blob/abc1234/plugins/sdd-flow/references/a.md');
    expect(main.querySelector('a[href="#/whats-new?plugin=sdd-flow"]')).not.toBeNull();
    expect(main.querySelector('a[href="https://github.com/example/fixture-market/tree/abc1234/plugins/sdd-flow"]')).not.toBeNull();
    expect(main.querySelectorAll('[data-artifacts] .card').length).toBe(4);
    expect(fetchFn.calls.some((u) => u.endsWith('data/bodies/sdd-flow.md'))).toBe(true);
  });

  it('links an in-catalog dependency and marks one that is not in the catalog', async () => {
    const { c } = await boot('#/plugins/sdd-flow');
    const deps = c.querySelector('[data-dependencies]')!;
    const inCat = deps.querySelector('a[href="#/plugins/paved-path"]');
    expect(text(inCat?.closest('li'))).toContain('^1.1.0');
    const outside = [...deps.querySelectorAll('li')].find((li) => text(li).includes('outside-lib'))!;
    expect(outside.querySelector('a')).toBeNull();
    expect(text(outside)).toContain('not in this catalog');
  });

  it('says so when a plugin has no dependencies, and lists who uses it', async () => {
    const { c } = await boot('#/plugins/paved-path');
    expect(text(c.querySelector('[data-dependencies]'))).toContain('has no dependencies');
    expect(c.querySelector('[data-used-by] a[href="#/plugins/sdd-flow"]')).not.toBeNull();
  });

  it('handles a plugin without README, description or author', async () => {
    const { c, fetchFn } = await boot('#/plugins/lonely');
    expect(text(c.querySelector('main'))).toContain('Not stated');
    expect(text(c.querySelector('main'))).toContain('This plugin has no README.');
    expect(fetchFn.calls.some((u) => u.includes('bodies/'))).toBe(false);
  });

  it('shows the not-found screen for an unknown plugin with links to Home and search', async () => {
    const { c } = await boot('#/plugins/nope');
    const main = c.querySelector('main')!;
    expect(text(main)).toContain('nope');
    expect(main.querySelector('a[href="#/"]')).not.toBeNull();
    expect(main.querySelector('a[href="#/search?q=nope"]')).not.toBeNull();
    expect(c.querySelectorAll('h1')).toHaveLength(1);
  });

  it('shows an inline error with Retry when the README cannot be loaded', async () => {
    history.replaceState(null, '', '#/plugins/sdd-flow');
    const good = makeFetch();
    const fetchFn = async (url: string) => (url.includes('bodies/') ? new Response('', { status: 404 }) : good(url));
    const c = await mount(<App fetchFn={fetchFn} base="/" />);
    await settle();
    expect(text(c.querySelector('[data-readme] [role="alert"]'))).toContain('bodies/sdd-flow.md');
  });
});

describe('artifact detail', () => {
  it('shows kind, names, parent link, description, frontmatter, install, body and supporting files', async () => {
    const { c } = await boot('#/plugins/paved-path/skill/zod', fixtureData, { 'paved-path/skill/zod': '## Using zod' });
    const main = c.querySelector('main')!;
    expect(text(main.querySelector('h1'))).toBe('zod');
    expect(text(main.querySelector('.badge'))).toBe('Skill');
    expect(text(main)).toContain('paved-path:zod');
    expect(main.querySelector('a[href="#/plugins/paved-path"]')).not.toBeNull();
    expect(text(main)).toContain('Schema validation with Zod.');
    expect(text(main.querySelector('[data-frontmatter]'))).toContain('allowed-tools');
    expect(text(main.querySelector('[data-frontmatter]'))).toContain('Read, Grep');
    expect(text(main.querySelector('[data-frontmatter]'))).toContain('yes');
    expect(main.querySelector('pre')?.textContent).toContain('claude plugin install paved-path@home-ai-marketplace-learning');
    expect(main.querySelector('.md h2')?.textContent).toBe('Using zod');
    expect(main.querySelector('[data-supporting] a')?.getAttribute('href')).toBe(
      'https://github.com/example/fixture-market/blob/abc1234/plugins/paved-path/skills/zod/references/api.md',
    );
  });

  it('joins list-valued frontmatter', async () => {
    const { c } = await boot('#/plugins/sdd-flow/agent/spec-creator');
    expect(text(c.querySelector('[data-frontmatter]'))).toContain('Read, Write');
  });

  it('shows only event names for a hook and only the transport for an MCP server, and fetches no body', async () => {
    const hook = await boot('#/plugins/sdd-flow/hook/hooks');
    expect(text(hook.c.querySelector('main'))).toContain('PreToolUse');
    expect(text(hook.c.querySelector('main'))).toContain('Stop');
    expect(hook.fetchFn.calls.some((u) => u.includes('bodies/'))).toBe(false);
    await cleanup();
    const mcp = await boot('#/plugins/sdd-flow/mcp/docs-server');
    expect(text(mcp.c.querySelector('main'))).toContain('Transport');
    expect(text(mcp.c.querySelector('main'))).toContain('http');
  });

  it('shows not-found for an unknown artifact', async () => {
    const { c } = await boot('#/plugins/sdd-flow/skill/ghost');
    expect(text(c.querySelector('main'))).toContain('ghost');
    expect(c.querySelector('main a[href="#/search?q=ghost"]')).not.toBeNull();
  });
});

describe('whats new', () => {
  it('lists every release: dated first, date text, current marker and rendered body', async () => {
    const { c } = await boot('#/whats-new', fixtureData, {});
    const items = [...c.querySelectorAll('[data-releases] > li')];
    expect(items.map((li) => text(li.querySelector('h2')))).toEqual(['sdd-flow 1.0.0', 'paved-path 1.1.0', 'paved-path 1.0.0']);
    expect(text(items[0])).toContain('2026-10-01');
    expect(text(items[1])).toContain('date not recorded');
    expect(text(items[1])).toContain('current');
    expect(text(items[2])).not.toContain('current');
    expect(items[1]!.querySelector('strong')?.textContent).toBe('zod');
  });

  it('filters by plugin', async () => {
    const { c } = await boot('#/whats-new?plugin=sdd-flow');
    expect([...c.querySelectorAll('[data-releases] > li h2')].map(text)).toEqual(['sdd-flow 1.0.0']);
    expect(c.querySelector('a[href="#/whats-new"]')).not.toBeNull();
  });

  it('says so when there are no releases', async () => {
    const { c } = await boot('#/whats-new', { ...fixtureData, releases: { schemaVersion: 1, releases: [] } });
    expect(text(c.querySelector('main'))).toContain('No releases recorded.');
  });
});

describe('getting started', () => {
  it('shows all six commands from the translations file', async () => {
    const { c } = await boot('#/getting-started');
    const blocks = [...c.querySelectorAll('main pre')].map((p) => p.textContent);
    expect(blocks).toEqual([
      'claude plugin marketplace add ochubey/home-ai-marketplace-learning',
      'claude plugin install <plugin>@home-ai-marketplace-learning',
      'claude plugin marketplace update home-ai-marketplace-learning',
      'claude plugin update <plugin>@home-ai-marketplace-learning',
      '/reload-plugins',
      'claude plugin list --json',
    ]);
  });
});

describe('not found', () => {
  it('shows the not-found screen for unknown routes', async () => {
    const { c } = await boot('#/nowhere');
    expect(text(c.querySelector('h1'))).toBe('Page not found');
    expect(text(c.querySelector('main'))).toContain('/nowhere');
    expect(c.querySelector('main a[href="#/"]')).not.toBeNull();
  });
});

describe('content rules', () => {
  it('shows no download, rating or stars wording on any screen', async () => {
    for (const hash of ['#/', '#/search', '#/plugins/sdd-flow', '#/plugins/paved-path/skill/zod', '#/whats-new', '#/getting-started']) {
      const { c } = await boot(hash);
      expect(text(c).toLowerCase()).not.toMatch(/download|rating|stars/);
      await cleanup();
    }
  });
});
