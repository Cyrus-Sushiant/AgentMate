import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import * as solid from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { fireEvent, render } from '@testing-library/react';
import { createRef, type ForwardRefExoticComponent, type RefAttributes } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import * as icons from './icons';

/**
 * The icons draw their SVG once per class name instead of going through FontAwesomeIcon on every
 * render. What ends up on the page has to stay exactly what FontAwesomeIcon draws: styles and
 * tests find icons by its classes and `data-icon`.
 */

type Icon = ForwardRefExoticComponent<icons.IconProps>;

const definitions = new Map<string, IconDefinition>(
  Object.values(solid)
    .filter((value): value is IconDefinition => typeof value === 'object' && 'iconName' in value)
    .map((definition) => [definition.iconName, definition]),
);

/** Every export made from a Font Awesome icon, with the definition it was made from. */
const fontAwesomeIcons = Object.entries(icons).flatMap(([name, value]) => {
  const match = /^Icon\((.+)\)$/.exec((value as { displayName?: string }).displayName ?? '');
  const definition = match ? definitions.get(match[1]) : undefined;
  return definition ? [{ name, Icon: value as Icon, definition }] : [];
});

describe('icons', () => {
  it('finds the Font Awesome icons to compare', () => {
    expect(fontAwesomeIcons.length).toBeGreaterThan(100);
  });

  it.each(['', 'h-3 w-3', 'h-2 w-2 transition-transform rotate-90'])(
    'draws the same markup as FontAwesomeIcon with className "%s"',
    (className) => {
      for (const { name, Icon, definition } of fontAwesomeIcons) {
        const ours = renderToStaticMarkup(<Icon className={className || undefined} />);
        const theirs = renderToStaticMarkup(
          <FontAwesomeIcon icon={definition} className={className || undefined} />,
        );
        expect(ours, name).toBe(theirs);
      }
    },
  );

  it('keeps each class name apart when an icon is drawn with several', () => {
    const { container } = render(
      <>
        <icons.ChevronRight className="h-2 w-2" />
        <icons.ChevronRight className="h-2 w-2 rotate-90" />
        <icons.ChevronRight className="h-2 w-2" />
      </>,
    );
    const classes = Array.from(container.querySelectorAll('svg')).map((svg) =>
      svg.getAttribute('class'),
    );
    expect(classes[0]).toBe(classes[2]);
    expect(classes[1]).toContain('rotate-90');
    expect(classes[0]).not.toContain('rotate-90');
  });

  it('forwards a ref and a click handler', () => {
    // The declared type leaves the ref out, but forwardRef passes one through all the same.
    const Copy = icons.Copy as ForwardRefExoticComponent<
      icons.IconProps & RefAttributes<SVGSVGElement>
    >;
    const ref = createRef<SVGSVGElement>();
    const onClick = vi.fn();
    render(<Copy ref={ref} className="h-3 w-3" onClick={onClick} />);
    expect(ref.current?.tagName.toLowerCase()).toBe('svg');
    expect(ref.current?.getAttribute('data-icon')).toBe('copy');
    fireEvent.click(ref.current as SVGSVGElement);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
