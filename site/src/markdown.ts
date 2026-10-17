import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { createElement, useMemo, type MouseEvent, type ReactElement } from 'react';
import { t } from './i18n/t';

export interface MarkdownContext {
  /** Repository-relative directory of the Markdown file (POSIX, no trailing slash). */
  baseDir: string;
  /** Repository URL on GitHub, without trailing slash. */
  repoUrl: string;
  /** Commit (short SHA) or branch used to build links to files on GitHub. */
  ref: string;
}

const ALLOWED_TAGS = [
  'a', 'blockquote', 'br', 'code', 'del', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'img', 'li', 'ol', 'p', 'pre',
  'strong', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'ul',
];
const ALLOWED_ATTR = ['href', 'src', 'alt', 'title', 'colspan', 'rowspan'];
const FORBID_TAGS = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'svg', 'math', 'base', 'meta', 'link'];
const FORBID_ATTR = ['style', 'srcset', 'formaction', 'action'];
// http, https and mailto, plus URLs without a scheme (relative links, anchors). Everything else is dropped.
const ALLOWED_URI_REGEXP = /^(?:https?:|mailto:|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i;
const REL = 'noopener noreferrer nofollow';
const SCHEME_RE = /^([a-z][a-z0-9+.-]*):/i;

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Resolves a relative link against the file's folder; the result never leaves the repository root. */
function repoUrlFor(href: string, ctx: MarkdownContext): string {
  const hashAt = href.indexOf('#');
  const hash = hashAt >= 0 ? href.slice(hashAt) : '';
  const noHash = hashAt >= 0 ? href.slice(0, hashAt) : href;
  const queryAt = noHash.indexOf('?');
  const target = safeDecode(queryAt >= 0 ? noHash.slice(0, queryAt) : noHash);
  const start = target.startsWith('/') ? [] : ctx.baseDir.split('/').filter(Boolean);
  const parts = [...start];
  for (const seg of target.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return `${ctx.repoUrl}/blob/${ctx.ref}/${encodeURI(parts.join('/'))}${hash}`;
}

type LinkKind = { kind: 'anchor' | 'external'; href: string } | null;

function classify(raw: string, ctx: MarkdownContext): LinkKind {
  const href = raw.trim();
  if (href.startsWith('#')) return { kind: 'anchor', href };
  const scheme = SCHEME_RE.exec(href);
  if (scheme) {
    const s = scheme[1]!.toLowerCase();
    return s === 'http' || s === 'https' || s === 'mailto' ? { kind: 'external', href } : null;
  }
  if (href.startsWith('//')) return { kind: 'external', href: `https:${href}` };
  return { kind: 'external', href: repoUrlFor(href, ctx) };
}

function markExternal(a: HTMLAnchorElement): void {
  const doc = a.ownerDocument;
  a.setAttribute('rel', REL);
  const mark = doc.createElement('span');
  mark.className = 'ext-indicator';
  mark.setAttribute('aria-hidden', 'true');
  mark.textContent = ' ↗';
  const hidden = doc.createElement('span');
  hidden.className = 'sr-only';
  hidden.textContent = t('markdown.externalLink');
  a.append(mark, hidden);
}

function rewriteLinks(root: ParentNode, ctx: MarkdownContext): void {
  for (const a of Array.from(root.querySelectorAll('a'))) {
    const raw = a.getAttribute('href');
    if (raw === null) continue; // the sanitizer already dropped an unsafe URL; the text stays
    const link = classify(raw, ctx);
    if (!link) {
      a.removeAttribute('href');
      continue;
    }
    a.setAttribute('href', link.href);
    if (link.kind === 'external') markExternal(a);
  }
}

function replaceImages(root: ParentNode, ctx: MarkdownContext): void {
  for (const img of Array.from(root.querySelectorAll('img'))) {
    const doc = img.ownerDocument;
    const alt = img.getAttribute('alt') ?? '';
    const src = img.getAttribute('src');
    const link = src === null ? null : classify(src, ctx);
    if (!link || link.kind !== 'external') {
      img.replaceWith(doc.createTextNode(alt));
      continue;
    }
    const a = doc.createElement('a');
    a.setAttribute('href', link.href);
    a.textContent = alt !== '' ? alt : link.href;
    markExternal(a);
    img.replaceWith(a);
  }
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 _-]/g, '')
    .trim()
    .replace(/ +/g, '-');
}

function addHeadingIds(root: ParentNode): void {
  const seen = new Map<string, number>();
  for (const h of Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6'))) {
    const base = slug(h.textContent ?? '');
    if (base === '') continue;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    h.setAttribute('id', n === 0 ? base : `${base}-${n}`);
  }
}

/** First layer: allowlist of tags, attributes and URL schemes. */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_TAGS,
    FORBID_ATTR,
    ALLOWED_URI_REGEXP,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
  });
}

/** Markdown to sanitized HTML. The result is safe to insert with the single sink in `MarkdownView`. */
export function renderMarkdown(source: string, ctx: MarkdownContext): string {
  const clean = sanitizeHtml(marked.parse(source, { async: false, gfm: true }));
  // A template's content is inert: nothing is fetched or run while the output is adjusted.
  const tpl = document.createElement('template');
  tpl.innerHTML = clean;
  replaceImages(tpl.content, ctx);
  rewriteLinks(tpl.content, ctx);
  addHeadingIds(tpl.content);
  return tpl.innerHTML;
}

function onAnchorClick(e: MouseEvent<HTMLElement>): void {
  const target = e.target instanceof Element ? e.target.closest('a') : null;
  const href = target?.getAttribute('href');
  if (!href || !href.startsWith('#') || href.startsWith('#/')) return;
  e.preventDefault();
  const id = safeDecode(href.slice(1));
  const el = Array.from(e.currentTarget.querySelectorAll('[id]')).find((n) => n.id === id);
  el?.scrollIntoView?.();
}

/** Renders Markdown text. This is the only place in the app that inserts HTML. */
export function MarkdownView(props: { source: string; ctx: MarkdownContext }): ReactElement {
  const { source, ctx } = props;
  const { baseDir, repoUrl, ref } = ctx;
  const html = useMemo(() => renderMarkdown(source, { baseDir, repoUrl, ref }), [source, baseDir, repoUrl, ref]);
  return createElement('div', { className: 'md', dangerouslySetInnerHTML: { __html: html }, onClick: onAnchorClick });
}
