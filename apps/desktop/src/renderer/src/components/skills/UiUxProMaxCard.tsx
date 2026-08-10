import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  buildUiProDesignSystemCommand,
  UI_UX_PRO_MAX_EXAMPLE_PROMPTS,
  UI_UX_PRO_MAX_GITHUB_URL,
  UI_UX_PRO_MAX_HIGHLIGHTS,
  UI_UX_PRO_MAX_HOMEPAGE,
  UI_UX_PRO_MAX_RULE_CATEGORIES,
  UI_UX_PRO_MAX_SKILL_ID,
  UI_UX_PRO_MAX_STACK_GROUPS,
} from '@agentmat/core';
import { Download, ExternalLink, Eye, Globe, Sparkles } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { queryKeys } from '@/lib/queryKeys';
import { UiUxProMaxWizard } from './UiUxProMaxWizard';

const PIPELINE = [
  { title: 'You ask', detail: 'Any UI/UX task: build, design, review, fix, improve.' },
  {
    title: 'Multi-domain search',
    detail: '5 parallel searches over product types, styles, palettes, patterns, and typography.',
  },
  {
    title: 'Reasoning engine',
    detail: 'BM25 ranking, industry rules, and anti-pattern filtering for your sector.',
  },
  {
    title: 'Design system out',
    detail: 'Pattern, style, colors, type, effects, anti-patterns, pre-delivery checklist.',
  },
];

/**
 * The featured entry for UI UX Pro Max (https://github.com/nextlevelbuilder/ui-ux-pro-max-skill).
 * It sits apart from the repository and skills.sh tabs because it is installed by its own CLI
 * rather than by copying files, so it gets a dedicated wizard.
 */
export function UiUxProMaxCard(): React.JSX.Element {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const globalInstalledQuery = useQuery({
    queryKey: queryKeys.installedSkills(null),
    queryFn: () => window.agentmat.skills.listInstalled(null),
  });
  const globalRecord = globalInstalledQuery.data?.find((s) => s.skillId === UI_UX_PRO_MAX_SKILL_ID);

  return (
    <>
      <Card className="glass overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-primary via-purple-500 to-pink-500" />
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> UI UX Pro Max
            </CardTitle>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="default">Featured</Badge>
              <Badge variant="outline">MIT</Badge>
              {globalRecord && <Badge variant="secondary">Installed globally</Badge>}
            </div>
          </div>
          <CardDescription>
            Design intelligence for building professional UI/UX across platforms and frameworks. It
            activates on its own when you ask an assistant for UI work, and answers with a complete
            design system: pattern, style, palette, typography, effects, and the anti-patterns to
            avoid for that industry.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {UI_UX_PRO_MAX_HIGHLIGHTS.map((highlight) => (
              <SimpleTooltip key={highlight.label} label={highlight.detail}>
                <div className="rounded-lg border border-border bg-card/60 px-3 py-2">
                  <p className="text-lg font-semibold text-foreground">{highlight.count}</p>
                  <p className="text-xs text-muted-foreground">{highlight.label}</p>
                </div>
              </SimpleTooltip>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setWizardOpen(true)}>
              <Download className="h-4 w-4" /> {globalRecord ? 'Install again' : 'Install'}
            </Button>
            <Button variant="outline" onClick={() => setDetailsOpen(true)}>
              <Eye className="h-4 w-4" /> What it does
            </Button>
            <SimpleTooltip label="Open the repository on GitHub">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => void window.agentmat.shell.openExternal(UI_UX_PRO_MAX_GITHUB_URL)}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </SimpleTooltip>
            <SimpleTooltip label="Open uupm.cc">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => void window.agentmat.shell.openExternal(UI_UX_PRO_MAX_HOMEPAGE)}
              >
                <Globe className="h-4 w-4" />
              </Button>
            </SimpleTooltip>
          </div>

          {globalRecord && globalRecord.agents && globalRecord.agents.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Installed globally for {globalRecord.agents.join(', ')}. Manage it under Global
              Skills.
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> UI UX Pro Max
            </DialogTitle>
            <DialogDescription>
              An AI skill that turns a product description into a tailored design system, then
              holds the assistant to it while it writes the code.
            </DialogDescription>
          </DialogHeader>

          <div className="-mx-1 min-h-0 flex-1 space-y-5 overflow-y-auto px-1 py-1">
            <section className="space-y-2">
              <h3 className="text-sm font-medium">How a request flows</h3>
              <ol className="space-y-1.5">
                {PIPELINE.map((entry, index) => (
                  <li key={entry.title} className="flex gap-2.5 text-sm">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-medium text-primary">
                      {index + 1}
                    </span>
                    <span>
                      <span className="font-medium text-foreground">{entry.title}.</span>{' '}
                      <span className="text-muted-foreground">{entry.detail}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-medium">161 reasoning rules, by sector</h3>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {UI_UX_PRO_MAX_RULE_CATEGORIES.map((entry) => (
                  <div
                    key={entry.category}
                    className="rounded-lg border border-border bg-card/60 px-3 py-2"
                  >
                    <p className="text-sm font-medium text-foreground">{entry.category}</p>
                    <p className="text-xs text-muted-foreground">{entry.examples}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Each rule carries a recommended page pattern, style priority, color and typography
                mood, key effects, and the anti-patterns for that industry (for example, no AI
                purple gradients on a banking product).
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-medium">Stack-specific guidelines</h3>
              <div className="space-y-1">
                {UI_UX_PRO_MAX_STACK_GROUPS.map((entry) => (
                  <p key={entry.group} className="text-sm">
                    <span className="font-medium text-foreground">{entry.group}:</span>{' '}
                    <span className="text-muted-foreground">{entry.stacks}</span>
                  </p>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Mention your stack in the prompt, or let it fall back to HTML + Tailwind.
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-medium">Prompts that trigger it</h3>
              <div className="space-y-1">
                {UI_UX_PRO_MAX_EXAMPLE_PROMPTS.map((prompt) => (
                  <p
                    key={prompt}
                    className="rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-xs text-foreground"
                  >
                    {prompt}
                  </p>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-medium">Driving the generator directly</h3>
              <p className="break-all rounded-md border border-border bg-muted/30 px-2.5 py-1.5 font-mono text-xs">
                {buildUiProDesignSystemCommand('.claude/skills', 'beauty spa wellness', 'Serenity Spa')}
              </p>
              <p className="text-xs text-muted-foreground">
                Add --persist to write design-system/MASTER.md, and --page &lt;name&gt; for a
                page-level override file. The scripts need Python 3.x, standard library only, and
                make no network calls. The wizard checks for Python before you install.
              </p>
            </section>
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setDetailsOpen(false);
                setWizardOpen(true);
              }}
            >
              <Download className="h-4 w-4" /> Install…
            </Button>
            <Button
              variant="outline"
              onClick={() => void window.agentmat.shell.openExternal(UI_UX_PRO_MAX_GITHUB_URL)}
            >
              <ExternalLink className="h-4 w-4" /> Open on GitHub
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UiUxProMaxWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </>
  );
}
