import { describe, expect, it, vi } from 'vitest';
import { DataLoadError, bodyFile, loadBody, loadCatalog, loadJson } from './data';
import { fixtureData } from './fixtures';

const BASE = '/home-ai-marketplace-learning/';
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe('loadJson', () => {
  it('fetches a data file relative to the base', async () => {
    const f = vi.fn(async () => ok({ schemaVersion: 1, x: 1 }));
    await expect(loadJson('stats.json', f, BASE)).resolves.toEqual({ schemaVersion: 1, x: 1 });
    expect(f).toHaveBeenCalledWith('/home-ai-marketplace-learning/data/stats.json');
  });

  it('names the file on a 404', async () => {
    const f = async () => new Response('nope', { status: 404 });
    await expect(loadJson('releases.json', f, BASE)).rejects.toMatchObject({ file: 'releases.json', reason: 'status', status: 404 });
  });

  it('names the file on malformed JSON', async () => {
    const f = async () => new Response('{not json', { status: 200 });
    const err = await loadJson('index.json', f, BASE).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DataLoadError);
    expect(err).toMatchObject({ file: 'index.json', reason: 'parse' });
  });

  it('rejects an unknown schemaVersion', async () => {
    const f = async () => ok({ schemaVersion: 2 });
    await expect(loadJson('index.json', f, BASE)).rejects.toMatchObject({ reason: 'parse' });
  });

  it('reports a network failure', async () => {
    const f = async () => {
      throw new TypeError('offline');
    };
    await expect(loadJson('stats.json', f, BASE)).rejects.toMatchObject({ file: 'stats.json', reason: 'network' });
  });
});

describe('loadCatalog', () => {
  it('loads the three files', async () => {
    const f = vi.fn(async (url: string) => {
      if (url.endsWith('index.json')) return ok(fixtureData.index);
      if (url.endsWith('releases.json')) return ok(fixtureData.releases);
      return ok(fixtureData.stats);
    });
    const data = await loadCatalog(f, BASE);
    expect(data.index.plugins.length).toBe(fixtureData.index.plugins.length);
    expect(f).toHaveBeenCalledTimes(3);
  });

  it('fails with the first failing file', async () => {
    const f = async (url: string) => (url.endsWith('stats.json') ? new Response('', { status: 500 }) : ok(fixtureData.index));
    await expect(loadCatalog(f, BASE)).rejects.toMatchObject({ file: 'stats.json' });
  });

  it('rejects an index of the wrong shape', async () => {
    const f = async () => ok({ schemaVersion: 1 });
    await expect(loadCatalog(f, BASE)).rejects.toMatchObject({ reason: 'parse' });
  });
});

describe('loadBody', () => {
  it('maps ids to body files and returns text', async () => {
    expect(bodyFile('sdd-engineering')).toBe('bodies/sdd-engineering.md');
    expect(bodyFile('a/skill/b')).toBe('bodies/a/skill/b.md');
    const f = vi.fn(async () => new Response('# hi', { status: 200 }));
    await expect(loadBody('a/skill/b', f, BASE)).resolves.toBe('# hi');
    expect(f).toHaveBeenCalledWith('/home-ai-marketplace-learning/data/bodies/a/skill/b.md');
  });

  it('names the body file on failure', async () => {
    const f = async () => new Response('', { status: 404 });
    await expect(loadBody('a/skill/b', f, BASE)).rejects.toMatchObject({ file: 'bodies/a/skill/b.md', reason: 'status' });
  });
});
