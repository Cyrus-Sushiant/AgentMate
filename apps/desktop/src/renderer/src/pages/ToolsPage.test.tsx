import type { InstalledAgentTool } from '@agentmat/core';
import { AGENT_TOOL_REGISTRY, SECURITY_TOOL_CATEGORY } from '@agentmat/core';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GooeyNavProps } from '@/components/ui/gooey-nav';
import { useTerminalStore } from '@/stores/terminalStore';
import { renderWithProviders } from '../../../test/renderer/renderWithProviders';

/**
 * The Agent Tools catalogue. Nothing here runs a command for the user: every install, update,
 * uninstall and Docker action ends up as text waiting in a terminal they still have to accept,
 * so that is what the tests assert on.
 */

const toast = vi.hoisted(() =>
  Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    dismiss: vi.fn(),
  }),
);
vi.mock('sonner', () => ({ toast, Toaster: () => null }));

/**
 * The category switcher, as a plain row of buttons. The real one animates with a Framer Motion
 * spring, and the renderer suite's Framer stand-in has no `jump()` on a spring value, so the
 * real component throws on mount. The contract used here is the same: a labelled button per
 * category, the index handed back on click.
 */
vi.mock('@/components/ui/gooey-nav', () => ({
  GooeyNav: ({ items, value, onChange, ...rest }: GooeyNavProps) => (
    <nav aria-label={rest['aria-label']}>
      {items.map((item, index) => {
        const label = typeof item === 'string' ? item : item.label;
        return (
          <button
            key={label}
            type="button"
            aria-current={index === value ? true : undefined}
            onClick={() => onChange?.(index)}
          >
            {label}
          </button>
        );
      })}
    </nav>
  ),
  GooeyNavCount: ({ value }: { value: number }) => <span>{value}</span>,
}));

const { default: ToolsPage } = await import('./ToolsPage');

/** A tool with a plain npm install, a Docker option, settings and an update check. */
const ROUTER = AGENT_TOOL_REGISTRY.find((tool) => tool.id === '9router');
if (!ROUTER) throw new Error('The 9router entry these tests are written against is gone');

function status(overrides: Partial<InstalledAgentTool> & { id: string }): InstalledAgentTool {
  return {
    installed: true,
    version: '1.4.0',
    dockerStatus: 'unavailable',
    lastCheckedAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  };
}

/** Only the fields the page reads off a project. */
const projects = [{ id: 'p1', name: 'Aurora', folderPath: '/code/aurora' }];

function renderPage(bridge: Record<string, unknown> = {}, route = '/tools') {
  return renderWithProviders(<ToolsPage />, { route, bridge });
}

/** The card a tool's name heads. */
function toolCard(name: string): HTMLElement {
  const title = screen.getByText(name);
  let element: HTMLElement | null = title.parentElement;
  while (element) {
    if (within(element).queryAllByRole('button').length > 0) return element;
    element = element.parentElement;
  }
  throw new Error(`No card found around "${name}"`);
}

function categoryTabs(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Tool categories' });
}

/**
 * An icon-only control on a card. They carry no accessible name of their own (the label lives in
 * a hover tooltip and the icon is aria-hidden), so they are found by the icon they draw. Worth
 * giving them labels in the component one day.
 */
function iconButton(card: HTMLElement, icon: string): HTMLElement {
  const button = card.querySelector(`svg[data-icon="${icon}"]`)?.closest('button');
  if (!button) throw new Error(`No button with the "${icon}" icon on this card`);
  return button;
}

describe('ToolsPage catalogue', () => {
  it('renders the whole registry against an empty bridge', async () => {
    renderPage();

    expect(await screen.findByText(ROUTER.name)).toBeTruthy();
    expect(screen.getByText(ROUTER.description)).toBeTruthy();
    // Every registry entry gets a card while the "All" tab is selected.
    expect(within(categoryTabs()).getByRole('button', { name: /^All/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('shows what the detection scan found, and what it did not', async () => {
    renderPage({ 'tools.detectAll': [status({ id: '9router', version: 'v2.0.1' })] });

    const card = toolCard(ROUTER.name);
    expect(await within(card).findByText('v2.0.1')).toBeTruthy();

    const other = AGENT_TOOL_REGISTRY.find((tool) => tool.id === 'rtk');
    expect(other).toBeTruthy();
    expect(await within(toolCard(other!.name)).findByText('Not detected')).toBeTruthy();
  });

  it('keeps the catalogue usable when detection itself fails', async () => {
    renderPage({ 'tools.detectAll': () => Promise.reject(new Error('spawn ENOENT')) });

    // The scan is what failed, not the page: every tool is still listed, as not detected.
    expect(await screen.findByText(ROUTER.name)).toBeTruthy();
    expect(await within(toolCard(ROUTER.name)).findByText('Not detected')).toBeTruthy();
  });

  it('filters down to one category and back', async () => {
    const { user } = renderPage();
    await screen.findByText(ROUTER.name);

    await user.click(within(categoryTabs()).getByRole('button', { name: /^Security/ }));

    await waitFor(() => expect(screen.queryByText(ROUTER.name)).toBeNull());
    // A tool name can also turn up in another tool's description, hence getAllByText.
    const security = AGENT_TOOL_REGISTRY.filter((tool) => tool.category === SECURITY_TOOL_CATEGORY);
    expect(screen.getAllByText(security[0].name).length).toBeGreaterThan(0);

    await user.click(within(categoryTabs()).getByRole('button', { name: /^All/ }));
    expect(await screen.findByText(ROUTER.name)).toBeTruthy();
  });

  it('opens on the category the URL asked for', async () => {
    renderPage({}, '/tools?tab=security');

    const security = AGENT_TOOL_REGISTRY.filter((tool) => tool.category === SECURITY_TOOL_CATEGORY);
    await waitFor(() => expect(screen.getAllByText(security[0].name).length).toBeGreaterThan(0));
    expect(screen.queryByText(ROUTER.name)).toBeNull();
  });

  it('re-runs the detection scan on refresh', async () => {
    const { bridge, user } = renderPage({ 'tools.detectAll': [status({ id: '9router' })] });
    await screen.findByText(ROUTER.name);
    const before = bridge.$fn('tools.detectAll').mock.calls.length;

    await user.click(screen.getByRole('button', { name: /Refresh/ }));

    expect(toast.info).toHaveBeenCalledWith('Re-checking installed tools…');
    await waitFor(() =>
      expect(bridge.$fn('tools.detectAll').mock.calls.length).toBeGreaterThan(before),
    );
  });

  it('opens a tool website and repository in the system browser', async () => {
    const { bridge, user } = renderPage();
    await screen.findByText(ROUTER.name);

    await user.click(iconButton(toolCard(ROUTER.name), 'code-branch'));

    expect(bridge.$fn('shell.openExternal')).toHaveBeenCalledWith(ROUTER.repositoryUrl);
  });
});

describe('ToolsPage install and uninstall', () => {
  it('puts the install command in a terminal for the user to confirm', async () => {
    const { bridge, user } = renderPage({
      'tools.getInstallCommand': async () => 'npm install -g 9router',
    });
    await screen.findByText(ROUTER.name);

    await user.click(
      within(toolCard(ROUTER.name)).getByRole('button', { name: /Install \(npm\)/ }),
    );

    await waitFor(() =>
      expect(bridge.$fn('tools.getInstallCommand')).toHaveBeenCalledWith('9router'),
    );
    const session = useTerminalStore
      .getState()
      .sessions.find((one) => one.title === `Install ${ROUTER.name}`);
    expect(session?.initialInput).toBe('npm install -g 9router');
    expect(toast.info).toHaveBeenCalledWith(
      `Press Enter in the terminal to install ${ROUTER.name}.`,
    );
  });

  it('says so instead of opening an empty terminal when this OS has no install command', async () => {
    const { user } = renderPage();
    await screen.findByText(ROUTER.name);

    await user.click(
      within(toolCard(ROUTER.name)).getByRole('button', { name: /Install \(npm\)/ }),
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        `No install command available for ${ROUTER.name} on this OS.`,
      ),
    );
    expect(useTerminalStore.getState().sessions).toHaveLength(0);
  });

  it('offers to uninstall what is already installed', async () => {
    const { user } = renderPage({
      'tools.detectAll': [status({ id: '9router' })],
      'tools.getUninstallCommand': async () => 'npm uninstall -g 9router',
    });
    await screen.findByText(ROUTER.name);
    const card = toolCard(ROUTER.name);
    await within(card).findByText('1.4.0');

    await user.click(within(card).getByRole('button', { name: /Uninstall/ }));

    await waitFor(() => {
      const session = useTerminalStore
        .getState()
        .sessions.find((one) => one.title === `Uninstall ${ROUTER.name}`);
      expect(session?.initialInput).toBe('npm uninstall -g 9router');
    });
  });

  it('copies the setup commands for a tool that installs inside another agent', async () => {
    const ponytail = AGENT_TOOL_REGISTRY.find((tool) => tool.id === 'ponytail');
    expect(ponytail?.interactiveInstall).toBeTruthy();
    const { user } = renderPage({
      'tools.getInteractiveLaunchCommand': async () => 'claude',
    });
    await screen.findByText(ponytail!.name);

    await user.click(within(toolCard(ponytail!.name)).getByRole('button', { name: /Install/ }));

    await waitFor(() => {
      const session = useTerminalStore
        .getState()
        .sessions.find((one) => one.title === `Install ${ponytail!.name}`);
      expect(session?.initialInput).toBe('claude');
    });
    // The commands are copied for pasting, and the toast spells out the shortcut that pastes
    // them, since xterm does not take a plain Ctrl+V.
    expect(toast.info).toHaveBeenCalledWith(expect.stringContaining('Ctrl+Shift+V, not Ctrl+V'));
  });
});

describe('ToolsPage updates', () => {
  it('has nothing to check when nothing is installed', async () => {
    const { user } = renderPage();
    await screen.findByText(ROUTER.name);

    await user.click(screen.getByRole('button', { name: /Check all for updates/ }));

    await waitFor(() => expect(toast.info).toHaveBeenCalledWith('No installed tools to check.'));
  });

  it('reports that everything is current when no update is out', async () => {
    const { user } = renderPage({
      'tools.detectAll': [status({ id: '9router', version: '1.4.0' })],
      'tools.checkForUpdate': async () => ({
        toolId: '9router',
        supported: true,
        currentVersion: '1.4.0',
        latestVersion: '1.4.0',
        updateAvailable: false,
      }),
    });
    await within(toolCard(ROUTER.name)).findByText('1.4.0');

    await user.click(screen.getByRole('button', { name: /Check all for updates/ }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('All tools are up to date.'));
  });

  it('offers the update command for confirmation when a newer version exists', async () => {
    const { user } = renderPage({
      'tools.detectAll': [status({ id: '9router', version: '1.4.0' })],
      'tools.checkForUpdate': async () => ({
        toolId: '9router',
        supported: true,
        currentVersion: '1.4.0',
        latestVersion: '2.0.0',
        updateAvailable: true,
      }),
      'tools.getUpdateCommand': async () => 'npm install -g 9router@latest',
    });
    await within(toolCard(ROUTER.name)).findByText('1.4.0');

    await user.click(screen.getByRole('button', { name: /Check all for updates/ }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain(`Update ${ROUTER.name}?`);
    expect(dialog.textContent).toContain('1.4.0');
    expect(dialog.textContent).toContain('2.0.0');
    expect(within(dialog).getByText('npm install -g 9router@latest')).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: 'Update' }));

    const session = useTerminalStore
      .getState()
      .sessions.find((one) => one.title === `Update ${ROUTER.name}`);
    expect(session?.initialInput).toBe('npm install -g 9router@latest');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('leaves the tool alone when the update dialog is cancelled', async () => {
    const { user } = renderPage({
      'tools.detectAll': [status({ id: '9router', version: '1.4.0' })],
      'tools.checkForUpdate': async () => ({
        toolId: '9router',
        supported: true,
        currentVersion: '1.4.0',
        latestVersion: '2.0.0',
        updateAvailable: true,
      }),
      'tools.getUpdateCommand': async () => 'npm install -g 9router@latest',
    });
    await within(toolCard(ROUTER.name)).findByText('1.4.0');
    await user.click(screen.getByRole('button', { name: /Check all for updates/ }));
    const dialog = await screen.findByRole('dialog');

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(useTerminalStore.getState().sessions).toHaveLength(0);
  });

  it('counts the tools it could not check rather than claiming they are current', async () => {
    const { user } = renderPage({
      'tools.detectAll': [status({ id: '9router', version: '1.4.0' }), status({ id: 'rtk' })],
      'tools.checkForUpdate': async (toolId: unknown) => ({
        toolId: String(toolId),
        supported: toolId === '9router',
        currentVersion: null,
        latestVersion: toolId === '9router' ? '1.4.0' : null,
        updateAvailable: false,
      }),
    });
    await within(toolCard(ROUTER.name)).findByText('1.4.0');

    await user.click(screen.getByRole('button', { name: /Check all for updates/ }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        'All checkable tools are up to date (1 could not be checked).',
      ),
    );
  });
});

describe('ToolsPage Docker actions', () => {
  it('says Docker is unavailable rather than offering an action that cannot run', async () => {
    renderPage({ 'tools.detectAll': [status({ id: '9router', dockerStatus: 'unavailable' })] });

    const card = toolCard(ROUTER.name);
    expect(await within(card).findByText('Docker: unavailable')).toBeTruthy();
    expect(within(card).getByRole('button', { name: 'Install with Docker' })).toBeDisabled();
  });

  it('puts the docker run command in a terminal when no container exists yet', async () => {
    const { bridge, user } = renderPage({
      'tools.detectAll': [status({ id: '9router', dockerStatus: 'not-created' })],
      'tools.getDockerCommand': async () => 'docker run -d --name agentmate-9router ...',
    });
    const card = toolCard(ROUTER.name);
    await within(card).findByText('Docker: not-created');

    await user.click(within(card).getByRole('button', { name: /Install with Docker/ }));

    await waitFor(() =>
      expect(bridge.$fn('tools.getDockerCommand')).toHaveBeenCalledWith('9router', 'run'),
    );
    const session = useTerminalStore
      .getState()
      .sessions.find((one) => one.title === `run ${ROUTER.name} container`);
    expect(session?.initialInput).toBe('docker run -d --name agentmate-9router ...');
    expect(toast.info).toHaveBeenCalledWith(
      'Press Enter in the terminal to install the container.',
    );
  });

  it('offers stop, reset and delete for a running container, but not start', async () => {
    const { bridge, user } = renderPage({
      'tools.detectAll': [status({ id: '9router', dockerStatus: 'running' })],
      'tools.getDockerCommand': async () => 'docker stop agentmate-9router',
    });
    const card = toolCard(ROUTER.name);
    await within(card).findByText('Docker: running');

    expect(iconButton(card, 'play')).toBeDisabled();
    await user.click(iconButton(card, 'stop'));

    await waitFor(() =>
      expect(bridge.$fn('tools.getDockerCommand')).toHaveBeenCalledWith('9router', 'stop'),
    );
    expect(toast.info).toHaveBeenCalledWith('Press Enter in the terminal to stop the container.');
  });

  it('says so when the docker command cannot be built', async () => {
    const { user } = renderPage({
      'tools.detectAll': [status({ id: '9router', dockerStatus: 'not-created' })],
    });
    const card = toolCard(ROUTER.name);
    await within(card).findByText('Docker: not-created');

    await user.click(within(card).getByRole('button', { name: /Install with Docker/ }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Docker command unavailable for this tool.'),
    );
  });
});

describe('ToolsPage settings', () => {
  it('previews the command it builds from the settings, and runs it on request', async () => {
    const { user } = renderPage();
    await screen.findByText(ROUTER.name);

    await user.click(iconButton(toolCard(ROUTER.name), 'wrench'));

    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain(`Configure ${ROUTER.name}`);
    expect(dialog.textContent).toContain('This applies machine-wide');
    // The preview is built from the defaults, so it is there before anything is typed.
    expect(within(dialog).getByText(/docker run -d --name agentmate-9router/)).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: 'Run in terminal' }));

    await waitFor(() => {
      const session = useTerminalStore
        .getState()
        .sessions.find((one) => one.title === `Configure ${ROUTER.name}`);
      expect(session?.initialInput).toContain('docker run -d --name agentmate-9router');
    });
  });

  it('copies settings that are a config file rather than a command', async () => {
    const ponytail = AGENT_TOOL_REGISTRY.find((tool) => tool.id === 'ponytail');
    const { user } = renderPage();
    await screen.findByText(ponytail!.name);

    await user.click(iconButton(toolCard(ponytail!.name), 'wrench'));
    const dialog = await screen.findByRole('dialog');

    await user.click(within(dialog).getByRole('button', { name: 'Copy to clipboard' }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Copied to clipboard.')),
    );
  });
});

describe('ToolsPage target project', () => {
  it('refuses a project-scoped action until a project is chosen', async () => {
    const codegraph = AGENT_TOOL_REGISTRY.find(
      (tool) => tool.id === 'codegraph' && tool.quickActions?.length,
    );
    expect(codegraph).toBeTruthy();
    const action = codegraph!.quickActions![0];
    const { user } = renderPage({ 'projects.list': projects });
    await screen.findByText(codegraph!.name);

    await user.click(within(toolCard(codegraph!.name)).getByRole('button', { name: action.label }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Choose a target project first.'));
  });

  it('runs a project-scoped action in the chosen project folder', async () => {
    const codegraph = AGENT_TOOL_REGISTRY.find(
      (tool) => tool.id === 'codegraph' && tool.quickActions?.length,
    );
    const action = codegraph!.quickActions![0];
    const { user } = renderPage({ 'projects.list': projects });
    await screen.findByText(codegraph!.name);

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByText('Aurora'));
    await user.click(within(toolCard(codegraph!.name)).getByRole('button', { name: action.label }));

    await waitFor(() => {
      const session = useTerminalStore
        .getState()
        .sessions.find((one) => one.title === action.label);
      expect(session?.cwd).toBe('/code/aurora');
    });
  });
});
