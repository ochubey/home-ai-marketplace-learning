import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderMarkdown, sanitizeHtml } from './markdown';

const ctx = { baseDir: 'plugins/p/skills/s', repoUrl: 'https://github.com/o/r', ref: 'abc1234' };

function dom(md: string, c = ctx): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = renderMarkdown(md, c);
  return el;
}

const FORBIDDEN = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'svg', 'math', 'img', 'base', 'meta', 'link', 'frame', 'frameset', 'textarea', 'button', 'select'];

function expectSafe(el: HTMLElement) {
  for (const tag of FORBIDDEN) expect(el.querySelector(tag), `<${tag}> survived`).toBeNull();
  for (const node of el.querySelectorAll('*')) {
    for (const attr of node.attributes) {
      expect(attr.name.startsWith('on'), `${attr.name} survived`).toBe(false);
      expect(attr.name, 'style attribute survived').not.toBe('style');
      if (['href', 'src', 'srcset', 'action', 'formaction', 'xlink:href', 'data', 'poster'].includes(attr.name)) {
        const value = attr.value.replace(/[\u0000- ]/g, '');
        const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(value);
        if (scheme) expect(['http', 'https', 'mailto']).toContain(scheme[1]!.toLowerCase());
      }
    }
  }
}

const CORPUS: [string, string][] = [
  ['script tag', 'before <script>alert(1)</script> after'],
  ['script with src', '<script src="https://evil.test/x.js"></script>'],
  ['split script tag', '<<script>script>alert(1)<</script>/script>'],
  ['img onerror', '<img src=x onerror=alert(1)>'],
  ['img onerror unquoted slash', '<img src=x onerror=alert(1)//>'],
  ['markdown image data url', '![x](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)'],
  ['markdown image remote', '![logo](https://evil.test/a.png)'],
  ['javascript link', '[click](javascript:alert(1))'],
  ['mixed case javascript link', '[click](JaVaScRiPt:alert(1))'],
  ['entity encoded javascript link', '<a href="&#106;avascript:alert(1)">x</a>'],
  ['tab inside scheme', '<a href="java\tscript:alert(1)">x</a>'],
  ['data link', '[x](data:text/html;base64,PHNjcmlwdD4=)'],
  ['vbscript link', '<a href="vbscript:msgbox(1)">x</a>'],
  ['ftp link', '<a href="ftp://example.test/x">x</a>'],
  ['tel link', '<a href="tel:+100000000">x</a>'],
  ['sms link', '<a href="sms:+100000000">x</a>'],
  ['file link', '<a href="file:///etc/hosts">x</a>'],
  ['svg onload', '<svg onload=alert(1)><circle/></svg>'],
  ['svg script', '<svg><script>alert(1)</script></svg>'],
  ['svg use', '<svg><use xlink:href="data:image/svg+xml;base64,AAAA#x"/></svg>'],
  ['mathml', '<math><mtext><script>alert(1)</script></mtext></math>'],
  ['mathml href', '<math href="javascript:alert(1)">x</math>'],
  ['iframe', '<iframe src="https://evil.test" srcdoc="<script>alert(1)</script>"></iframe>'],
  ['object and embed', '<object data="x.swf"></object><embed src="x.swf">'],
  ['form and input', '<form action="https://evil.test"><input name=a><button>go</button></form>'],
  ['style tag', '<style>body{display:none}</style>text'],
  ['style attribute', '<p style="position:fixed;top:0">fixed</p>'],
  ['event handler on anchor', '<a href="#x" onclick="alert(1)" onmouseover="alert(2)">x</a>'],
  ['base and meta', '<base href="https://evil.test/"><meta http-equiv="refresh" content="0;url=https://evil.test">'],
  ['link tag', '<link rel="stylesheet" href="https://evil.test/a.css">'],
  ['html comment', '<!-- <script>alert(1)</script> -->text'],
  ['nested tags', '<div><p><b><i><a href="javascript:alert(1)"><img src=x onerror=alert(1)></a></i></b></p></div>'],
  ['entity encoded tag', '&lt;script&gt;alert(1)&lt;/script&gt;'],
  ['numeric entity script', '&#60;script&#62;alert(1)&#60;/script&#62;'],
  ['null byte', 'a\u0000<scr\u0000ipt>alert(1)</scr\u0000ipt>'],
  ['details ontoggle', '<details open ontoggle=alert(1)><summary>x</summary></details>'],
  ['autolink javascript', '<javascript:alert(1)>'],
  ['unsafe link keeps no href', '[click](javascript:alert(1))'],
  ['reference style link', '[x][1]\n\n[1]: javascript:alert(1)'],
  ['code block keeps text', '```html\n<script>alert(1)</script>\n```'],
];

describe('renderMarkdown sanitizing', () => {
  it.each(CORPUS)('%s', (_name, md) => {
    expectSafe(dom(md));
  });

  it('leaves an unsafe link without an href and without a rewrite to GitHub', () => {
    const a = dom('[click](javascript:alert(1))').querySelector('a');
    expect(a?.getAttribute('href') ?? null).toBeNull();
    expect(dom('[click](javascript:alert(1))').innerHTML).not.toContain('github.com');
  });

  it('renders ordinary Markdown', () => {
    const el = dom('# Title\n\nSome **bold** text and `code`.\n\n- a\n- b\n\n| h |\n|---|\n| c |\n');
    expect(el.querySelector('h1')).toBeNull();
    expect(el.querySelector('h2')?.textContent).toBe('Title');
    expect(el.querySelector('strong')?.textContent).toBe('bold');
    expect(el.querySelector('code')?.textContent).toBe('code');
    expect(el.querySelectorAll('li')).toHaveLength(2);
    expect(el.querySelector('table td')?.textContent).toBe('c');
  });

  it('shows script source in a code block as text, not as markup', () => {
    const el = dom('```html\n<script>alert(1)</script>\n```');
    expect(el.querySelector('pre code')?.textContent).toContain('<script>alert(1)</script>');
    expect(el.querySelector('script')).toBeNull();
  });

  it('does not render task list checkboxes as inputs', () => {
    expect(dom('- [x] done\n- [ ] todo').querySelector('input')).toBeNull();
  });
});

describe('sanitizeHtml URL allowlist', () => {
  it.each(['tel:+100000000', 'sms:+100000000', 'ftp://example.test/x', 'file:///etc/hosts', 'data:text/html;base64,AAAA', 'javascript:alert(1)', 'cid:abc'])(
    'drops %s',
    (url) => {
      expect(sanitizeHtml(`<a href="${url}">x</a>`)).toBe('<a>x</a>');
    },
  );

  it.each(['https://example.test/x', 'http://example.test/x', 'mailto:a@example.test', 'docs/x.md', '../x.md', '#anchor', '/root.md'])('keeps %s', (url) => {
    expect(sanitizeHtml(`<a href="${url}">x</a>`)).toBe(`<a href="${url}">x</a>`);
  });
});

describe('renderMarkdown links', () => {
  it('marks absolute links as external with rel and an indicator', () => {
    const a = dom('[site](https://example.test/page)').querySelector('a')!;
    expect(a.getAttribute('href')).toBe('https://example.test/page');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer nofollow');
    expect(a.querySelector('.ext-indicator')).not.toBeNull();
  });

  it('treats mailto and protocol-relative links as external', () => {
    expect(dom('[m](mailto:a@example.test)').querySelector('a')?.getAttribute('rel')).toBe('noopener noreferrer nofollow');
    const pr = dom('<a href="//example.test/x">x</a>').querySelector('a')!;
    expect(pr.getAttribute('href')).toBe('https://example.test/x');
    expect(pr.getAttribute('rel')).toBe('noopener noreferrer nofollow');
  });

  it('rewrites a relative link to the GitHub URL at the commit', () => {
    const a = dom('[ref](references/x.md)').querySelector('a')!;
    expect(a.getAttribute('href')).toBe('https://github.com/o/r/blob/abc1234/plugins/p/skills/s/references/x.md');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer nofollow');
    expect(a.querySelector('.ext-indicator')).not.toBeNull();
  });

  it('uses main when the commit is unknown', () => {
    const a = dom('[ref](./x.md#part)', { ...ctx, ref: 'main' }).querySelector('a')!;
    expect(a.getAttribute('href')).toBe('https://github.com/o/r/blob/main/plugins/p/skills/s/x.md#part');
  });

  it('resolves parent and root-relative links and never leaves the repository', () => {
    const el = dom('[a](../other/y.md) [b](/docs/z.md) [c](../../../../../../../etc/x)');
    const hrefs = [...el.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual([
      'https://github.com/o/r/blob/abc1234/plugins/p/skills/other/y.md',
      'https://github.com/o/r/blob/abc1234/docs/z.md',
      'https://github.com/o/r/blob/abc1234/etc/x',
    ]);
  });

  it('keeps an in-page anchor and gives headings ids', () => {
    const el = dom('# My Section!\n\n[jump](#my-section)');
    const a = el.querySelector('a')!;
    expect(a.getAttribute('href')).toBe('#my-section');
    expect(a.getAttribute('rel')).toBeNull();
    expect(a.querySelector('.ext-indicator')).toBeNull();
    expect(el.querySelector('h2')?.getAttribute('id')).toBe('my-section');
  });
});

describe('renderMarkdown images', () => {
  it('replaces an image with its alt text as a link to the image URL', () => {
    const el = dom('![the logo](https://example.test/a.png)');
    expect(el.querySelector('img')).toBeNull();
    const a = el.querySelector('a')!;
    expect(a.getAttribute('href')).toBe('https://example.test/a.png');
    expect(a.textContent).toContain('the logo');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer nofollow');
  });

  it('rewrites a relative image URL to GitHub', () => {
    const a = dom('![diagram](img/d.png)').querySelector('a')!;
    expect(a.getAttribute('href')).toBe('https://github.com/o/r/blob/abc1234/plugins/p/skills/s/img/d.png');
  });

  it('keeps only the alt text when the image URL is not allowed', () => {
    const el = dom('![bad](data:image/png;base64,AAAA)');
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('a')).toBeNull();
    expect(el.textContent).toContain('bad');
  });
});

describe('markdown module policy', () => {
  it('is the only source file with a raw HTML sink, and no file evaluates strings', () => {
    const root = join(process.cwd(), 'src');
    const files = readdirSync(root, { recursive: true }).filter((f) => /\.(ts|tsx)$/.test(f) && !/\.spec\.tsx?$/.test(f));
    const sinks: string[] = [];
    for (const f of files) {
      const text = readFileSync(join(root, f), 'utf8');
      if (text.includes('dangerouslySetInnerHTML')) sinks.push(f);
      expect(text, f).not.toMatch(/\beval\s*\(/);
      expect(text, f).not.toMatch(/new\s+Function\b/);
    }
    expect(sinks).toEqual(['markdown.ts']);
  });
});
