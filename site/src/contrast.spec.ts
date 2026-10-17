import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { KINDS } from './types';

const tokensCss = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8');

type Rgb = [number, number, number];

function parseBlock(selector: string): Record<string, string> {
  const start = tokensCss.indexOf(selector);
  const open = tokensCss.indexOf('{', start);
  const close = tokensCss.indexOf('}', open);
  const out: Record<string, string> = {};
  for (const m of tokensCss.slice(open + 1, close).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]!] = m[2]!.trim();
  return out;
}

const gamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

function oklchToRgb(l: number, c: number, hDeg: number): Rgb {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const l_ = Math.pow(l + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m_ = Math.pow(l - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s_ = Math.pow(l - 0.0894841775 * a - 1.291485548 * b, 3);
  const lin = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  return lin.map((v) => Math.min(1, Math.max(0, gamma(v)))) as Rgb;
}

function toRgb(value: string): Rgb {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const ok = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(value);
  if (ok) return oklchToRgb(Number(ok[1]), Number(ok[2]), Number(ok[3]));
  throw new Error(`unsupported color: ${value}`);
}

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const luminance = ([r, g, b]: Rgb) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

export function ratio(fg: string, bg: string): number {
  const a = luminance(toRgb(fg));
  const b = luminance(toRgb(bg));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const themes = { dark: { ...parseBlock(':root') }, light: { ...parseBlock(":root"), ...parseBlock("[data-theme='light']") } };
const SURFACES = ['--bg', '--surface', '--surface-2', '--hover'] as const;

describe.each(Object.entries(themes))('%s theme contrast (WCAG 2.2 AA)', (_name, tokens) => {
  const get = (k: string) => {
    const v = tokens[k];
    if (!v) throw new Error(`missing token ${k}`);
    return v;
  };

  it.each(SURFACES)('body text reaches 4.5:1 on %s', (surface) => {
    expect(ratio(get('--text'), get(surface))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(SURFACES)('dim text reaches 4.5:1 on %s', (surface) => {
    expect(ratio(get('--dim'), get(surface))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(SURFACES)('links (accent) reach 4.5:1 on %s', (surface) => {
    expect(ratio(get('--accent'), get(surface))).toBeGreaterThanOrEqual(4.5);
  });

  it('button text on the accent color reaches 4.5:1', () => {
    expect(ratio(get('--on-accent'), get('--accent'))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(KINDS)('kind badge text %s reaches 4.5:1 on every surface', (kind) => {
    for (const surface of SURFACES) expect(ratio(get(`--kind-${kind}`), get(surface))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(SURFACES)('focus indicator reaches 3:1 on %s', (surface) => {
    expect(ratio(get('--focus'), get(surface))).toBeGreaterThanOrEqual(3);
  });

  it.each(SURFACES)('input borders reach 3:1 on %s', (surface) => {
    expect(ratio(get('--border-strong'), get(surface))).toBeGreaterThanOrEqual(3);
  });

  it('defines six distinct kind tokens', () => {
    const values = KINDS.map((k) => get(`--kind-${k}`));
    expect(new Set(values).size).toBe(6);
  });
});

it('kind tokens differ between themes', () => {
  for (const k of KINDS) expect(themes.dark[`--kind-${k}` as keyof typeof themes.dark]).not.toBe(themes.light[`--kind-${k}` as keyof typeof themes.light]);
});
