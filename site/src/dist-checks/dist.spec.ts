// Checks of the production build in dist/. Run after `npm run build` with `npm run test:dist`.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const dist = join(process.cwd(), 'dist');
const files = existsSync(dist) ? readdirSync(dist, { recursive: true }).filter((f) => /\.(html|js|css)$/.test(f)) : [];
const read = (f: string) => readFileSync(join(dist, f), 'utf8');
const html = existsSync(join(dist, 'index.html')) ? read('index.html') : '';

const REQUIRED_CSP = [
  ["default-src", ["'self'"]],
  ["script-src", ["'self'"]],
  ["style-src", ["'self'"]],
  ["img-src", ["'self'", 'data:']],
  ["connect-src", ["'self'"]],
  ["font-src", ["'self'"]],
  ["object-src", ["'none'"]],
  ["base-uri", ["'self'"]],
  ["form-action", ["'none'"]],
] as const;

describe('production build', () => {
  it('exists', () => {
    expect(files.length).toBeGreaterThan(0);
    expect(html).toContain('<div id="root">');
  });

  it('declares lang="en"', () => {
    expect(html).toMatch(/<html[^>]*\slang="en"/);
  });

  it('carries a CSP meta tag at least as strict as the required policy', () => {
    const meta = /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/.exec(html);
    expect(meta, 'CSP meta tag missing').not.toBeNull();
    const policy = meta![1]!.replace(/&#39;|&apos;/g, "'");
    const directives = new Map(policy.split(';').map((d) => d.trim().split(/\s+/)).map(([name, ...values]) => [name!, values]));
    for (const [name, allowed] of REQUIRED_CSP) {
      const values = directives.get(name);
      expect(values, `${name} missing`).toBeDefined();
      for (const v of values!) expect(allowed as readonly string[], `${name} allows ${v}`).toContain(v);
    }
    expect(policy).not.toContain('unsafe');
  });

  it('puts the CSP meta before any script or link', () => {
    expect(html.indexOf('Content-Security-Policy')).toBeLessThan(html.search(/<script|<link/));
  });

  it('has no inline script and no inline event handler attribute', () => {
    for (const m of html.matchAll(/<script\b([^>]*)>/g)) expect(m[1], 'inline script').toMatch(/\ssrc="/);
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
    expect(html).not.toMatch(/<style\b/i);
    expect(html).not.toMatch(/\sstyle\s*=/i);
  });

  it('loads scripts and styles from the same origin only', () => {
    for (const m of html.matchAll(/<(?:script|link)\b[^>]*\s(?:src|href)="([^"]+)"/g)) {
      expect(m[1], 'external URL').not.toMatch(/^(?:[a-z]+:)?\/\//i);
      expect(m[1]!.startsWith('/home-ai-marketplace-learning/')).toBe(true);
    }
  });

  it('has no external URL in CSS url() or @import', () => {
    for (const f of files.filter((x) => x.endsWith('.css'))) {
      const css = read(f);
      expect(css, f).not.toMatch(/@import/);
      for (const m of css.matchAll(/url\(\s*["']?([^)"']+)/g)) expect(m[1], `${f} url()`).not.toMatch(/^(?:https?:)?\/\//i);
    }
  });

  it('has the reduced-motion rule in the built CSS', () => {
    const css = files.filter((f) => f.endsWith('.css')).map(read).join('\n');
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
  });

  it('ships no remote font or script reference in JavaScript fetch targets', () => {
    for (const f of files.filter((x) => x.endsWith('.js'))) {
      const js = read(f);
      expect(js, f).not.toMatch(/fonts\.(googleapis|gstatic)/);
      expect(js, f).not.toMatch(/\bnew Function\(/);
    }
  });

  it('does not rely on the module preload polyfill', () => {
    for (const f of files.filter((x) => x.endsWith('.js'))) expect(read(f), f).not.toContain('relList');
  });
});
