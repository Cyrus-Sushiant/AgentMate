import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Server } from '@/components/icons';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CATALOG_SIDEBAR_WIDTH, useCatalogLayoutStore } from '@/stores/catalogLayoutStore';
import {
  CatalogSplit,
  Chip,
  CountChip,
  EmptyState,
  FilterChip,
  MetricTile,
  PillTabs,
  SearchPill,
  SideNavRow,
} from './index';

function ControlledSearch({ initial = '' }: { initial?: string }): React.JSX.Element {
  const [value, setValue] = useState(initial);
  return <SearchPill label="Search things" value={value} onValueChange={setValue} />;
}

function ControlledFilter(): React.JSX.Element {
  const [value, setValue] = useState('');
  return (
    <SearchPill
      type="search"
      label="Filter tools"
      clearLabel="Clear filter"
      value={value}
      onValueChange={setValue}
    />
  );
}

describe('SearchPill as a list filter', () => {
  it('is a searchbox whose clear button carries the filter wording', () => {
    render(<ControlledFilter />);
    const filter = screen.getByRole('searchbox', { name: 'Filter tools' });

    fireEvent.change(filter, { target: { value: 'semgrep' } });
    fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }));

    expect(filter).toHaveValue('');
  });
});

describe('Chip', () => {
  it('passes HTML attributes through and draws a dot only when asked', () => {
    const { container, rerender } = render(
      <Chip tone="success" aria-label="State: running">
        Running
      </Chip>,
    );
    expect(screen.getByLabelText('State: running')).toHaveTextContent('Running');
    expect(container.querySelector('[aria-hidden]')).toBeNull();

    rerender(
      <Chip tone="success" dot pulse>
        Running
      </Chip>,
    );
    expect(container.querySelector('[aria-hidden] [class*="animate-ping"]')).not.toBeNull();
  });
});

describe('EmptyState', () => {
  it('shows its title, a block description and the action', () => {
    render(
      <EmptyState
        icon={Server}
        title="No servers yet"
        description={
          <>
            Add one in <button type="button">Remote</button>.
          </>
        }
        action={<button type="button">Add server</button>}
      />,
    );
    expect(screen.getByText('No servers yet')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remote' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add server' })).toBeTruthy();
  });

  it('draws its own glass card only when asked', () => {
    const { container, rerender } = render(<EmptyState icon={Server} title="Empty" />);
    expect(container.firstElementChild?.classList.contains('glass')).toBe(false);

    rerender(<EmptyState card icon={Server} title="Empty" />);
    expect(container.firstElementChild?.classList.contains('glass')).toBe(true);
  });
});

describe('MetricTile', () => {
  it('names the tile by its label and offers remove only in edit mode', () => {
    const onRemove = vi.fn();
    const { rerender } = render(<MetricTile icon={null} label="Load" value="0.42" />);
    expect(screen.getByText('Load')).toBeTruthy();
    expect(screen.getByText('0.42')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();

    rerender(
      <TooltipProvider>
        <MetricTile icon={null} label="Load" value="0.42" onRemove={onRemove} />
      </TooltipProvider>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

describe('SearchPill', () => {
  it('offers a clear button only once something is typed, and it empties the box', () => {
    render(<ControlledSearch />);
    const input = screen.getByLabelText('Search things');
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();

    fireEvent.change(input, { target: { value: 'nginx' } });
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(input).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
  });

  it('clears on Escape without letting the key reach a dialog around it', () => {
    const outer = vi.fn();
    render(
      <div onKeyDown={outer}>
        <ControlledSearch initial="postgres" />
      </div>,
    );
    const input = screen.getByLabelText('Search things');

    fireEvent.keyDown(input, { key: 'Escape' });

    expect(input).toHaveValue('');
    expect(outer).not.toHaveBeenCalled();
  });

  it('lets Escape through when there is nothing to clear', () => {
    const outer = vi.fn();
    render(
      <div onKeyDown={outer}>
        <ControlledSearch />
      </div>,
    );

    fireEvent.keyDown(screen.getByLabelText('Search things'), { key: 'Escape' });

    expect(outer).toHaveBeenCalled();
  });
});

function Views({ kind }: { kind?: 'nav' | 'toggle' }): React.JSX.Element {
  const [value, setValue] = useState<'all' | 'running'>('all');
  return (
    <PillTabs
      id="test-views"
      label="Views"
      kind={kind}
      items={[
        { value: 'all', label: 'All' },
        { value: 'running', label: 'Running', count: 3 },
      ]}
      value={value}
      onChange={setValue}
    />
  );
}

describe('PillTabs', () => {
  it('is a navigation landmark whose current view moves with a click', () => {
    render(<Views />);
    expect(screen.getByRole('navigation', { name: 'Views' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-current', 'true');

    fireEvent.click(screen.getByRole('button', { name: /^Running/ }));

    expect(screen.getByRole('button', { name: /^Running/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByRole('button', { name: 'All' })).not.toHaveAttribute('aria-current');
    // A count shows next to its label.
    expect(screen.getByRole('button', { name: /^Running/ })).toHaveTextContent('3');
  });

  it('as a toggle group, marks the chosen option as pressed instead', () => {
    render(<Views kind="toggle" />);
    expect(screen.getByRole('group', { name: 'Views' })).toBeTruthy();
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: /^Running/ }));

    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /^Running/ })).not.toHaveAttribute('aria-current');
  });
});

describe('PillTabs counts', () => {
  it('hides a zero count and tints one that needs attention', () => {
    render(
      <PillTabs
        id="test-counts"
        label="Prompt views"
        items={[
          { value: 'drafts', label: 'Drafts', count: 0 },
          { value: 'scheduled', label: 'Scheduled', count: 2, countTone: 'destructive' },
        ]}
        value="drafts"
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Drafts' })).toHaveTextContent(/^Drafts$/);
    const count = screen.getByText('2');
    expect(count.className).toContain('text-destructive');
  });
});

describe('FilterChip', () => {
  it('reports whether it is on', () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <FilterChip active={false} onClick={onClick}>
        Official
      </FilterChip>,
    );
    const chip = screen.getByRole('button', { name: 'Official' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(chip);
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <FilterChip active onClick={onClick}>
        Official
      </FilterChip>,
    );
    expect(chip).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('SideNavRow', () => {
  it('marks the active row as current and selects on click', () => {
    const onSelect = vi.fn();
    render(
      <>
        <SideNavRow group="t" active label="All repositories" count={2} onSelect={vi.fn()} />
        <SideNavRow group="t" active={false} label="Community" onSelect={onSelect} />
      </>,
    );
    expect(screen.getByRole('button', { name: /^All repositories/ })).toHaveAttribute(
      'aria-current',
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Community' }));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});

describe('CountChip', () => {
  it('shows its label and number as its only text, and shimmers while loading', () => {
    const { rerender, container } = render(<CountChip label="Running" value={4} />);
    expect(container.textContent).toBe('Running4');

    rerender(<CountChip label="Running" value={4} loading />);
    expect(container.textContent).toBe('Running');
    expect(container.querySelector('.shimmer')).not.toBeNull();
  });
});

describe('CatalogSplit', () => {
  beforeEach(() => {
    act(() => useCatalogLayoutStore.setState({ widths: {} }));
  });

  it('starts at the default width and remembers a resize per sidebar', () => {
    render(
      <CatalogSplit
        sidebar="mcpRepositories"
        sidebarLabel="Repositories"
        resizeLabel="Resize repositories"
        aside={<p>list</p>}
      >
        <p>detail</p>
      </CatalogSplit>,
    );
    const aside = screen.getByRole('complementary', { name: 'Repositories' });
    expect(aside.style.width).toBe(`${CATALOG_SIDEBAR_WIDTH.default}px`);

    fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize repositories' }), {
      key: 'ArrowRight',
    });

    const saved = useCatalogLayoutStore.getState().widths;
    expect(saved.mcpRepositories).toBe(CATALOG_SIDEBAR_WIDTH.default + 16);
    expect(saved.skillRepositories).toBeUndefined();
    expect(aside.style.width).toBe(`${CATALOG_SIDEBAR_WIDTH.default + 16}px`);
  });
});
