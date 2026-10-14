/**
 * A radiology report's body is rich-text HTML written at the desk. The portal
 * sanitises it against an allowlist before drawing it; this reads it the same
 * way into a small tree the app can draw with its own text and views.
 *
 * Mirrors the portal's `sanitizeReportHtml`: the allowlisted tags are kept,
 * dangerous ones are dropped with everything inside them, any other tag is
 * unwrapped (its text stays), and only `colspan`/`rowspan`/`span` survive as
 * attributes.
 */

export type ReportHtmlNode =
  | { type: 'text'; text: string }
  | { type: 'element'; tag: string; colSpan: number; children: ReportHtmlNode[] };

const ALLOWED_TAGS = new Set([
  'p', 'br', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'code', 'pre', 'blockquote',
  'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'caption', 'colgroup', 'col', 'hr',
]);

/** Dropped together with their content. */
const DROPPED_TAGS = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'form',
  'input', 'button', 'select', 'textarea', 'template', 'svg', 'math', 'head', 'title',
]);

/** Tags that never have content or a closing tag. */
const VOID_TAGS = new Set([
  'br', 'hr', 'col', 'img', 'input', 'meta', 'link', 'base', 'area', 'source', 'wbr', 'embed',
]);

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  ndash: '–',
  mdash: '—',
  hellip: '…',
  deg: '°',
  plusmn: '±',
  times: '×',
  micro: 'µ',
  copy: '©',
  reg: '®',
  bull: '•',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
};

export const decodeHtmlEntities = (text: string): string =>
  String(text ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code =
        entity[1]?.toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return match;
      // A non-breaking space reads as a plain one.
      return code === 160 ? ' ' : String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });

const readColSpan = (attributes: string): number => {
  const match = /\b(?:colspan|span)\s*=\s*["']?(\d+)/i.exec(attributes ?? '');
  const span = match ? Number(match[1]) : 1;
  return Number.isFinite(span) && span > 1 ? Math.min(span, 12) : 1;
};

type Frame = { tag: string; colSpan: number; children: ReportHtmlNode[] };

const TOKEN = /<!--[\s\S]*?-->|<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>|[^<]+|</g;

/** The report's HTML as a tree of allowed elements and text. */
export const parseReportHtml = (html?: string | null): ReportHtmlNode[] => {
  const root: Frame = { tag: '#root', colSpan: 1, children: [] };
  const stack: Frame[] = [root];
  /** While inside a dropped tag: its name and how deep it is nested in itself. */
  let dropping: { tag: string; depth: number } | null = null;

  const source = String(html ?? '');
  let match: RegExpExecArray | null;
  TOKEN.lastIndex = 0;

  while ((match = TOKEN.exec(source)) !== null) {
    const token = match[0];
    if (token.startsWith('<!--')) continue;

    const tagName = match[1]?.toLowerCase();
    if (!tagName) {
      // Text — or a stray '<' that opens no tag.
      if (!dropping) {
        stack[stack.length - 1].children.push({ type: 'text', text: decodeHtmlEntities(token) });
      }
      continue;
    }

    const isClosing = token.startsWith('</');
    const isSelfClosing = /\/\s*>$/.test(token) || VOID_TAGS.has(tagName);

    if (dropping) {
      if (tagName === dropping.tag && !isSelfClosing) {
        dropping.depth += isClosing ? -1 : 1;
        if (dropping.depth === 0) dropping = null;
      }
      continue;
    }

    if (DROPPED_TAGS.has(tagName)) {
      if (!isClosing && !isSelfClosing) dropping = { tag: tagName, depth: 1 };
      continue;
    }

    // Anything not on the list is unwrapped: the tag goes, its content stays.
    if (!ALLOWED_TAGS.has(tagName)) continue;

    if (isClosing) {
      const at = stack.map(frame => frame.tag).lastIndexOf(tagName);
      // A closing tag with nothing open to close is ignored.
      if (at <= 0) continue;
      while (stack.length > at) {
        const frame = stack.pop() as Frame;
        stack[stack.length - 1].children.push({
          type: 'element',
          tag: frame.tag,
          colSpan: frame.colSpan,
          children: frame.children,
        });
      }
      continue;
    }

    const colSpan = tagName === 'th' || tagName === 'td' || tagName === 'col' ? readColSpan(match[2]) : 1;
    if (isSelfClosing) {
      stack[stack.length - 1].children.push({ type: 'element', tag: tagName, colSpan, children: [] });
    } else {
      stack.push({ tag: tagName, colSpan, children: [] });
    }
  }

  // Close whatever was left open.
  while (stack.length > 1) {
    const frame = stack.pop() as Frame;
    stack[stack.length - 1].children.push({
      type: 'element',
      tag: frame.tag,
      colSpan: frame.colSpan,
      children: frame.children,
    });
  }

  return root.children;
};

/** Whether the report says anything once its tags are gone — `<p></p>` does not. */
export const reportHtmlHasText = (html?: string | null): boolean =>
  decodeHtmlEntities(String(html ?? '').replace(/<[^>]*>/g, ' ')).trim().length > 0;
