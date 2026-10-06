import type { Project } from '@agentmat/core';
import { act, screen, waitFor, within } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../../../../test/renderer/renderWithProviders';
import { FOLDER_NOTE, NewWordPressProjectDialog } from './NewWordPressProjectDialog';
import { deferred, SITE_ITEMS, wpProject, wpSite } from './testing/fixtures';

/**
 * Making a project from a WordPress site, step by step: the site, its themes and plugins, the
 * name and folder, the pull, and opening the result.
 */

function Harness(): React.JSX.Element {
  const location = useLocation();
  return (
    <>
      <span data-testid="location">{location.pathname}</span>
      <NewWordPressProjectDialog open onOpenChange={() => undefined} />
    </>
  );
}

function renderDialog(bridge: Record<string, unknown> = {}) {
  return renderWithProviders(<Harness />, {
    route: '/projects',
    bridge: {
      'deployWordPress.listSites': [
        wpSite(),
        wpSite({ id: 'site-2', label: 'Blog', siteUrl: 'https://blog.example.com' }),
      ],
      'deployWordPress.listItems': SITE_ITEMS,
      'settings.get': { projectsRootPath: 'D:\\Sites' },
      ...bridge,
    },
  });
}

async function toItems(user: ReturnType<typeof renderDialog>['user']): Promise<void> {
  await user.click(await screen.findByRole('button', { name: /Acme Shop/ }));
  await user.click(screen.getByRole('button', { name: /Next/ }));
  await screen.findByText('Storefront');
}

async function toDetails(user: ReturnType<typeof renderDialog>['user']): Promise<void> {
  await toItems(user);
  await user.click(screen.getByRole('button', { name: /Next/ }));
  await screen.findByLabelText('Name');
}

describe('NewWordPressProjectDialog', () => {
  it('waits for a site to be picked before going on', async () => {
    renderDialog();
    expect(await screen.findByRole('button', { name: /Blog/ })).toBeTruthy();
    expect((screen.getByRole('button', { name: /Next/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: /Connect a new site/ })).toBeTruthy();
  });

  it('opens the connect dialog from the site step', async () => {
    const { user } = renderDialog({ 'deployWordPress.listSites': [] });
    expect(await screen.findByText(/No WordPress sites are connected yet/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Connect a new site/ }));
    expect(await screen.findByRole('dialog', { name: /connect/i })).toBeTruthy();
  });

  it("ticks the site's active theme, hides the connector and shows versions and active state", async () => {
    const { user, bridge } = renderDialog();
    await toItems(user);

    expect(bridge.$fn('deployWordPress.listItems')).toHaveBeenCalledWith('site-1');
    expect(screen.getByRole('checkbox', { name: /Storefront/ })).toHaveAttribute(
      'data-state',
      'checked',
    );
    expect(screen.getByRole('checkbox', { name: /Twenty Twenty-Five/ })).toHaveAttribute(
      'data-state',
      'unchecked',
    );
    expect(screen.getByRole('checkbox', { name: /WooCommerce/ })).toHaveAttribute(
      'data-state',
      'unchecked',
    );
    expect(screen.queryByText('AgentMate Connector')).toBeNull();
    expect(screen.getByText(/version 4\.5/)).toBeTruthy();
    expect(screen.getAllByText('Active')).toHaveLength(2);

    // With nothing ticked there is nothing to make a project from.
    await user.click(screen.getByRole('checkbox', { name: /Storefront/ }));
    expect((screen.getByRole('button', { name: /Next/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('names the project after the site and puts it in the projects folder by default', async () => {
    const { user } = renderDialog();
    await toDetails(user);

    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Acme Shop');
    expect((screen.getByLabelText('Folder') as HTMLInputElement).value).toBe(
      'D:\\Sites\\acme-shop',
    );
    expect(screen.getByText(FOLDER_NOTE)).toBeTruthy();

    // The folder follows the name until it is picked or typed.
    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Shop Redesign!');
    expect((screen.getByLabelText('Folder') as HTMLInputElement).value).toBe(
      'D:\\Sites\\shop-redesign',
    );
  });

  it('takes a folder from the picker, and needs one when there is no projects folder', async () => {
    const { user } = renderDialog({
      'settings.get': { projectsRootPath: null },
      'projects.pickFolder': async () => 'E:\\work\\shop',
    });
    await toDetails(user);

    expect((screen.getByLabelText('Folder') as HTMLInputElement).value).toBe('');
    expect(
      (screen.getByRole('button', { name: /Create project/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
    await user.click(screen.getByRole('button', { name: /Browse/ }));
    await waitFor(() =>
      expect((screen.getByLabelText('Folder') as HTMLInputElement).value).toBe('E:\\work\\shop'),
    );
    expect(
      (screen.getByRole('button', { name: /Create project/ }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('creates the project with an operation id, shows the pull and opens the project', async () => {
    const call = deferred<Project>();
    const { user, bridge } = renderDialog({
      'deployWordPress.createProject': () => call.promise,
    });
    await toItems(user);
    await user.click(screen.getByRole('checkbox', { name: /WooCommerce/ }));
    await user.click(screen.getByRole('button', { name: /Next/ }));
    await user.click(await screen.findByRole('button', { name: /Create project/ }));

    await waitFor(() => expect(bridge.$fn('deployWordPress.createProject')).toHaveBeenCalled());
    const input = bridge.$fn('deployWordPress.createProject').mock.calls[0][0];
    expect(input).toEqual({
      operationId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      siteId: 'site-1',
      items: [
        { kind: 'theme', slug: 'storefront' },
        { kind: 'plugin', slug: 'woocommerce' },
      ],
      folderPath: 'D:\\Sites\\acme-shop',
      name: 'Acme Shop',
      agentType: 'claude-code',
    });

    const event = {
      operationId: input.operationId,
      siteId: 'site-1',
      projectId: null,
      kind: 'createProject' as const,
    };
    act(() => {
      bridge.$emit('deployWordPress.onProgress', {
        ...event,
        phase: 'connecting',
        done: 0,
        total: 0,
      });
      bridge.$emit('deployWordPress.onProgress', {
        ...event,
        phase: 'download',
        done: 4,
        total: 10,
      });
    });
    const progress = await screen.findByRole('list', { name: 'Progress' });
    expect(within(progress).getByLabelText('Downloading files: in progress')).toHaveTextContent(
      '4 of 10',
    );

    await act(async () => call.resolve(wpProject({ id: 'new-project' })));
    expect(await screen.findByText('Acme Shop is ready')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Open the project/ }));
    expect(screen.getByTestId('location')).toHaveTextContent('/projects/new-project');
  });

  it('explains a failure and goes back to the details', async () => {
    const { user } = renderDialog({
      'deployWordPress.createProject': async () => {
        throw new Error('[wp:folderNotEmpty] wp-content/themes/storefront already holds files.');
      },
    });
    await toDetails(user);
    await user.click(screen.getByRole('button', { name: /Create project/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'wp-content/themes/storefront already holds files.',
    );
    expect(screen.getByText('Pick an empty folder, or a new one.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /^Back$/ }));
    expect(await screen.findByLabelText('Folder')).toBeTruthy();
  });
});
