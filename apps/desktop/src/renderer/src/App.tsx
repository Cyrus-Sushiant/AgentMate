import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { queryClient } from './queryClient';
import { initTheme } from './stores/themeStore';
import { initDefaultCli } from './stores/cliStore';
import { AppShell } from './components/layout/AppShell';
import DashboardPage from './pages/DashboardPage';
import CliManagerPage from './pages/CliManagerPage';
import PromptBuilderPage from './pages/PromptBuilderPage';
import PromptHistoryPage from './pages/PromptHistoryPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import SkillsPage from './pages/SkillsPage';
import SettingsPage from './pages/SettingsPage';

export default function App(): React.JSX.Element {
  useEffect(() => {
    void initTheme();
    void initDefaultCli();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="cli-manager" element={<CliManagerPage />} />
            <Route path="prompt-builder" element={<PromptBuilderPage />} />
            <Route path="prompt-history" element={<PromptHistoryPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="projects/:projectId" element={<ProjectDetailPage />} />
            <Route path="skills" element={<SkillsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </HashRouter>
      <Toaster theme="system" position="bottom-right" richColors closeButton />
    </QueryClientProvider>
  );
}
