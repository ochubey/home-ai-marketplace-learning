import { describe, expect, it } from 'vitest';
import en from './en.json';
import { t } from './t';

describe('t', () => {
  it('returns the string for a key', () => {
    expect(t('nav.home')).toBe('Home');
  });

  it('fills placeholders and keeps unknown ones', () => {
    expect(t('install.plugin', { plugin: 'zod-kit' })).toBe('claude plugin install zod-kit@home-ai-marketplace-learning');
    expect(t('search.count', {})).toBe('{count} results');
  });

  it('rejects a key that does not exist at compile time', () => {
    // @ts-expect-error unknown key must fail the typecheck
    const value = t('no.such.key');
    expect(value).toBeUndefined();
  });

  it('has no download, rating or stars wording', () => {
    const text = Object.values(en).join('\n').toLowerCase();
    for (const word of ['download', 'rating', 'stars']) expect(text).not.toContain(word);
  });
});
