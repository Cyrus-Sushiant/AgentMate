import type { FavoriteSkillRecord, SkillAuditRecord } from '@shared/apiTypes';
import { useMemo, useState } from 'react';
import { CatalogCardSkeleton } from '@/components/CatalogCardSkeleton';
import {
  ChartSimple,
  CircleCheck,
  Copy,
  Download,
  ExternalLink,
  Search,
  Shield,
  Star,
} from '@/components/icons';
import { SkillAuditVerdictBadge } from '@/components/skills/SkillAuditReport';
import { SkillFavoriteButton } from '@/components/skills/SkillFavoriteButton';
import type { SkillSecurityTarget } from '@/components/skills/SkillSecurityDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SimpleTooltip } from '@/components/ui/tooltip';
import type { SkillFavorites } from '@/hooks/useSkillFavorites';

/** How each kind of favorite is labelled on its card. */
const SOURCE_BADGE: Record<FavoriteSkillRecord['source'], string> = {
  'skills-sh': 'skills.sh',
  repository: 'Repository',
  installed: 'Installed',
  local: 'Local',
};

/** The security check a favorite supports, or null for one with nothing to read. */
function securityTargetFor(favorite: FavoriteSkillRecord): SkillSecurityTarget | null {
  if (favorite.source === 'skills-sh' && favorite.repo) {
    return {
      skillId: favorite.skillId,
      skillName: favorite.name,
      target: { kind: 'github', repo: favorite.repo, skillName: favorite.name },
    };
  }
  if (favorite.source === 'repository' && favorite.repositoryId) {
    return {
      skillId: favorite.skillId,
      skillName: favorite.name,
      target: {
        kind: 'repository',
        repositoryId: favorite.repositoryId,
        skillId: favorite.skillId,
      },
    };
  }
  if (favorite.source === 'installed') {
    return {
      skillId: favorite.skillId,
      skillName: favorite.name,
      target: { kind: 'installed', projectId: null, skillId: favorite.skillId },
    };
  }
  return null;
}

/**
 * The Favorites tab: every starred skill in one place, with the same install, check and open
 * actions its card carries in the tab it was starred from.
 */
export function SkillFavoritesTab({
  favorites,
  auditBySkillId,
  usageBySkillName,
  onInstall,
  onCheckSecurity,
  onCopyInstallCommand,
}: {
  favorites: SkillFavorites;
  auditBySkillId: Map<string, SkillAuditRecord>;
  /** Invocation counts keyed by skill name, so a card can show how often it is actually used. */
  usageBySkillName: Map<string, number>;
  onInstall: (favorite: FavoriteSkillRecord) => void;
  onCheckSecurity: (target: SkillSecurityTarget) => void;
  onCopyInstallCommand: (command: string) => void;
}): React.JSX.Element {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return favorites.favorites;
    return favorites.favorites.filter(
      (favorite) =>
        favorite.name.toLowerCase().includes(query) ||
        favorite.sourceLabel.toLowerCase().includes(query) ||
        (favorite.description ?? '').toLowerCase().includes(query),
    );
  }, [favorites.favorites, search]);

  if (favorites.isPending) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <CatalogCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (favorites.favorites.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
        <Star className="mx-auto h-6 w-6 text-muted-foreground/50" />
        <p className="mt-3 text-sm font-medium text-foreground">No favorites yet.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Use the star on any skill in the Directory, Repositories or Usage tab to keep it here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-64 flex-1 space-y-1.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 z-10 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search favorites…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
        <p className="pb-2 text-sm text-muted-foreground">
          {favorites.favorites.length} starred skill
          {favorites.favorites.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((favorite) => {
          const audit = auditBySkillId.get(favorite.skillId);
          const uses = usageBySkillName.get(favorite.name) ?? 0;
          const securityTarget = securityTargetFor(favorite);
          const installable = favorite.source === 'skills-sh' || favorite.source === 'repository';
          return (
            <Card key={favorite.skillId} className="flex flex-col hover:border-primary/30">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="flex items-center gap-1.5">
                    {favorite.name}
                    {favorite.official && (
                      <SimpleTooltip label="Official: skills.sh has verified this publisher">
                        <CircleCheck className="h-4 w-4 shrink-0 text-blue-500" />
                      </SimpleTooltip>
                    )}
                  </CardTitle>
                  <SkillFavoriteButton
                    starred
                    onToggle={() => favorites.toggleFavorite(favorite)}
                    className="-mr-2 -mt-1 shrink-0"
                  />
                </div>
                <CardDescription className="line-clamp-3">
                  {favorite.description ?? 'No description saved for this skill.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto space-y-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary">{SOURCE_BADGE[favorite.source]}</Badge>
                  {uses > 0 && (
                    <Badge variant="outline" className="gap-1">
                      <ChartSimple className="h-3 w-3" />
                      {uses} use{uses === 1 ? '' : 's'}
                    </Badge>
                  )}
                  {audit && <SkillAuditVerdictBadge verdict={audit.verdict} score={audit.score} />}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {favorite.sourceLabel} · starred {new Date(favorite.addedAt).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-2">
                  {installable && (
                    <Button size="sm" onClick={() => onInstall(favorite)}>
                      <Download /> Install
                    </Button>
                  )}
                  {favorite.installCommand && (
                    <SimpleTooltip label="Copy the install command">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => onCopyInstallCommand(favorite.installCommand!)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </SimpleTooltip>
                  )}
                  {securityTarget && (
                    <SimpleTooltip label="Check this skill for unsafe instructions">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onCheckSecurity(securityTarget)}
                      >
                        <Shield className="h-4 w-4" />
                      </Button>
                    </SimpleTooltip>
                  )}
                  {favorite.url && (
                    <SimpleTooltip label="Open on skills.sh">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => void window.agentmat.shell.openExternal(favorite.url!)}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </SimpleTooltip>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">No favorites match your search.</p>
      )}
    </div>
  );
}
