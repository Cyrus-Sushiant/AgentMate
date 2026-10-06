import type { DeployServer } from '@shared/deployTypes';
import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../test/renderer/renderWithProviders';
import { ServerRail } from './ServerRail';
import { wpSite } from './wordpress/testing/fixtures';

/**
 * The rail lists the servers and, under them, the WordPress sites: each site with its address,
 * when it was last reached and the two badges that change what can be done with it.
 */

const SERVER: DeployServer = {
  id: 'srv-1',
  nickname: 'Production',
  host: 'prod.example',
  port: 22,
  username: 'deployer',
  core: null,
  enrolled: false,
};

function renderRail(props: Partial<Parameters<typeof ServerRail>[0]> = {}) {
  const onSelect = vi.fn();
  const onSelectSite = vi.fn();
  const onConnectSite = vi.fn();
  const view = renderWithProviders(
    <ServerRail
      servers={[SERVER]}
      selectedId="srv-1"
      onSelect={onSelect}
      sites={[]}
      onSelectSite={onSelectSite}
      onConnectSite={onConnectSite}
      {...props}
    />,
  );
  return { ...view, onSelect, onSelectSite, onConnectSite };
}

describe('ServerRail WordPress sites', () => {
  it('lists each site with its host, last contact and badges', () => {
    renderRail({
      sites: [
        wpSite(),
        wpSite({
          id: 'site-2',
          label: 'Staging',
          siteUrl: 'http://staging.bakery.example/blog/',
          scope: 'read',
          transport: 'plain-http',
          lastSeenAt: null,
        }),
      ],
    });

    const list = screen.getByRole('list', { name: 'WordPress sites' });
    const [first, second] = within(list).getAllByRole('button');
    expect(within(first).getByText('Bakery')).toBeTruthy();
    expect(within(first).getByText('bakery.example')).toBeTruthy();
    expect(within(first).getByText('Seen 5m ago')).toBeTruthy();
    expect(within(first).queryByText('Read-only')).toBeNull();
    expect(within(first).queryByText('Plain HTTP')).toBeNull();

    expect(within(second).getByText('staging.bakery.example/blog')).toBeTruthy();
    expect(within(second).getByText('Not reached yet')).toBeTruthy();
    expect(within(second).getByText('Read-only')).toBeTruthy();
    expect(within(second).getByText('Plain HTTP')).toBeTruthy();
  });

  it('selects a site and marks the selected one', async () => {
    const { user, onSelectSite } = renderRail({
      sites: [wpSite()],
      selectedId: null,
      selectedSiteId: wpSite().id,
    });

    const button = within(screen.getByRole('list', { name: 'WordPress sites' })).getByRole(
      'button',
    );
    expect(button.getAttribute('aria-current')).toBe('true');
    await user.click(button);
    expect(onSelectSite).toHaveBeenCalledWith(wpSite().id);
  });

  it('offers to connect a site', async () => {
    const { user, onConnectSite } = renderRail();

    await user.click(screen.getByRole('button', { name: /Connect a WordPress site/ }));
    expect(onConnectSite).toHaveBeenCalled();
  });

  it('shimmers in the sites group while the sites load', () => {
    const { container } = renderRail({ sites: undefined, sitesLoading: true });

    expect(container.querySelector('[aria-busy="true"] .shimmer')).not.toBeNull();
    expect(screen.getByText('Production')).toBeTruthy();
  });

  it('says why the sites did not load and offers to try again', async () => {
    const onRetrySites = vi.fn();
    const { user } = renderRail({ sitesError: 'disk is gone', onRetrySites });

    expect(screen.getByRole('alert').textContent).toContain('disk is gone');
    await user.click(screen.getByRole('button', { name: /Try again/ }));
    expect(onRetrySites).toHaveBeenCalled();
  });

  it('says so when there are only sites', () => {
    renderRail({ servers: [], selectedId: null, sites: [wpSite()] });

    expect(screen.getByText('No servers yet.')).toBeTruthy();
    expect(screen.getByRole('list', { name: 'WordPress sites' })).toBeTruthy();
  });

  it('shows no sites group when the page passes none', () => {
    renderWithProviders(<ServerRail servers={[SERVER]} selectedId="srv-1" onSelect={vi.fn()} />);

    expect(screen.queryByText('WordPress sites')).toBeNull();
  });
});
