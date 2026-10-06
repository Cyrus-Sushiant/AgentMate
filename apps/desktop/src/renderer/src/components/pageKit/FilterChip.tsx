import { FolderOpen, GitBranch, Globe, Package } from '@/components/icons';
import { cn } from '@/lib/utils';

/**
 * A rounded-full on/off filter, like "Official" or "Installed". Off it is the search pill's soft
 * wash; on it takes the main menu's primary tint. The edge is a ring, since the app's global border
 * colour would win over a tinted border utility.
 */
export function FilterChip({
  active,
  onClick,
  icon,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex h-7 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-medium ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3.5 [&_svg]:shrink-0',
        active
          ? 'bg-primary/12 text-primary ring-primary/30'
          : 'bg-foreground/[0.05] text-muted-foreground ring-foreground/[0.07] hover:bg-foreground/[0.08] hover:text-foreground',
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/** The icon for where a skill or MCP repository comes from. */
export function RepositorySourceIcon({
  sourceType,
  builtIn = false,
  className,
}: {
  sourceType: string;
  builtIn?: boolean;
  className?: string;
}): React.JSX.Element {
  const Icon =
    builtIn || sourceType === 'bundled'
      ? Package
      : sourceType === 'git'
        ? GitBranch
        : sourceType === 'url'
          ? Globe
          : FolderOpen;
  return <Icon className={className} />;
}
