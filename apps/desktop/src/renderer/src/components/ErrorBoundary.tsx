import * as React from 'react';
import { Copy, RefreshCw, TriangleAlert } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /**
   * Clears the caught error whenever this value changes (the route path), so
   * navigating away from a page that threw brings it back on the next visit
   * instead of leaving the error card up for the rest of the session.
   */
  resetKey?: string;
  /** Shown above the message, e.g. "Token Usage". */
  title?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
  componentStack: string | null;
}

/**
 * Catches render/commit errors below it and shows them.
 *
 * Without a boundary anywhere in the tree, React unmounts the whole root on the
 * first uncaught render error, which in this app means the window is left
 * showing nothing but the BrowserWindow's own background color, i.e. a black
 * screen with no hint of what went wrong. One of these around each page (and
 * one around the app) turns that into a readable card the user can act on and
 * report, while the rest of the shell keeps working.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, componentStack: null };

  static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    this.setState({ componentStack: info.componentStack ?? null });
    // eslint-disable-next-line no-console
    console.error('[ui] render error:', error, info.componentStack);
  }

  componentDidUpdate(prev: ErrorBoundaryProps): void {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null, componentStack: null });
    }
  }

  private details(): string {
    const { error, componentStack } = this.state;
    return [error?.stack ?? error?.message, componentStack].filter(Boolean).join('\n\n');
  }

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-full flex-1 items-center justify-center p-6">
        <Card className="glass w-full max-w-xl">
          <CardContent className="flex flex-col gap-3 p-5">
            <div className="flex items-center gap-2 text-destructive">
              <TriangleAlert className="h-4 w-4 shrink-0" />
              <span className="text-sm font-semibold">
                {this.props.title ? `${this.props.title} could not be shown` : 'Something broke'}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              The page hit an unexpected error and stopped rendering. Nothing was lost, try again,
              or reload the window.
            </p>
            <pre className="max-h-48 overflow-auto rounded-md bg-foreground/5 p-3 text-[11px] leading-relaxed text-muted-foreground">
              {error.message || String(error)}
            </pre>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => this.setState({ error: null, componentStack: null })}>
                <RefreshCw className="h-3.5 w-3.5" /> Try again
              </Button>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Reload window
              </Button>
              <Button
                variant="ghost"
                onClick={() => void navigator.clipboard.writeText(this.details())}
              >
                <Copy className="h-3.5 w-3.5" /> Copy details
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}
