import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Download, ExternalLink, RefreshCw, Spinner } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { closeAbout, openAbout, useAboutStore } from '@/stores/aboutStore';
import { openUpdateDialog, useUpdateStore } from '@/stores/updateStore';
import { VERSION_CHIP } from './AboutCard';
import { PUBLISHER, useUpdateCheck } from './mainNav';
import { SmartCloudsLogo } from './SmartCloudsLogo';

export const SMARTCLOUDS_URL = 'https://smartclouds.co';

/**
 * About AgentMate: who makes it, the running version, a way to check for updates and a link to
 * the SmartClouds site. Opened from the sidebar's about card or the top bar's version chip, and
 * mounted once in AppShell.
 */
export function AboutDialog(): React.JSX.Element {
  const open = useAboutStore((s) => s.open);
  const updateDialogOpen = useUpdateStore((s) => s.dialogOpen);

  // Once a check finds something, or "View update" is pressed, the update dialog takes over.
  // About steps aside rather than leaving a second modal stacked under it.
  useEffect(() => {
    if (updateDialogOpen) closeAbout();
  }, [updateDialogOpen]);

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? openAbout() : closeAbout())}>
      {/* .search-panel is unlayered CSS, so its frosted surface, edge and corner replace the
          dialog's default background, border and radius. */}
      <DialogContent className="search-panel max-w-[400px] gap-0 p-0">
        <AboutBody />
      </DialogContent>
    </Dialog>
  );
}

/** The dialog's contents. Radix only renders them while open, so the version query waits too. */
function AboutBody(): React.JSX.Element {
  const { versionText, checking, updatePending, checkForUpdates } = useUpdateCheck();
  // The main process reports "checking" a moment after the call goes out, so the button tracks
  // its own request as well and shows progress from the first click.
  const [requesting, setRequesting] = useState(false);
  const busy = checking || requesting;

  async function runCheck(): Promise<void> {
    if (busy) return;
    setRequesting(true);
    try {
      await checkForUpdates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't check for updates.");
    } finally {
      setRequesting(false);
    }
  }

  function openSite(event: React.MouseEvent<HTMLAnchorElement>): void {
    // A plain link would load the site inside the app window, so it goes to the browser instead.
    event.preventDefault();
    void window.agentmat.shell.openExternal(SMARTCLOUDS_URL);
  }

  return (
    <div className="flex flex-col">
      <div className="relative flex flex-col items-center px-8 pb-6 pt-10 text-center">
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-3 h-32 w-60 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl"
        />
        <span className="brand-tile relative flex h-20 w-20 items-center justify-center rounded-2xl">
          <SmartCloudsLogo size="lg" alt={PUBLISHER} />
        </span>

        <div className="relative mt-5 flex items-center gap-2">
          {/* It reads as "AgentMate" on screen, and as "About AgentMate" to a screen reader. */}
          <DialogTitle
            aria-label="About AgentMate"
            className="text-xl font-semibold tracking-tight"
          >
            AgentMate
          </DialogTitle>
          {versionText && (
            <span className={cn(VERSION_CHIP, 'h-5 px-2 text-[11px]')}>{versionText}</span>
          )}
        </div>
        <p className="relative mt-1 text-xs text-muted-foreground">by {PUBLISHER}</p>

        {/* The classes go on the primitive, whose cn() replaces its own text-sm; on the div they
            would only be added next to it. */}
        <DialogDescription
          asChild
          className="relative mt-4 space-y-2 text-[13px] leading-relaxed text-muted-foreground"
        >
          <div>
            <p>
              We're {PUBLISHER}, a full-stack digital partner for web, cloud, marketing, design and
              AI, all under one roof. We started as a handful of developers and marketers, and we
              still work the same way: the same people from kickoff to launch, and no black boxes.
            </p>
            <p className="text-foreground/80">
              AgentMate is our control center for AI coding agents, one place for every AI coding
              tool you run.
            </p>
          </div>
        </DialogDescription>

        <div className="relative mt-6 flex flex-wrap items-center justify-center gap-2">
          {updatePending && !busy ? (
            <Button onClick={openUpdateDialog}>
              <Download />
              View update
            </Button>
          ) : (
            <Button
              onClick={() => void runCheck()}
              // aria-disabled rather than disabled, so focus stays on the button while it works.
              aria-disabled={busy}
              aria-busy={busy}
            >
              {busy ? <Spinner className="motion-safe:animate-spin" /> : <RefreshCw />}
              {busy ? 'Checking…' : 'Check for updates'}
            </Button>
          )}
          <Button variant="outline" asChild>
            <a href={SMARTCLOUDS_URL} onClick={openSite}>
              smartclouds.co
              <span className="sr-only">, opens in your browser</span>
              <ExternalLink className="opacity-70" />
            </a>
          </Button>
        </div>
      </div>

      {/* A hairline drawn as a fill: the app's global border colour would win over a utility. */}
      <div aria-hidden className="h-px bg-foreground/[0.08]" />
      <p className="px-6 py-3 text-center text-xs tabular-nums text-muted-foreground">
        © {new Date().getFullYear()} {PUBLISHER}
      </p>
    </div>
  );
}
