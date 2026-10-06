import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../../../../test/renderer/renderWithProviders';
import { SiteOverviewPanel } from './SiteOverviewPanel';
import { NOW_SECONDS, wpSite, wpSiteInfo } from './testing/fixtures';

/**
 * The site's overview: versions, theme, HTTPS, the connector and its guard, and in plain words
 * whether deploys can write files and what stops them when they can't.
 */

function renderPanel(info: unknown, site = wpSite()) {
  return renderWithProviders(<SiteOverviewPanel site={site} />, {
    bridge: { 'deployWordPress.siteInfo': info },
  });
}

describe('SiteOverviewPanel', () => {
  it('shimmers in each card while the site answers', () => {
    const { container } = renderPanel(() => new Promise(() => undefined));

    expect(container.querySelectorAll('[aria-busy="true"] .shimmer').length).toBeGreaterThan(3);
    expect(container.querySelectorAll('[aria-busy="true"]').length).toBe(3);
  });

  it("lists the site's facts", async () => {
    renderPanel(async () => wpSiteInfo());

    expect(await screen.findByText('6.6.2')).toBeTruthy();
    expect(screen.getByText('8.2.12')).toBeTruthy();
    expect(screen.getByText('crumb-child')).toBeTruthy();
    expect(screen.getByText('crumb')).toBeTruthy();
    expect(screen.getByText(/Installed\. If a deploy breaks the site/)).toBeTruthy();
    expect(screen.getByText(/every deploy is health-checked/)).toBeTruthy();
    expect(
      screen.getByText(/Allowed\. Deploys write theme and plugin files directly/),
    ).toBeTruthy();
  });

  it.each([
    [{ fileModsDisabled: true }, /DISALLOW_FILE_MODS is set/],
    [{ readOnlyByConstant: true }, /AGENTMATE_CONNECTOR_READ_ONLY is set/],
    [{ filesystemMethod: 'ftpext' }, /through "ftpext" here/],
  ])('says why file changes are off (%o)', async (patch, expected) => {
    renderPanel(async () => wpSiteInfo(patch));

    expect(await screen.findByText(expected)).toBeTruthy();
  });

  it('says a read-only key cannot deploy even when the site allows it', async () => {
    renderPanel(async () => wpSiteInfo(), wpSite({ scope: 'read' }));

    expect(await screen.findByText(/but this key is read-only/)).toBeTruthy();
  });

  it('warns when the rescue guard is missing and loopback fails', async () => {
    renderPanel(async () =>
      wpSiteInfo({ guard: { installed: false, rescueUrl: null }, loopback: 'failed' }),
    );

    expect(await screen.findByText(/Not installed, so a deploy that breaks the site/)).toBeTruthy();
    expect(screen.getByText(/loopback requests fail/)).toBeTruthy();
  });

  it('says clearly when the connector is older than this app expects', async () => {
    renderPanel(async () => wpSiteInfo({ protocol: 0, pluginVersion: '0.9.0' }));

    expect(await screen.findByText(/older than this version of AgentMate expects/)).toBeTruthy();
    expect(screen.getByText('Update the connector')).toBeTruthy();
  });

  it('mentions a newer connector of the same protocol without alarm', async () => {
    renderPanel(async () => wpSiteInfo({ pluginVersion: '0.9.5' }));

    expect(await screen.findByText(/comes with this app\. This one still works/)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows a deploy that waits for its confirmation', async () => {
    renderPanel(async () =>
      wpSiteInfo({
        pendingDeploy: { deployId: 'dep-9', state: 'applied', deadline: NOW_SECONDS + 120 },
      }),
    );

    expect(await screen.findByText(/A deploy is waiting for confirmation/)).toBeTruthy();
  });

  it('explains a locked vault and offers to try again', async () => {
    const { user, bridge } = renderPanel(async () => {
      throw new Error(
        "Error invoking remote method 'deployWordPress:siteInfo': Error: [wp:vaultLocked] locked",
      );
    });

    expect(
      await screen.findByText(/locked with a passkey, and this site's key with them/),
    ).toBeTruthy();
    bridge.$set('deployWordPress.siteInfo', async () => wpSiteInfo());
    await user.click(screen.getByRole('button', { name: /Try again/ }));
    expect(await screen.findByText('6.6.2')).toBeTruthy();
  });

  it('explains a firewall answering instead of the connector', async () => {
    renderPanel(async () => {
      throw new Error('[wp:foreignResponse] got HTML');
    });

    expect(await screen.findByText(/Something other than the connector answered/)).toBeTruthy();
  });

  it("shows the main process's own words when they say who answered", async () => {
    renderPanel(async () => {
      throw new Error(
        "Error invoking remote method 'deployWordPress:siteInfo': Error: [wp:foreignResponse] Cloudflare answered instead of AgentMate Connector (HTTP 403), most likely with a bot check.",
      );
    });

    expect(
      await screen.findByText(/Cloudflare answered instead of AgentMate Connector/),
    ).toBeTruthy();
  });
});
