import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mirrorsSprite } from './flock';

describe('mirrorsSprite', () => {
  it('mirrors a normal sprite only while it walks left', () => {
    expect(mirrorsSprite('right', false)).toBe(false);
    expect(mirrorsSprite('left', false)).toBe(true);
  });

  it('runs the other way for a flipped character, so it still faces where it walks', () => {
    expect(mirrorsSprite('right', true)).toBe(true);
    expect(mirrorsSprite('left', true)).toBe(false);
  });
});

/** Pulls out one CSS rule's body, so the test does not depend on the rest of the file. */
function ruleBody(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `${selector} is missing`).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf('}', start));
}

function lastFrame(css: string, name: string): string {
  const start = css.indexOf(`@keyframes ${name} {`);
  expect(start, `@keyframes ${name} is missing`).toBeGreaterThanOrEqual(0);
  const block = css.slice(start, css.indexOf('\n}', start));
  return block.slice(block.lastIndexOf('100%'));
}

describe('pet turn animation', () => {
  const css = readFileSync(resolve(__dirname, '../../index.css'), 'utf-8').replace(/\r\n/g, '\n');

  // The turn has to end on the pose the pet holds once it stops turning,
  // otherwise it spins the wrong way and snaps around at the end.
  it('ends a turn to the left mirrored, like the resting left pose', () => {
    const name = ruleBody(css, '.desktop-pet-body.is-left.is-turning').match(
      /animation-name:\s*([\w-]+)/,
    )?.[1];
    expect(ruleBody(css, '.desktop-pet-body.is-left:not(.is-turning)')).toContain(
      'transform: scaleX(-1)',
    );
    expect(lastFrame(css, name ?? '')).toContain('scaleX(-1)');
  });

  it('ends a turn to the right unmirrored', () => {
    const name = ruleBody(css, '.desktop-pet-body.is-turning').match(/animation:\s*([\w-]+)/)?.[1];
    expect(lastFrame(css, name ?? '')).toContain('scaleX(1)');
  });
});
