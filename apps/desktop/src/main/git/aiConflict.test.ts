import { describe, expect, it } from 'vitest';
import { buildConflictResolutionPrompt, hasConflictMarkers, resolutionSummary } from './aiConflict';

describe('hasConflictMarkers', () => {
  it('finds a conflict block, with or without labels and CRLF endings', () => {
    expect(hasConflictMarkers('a\n<<<<<<< HEAD\nb\n=======\nc\n>>>>>>> feature\n')).toBe(true);
    expect(hasConflictMarkers('a\r\n<<<<<<<\r\nb\r\n=======\r\nc\r\n>>>>>>>\r\n')).toBe(true);
    expect(hasConflictMarkers('left over end\n>>>>>>> main\n')).toBe(true);
  });

  it('ignores lookalikes that are not markers', () => {
    // A Markdown heading underline is not a conflict.
    expect(hasConflictMarkers('Title\n=======\n\nBody\n')).toBe(false);
    expect(hasConflictMarkers('const shift = a <<<<<<< b;\n')).toBe(false);
    expect(hasConflictMarkers('<<<<<<<<< eight of them\n')).toBe(false);
    expect(hasConflictMarkers('')).toBe(false);
  });
});

describe('buildConflictResolutionPrompt', () => {
  it('names the file and keeps the agent off git', () => {
    const prompt = buildConflictResolutionPrompt('src/app.ts', 'merge', 'UU');
    expect(prompt).toContain('"src/app.ts"');
    expect(prompt).toContain('both modified');
    expect(prompt).toContain('Edit only this file');
    expect(prompt).toContain('Do not run git add');
  });

  it("puts git's conflict code into words, and leaves out one it doesn't know", () => {
    expect(buildConflictResolutionPrompt('a.ts', 'merge', 'UD')).toContain('"deleted by them"');
    const unknown = buildConflictResolutionPrompt('a.ts', 'merge', 'XY');
    expect(unknown).not.toContain('Git reports');
    expect(unknown).not.toContain('XY');
  });

  it('explains that a rebase flips which side HEAD is', () => {
    expect(buildConflictResolutionPrompt('a.ts', 'rebase')).toContain('being rebased onto');
  });

  it('stays well inside the Windows command line budget', () => {
    expect(buildConflictResolutionPrompt('a/b/c.ts', 'rebase', 'AA').length).toBeLessThan(2000);
  });
});

describe('resolutionSummary', () => {
  it('takes the closing line and caps its length', () => {
    expect(resolutionSummary('Reading the file\n\nKept both imports.\n')).toBe(
      'Kept both imports.',
    );
    expect(resolutionSummary('x'.repeat(500))?.length).toBe(240);
    expect(resolutionSummary('   ')).toBeUndefined();
  });
});
