import { Blocks, History, Key } from '@/components/icons';
import { cn } from '@/lib/utils';

/** The parts of a WordPress site's page under Deploy. */
export type SiteSection = 'overview' | 'items' | 'deploys' | 'access';

const SECTIONS: ReadonlyArray<{ value: SiteSection; label: string; icon?: typeof Blocks }> = [
  { value: 'overview', label: 'Overview' },
  { value: 'items', label: 'Themes and plugins', icon: Blocks },
  { value: 'deploys', label: 'Deploys', icon: History },
  { value: 'access', label: 'Access', icon: Key },
];

/** Reads a section from the page's address (`?view=`); anything unknown is the Overview. */
export function siteSectionFromView(view: string | null): SiteSection {
  return SECTIONS.find((section) => section.value === view)?.value ?? 'overview';
}

/** Switches between a site's sections, the same way a server's section strip does. */
export function SiteSections({
  value,
  onChange,
}: {
  value: SiteSection;
  onChange: (section: SiteSection) => void;
}): React.JSX.Element {
  return (
    <nav
      aria-label="Site sections"
      className="flex gap-1 overflow-x-auto shadow-[inset_0_-1px_0_hsl(var(--border))] [scrollbar-width:thin]"
    >
      {SECTIONS.map((section) => {
        const Icon = section.icon;
        const current = section.value === value;
        return (
          <button
            key={section.value}
            type="button"
            aria-current={current ? 'page' : undefined}
            onClick={() => onChange(section.value)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
              current
                ? 'border-primary font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {section.label}
          </button>
        );
      })}
    </nav>
  );
}
