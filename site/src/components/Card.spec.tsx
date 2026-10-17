import { afterEach, describe, expect, it } from 'vitest';
import { fixtureIndex } from '../fixtures';
import { cleanup, mount, text } from '../test-utils';
import { KINDS } from '../types';
import { Card } from './Card';
import { KindBadge } from './KindBadge';

afterEach(cleanup);
const find = (id: string) => fixtureIndex.artifacts.find((a) => a.id === id)!;

describe('KindBadge', () => {
  it.each(KINDS)('shows the %s kind as text, with its own data-kind', async (kind) => {
    const c = await mount(<KindBadge kind={kind} />);
    const badge = c.querySelector('.badge')!;
    expect(badge.getAttribute('data-kind')).toBe(kind);
    expect(text(badge).length).toBeGreaterThan(0);
  });

  it('uses a distinct label per kind', async () => {
    const labels = new Set<string>();
    for (const kind of KINDS) {
      const c = await mount(<KindBadge kind={kind} />);
      labels.add(text(c));
    }
    expect(labels.size).toBe(6);
  });
});

describe('Card', () => {
  it('shows kind, name, parent plugin and description and links to the detail route', async () => {
    const c = await mount(<Card artifact={find('sdd-flow/agent/spec-creator')} />);
    expect(text(c.querySelector('.badge'))).toBe('Agent');
    expect(text(c)).toContain('spec-creator');
    expect(text(c)).toContain('sdd-flow');
    expect(text(c)).toContain('Creates a spec from a request.');
    expect(c.querySelector('a')?.getAttribute('href')).toBe('#/plugins/sdd-flow/agent/spec-creator');
  });

  it('shows "No description" when the description is null', async () => {
    const c = await mount(<Card artifact={find('sdd-flow/hook/hooks')} />);
    expect(text(c)).toContain('No description');
  });

  it('shows the version for a plugin, and no parent plugin line', async () => {
    const c = await mount(<Card artifact={find('paved-path')} version="1.1.0" />);
    expect(text(c)).toContain('1.1.0');
    expect(text(c)).not.toContain('Plugin: ');
    expect(c.querySelector('a')?.getAttribute('href')).toBe('#/plugins/paved-path');
  });

  it('renders plugin text as text, never as markup', async () => {
    const hostile = { ...find('paved-path/skill/zod'), description: '<img src=x onerror=alert(1)>' };
    const c = await mount(<Card artifact={hostile} />);
    expect(c.querySelector('img')).toBeNull();
    expect(text(c)).toContain('<img src=x onerror=alert(1)>');
  });
});
