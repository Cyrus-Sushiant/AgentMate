import type { ApiExecutionResult, ApiResponseData, ApiTimings } from '@shared/apiClientTypes';
import { useEffect, useMemo, useState } from 'react';
import { MonacoEditor } from '@/components/editor/MonacoEditor';
import { CircleCheck, CircleX, Copy, Send, StopCircle, TriangleAlert } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ApiTabRun } from '@/stores/apiClientTabsStore';
import {
  bodyLanguage,
  canPreview,
  formatBytes,
  formatDuration,
  prettyBody,
  previewDocument,
  STATUS_TONE_CLASSES,
  statusTone,
} from './format';

interface ResponsePaneProps {
  run: ApiTabRun;
  onCancel: () => void;
}

/** The lower half of a request tab: whatever came back from the last send. */
export function ResponsePane({ run, onCancel }: ResponsePaneProps): React.JSX.Element {
  return (
    <section aria-label="Response" className="flex h-full min-h-0 flex-col">
      {run.status === 'idle' && <IdleState />}
      {run.status === 'sending' && <SendingState startedAt={run.startedAt} onCancel={onCancel} />}
      {run.status === 'done' && <ResultView result={run.result} />}
    </section>
  );
}

function IdleState(): React.JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary shadow-[0_0_40px_-12px_hsl(var(--primary)/0.7)]">
        <Send className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">Send a request to see the response here</p>
        <p className="text-xs text-muted-foreground">
          Press <Kbd>Ctrl</Kbd> + <Kbd>Enter</Kbd> from anywhere in the request.
        </p>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground">
      {children}
    </kbd>
  );
}

function SendingState({
  startedAt,
  onCancel,
}: {
  startedAt: number;
  onCancel: () => void;
}): React.JSX.Element {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, []);

  return (
    <div role="status" aria-label="Sending request" className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          Sending…{' '}
          <span className="tabular-nums">{formatDuration(Math.max(0, now - startedAt))}</span>
        </div>
        <Button variant="soft" size="sm" onClick={onCancel} aria-label="Cancel request">
          <StopCircle /> Cancel
        </Button>
      </div>
      <Skeleton className="h-6 w-2/5" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-4 w-3/5" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

function errorHint(error: string): string {
  if (/ECONNREFUSED/i.test(error)) return 'Is the server running, and is the port right?';
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(error)) {
    return 'The host name could not be found. Check the URL, or whether a variable in it is set.';
  }
  if (/timed? ?out|ETIMEDOUT|ESOCKETTIMEDOUT/i.test(error)) {
    return 'The server took too long to answer.';
  }
  if (/certificate|SSL|TLS|self.signed/i.test(error)) {
    return 'The server certificate was not accepted.';
  }
  if (/Invalid URI|Invalid URL|invalid url/i.test(error)) return 'The URL is not valid.';
  return 'Check the URL and your connection, then try again.';
}

function ResultView({ result }: { result: ApiExecutionResult }): React.JSX.Element {
  if (result.cancelled) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
        Request cancelled.
      </div>
    );
  }
  if (!result.response) {
    const error = result.error ?? 'Unknown error';
    return (
      <div className="flex h-full items-start justify-center overflow-auto p-6">
        <div className="w-full max-w-lg rounded-xl bg-destructive/[0.06] p-4 ring-1 ring-inset ring-destructive/30">
          <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <TriangleAlert className="h-4 w-4" /> Could not get a response
          </div>
          <p className="mt-2 text-sm text-foreground">{errorHint(error)}</p>
          <pre className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-background/60 p-2.5 font-mono text-xs text-muted-foreground">
            {error}
          </pre>
        </div>
      </div>
    );
  }
  return <ResponseTabs result={result} response={result.response} />;
}

function ResponseTabs({
  result,
  response,
}: {
  result: ApiExecutionResult;
  response: ApiResponseData;
}): React.JSX.Element {
  const passed = result.tests.filter((t) => t.passed).length;
  const hasTests = result.tests.length > 0 || result.scriptErrors.length > 0;

  return (
    <Tabs defaultValue="body" className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 pl-1.5 pr-3 shadow-[inset_0_-1px_0_hsl(var(--border)/0.6)]">
        <TabsList
          className="h-9 border-none bg-transparent"
          containerClassName="min-w-0 border-b-0"
        >
          <TabsTrigger value="body">Body</TabsTrigger>
          <TabsTrigger value="headers">
            Headers <Count>{response.headers.length}</Count>
          </TabsTrigger>
          {hasTests && (
            <TabsTrigger value="tests">
              Tests{' '}
              <Count tone={passed === result.tests.length ? 'success' : 'danger'}>
                {passed}/{result.tests.length}
              </Count>
            </TabsTrigger>
          )}
        </TabsList>
        <ResponseMeta response={response} />
      </div>
      <TabsContent value="body" className="mt-0 min-h-0 flex-1">
        <ResponseBody response={response} url={result.sent?.url ?? null} />
      </TabsContent>
      <TabsContent value="headers" className="mt-0 min-h-0 flex-1 overflow-auto p-3">
        <HeadersTable response={response} />
      </TabsContent>
      {hasTests && (
        <TabsContent value="tests" className="mt-0 min-h-0 flex-1 overflow-auto p-3">
          <TestResults result={result} />
        </TabsContent>
      )}
    </Tabs>
  );
}

function Count({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: 'success' | 'danger';
}): React.JSX.Element {
  return (
    <span
      className={cn(
        'ml-1 rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums',
        tone === 'success' && 'bg-success/15 text-success',
        tone === 'danger' && 'bg-destructive/15 text-destructive',
        !tone && 'bg-foreground/[0.06] text-muted-foreground',
      )}
    >
      {children}
    </span>
  );
}

const TIMING_PHASES: { key: keyof ApiTimings; label: string }[] = [
  { key: 'dns', label: 'DNS lookup' },
  { key: 'tcp', label: 'TCP handshake' },
  { key: 'tls', label: 'TLS handshake' },
  { key: 'firstByte', label: 'Waiting (TTFB)' },
  { key: 'download', label: 'Download' },
];

function TimingBreakdown({ timings }: { timings: ApiTimings }): React.JSX.Element {
  const total = Math.max(timings.total, 1);
  return (
    <div className="w-56 space-y-1.5 py-1">
      {TIMING_PHASES.map(({ key, label }) => (
        <div key={key} className="grid grid-cols-[6.5rem_1fr_3rem] items-center gap-2 text-[11px]">
          <span className="text-muted-foreground">{label}</span>
          <span className="h-1.5 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, (timings[key] / total) * 100)}%` }}
            />
          </span>
          <span className="text-right tabular-nums">{formatDuration(timings[key])}</span>
        </div>
      ))}
      <div className="flex justify-between border-t border-border pt-1.5 text-[11px] font-semibold">
        <span>Total</span>
        <span className="tabular-nums">{formatDuration(timings.total)}</span>
      </div>
    </div>
  );
}

function ResponseMeta({ response }: { response: ApiResponseData }): React.JSX.Element {
  const tone = statusTone(response.status);
  return (
    <div className="flex shrink-0 items-center gap-1 text-xs">
      <span
        data-tone={tone}
        className={cn(
          'mr-1 inline-flex items-center gap-1.5 rounded-full py-0.5 pl-2 pr-2.5 font-semibold tabular-nums ring-1 ring-inset',
          STATUS_TONE_CLASSES[tone],
        )}
      >
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
        {`${response.status} ${response.statusText}`.trim()}
      </span>
      <SimpleTooltip
        label={<TimingBreakdown timings={response.timings} />}
        side="bottom"
        align="end"
      >
        <span className="cursor-default rounded-full px-2 py-0.5 tabular-nums text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground">
          {formatDuration(response.timings.total)}
        </span>
      </SimpleTooltip>
      <SimpleTooltip
        label={`Headers ${formatBytes(response.size.headers)}, body ${formatBytes(response.size.body)}`}
        side="bottom"
        align="end"
      >
        <span className="cursor-default rounded-full px-2 py-0.5 tabular-nums text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground">
          {formatBytes(response.size.headers + response.size.body)}
        </span>
      </SimpleTooltip>
    </div>
  );
}

type BodyView = 'pretty' | 'raw' | 'preview';

const VIEW_LABELS: Record<BodyView, string> = { pretty: 'Pretty', raw: 'Raw', preview: 'Preview' };

function ResponseBody({
  response,
  url,
}: {
  response: ApiResponseData;
  url: string | null;
}): React.JSX.Element {
  const [view, setView] = useState<BodyView>('pretty');
  const previewable = canPreview(response.mime);
  const views: BodyView[] = previewable ? ['pretty', 'raw', 'preview'] : ['pretty', 'raw'];
  const [copied, setCopied] = useState(false);
  const language = bodyLanguage(response.mime);
  const pretty = useMemo(
    () => (response.bodyEncoding === 'utf8' ? prettyBody(response.body, language) : ''),
    [response.body, response.bodyEncoding, language],
  );

  if (response.bodyEncoding === 'base64') {
    return <BinaryBody response={response} />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div
          role="radiogroup"
          aria-label="Body view"
          className="flex rounded-full bg-foreground/[0.05] p-0.5"
        >
          {views.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={view === option}
              onClick={() => setView(option)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                view === option
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {VIEW_LABELS[option]}
            </button>
          ))}
        </div>
        <SimpleTooltip label={copied ? 'Copied' : 'Copy body'}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Copy body"
            onClick={() => {
              void navigator.clipboard.writeText(view === 'pretty' ? pretty : response.body);
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }}
          >
            <Copy />
          </Button>
        </SimpleTooltip>
      </div>
      {response.bodyTruncated && (
        <p className="mx-3 mb-2 rounded-lg bg-warning/10 px-2.5 py-1.5 text-xs text-warning">
          This response is {formatBytes(response.size.body)}. Only the first{' '}
          {formatBytes(new Blob([response.body]).size)} is shown.
        </p>
      )}
      {response.body.length === 0 ? (
        <p className="px-3 text-sm text-muted-foreground">This response has no body.</p>
      ) : view === 'preview' && previewable ? (
        <BodyPreview response={response} url={url} />
      ) : view === 'pretty' ? (
        <div className="min-h-0 flex-1 px-3 pb-3">
          <MonacoEditor
            key={`${language}:${response.body.length}`}
            value={pretty}
            language={language}
            readOnly
            className="h-full min-h-0"
          />
        </div>
      ) : (
        <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-all px-3 pb-3 font-mono text-xs">
          {response.body}
        </pre>
      )}
    </div>
  );
}

/**
 * The rendered page, in a frame sandboxed with no permissions at all: its scripts never run, and
 * the app's content policy keeps it from loading anything from other sites.
 */
function BodyPreview({
  response,
  url,
}: {
  response: ApiResponseData;
  url: string | null;
}): React.JSX.Element {
  const isSvg = response.mime === 'image/svg+xml';
  const srcDoc = useMemo(
    () => (isSvg ? '' : previewDocument(response.body, url)),
    [isSvg, response.body, url],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5 px-3 pb-3">
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg bg-white ring-1 ring-border/60">
        {isSvg ? (
          <div className="flex h-full items-center justify-center overflow-auto p-4">
            <img
              alt="Response preview"
              src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(response.body)}`}
              className="max-h-full max-w-full"
            />
          </div>
        ) : (
          <iframe
            title="Response preview"
            sandbox=""
            srcDoc={srcDoc}
            referrerPolicy="no-referrer"
            className="h-full w-full border-0 bg-white"
          />
        )}
      </div>
      {!isSvg && (
        <p className="text-[11px] text-muted-foreground">
          Scripts and files from other sites are not loaded in the preview.
        </p>
      )}
    </div>
  );
}

function BinaryBody({ response }: { response: ApiResponseData }): React.JSX.Element {
  if (response.mime.startsWith('image/') && !response.bodyTruncated) {
    return (
      <div className="flex h-full items-center justify-center overflow-auto bg-[repeating-conic-gradient(hsl(var(--muted))_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] p-4">
        <img
          alt="Response image"
          src={`data:${response.mime};base64,${response.body}`}
          className="max-h-full max-w-full rounded-md shadow-lg"
        />
      </div>
    );
  }
  return (
    <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
      Binary response ({response.mime || 'unknown type'}, {formatBytes(response.size.body)}).
    </div>
  );
}

function HeadersTable({ response }: { response: ApiResponseData }): React.JSX.Element {
  return (
    <table aria-label="Response headers" className="w-full table-fixed text-xs">
      <thead>
        <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
          <th className="w-2/5 py-1.5 pr-3 font-semibold">Key</th>
          <th className="py-1.5 font-semibold">Value</th>
        </tr>
      </thead>
      <tbody>
        {response.headers.map((header, index) => (
          <tr
            // Headers can repeat (several set-cookie lines), so the position is part of the key.
            key={`${header.key}-${index}`}
            className="border-b border-border/60 align-top last:border-b-0"
          >
            <td className="break-words py-1.5 pr-3 font-mono font-medium">{header.key}</td>
            <td className="break-all py-1.5 font-mono text-muted-foreground">{header.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TestResults({ result }: { result: ApiExecutionResult }): React.JSX.Element {
  return (
    <div className="space-y-3">
      {result.scriptErrors.map((error) => (
        <div
          key={error}
          className="flex items-start gap-2 rounded-lg bg-destructive/[0.06] p-2 text-xs ring-1 ring-inset ring-destructive/30"
        >
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
          <span className="font-mono">{error}</span>
        </div>
      ))}
      <ul className="space-y-1">
        {result.tests.map((test, index) => (
          <li
            key={`${test.name}-${index}`}
            className="flex items-start gap-2 rounded-md px-1 py-1 text-xs"
          >
            {test.passed ? (
              <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
            ) : (
              <CircleX className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
            )}
            <span className="min-w-0">
              <span className="font-medium">{test.name}</span>
              {test.error && (
                <span className="block font-mono text-[11px] text-muted-foreground">
                  {test.error}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
