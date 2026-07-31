import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import { TooltipProvider } from './components/ui/tooltip';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ConfirmDialogHost } from './components/ConfirmDialog';
import { UpdateManager } from './components/UpdateManager';
import { queryClient } from './queryClient';
import { initTheme, useThemeStore } from './stores/themeStore';
import { initDefaultCli } from './stores/cliStore';
import { initPingTargets } from './stores/pingTargetsStore';
import { initDashboardLayout } from './stores/dashboardLayoutStore';
import { initRemote } from './stores/remoteStore';
import { initUpdateStatusListener } from './stores/updateStore';
import { AppShell } from './components/layout/AppShell';
import DashboardPage from './pages/DashboardPage';
import CliManagerPage from './pages/CliManagerPage';
import PromptBuilderPage from './pages/PromptBuilderPage';
import PromptHistoryPage from './pages/PromptHistoryPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import SkillsPage from './pages/SkillsPage';
import McpPage from './pages/McpPage';
import ToolsPage from './pages/ToolsPage';
import AskAiPage from './pages/AskAiPage';
import RemotePage from './pages/RemotePage';
import SettingsPage from './pages/SettingsPage';
import UsagePage from './pages/UsagePage';
import WidgetRoute from './components/usage/WidgetRoute';
import PromptBuildWidgetRoute from './components/projects/PromptBuildWidgetRoute';
import RemoteSessionRoute from './components/remote/RemoteSessionRoute';

/* Glass toasts: richColors is off on purpose. It paints an opaque per-type
   background that would defeat the frosted surface. The type accents live in
   index.css under .toaster-glass instead. */
function AppToaster(): React.JSX.Element {
  const theme = useThemeStore((s) => s.theme);
  return (
    <Toaster
      theme={theme}
      className="toaster-glass"
      position="bottom-right"
      gap={12}
      closeButton
    />
  );
}

export default function App(): React.JSX.Element {
  useEffect(() => {
    void initTheme();
    void initDefaultCli();
    void initPingTargets();
    void initDashboardLayout();
    initRemote();
    // Usage threshold alerts prefer an OS notification; main only falls back
    // to this event when the platform has none to show.
    const unsubscribeThresholdAlert = window.agentmat.usage.onThresholdAlert(({ title, body }) => {
      toast.warning(title, { description: body });
    });
    const unsubscribeUpdateStatus = initUpdateStatusListener();
    return () => {
      unsubscribeThresholdAlert();
      unsubscribeUpdateStatus();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300} skipDelayDuration={100}>
        {/* Outermost net: covers the shell itself and the standalone widget
            windows, so no failure can leave the window blank. */}
        <ErrorBoundary>
          <HashRouter>
            <Routes>
              {/* Floating desktop widget windows render standalone, outside the app shell. */}
              <Route path="widget/:id" element={<WidgetRoute />} />
              <Route path="widget/prompt-build/:id" element={<PromptBuildWidgetRoute />} />
              <Route path="remote-session" element={<RemoteSessionRoute />} />
              <Route element={<AppShell />}>
                <Route index element={<DashboardPage />} />
                <Route path="cli-manager" element={<CliManagerPage />} />
                <Route path="prompt-builder" element={<PromptBuilderPage />} />
                <Route path="prompt-history" element={<PromptHistoryPage />} />
                <Route path="projects" element={<ProjectsPage />} />
                <Route path="projects/:projectId" element={<ProjectDetailPage />} />
                <Route path="skills" element={<SkillsPage />} />
                <Route path="mcp" element={<McpPage />} />
                <Route path="tools" element={<ToolsPage />} />
                <Route path="usage" element={<UsagePage />} />
                <Route path="ask-ai" element={<AskAiPage />} />
                <Route path="remote" element={<RemotePage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Routes>
          </HashRouter>
        </ErrorBoundary>
        <AppToaster />
        <ConfirmDialogHost />
        <UpdateManager />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
