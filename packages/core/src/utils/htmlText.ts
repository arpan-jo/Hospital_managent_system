/**
 * Text written in the admin's rich-text editor (a prescription layout's header,
 * footer or signatory), as plain lines for a native screen: paragraphs, line
 * breaks and list items become lines, tags go, entities are decoded, and blank
 * lines are dropped.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

const decodeEntities = (text: string): string =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    const lower = code.toLowerCase();
    if (lower.startsWith('#x')) {
      const value = parseInt(lower.slice(2), 16);
      return Number.isFinite(value) ? String.fromCodePoint(value) : whole;
    }
    if (lower.startsWith('#')) {
      const value = parseInt(lower.slice(1), 10);
      return Number.isFinite(value) ? String.fromCodePoint(value) : whole;
    }
    return NAMED_ENTITIES[lower] ?? whole;
  });

export const htmlToLines = (html: string | null | undefined): string[] => {
  const text = String(html ?? '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]*>/g, '');

  return decodeEntities(text)
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
};
