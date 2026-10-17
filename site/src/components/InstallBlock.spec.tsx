import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { click, cleanup, mount, text } from '../test-utils';
import { InstallBlock } from './InstallBlock';

afterEach(async () => {
  await cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const EXPECTED = 'claude plugin marketplace add ochubey/home-ai-marketplace-learning\nclaude plugin install sdd-flow@home-ai-marketplace-learning';

describe('InstallBlock', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it('shows exactly the two install commands', async () => {
    const c = await mount(<InstallBlock plugin="sdd-flow" />);
    expect(c.querySelector('pre')?.textContent).toBe(EXPECTED);
  });

  it('copies exactly the two lines and announces Copied for at least 2 seconds', async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const c = await mount(<InstallBlock plugin="sdd-flow" />);
    await click(c.querySelector('button')!);
    expect(writeText).toHaveBeenCalledWith(EXPECTED);
    const live = c.querySelector('[role="status"]')!;
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(text(live)).toBe('Copied');
    await act(async () => {
      vi.advanceTimersByTime(1900);
    });
    expect(text(live)).toBe('Copied');
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(text(live)).toBe('');
  });

  it('selects the text and tells the user to copy with the keyboard when the clipboard rejects', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn(async () => Promise.reject(new Error('denied'))) } });
    const c = await mount(<InstallBlock plugin="sdd-flow" />);
    await click(c.querySelector('button')!);
    expect(text(c.querySelector('[role="status"]'))).toContain('press Ctrl+C');
    expect(window.getSelection()?.toString()).toContain('claude plugin install sdd-flow@home-ai-marketplace-learning');
  });

  it('falls back the same way when there is no clipboard API', async () => {
    vi.stubGlobal('navigator', {});
    const c = await mount(<InstallBlock plugin="sdd-flow" />);
    await click(c.querySelector('button')!);
    expect(text(c.querySelector('[role="status"]'))).toContain('Cmd+C');
  });
});
