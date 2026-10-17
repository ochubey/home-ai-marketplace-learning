import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { resetThemeForTests } from './theme';
import { cleanup, click, makeFetch, mount, press, settle, text, type } from './test-utils';

async function boot(hash = '#/getting-started') {
  history.replaceState(null, '', hash);
  const c = await mount(<App fetchFn={makeFetch()} base="/" />);
  await settle();
  return c;
}
const dialog = () => document.querySelector('[role="dialog"]');
const input = () => document.querySelector('[role="dialog"] input') as HTMLInputElement;

beforeEach(() => resetThemeForTests());
afterEach(async () => {
  await cleanup();
  vi.unstubAllGlobals();
  history.replaceState(null, '', location.pathname);
});

describe('command palette', () => {
  it('opens with Ctrl+K, focuses its input and lists the four actions', async () => {
    await boot();
    expect(dialog()).toBeNull();
    const e = await press(document.body, 'k', { ctrlKey: true });
    expect(e.defaultPrevented).toBe(true);
    expect(dialog()).not.toBeNull();
    expect(document.activeElement).toBe(input());
    const labels = [...document.querySelectorAll('[role="dialog"] [role="option"]')].map(text);
    for (const a of ['Home', "What's new", 'Getting started', 'Toggle theme']) expect(labels).toContain(a);
  });

  it('opens with Cmd+K as well', async () => {
    await boot();
    await press(document.body, 'k', { metaKey: true });
    expect(dialog()).not.toBeNull();
  });

  it('lists matching artifacts for a query', async () => {
    await boot();
    await press(document.body, 'k', { ctrlKey: true });
    await type(input(), 'zod');
    const options = [...document.querySelectorAll('[role="dialog"] [role="option"]')].map(text);
    expect(options.some((o) => o.includes('zod'))).toBe(true);
    expect(options).not.toContain('Home');
  });

  it('moves with arrow keys, runs with Enter and restores focus on close', async () => {
    const c = await boot();
    const search = c.querySelector('header input[data-search-input]') as HTMLInputElement;
    search.focus();
    await press(document.body, 'k', { ctrlKey: true });
    const first = () => document.querySelector('[role="option"][aria-selected="true"]');
    expect(text(first())).toBe('Home');
    await press(input(), 'ArrowDown');
    expect(text(first())).toBe("What's new");
    expect(input().getAttribute('aria-activedescendant')).toBe(first()!.id);
    await press(input(), 'ArrowUp');
    expect(text(first())).toBe('Home');
    await press(input(), 'ArrowUp');
    expect(text(first())).toBe('Toggle theme');
    await press(input(), 'ArrowDown');
    await press(input(), 'ArrowDown');
    await press(input(), 'Enter');
    expect(location.hash).toBe('#/whats-new');
    expect(dialog()).toBeNull();
  });

  it('closes with Escape and returns focus to the previous element', async () => {
    const c = await boot();
    const search = c.querySelector('header input[data-search-input]') as HTMLInputElement;
    search.focus();
    await press(document.body, 'k', { ctrlKey: true });
    await press(input(), 'Escape');
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(search);
  });

  it('keeps focus inside while Tab is pressed', async () => {
    await boot();
    await press(document.body, 'k', { ctrlKey: true });
    await press(input(), 'Tab');
    expect(dialog()!.contains(document.activeElement)).toBe(true);
    await press(document.activeElement!, 'Tab');
    expect(dialog()!.contains(document.activeElement)).toBe(true);
    await press(document.activeElement!, 'Tab', { shiftKey: true });
    expect(dialog()!.contains(document.activeElement)).toBe(true);
  });

  it('runs Toggle theme and opens an artifact on click', async () => {
    await boot();
    await press(document.body, 'k', { ctrlKey: true });
    const toggle = [...document.querySelectorAll('[role="option"]')].find((o) => text(o) === 'Toggle theme')!;
    await click(toggle);
    expect(document.documentElement.dataset.theme).toBe('light');
    await press(document.body, 'k', { ctrlKey: true });
    await type(input(), 'spec-creator');
    await click(document.querySelector('[role="dialog"] [role="option"]')!);
    expect(location.hash).toBe('#/plugins/sdd-flow/agent/spec-creator');
  });

  it('does not let the / shortcut fire while the palette is open', async () => {
    await boot();
    await press(document.body, 'k', { ctrlKey: true });
    const e = await press(input(), '/');
    expect(e.defaultPrevented).toBe(false);
  });
});
