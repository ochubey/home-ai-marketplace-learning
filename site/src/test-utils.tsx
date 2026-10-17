// Helpers shared by the component specs (not a spec itself).
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { FetchFn } from './data';
import { fixtureData } from './fixtures';
import type { CatalogData } from './types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: { root: Root; container: HTMLElement }[] = [];

export async function mount(ui: ReactElement): Promise<HTMLElement> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push({ root, container });
  await act(async () => {
    root.render(ui);
  });
  return container;
}

export async function cleanup(): Promise<void> {
  for (const { root, container } of mounted.splice(0)) {
    await act(async () => root.unmount());
    container.remove();
  }
}

/** Lets pending promises (fetch mocks, effects) settle. */
export async function settle(): Promise<void> {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

export async function click(el: Element): Promise<void> {
  await act(async () => {
    (el as HTMLElement).click();
  });
}

export async function type(input: HTMLInputElement, value: string): Promise<void> {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

export async function press(target: EventTarget, key: string, init: KeyboardEventInit = {}): Promise<KeyboardEvent> {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  await act(async () => {
    target.dispatchEvent(event);
  });
  return event;
}

export async function setHash(hash: string): Promise<void> {
  await act(async () => {
    history.replaceState(null, '', hash === '' ? location.pathname : hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

export function makeFetch(data: CatalogData = fixtureData, bodies: Record<string, string> = {}): FetchFn & { calls: string[] } {
  const calls: string[] = [];
  const fn = async (url: string) => {
    calls.push(url);
    const file = url.replace(/^.*\/data\//, '');
    if (file === 'index.json') return new Response(JSON.stringify(data.index));
    if (file === 'releases.json') return new Response(JSON.stringify(data.releases));
    if (file === 'stats.json') return new Response(JSON.stringify(data.stats));
    if (file.startsWith('bodies/')) {
      const id = file.slice('bodies/'.length, -'.md'.length);
      return new Response(bodies[id] ?? `Body text of ${id}`);
    }
    return new Response('', { status: 404 });
  };
  return Object.assign(fn, { calls });
}

export const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
