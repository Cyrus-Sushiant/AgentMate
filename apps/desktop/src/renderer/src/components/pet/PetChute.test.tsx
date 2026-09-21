// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { chuteFitFor, petCharacter } from './characters';
import { PetChute } from './PetChute';

/**
 * The parachute has two looks: the flat pixel canopy that matches the built-in sprites, and the
 * shaded one for a pet someone uploaded as a 3D render. The switch in Settings picks between
 * them, so what matters here is that each look draws what it promises and that two chutes on
 * screen never share the ids their gradients and clip paths hang off.
 */

const fit = chuteFitFor(petCharacter('tide'));

function draw(props: { layer: 'back' | 'front'; depth?: boolean }): HTMLElement {
  const { container } = render(
    <PetChute box={120} spriteW={86} spriteH={110} fit={fit} {...props} />,
  );
  return container;
}

/** Every `id` the chute minted, so collisions between two of them are easy to spot. */
function ids(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[id]')].map((node) => node.id);
}

describe('PetChute', () => {
  it('draws the flat canopy when nothing asks for depth', () => {
    const container = draw({ layer: 'back' });

    expect(container.querySelector('.pet-chute')?.classList.contains('is-3d')).toBe(false);
    // Flat stripes are plain rects with a solid fill, and nothing is shaded.
    expect(container.querySelectorAll('rect').length).toBeGreaterThan(0);
    expect(container.querySelector('.pet-chute-dome-edge')).not.toBeNull();
    expect(container.querySelector('linearGradient')).toBeNull();
    expect(container.querySelector('.pet-chute-panel')).toBeNull();
  });

  it('draws shaded panels instead of flat stripes when depth is on', () => {
    const flat = draw({ layer: 'back' });
    const solid = draw({ layer: 'back', depth: true });

    expect(solid.querySelector('.pet-chute')?.classList.contains('is-3d')).toBe(true);
    const panels = [...solid.querySelectorAll('.pet-chute-panel')];
    // Same canopy, same number of gores: depth changes how it is lit, not its design.
    expect(panels).toHaveLength(flat.querySelectorAll('.pet-chute-dome rect').length);
    expect(panels.map((panel) => panel.getAttribute('fill'))).toEqual(
      [...flat.querySelectorAll('.pet-chute-dome rect')].map((rect) => rect.getAttribute('fill')),
    );
    expect(solid.querySelector('.pet-chute-dome-rim')).not.toBeNull();
  });

  it('hangs every panel off the same apex so the canopy closes at the top', () => {
    const container = draw({ layer: 'back', depth: true });

    const apexes = [...container.querySelectorAll('.pet-chute-panel')].map(
      (panel) => (panel.getAttribute('d') ?? '').split(' Q ')[0],
    );

    expect(apexes.length).toBeGreaterThan(1);
    expect(new Set(apexes).size).toBe(1);
  });

  it('shades the canopy and the risers from its own gradients', () => {
    const container = draw({ layer: 'back', depth: true });

    const gradients = [...container.querySelectorAll('linearGradient')].map((node) => node.id);
    expect(gradients).toHaveLength(3);

    // A fill or stroke pointing at a gradient that was never defined paints nothing at all.
    const refs = [...container.querySelectorAll('[fill^="url"], [stroke^="url"]')].map((node) =>
      (node.getAttribute('fill') ?? node.getAttribute('stroke') ?? '').slice(5, -1),
    );
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) expect(gradients).toContain(ref);

    const risers = [...container.querySelectorAll('.pet-chute-riser-lit')];
    expect(risers).toHaveLength(4);
    for (const riser of risers) expect(riser.getAttribute('stroke')).toMatch(/^url\(#/);
  });

  it('lights the harness on the front layer too', () => {
    const container = draw({ layer: 'front', depth: true });

    expect(container.querySelector('.pet-chute-strap-lit')?.getAttribute('stroke')).toMatch(
      /^url\(#/,
    );
    const clips = [...container.querySelectorAll('.pet-chute-clip-lit')];
    expect(clips).toHaveLength(2);
    for (const clip of clips) expect(clip.getAttribute('fill')).toMatch(/^url\(#/);
    // The flat ink outline would sit on top of the shading and flatten it again.
    expect(container.querySelector('.pet-chute-strap')).toBeNull();
  });

  it('keeps its gradient and clip ids to itself', () => {
    const { container } = render(
      <>
        <PetChute box={120} spriteW={86} spriteH={110} fit={fit} layer="back" depth />
        <PetChute box={120} spriteW={86} spriteH={110} fit={fit} layer="back" depth />
      </>,
    );

    const all = ids(container);
    expect(all.length).toBeGreaterThan(1);
    expect(new Set(all).size).toBe(all.length);
  });
});
