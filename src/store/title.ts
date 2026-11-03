import { TITLE_AUTO_MAX, TITLE_MAX } from '@/config/chat';

/**
 * AC-13: whitespace collapsed and trimmed; if over 40 characters, cut at the last word boundary
 * within 40 and add "…". A single word longer than 40 is cut at 40 plus "…".
 */
export function makeAutoTitle(prompt: string): string {
  const chars = Array.from(prompt.replace(/\s+/g, ' ').trim());
  if (chars.length <= TITLE_AUTO_MAX) return chars.join('');
  const head = chars.slice(0, TITLE_AUTO_MAX);
  // A space right after the cut means the last word fits exactly.
  const boundary = chars[TITLE_AUTO_MAX] === ' ' ? TITLE_AUTO_MAX : head.lastIndexOf(' ');
  const kept = boundary > 0 ? head.slice(0, boundary) : head;
  return `${kept.join('')}…`;
}

/** AC-16: trimmed, at most 60 characters; null when empty. */
export function normalizeTitle(input: string): string | null {
  const trimmed = Array.from(input.trim()).slice(0, TITLE_MAX).join('').trim();
  return trimmed.length > 0 ? trimmed : null;
}
