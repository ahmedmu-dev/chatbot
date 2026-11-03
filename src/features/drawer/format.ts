/** One-line plain text from Markdown, for the drawer preview (AC-7). */
export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[^\n]*\n?/g, ' ') // code fence lines (the code itself is kept)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // images -> alt text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> link text
    .replace(/^\s{0,3}#{1,6}\s+/gm, '') // headings
    .replace(/^\s{0,3}>\s?/gm, '') // blockquotes
    .replace(/^\s*([-*+]|\d+[.)])\s+/gm, '') // list markers
    .replace(/^\s*([-*_]\s*){3,}$/gm, ' ') // horizontal rules
    .replace(/\*\*(.+?)\*\*/gs, '$1') // bold
    .replace(/(^|\W)__(.+?)__(?!\w)/gs, '$1$2') // bold (not inside words)
    .replace(/\*(\S(?:.*?\S)?)\*/gs, '$1') // italic
    .replace(/(^|\W)_(.+?)_(?!\w)/gs, '$1$2') // italic (not inside words)
    .replace(/~~(.+?)~~/gs, '$1') // strikethrough
    .replace(/`([^`]*)`/g, '$1') // inline code
    .replace(/^\s*\|?[\s:|-]+\|[\s:|-]*$/gm, ' ') // table separator rows
    .replace(/\|/g, ' ') // table cells
    .replace(/\s+/g, ' ')
    .trim();
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** AC-7: the time if the chat was updated today (e.g. "14:05"), else the date, in the device locale. */
export function formatChatTime(updatedAt: number, now: number = Date.now()): string {
  const date = new Date(updatedAt);
  if (sameDay(date, new Date(now))) {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
}
