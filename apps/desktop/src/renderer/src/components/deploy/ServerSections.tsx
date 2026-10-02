import { Blocks, Docker, FileText, Globe, Lock, Shield, Store } from '@/components/icons';
import { cn } from '@/lib/utils';

/** The parts of a server's page under Deploy. */
export type ServerSection =
  | 'overview'
  | 'apps'
  | 'containers'
  | 'store'
  | 'websites'
  | 'firewall'
  | 'logs'
  | 'security';

const SECTIONS: ReadonlyArray<{ value: ServerSection; label: string; icon?: typeof Shield }> = [
  { value: 'overview', label: 'Overview' },
  { value: 'apps', label: 'Apps', icon: Blocks },
  { value: 'containers', label: 'Containers', icon: Docker },
  { value: 'store', label: 'App Store', icon: Store },
  { value: 'websites', label: 'Websites', icon: Globe },
  { value: 'firewall', label: 'Firewall', icon: Lock },
  { value: 'logs', label: 'Logs', icon: FileText },
  { value: 'security', label: 'Security', icon: Shield },
];

/** Reads a section from the page's address; anything unknown is the Overview. */
export function sectionFromView(view: string | null): ServerSection {
  return SECTIONS.find((section) => section.value === view)?.value ?? 'overview';
}

/**
 * Switches between a server's sections. The section is part of the page's address, so a link
 * can open one directly; the one shown is marked for screen readers, not only by its colour.
 */
export function ServerSections({
  value,
  onChange,
}: {
  value: ServerSection;
  onChange: (section: ServerSection) => void;
}): React.JSX.Element {
  return (
    <nav aria-label="Server sections" className="flex gap-1 border-b border-border">
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
              '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
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
