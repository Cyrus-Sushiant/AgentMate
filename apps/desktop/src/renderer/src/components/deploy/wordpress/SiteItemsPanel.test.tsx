import type { WpItemRef } from '@agentmat/core';
import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../../test/renderer/renderWithProviders';
import { SiteItemsPanel } from './SiteItemsPanel';
import { wpItem, wpProject, wpSite, wpSiteInfo } from './testing/fixtures';

/**
 * The site's themes and plugins with the projects that hold them, and the way into a pull or a
 * reviewed deploy. Deploy stays off, with the reason on hover, for a read-only key or a site with
 * file changes switched off.
 */

interface FlowProps {
  open: boolean;
  projectId: string;
  siteId: string;
  items?: WpItemRef[];
}

// The flow dialogs belong to the Projects workstream; here only how they are opened matters.
vi.mock('@/components/wordpress/DeployFlowDialog', () => ({
  DeployFlowDialog: (props: FlowProps) =>
    props.open ? <div data-testid="deploy-flow">{JSON.stringify(props)}</div> : null,
}));
vi.mock('@/components/wordpress/PullFlowDialog', () => ({
  PullFlowDialog: (props: FlowProps) =>
    props.open ? <div data-testid="pull-flow">{JSON.stringify(props)}</div> : null,
}));

const ITEMS = [
  wpItem(),
  wpItem({ kind: 'theme', slug: 'crumb', name: 'Crumb', active: false, parentTheme: undefined }),
  wpItem({ kind: 'plugin', slug: 'oven', name: 'Oven <b>Tools</b>', active: true }),
  wpItem({
    kind: 'plugin',
    slug: 'agentmate-connector',
    name: 'AgentMate Connector',
    protected: true,
    writable: false,
  }),
  wpItem({ kind: 'mu-plugin', slug: 'cache.php', name: 'cache.php', isFile: true, active: true }),
];

function renderPanel(bridge: Record<string, unknown> = {}, site = wpSite()) {
  return renderWithProviders(<SiteItemsPanel site={site} />, {
    bridge: {
      'deployWordPress.listItems': async () => ITEMS,
      'deployWordPress.siteInfo': async () => wpSiteInfo(),
      'projects.list': async () => [
        wpProject(),
        wpProject({ id: 'proj-2', name: 'Unrelated', wordpress: undefined }),
      ],
      ...bridge,
    },
  });
}

describe('SiteItemsPanel', () => {
  it('shimmers in each group while the items load', () => {
    const { container } = renderPanel({
      'deployWordPress.listItems': () => new Promise(() => undefined),
    });

    expect(container.querySelectorAll('[aria-busy="true"] .shimmer').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[aria-busy="true"]').length).toBe(3);
  });

  it('groups items by kind with active state, version and linked projects', async () => {
    renderPanel();

    const themes = await screen.findByRole('list', { name: 'Themes' });
    expect(within(themes).getByText('Crumb Child')).toBeTruthy();
    expect(within(themes).getAllByText('Active')).toHaveLength(1);
    expect(within(themes).getAllByText(/version 1\.2\.0/).length).toBeGreaterThan(0);
    expect(within(themes).getByRole('list', { name: 'Projects with Crumb Child' })).toBeTruthy();
    expect(within(themes).getByText('Bakery theme')).toBeTruthy();
    expect(within(themes).queryByText('Unrelated')).toBeNull();
    expect(within(themes).getAllByText('Not in a project yet.')).toHaveLength(1);

    // Site strings are text, never markup.
    const plugins = screen.getByRole('list', { name: 'Plugins' });
    expect(within(plugins).getByText('Oven <b>Tools</b>')).toBeTruthy();
    expect(within(plugins).getByText(/the AgentMate Connector itself/)).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Must-use plugins' })).toBeTruthy();
  });

  it('opens the deploy review for the linked project and that item', async () => {
    const { user } = renderPanel();

    await user.click(
      await screen.findByRole('button', {
        name: 'Review and deploy Crumb Child from Bakery theme',
      }),
    );

    const flow = JSON.parse(screen.getByTestId('deploy-flow').textContent ?? '{}') as FlowProps;
    expect(flow).toMatchObject({
      open: true,
      projectId: 'proj-1',
      siteId: wpSite().id,
      items: [{ kind: 'theme', slug: 'crumb-child' }],
    });
  });

  it('opens the pull for the linked project and that item', async () => {
    const { user } = renderPanel();

    await user.click(
      await screen.findByRole('button', { name: 'Pull Crumb Child into Bakery theme' }),
    );

    const flow = JSON.parse(screen.getByTestId('pull-flow').textContent ?? '{}') as FlowProps;
    expect(flow).toMatchObject({
      projectId: 'proj-1',
      items: [{ kind: 'theme', slug: 'crumb-child' }],
    });
  });

  it('keeps deploy off for a read-only key, says why, and still allows a pull', async () => {
    const { user } = renderPanel({}, wpSite({ scope: 'read' }));

    const deploy = (await screen.findByRole('button', {
      name: 'Review and deploy Crumb Child from Bakery theme',
    })) as HTMLButtonElement;
    expect(deploy.disabled).toBe(true);
    expect(
      screen.getAllByText('Read-only key. You can pull files from this site but not deploy to it.')
        .length,
    ).toBeGreaterThan(0);
    await user.hover(deploy.parentElement as HTMLElement);
    expect(
      await screen.findByRole('tooltip', {
        name: 'Read-only key. You can pull files from this site but not deploy to it.',
      }),
    ).toBeTruthy();
    const pull = screen.getByRole('button', { name: 'Pull Crumb Child into Bakery theme' });
    expect((pull as HTMLButtonElement).disabled).toBe(false);
  });

  it('keeps deploy off when the site switched file changes off', async () => {
    renderPanel({ 'deployWordPress.siteInfo': async () => wpSiteInfo({ fileModsDisabled: true }) });

    const deploy = (await screen.findByRole('button', {
      name: 'Review and deploy Crumb Child from Bakery theme',
    })) as HTMLButtonElement;
    await screen.findAllByText(/DISALLOW_FILE_MODS is set/);
    expect(deploy.disabled).toBe(true);
  });

  it('says why the items did not load', async () => {
    renderPanel({
      'deployWordPress.listItems': async () => {
        throw new Error('[wp:timeout] slow');
      },
    });

    expect(await screen.findByText(/took too long to answer/)).toBeTruthy();
  });
});
