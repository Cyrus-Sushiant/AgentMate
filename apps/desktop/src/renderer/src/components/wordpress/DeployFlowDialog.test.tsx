import type { DeployWordPressDeployResult } from '@shared/deployWordPressTypes';
import { act, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../test/renderer/renderWithProviders';
import {
  change,
  deferred,
  wpPlan,
  wpProject,
  wpSite,
} from '../projects/wordpress/testing/fixtures';

vi.mock('@/components/editor/MonacoDiffEditor', async () => ({
  MonacoDiffEditor: (await import('../deploy/sites/testing/monacoMocks')).FakeMonacoDiffEditor,
}));

const { DeployFlowDialog } = await import('./DeployFlowDialog');

/**
 * Deploying a WordPress project from the outside: what the review shows, what blocks the deploy,
 * what the call is sent with, and how the outcome reads.
 */

const done: DeployWordPressDeployResult = {
  deployId: 'd1',
  state: 'done',
  health: [{ name: 'home', status: 200, ok: true, detail: '' }],
  uploaded: 2,
  deleted: 1,
  durationMs: 900,
};

function renderDialog(bridge: Record<string, unknown> = {}) {
  const onOpenChange = vi.fn();
  const view = renderWithProviders(
    <DeployFlowDialog open onOpenChange={onOpenChange} projectId="p1" siteId="site-1" />,
    {
      bridge: {
        'projects.list': [wpProject()],
        'deployWordPress.listSites': [wpSite()],
        'deployWordPress.planDeploy': wpPlan(),
        ...bridge,
      },
    },
  );
  return { ...view, onOpenChange };
}

async function continueButton(): Promise<HTMLButtonElement> {
  return (await screen.findByRole('button', { name: /Continue/ })) as HTMLButtonElement;
}

describe('DeployFlowDialog review', () => {
  it('lists the changes by item with their sizes, and shows a diff for a clicked file', async () => {
    const { user, bridge } = renderDialog({
      'deployWordPress.remoteFile': {
        text: 'old css',
        binary: false,
        tooLarge: false,
        sha256: 'a',
      },
      'fs.readFile': async () => 'new css',
    });

    expect(await screen.findByText('style.css')).toBeTruthy();
    expect(screen.getByText('inc/new.php')).toBeTruthy();
    expect(screen.getByText('old.php')).toBeTruthy();
    expect(screen.getByText('2.00 KB')).toBeTruthy();
    expect(screen.getByText(/2 files to upload \(2.50 KB\), 1 to delete/)).toBeTruthy();
    expect(bridge.$fn('deployWordPress.planDeploy')).toHaveBeenCalledWith({ projectId: 'p1' });

    await user.click(screen.getByRole('button', { name: /style\.css/ }));
    expect(await screen.findByTestId('snippet-diff')).toHaveTextContent('old css => new css');
    expect(bridge.$fn('deployWordPress.remoteFile')).toHaveBeenCalledWith({
      projectId: 'p1',
      item: { kind: 'theme', slug: 'storefront' },
      path: 'style.css',
    });
    expect(bridge.$fn('fs.readFile')).toHaveBeenCalledWith(
      'C:\\code\\acme-shop\\wp-content\\themes\\storefront\\style.css',
    );
  });

  it('blocks on conflicts until the site version is overwritten, then deploys with force', async () => {
    const conflict = change({
      path: 'functions.php',
      local: 'modified',
      remote: 'modified',
      action: 'conflict',
    });
    const { user, bridge } = renderDialog({
      'deployWordPress.planDeploy': wpPlan({
        changes: [...wpPlan().changes, conflict],
        conflicts: [conflict],
      }),
      'deployWordPress.deploy': done,
    });

    const conflicts = await screen.findByRole('region', { name: 'Conflicts' });
    expect(within(conflicts).getByText('functions.php')).toBeTruthy();
    expect(within(conflicts).getByText('Changed here and on the site.')).toBeTruthy();
    expect((await continueButton()).disabled).toBe(true);

    await user.click(within(conflicts).getByRole('checkbox'));
    expect((await continueButton()).disabled).toBe(false);
    await user.click(await continueButton());
    await user.click(screen.getByRole('button', { name: /Deploy now/ }));

    await waitFor(() =>
      expect(bridge.$fn('deployWordPress.deploy')).toHaveBeenCalledWith(
        expect.objectContaining({ planId: 'plan-1', force: true }),
      ),
    );
    const operationId = bridge.$fn('deployWordPress.deploy').mock.calls[0][0].operationId;
    expect(operationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(await screen.findByText('Deployed')).toBeTruthy();
  });

  it('deploys without force when nothing needs it', async () => {
    const { user, bridge } = renderDialog({ 'deployWordPress.deploy': done });

    await user.click(await continueButton());
    expect(screen.getByText(/stay on this computer/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Deploy now/ }));

    await waitFor(() =>
      expect(bridge.$fn('deployWordPress.deploy')).toHaveBeenCalledWith(
        expect.objectContaining({ force: false }),
      ),
    );
    expect(await screen.findByText(/2 files uploaded, 1 file deleted/)).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Health checks' })).toHaveTextContent('HTTP 200');
  });

  it('asks before deploying over the active theme, then sends force', async () => {
    const { user, bridge } = renderDialog({
      'deployWordPress.planDeploy': wpPlan({ warnings: ['touchesActiveThemeCore', 'createsItem'] }),
      'deployWordPress.deploy': done,
    });

    expect(await screen.findByText("Changes the active theme's core files")).toBeTruthy();
    expect(screen.getByText('Adds a new theme or plugin folder to the site')).toBeTruthy();
    expect((await continueButton()).disabled).toBe(true);

    await user.click(screen.getByRole('checkbox', { name: /Deploy these anyway/ }));
    await user.click(await continueButton());
    await user.click(screen.getByRole('button', { name: /Deploy now/ }));
    await waitFor(() =>
      expect(bridge.$fn('deployWordPress.deploy')).toHaveBeenCalledWith(
        expect.objectContaining({ force: true }),
      ),
    );
  });

  it('keeps a read-only site from being deployed to, and says why', async () => {
    renderDialog({
      'deployWordPress.listSites': [wpSite({ scope: 'read' })],
      'deployWordPress.planDeploy': wpPlan({ warnings: ['readOnlyScope'] }),
    });

    expect(await screen.findByText("This site's key is read-only")).toBeTruthy();
    expect((await continueButton()).disabled).toBe(true);
  });

  it('shows the plan error with a way to try again', async () => {
    let calls = 0;
    const { user } = renderDialog({
      'deployWordPress.planDeploy': async () => {
        calls += 1;
        if (calls === 1) throw new Error('[wp:vaultLocked] The Servers vault is locked.');
        return wpPlan();
      },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('The Servers vault is locked.');
    expect(screen.getByText(/Unlock the Servers vault/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Try again/ }));
    expect(await screen.findByText('style.css')).toBeTruthy();
  });
});

describe('DeployFlowDialog outcome', () => {
  async function deployWith(result: unknown) {
    const view = renderDialog({ 'deployWordPress.deploy': result });
    await view.user.click(await continueButton());
    await view.user.click(screen.getByRole('button', { name: /Deploy now/ }));
    return view;
  }

  it('says in words why a deploy was rolled back', async () => {
    await deployWith({ ...done, state: 'rolledBack', reason: 'healthCheck' });
    expect(await screen.findByText('Rolled back')).toBeTruthy();
    expect(
      screen.getByText(
        'The site showed an error after the change, so the old files were put back.',
      ),
    ).toBeTruthy();
  });

  it('names the file and line of each syntax error', async () => {
    await deployWith(async () => {
      throw new Error(
        "Error invoking remote method 'deployWordPress:deploy': Error: [wp:syntaxError] 1 PHP file has a syntax error.\nwp-content/themes/storefront/functions.php:12: syntax error, unexpected '}'",
      );
    });

    const errors = await screen.findByRole('list', { name: 'Syntax errors' });
    expect(within(errors).getByText('wp-content/themes/storefront/functions.php')).toBeTruthy();
    expect(within(errors).getByText(', line 12')).toBeTruthy();
    expect(within(errors).getByText("syntax error, unexpected '}'")).toBeTruthy();
    expect(screen.getByText('1 PHP file has a syntax error.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Check again/ })).toBeTruthy();
  });

  it('cancels a running deploy through the main process', async () => {
    const call = deferred<DeployWordPressDeployResult>();
    const { user, bridge } = await deployWith(() => call.promise);

    await user.click(await screen.findByRole('button', { name: 'Cancel deploy' }));
    const operationId = bridge.$fn('deployWordPress.deploy').mock.calls[0][0].operationId;
    expect(bridge.$fn('deployWordPress.cancel')).toHaveBeenCalledWith(operationId);
    expect(await screen.findByRole('button', { name: 'Cancelling' })).toBeTruthy();

    await act(async () => call.resolve({ ...done, state: 'rolledBack', reason: 'requested' }));
    expect(
      await screen.findByText('The deploy was stopped, so the old files were put back.'),
    ).toBeTruthy();
  });

  it('picks a running deploy up again after the dialog is gone and back', async () => {
    const call = deferred<DeployWordPressDeployResult>();
    let setMounted: (value: boolean) => void = () => undefined;
    function Harness(): React.JSX.Element | null {
      const [mounted, set] = useState(true);
      setMounted = set;
      return mounted ? (
        <DeployFlowDialog open onOpenChange={() => undefined} projectId="p1" siteId="site-1" />
      ) : null;
    }
    const { user, bridge } = renderWithProviders(<Harness />, {
      bridge: {
        'projects.list': [wpProject()],
        'deployWordPress.listSites': [wpSite()],
        'deployWordPress.planDeploy': wpPlan(),
        'deployWordPress.deploy': () => call.promise,
      },
    });
    await user.click(await continueButton());
    await user.click(screen.getByRole('button', { name: /Deploy now/ }));
    const operationId = bridge.$fn('deployWordPress.deploy').mock.calls[0][0].operationId;
    const event = { operationId, siteId: 'site-1', projectId: 'p1', kind: 'deploy' as const };
    act(() => {
      bridge.$emit('deployWordPress.onProgress', {
        ...event,
        phase: 'connecting',
        done: 0,
        total: 0,
      });
      bridge.$emit('deployWordPress.onProgress', { ...event, phase: 'upload', done: 1, total: 3 });
    });

    act(() => setMounted(false));
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => {
      bridge.$emit('deployWordPress.onProgress', { ...event, phase: 'upload', done: 2, total: 3 });
    });
    act(() => setMounted(true));

    const progress = await screen.findByRole('list', { name: 'Progress' });
    expect(within(progress).getByLabelText('Uploading the changes: in progress')).toHaveTextContent(
      '2 of 3',
    );
    expect(within(progress).getByLabelText('Reaching the site: done')).toBeTruthy();
    // Picking the run up again does not plan a second deploy.
    expect(bridge.$fn('deployWordPress.planDeploy')).toHaveBeenCalledTimes(1);

    await act(async () => call.resolve(done));
    expect(await screen.findByText('Deployed')).toBeTruthy();
  });
});
