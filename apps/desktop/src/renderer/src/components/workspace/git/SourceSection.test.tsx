// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SourceSection, SourceSectionSplitter } from './SourceSection';

/**
 * A folding section of the Source control tab. A folded one must not render its body at all,
 * since the body is what fetches (commits, pipelines, the pull request).
 */

afterEach(cleanup);

function Body(): React.JSX.Element {
  return <p>section body</p>;
}

describe('SourceSection', () => {
  it('leaves the body out while folded, and says so to assistive tech', () => {
    render(
      <SourceSection id="commits" title="Commits" open={false} onToggle={vi.fn()}>
        <Body />
      </SourceSection>,
    );
    expect(screen.queryByText('section body')).toBeNull();
    expect(screen.getByRole('button', { name: /Commits/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('shows the body and its buttons while open', () => {
    render(
      <SourceSection
        id="branches"
        title="Branches"
        open
        onToggle={vi.fn()}
        actions={<button type="button">New branch</button>}
      >
        <Body />
      </SourceSection>,
    );
    expect(screen.getByText('section body')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New branch' })).toBeInTheDocument();
  });

  it('keeps its buttons out of the header while folded', () => {
    render(
      <SourceSection
        id="branches"
        title="Branches"
        open={false}
        onToggle={vi.fn()}
        actions={<button type="button">New branch</button>}
      >
        <Body />
      </SourceSection>,
    );
    expect(screen.queryByRole('button', { name: 'New branch' })).toBeNull();
  });

  it('toggles from the header', () => {
    const onToggle = vi.fn();
    render(
      <SourceSection id="changes" title="Changes" open onToggle={onToggle}>
        <Body />
      </SourceSection>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Changes/ }));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('shows a count, capped, with what it means', () => {
    render(
      <SourceSection
        id="changes"
        title="Changes"
        open={false}
        onToggle={vi.fn()}
        count={140}
        countLabel="140 changed files"
      >
        <Body />
      </SourceSection>,
    );
    expect(screen.getByLabelText('140 changed files')).toHaveTextContent('99+');
  });

  it('shows no count for zero', () => {
    render(
      <SourceSection id="commits" title="Commits" open={false} onToggle={vi.fn()} count={0}>
        <Body />
      </SourceSection>,
    );
    expect(screen.getByRole('button', { name: /Commits/ })).toHaveTextContent(/^Commits$/);
  });
});

describe('SourceSectionSplitter', () => {
  function Sections({
    onResize,
    onReset = vi.fn(),
  }: {
    onResize: (upper: number, lower: number) => void;
    onReset?: () => void;
  }): React.JSX.Element {
    const ref = useRef<HTMLDivElement>(null);
    return (
      <div ref={ref}>
        <SourceSection id="changes" title="Changes" open onToggle={vi.fn()} primary>
          <Body />
        </SourceSection>
        <SourceSection
          id="branches"
          title="Branches"
          open
          onToggle={vi.fn()}
          splitter={
            <SourceSectionSplitter
              containerRef={ref}
              upper="changes"
              lower="branches"
              onResize={onResize}
              onReset={onReset}
            />
          }
        >
          <Body />
        </SourceSection>
      </div>
    );
  }

  function stubHeights(heights: Record<string, number>): void {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      return { height: heights[this.dataset.sourceSection ?? ''] ?? 0 } as DOMRect;
    });
  }

  afterEach(() => vi.restoreAllMocks());

  it('moves height between the sections around it with the arrow keys', () => {
    stubHeights({ changes: 300, branches: 200 });
    const onResize = vi.fn();
    render(<Sections onResize={onResize} />);
    fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize sections' }), {
      key: 'ArrowDown',
    });
    expect(onResize).toHaveBeenCalledWith(316, 184);
  });

  it('never squeezes a section below its minimum', () => {
    stubHeights({ changes: 300, branches: 120 });
    const onResize = vi.fn();
    render(<Sections onResize={onResize} />);
    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowDown' });
    expect(onResize).toHaveBeenCalledWith(308, 112);
  });

  it('lets the sections size themselves again on a double click', () => {
    const onReset = vi.fn();
    render(<Sections onResize={vi.fn()} onReset={onReset} />);
    fireEvent.doubleClick(screen.getByRole('separator'));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it('applies a dragged height to a section that is not the primary one', () => {
    render(
      <SourceSection id="commits" title="Commits" open onToggle={vi.fn()} height={180}>
        <Body />
      </SourceSection>,
    );
    expect(screen.getByRole('region', { name: 'Commits' })).toHaveStyle({ flexBasis: '180px' });
  });
});
