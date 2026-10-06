import { describe, expect, it } from 'vitest';
import { cellWidth, rtlRuns, shapeVisualRuns, startsRightToLeft } from './rtlText';

/** The text of each run, which reads better in a failing assertion than index pairs. */
function runTexts(text: string): string[] {
  return rtlRuns(text).map(([start, end]) => text.slice(start, end));
}

describe('rtlRuns', () => {
  it('finds nothing in text without right-to-left letters', () => {
    expect(rtlRuns('')).toEqual([]);
    expect(rtlRuns('git commit -m "fix"')).toEqual([]);
    expect(rtlRuns('Привет мир 123')).toEqual([]);
  });

  it('takes a Persian sentence as one run', () => {
    expect(rtlRuns('سلام دنیا')).toEqual([[0, 9]]);
  });

  it('keeps English words inside a Persian sentence in the same run', () => {
    expect(runTexts('سلام hello دنیا')).toEqual(['سلام hello دنیا']);
    expect(runTexts('من این فایل را با git commit ذخیره کنم.')).toEqual([
      'من این فایل را با git commit ذخیره کنم.',
    ]);
  });

  it('keeps an English sentence holding a Persian word left to right', () => {
    expect(runTexts('Hello سلام world')).toEqual(['Hello سلام world']);
    expect(runTexts('Please read سلام and reply')).toEqual(['Please read سلام and reply']);
  });

  it('starts a Persian sentence at its first Persian word when English comes before it', () => {
    // A prompt, a command or a label in front must not make the sentence left to right, or the
    // English words and numbers inside it land on the wrong side of the Persian ones.
    expect(runTexts('PS C:\\Users\\arc13> echo سلام hello دنیا')).toEqual(['سلام hello دنیا']);
    expect(runTexts('Note: سلام 123 دنیا')).toEqual(['سلام 123 دنیا']);
    expect(runTexts('echo فایل README.md را باز کن')).toEqual(['فایل README.md را باز کن']);
    expect(runTexts('Здравствуй سلام')).toEqual(['سلام']);
  });

  it('leaves a prompt or bullet in front of the text where it is', () => {
    expect(runTexts('> سلام دنیا')).toEqual(['سلام دنیا']);
    expect(runTexts('- کتاب')).toEqual(['کتاب']);
    expect(runTexts('$ echo سلام')).toEqual(['سلام']);
  });

  it('takes a leading number into the run, as in a numbered list', () => {
    expect(runTexts('1. سلام')).toEqual(['1. سلام']);
    expect(runTexts('۱. سلام')).toEqual(['۱. سلام']);
  });

  it('takes in an opening quote or bracket when the run closes it', () => {
    // A shell colors a quoted string apart from the command, so the string reaches the
    // joiner on its own, quotes and all.
    expect(runTexts('"سلام دنیا، من git commit را زدم"')).toEqual([
      '"سلام دنیا، من git commit را زدم"',
    ]);
    expect(runTexts('> «کتاب»')).toEqual(['«کتاب»']);
    expect(runTexts('Write-Output "من 3 فایل با git commit ذخیره کردم"')).toEqual([
      '"من 3 فایل با git commit ذخیره کردم"',
    ]);
    expect(runTexts("'سلام'")).toEqual(["'سلام'"]);
    expect(runTexts('(سلام)')).toEqual(['(سلام)']);
    // Nothing to pair with: the quote stays outside.
    expect(runTexts('"سلام')).toEqual(['سلام']);
    expect(runTexts('(سلام"')).toEqual(['سلام"']);
  });

  it('keeps closing punctuation but not trailing spaces', () => {
    expect(runTexts('آماده است!   ')).toEqual(['آماده است!']);
    expect(runTexts('چطوری؟')).toEqual(['چطوری؟']);
  });

  it('splits at box-drawing borders, tabs and wide gaps, the way TUIs lay out columns', () => {
    expect(runTexts('│ > سلام، نسخه 1.53 آماده است!         │')).toEqual([
      'سلام، نسخه 1.53 آماده است!',
    ]);
    expect(runTexts('نام    توضیح')).toEqual(['نام', 'توضیح']);
    expect(runTexts('name\tتوضیح')).toEqual(['توضیح']);
    expect(runTexts('README.md    راهنما')).toEqual(['راهنما']);
  });

  it('keeps the zero-width non-joiner and vowel marks inside the run', () => {
    expect(runTexts('می‌خواهم')).toEqual(['می‌خواهم']);
    expect(runTexts('سَلام')).toEqual(['سَلام']);
  });

  it('does not join a lone letter, which has nothing to shape against', () => {
    expect(rtlRuns('و')).toEqual([]);
    expect(rtlRuns('a و')).toEqual([]);
  });

  it('handles Hebrew and Arabic the same way', () => {
    expect(runTexts('שלום עולם')).toEqual(['שלום עולם']);
    expect(runTexts('مرحبا بالعالم')).toEqual(['مرحبا بالعالم']);
  });

  it('returns indexes into the text it was given', () => {
    const text = 'abc  سلام  def  دنیا';
    for (const [start, end] of rtlRuns(text)) {
      expect(start).toBeGreaterThanOrEqual(0);
      expect(end).toBeLessThanOrEqual(text.length);
      expect(start).toBeLessThan(end);
    }
    expect(runTexts(text)).toEqual(['سلام', 'دنیا']);
  });
});

describe('cellWidth', () => {
  it('gives each Persian or Latin letter one cell', () => {
    expect(cellWidth('سلام')).toBe(4);
    expect(cellWidth('hello')).toBe(5);
    expect(cellWidth('سلام hello دنیا')).toBe(15);
  });

  it('gives zero cells to marks that ride on the letter before them', () => {
    // Zero-width non-joiner, as in می‌خواهم.
    expect(cellWidth('می‌خواهم')).toBe(7);
    // Fatha.
    expect(cellWidth('سَلام')).toBe(4);
    // Zero-width joiner and the Arabic number sign.
    expect(cellWidth('a‍b؀')).toBe(2);
  });

  it('matches xterm for wide and astral characters', () => {
    expect(cellWidth('中文')).toBe(4);
    expect(cellWidth('한')).toBe(2);
    // xterm's default Unicode 6 tables draw emoji in a single cell.
    expect(cellWidth('سلام 😀')).toBe(6);
  });
});

describe('startsRightToLeft', () => {
  it('reads the direction from the first letter, as a browser picks a paragraph direction', () => {
    expect(startsRightToLeft('سلام hello')).toBe(true);
    expect(startsRightToLeft('Hello سلام')).toBe(false);
    expect(startsRightToLeft('שלום')).toBe(true);
  });

  it('looks past numbers and punctuation to the first letter', () => {
    expect(startsRightToLeft('1. سلام')).toBe(true);
    expect(startsRightToLeft('۱۲ - item')).toBe(false);
    expect(startsRightToLeft('123')).toBe(false);
  });
});

describe('shapeVisualRuns', () => {
  // What Claude Code writes to the terminal for each typed text: it reorders right-to-left
  // text itself, so the screen already holds it in display order (captured from v2.1.289).
  const RLI = String.fromCodePoint(0x2067);
  const PDI = String.fromCodePoint(0x2069);
  const isolated = (text: string): string => `${RLI}${text}${PDI}`;

  it('turns each right-to-left stretch back into reading order, isolated in place', () => {
    // Typed: سلام hello دنیا
    expect(shapeVisualRuns('ایند hello مالس')).toBe(
      `${isolated('دنیا')} hello ${isolated('سلام')}`,
    );
    // Typed: Hello سلام world
    expect(shapeVisualRuns('Hello مالس world')).toBe(`Hello ${isolated('سلام')} world`);
  });

  it('keeps numbers and English names where they are', () => {
    // Typed: نسخه 1.53 آماده است!
    expect(shapeVisualRuns('!تسا هدامآ 1.53 هخسن')).toBe(
      `!${isolated('آماده است')} 1.53 ${isolated('نسخه')}`,
    );
    // Typed: فایل README.md را بخوان
    expect(shapeVisualRuns('ناوخب ار README.md لیاف')).toBe(
      `${isolated('را بخوان')} README.md ${isolated('فایل')}`,
    );
    expect(shapeVisualRuns('ایند ۱۲۳ مالس')).toBe(`${isolated('دنیا')} ۱۲۳ ${isolated('سلام')}`);
  });

  it('keeps the zero-width non-joiner and vowel marks on their letter', () => {
    // Typed: می‌خواهم بروم
    expect(shapeVisualRuns('مورب مهاوخی‌م')).toBe(isolated('می‌خواهم بروم'));
    expect(shapeVisualRuns('مالسَ')).toBe(isolated('سَلام'));
  });

  it('carries Persian punctuation along with its words', () => {
    // Typed: سلام، hello world دنیا
    expect(shapeVisualRuns('ایند hello world ،مالس')).toBe(
      `${isolated('دنیا')} hello world ${isolated('سلام،')}`,
    );
  });

  it('leaves text without right-to-left letters untouched', () => {
    expect(shapeVisualRuns('git commit -m "fix"')).toBe('git commit -m "fix"');
  });
});
