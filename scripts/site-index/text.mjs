// Plain-text and size-cap helpers. Nothing here renders HTML.
import { BODY_MAX_BYTES, REPO_URL, SEARCH_TEXT_MAX } from './constants.mjs';

/** Plain text of a Markdown body for search: markup and tags removed, whitespace collapsed, capped. */
export function toSearchText(body) {
  const t = body
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<\/?[A-Za-z][^>]*>/g, ' ')
    .replace(/[`*#>|~]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length <= SEARCH_TEXT_MAX) return t;
  let cut = t.slice(0, SEARCH_TEXT_MAX);
  if (/[\ud800-\udbff]$/.test(cut)) cut = cut.slice(0, -1);
  return cut.trimEnd();
}

/** Caps a body at 200 KB (UTF-8) and appends a notice with a GitHub link. */
export function capBody(body, sourcePath) {
  if (Buffer.byteLength(body, 'utf8') <= BODY_MAX_BYTES) return body;
  let cut = Buffer.from(body, 'utf8').subarray(0, BODY_MAX_BYTES).toString('utf8').replace(/\uFFFD+$/, '');
  cut = cut.replace(/[\ud800-\udbff]$/, '');
  const url = `${REPO_URL}/blob/main/${sourcePath.split('/').map(encodeURIComponent).join('/')}`;
  return `${cut}\n\n> Content truncated at 200 KB. Read the full file on GitHub: ${url}\n`;
}
