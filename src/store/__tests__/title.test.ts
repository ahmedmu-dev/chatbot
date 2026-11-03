import { makeAutoTitle, normalizeTitle } from '../title';

describe('makeAutoTitle', () => {
  it('AC-13: keeps a short prompt as is, with whitespace collapsed and trimmed', () => {
    expect(makeAutoTitle('  hello \n\n  world\t ')).toBe('hello world');
  });

  it('AC-13: a prompt of exactly 40 characters gets no ellipsis', () => {
    const text = 'a'.repeat(40);
    expect(makeAutoTitle(text)).toBe(text);
  });

  it('AC-13: cuts at the last word boundary within 40 characters and adds an ellipsis', () => {
    // The 40-character head ends in the middle of 'whyyyyy'.
    expect(makeAutoTitle('What is the capital of France and whyyyyy is it')).toBe(
      'What is the capital of France and…',
    );
  });

  it('AC-13: when the 40th character ends a word the whole word is kept', () => {
    const text = `${'a'.repeat(19)} ${'b'.repeat(20)} tail`; // first 40 chars end exactly at a space
    expect(makeAutoTitle(text)).toBe(`${'a'.repeat(19)} ${'b'.repeat(20)}…`);
  });

  it('AC-13: a single word longer than 40 is cut at 40 plus an ellipsis', () => {
    expect(makeAutoTitle('x'.repeat(55))).toBe(`${'x'.repeat(40)}…`);
  });

  it('AC-13: does not split an emoji in half', () => {
    const title = makeAutoTitle('😀'.repeat(45));
    expect(title).toBe(`${'😀'.repeat(40)}…`);
  });
});

describe('normalizeTitle', () => {
  it('AC-16: trims, rejects empty and caps at 60 characters', () => {
    expect(normalizeTitle('  My chat  ')).toBe('My chat');
    expect(normalizeTitle('   ')).toBeNull();
    expect(normalizeTitle('z'.repeat(80))).toBe('z'.repeat(60));
  });
});
