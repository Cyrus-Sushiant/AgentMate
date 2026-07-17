import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Blocks, Monitor, Moon, Sun } from '@/components/icons';
import { CLI_REGISTRY } from '@agentmat/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { queryKeys } from '@/lib/queryKeys';
import { useCliStore } from '@/stores/cliStore';
import { useThemeStore } from '@/stores/themeStore';
import type { ThemeMode } from '@agentmat/core';
import { cn } from '@/lib/utils';

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export default function SettingsPage(): React.JSX.Element {
  const navigate = useNavigate();
  const defaultCliId = useCliStore((s) => s.defaultCliId);
  const setDefaultCliId = useCliStore((s) => s.setDefaultCliId);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  const reposQuery = useQuery({
    queryKey: queryKeys.repositories,
    queryFn: () => window.agentmat.skills.listRepositories(),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure defaults for AgentMate.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Default CLI</CardTitle>
          <CardDescription>
            Used whenever a feature needs an AI provider without asking explicitly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Combobox
            className="w-64"
            value={defaultCliId ?? ''}
            onChange={(v) => setDefaultCliId(v || null)}
            placeholder="No default set"
            searchPlaceholder="Search CLIs…"
            options={CLI_REGISTRY.map((cli) => ({ value: cli.id, label: cli.name }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Choose how AgentMate looks.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          {THEME_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant={theme === option.value ? 'secondary' : 'outline'}
              className={cn(theme === option.value && 'ring-1 ring-primary')}
              onClick={() => setTheme(option.value)}
            >
              <option.icon /> {option.label}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Skill Repositories</CardTitle>
          <CardDescription>
            {reposQuery.data?.length ?? 0} repositor{reposQuery.data?.length === 1 ? 'y' : 'ies'} configured.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => navigate('/skills')}>
            <Blocks /> Manage repositories
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">AgentMate v0.1.0</CardContent>
      </Card>
    </div>
  );
}
