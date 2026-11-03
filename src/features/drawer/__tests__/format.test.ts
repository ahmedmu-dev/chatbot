import { formatChatTime, stripMarkdown } from '../format';

describe('stripMarkdown', () => {
  it('AC-7: turns Markdown into one line of plain text', () => {
    expect(stripMarkdown('# Title\n\nSome **bold** and *italic* and `code`.')).toBe(
      'Title Some bold and italic and code.',
    );
    expect(stripMarkdown('- one\n- two\n1. three')).toBe('one two three');
    expect(stripMarkdown('See [the docs](https://x.dev/a_b) and ![logo](a.png)')).toBe(
      'See the docs and logo',
    );
    expect(stripMarkdown('> quoted ~~gone~~ __strong__')).toBe('quoted gone strong');
  });

  it('AC-7: keeps the code of a fenced block but drops the fences', () => {
    expect(stripMarkdown('Run:\n```ts\nconst a = 1;\n```\nDone')).toBe('Run: const a = 1; Done');
  });

  it('AC-7: does not break snake_case words or lone asterisks', () => {
    expect(stripMarkdown('use my_var_name here')).toBe('use my_var_name here');
    expect(stripMarkdown('2 * 3 = 6')).toBe('2 * 3 = 6');
  });

  it('AC-7: flattens tables', () => {
    expect(stripMarkdown('| a | b |\n|---|---|\n| 1 | 2 |')).toBe('a b 1 2');
  });
});

describe('formatChatTime', () => {
  const now = new Date(2026, 10, 3, 18, 30).getTime();

  it('AC-7: shows the time when updated today, in the device locale', () => {
    const at = new Date(2026, 10, 3, 14, 5).getTime();
    expect(formatChatTime(at, now)).toBe(
      new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
    );
    expect(formatChatTime(at, now)).toMatch(/0?2:05|14:05/);
  });

  it('AC-7: shows the date when updated on another day, in the device locale', () => {
    const at = new Date(2026, 10, 2, 23, 59).getTime();
    const text = formatChatTime(at, now);
    expect(text).toBe(
      new Date(at).toLocaleDateString(undefined, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
    );
    expect(text).toContain('2026');
    expect(text).not.toMatch(/:/);
  });
});
