// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SourceSection } from './SourceSection';

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
