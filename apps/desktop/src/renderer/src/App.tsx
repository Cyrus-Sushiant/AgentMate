import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { TooltipProvider } from './components/ui/tooltip';
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

/* Glass toasts: richColors is off on purpose — it paints an opaque per-type
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
    return initUpdateStatusListener();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300} skipDelayDuration={100}>
        <HashRouter>
          <Routes>
            {/* Floating desktop widget windows render standalone, outside the app shell. */}
            <Route path="widget/:id" element={<WidgetRoute />} />
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
        <AppToaster />
        <ConfirmDialogHost />
        <UpdateManager />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
