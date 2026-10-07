import type { ApiExecutionResult, ApiResponseData } from '@shared/apiClientTypes';
import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ApiTabRun } from '@/stores/apiClientTabsStore';
import { renderWithProviders } from '../../../../test/renderer/renderWithProviders';

// Monaco needs workers and a layout engine; these tests only care about what it is given.
vi.mock('@/components/editor/MonacoEditor', () => ({
  MonacoEditor: ({ value, language }: { value: string; language: string }) => (
    <textarea data-testid="monaco-editor" data-language={language} value={value} readOnly />
  ),
}));

const { ResponsePane } = await import('./ResponsePane');

const response = (overrides: Partial<ApiResponseData> = {}): ApiResponseData => ({
  status: 201,
  statusText: 'Created',
  headers: [
    { key: 'content-type', value: 'application/json' },
    { key: 'x-request-id', value: 'abc' },
  ],
  body: '{"id":7,"name":"Ada"}',
  bodyEncoding: 'utf8',
  bodyTruncated: false,
  mime: 'application/json',
  size: { body: 21, headers: 120 },
  timings: { dns: 2, tcp: 3, tls: 0, firstByte: 40, download: 5, total: 50 },
  httpVersion: '1.1',
  ...overrides,
});

const result = (overrides: Partial<ApiExecutionResult> = {}): ApiExecutionResult => ({
  requestId: 'r',
  ok: true,
  cancelled: false,
  error: null,
  response: response(),
  sent: { method: 'POST', url: 'https://a.test/users', headers: [], body: null },
  tests: [],
  console: [],
  scriptErrors: [],
  startedAt: 0,
  ...overrides,
});

function show(run: ApiTabRun, onCancel = vi.fn()) {
  return { ...renderWithProviders(<ResponsePane run={run} onCancel={onCancel} />), onCancel };
}

describe('ResponsePane', () => {
  it('explains what to do before anything was sent', () => {
    show({ status: 'idle' });
    expect(screen.getByText(/send a request to see the response/i)).toBeInTheDocument();
  });

  it('shimmers while sending and lets the request be cancelled', async () => {
    const { user, onCancel } = show({ status: 'sending', requestId: 'r', startedAt: Date.now() });
    expect(screen.getByRole('status', { name: /sending/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /cancel request/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows status, time, size and the pretty-printed body', () => {
    show({ status: 'done', result: result() });
    expect(screen.getByText('201 Created')).toBeInTheDocument();
    expect(screen.getByText('50 ms')).toBeInTheDocument();
    expect(screen.getByText('141 B')).toBeInTheDocument();
    expect(screen.getByTestId('monaco-editor')).toHaveValue('{\n  "id": 7,\n  "name": "Ada"\n}');
  });

  it.each([
    [201, 'Created', 'success'],
    [304, 'Not Modified', 'info'],
    [404, 'Not Found', 'warning'],
    [503, 'Service Unavailable', 'danger'],
  ])('shows %i %s in the %s tone', (status, statusText, tone) => {
    show({ status: 'done', result: result({ response: response({ status, statusText }) }) });
    expect(screen.getByText(`${status} ${statusText}`)).toHaveAttribute('data-tone', tone);
  });

  it('shows the raw body on request', async () => {
    const { user } = show({ status: 'done', result: result() });
    await user.click(screen.getByRole('radio', { name: 'Raw' }));
    expect(screen.getByText('{"id":7,"name":"Ada"}')).toBeInTheDocument();
  });

  it('lists the response headers', async () => {
    const { user } = show({ status: 'done', result: result() });
    await user.click(screen.getByRole('tab', { name: /headers/i }));
    const table = screen.getByRole('table', { name: 'Response headers' });
    expect(within(table).getByText('x-request-id')).toBeInTheDocument();
    expect(within(table).getByText('abc')).toBeInTheDocument();
  });

  it('shows test results with a pass count', async () => {
    const { user } = show({
      status: 'done',
      result: result({
        tests: [
          { name: 'status is 201', passed: true, skipped: false, error: null },
          { name: 'has name', passed: false, skipped: false, error: 'expected undefined' },
        ],
      }),
    });
    const tab = screen.getByRole('tab', { name: /tests/i });
    expect(tab).toHaveTextContent('1/2');
    await user.click(tab);
    expect(screen.getByText('status is 201')).toBeInTheDocument();
    expect(screen.getByText('expected undefined')).toBeInTheDocument();
  });

  it('explains a request that never got a response', () => {
    show({
      status: 'done',
      result: result({ ok: false, response: null, error: 'ECONNREFUSED: connect ECONNREFUSED' }),
    });
    expect(screen.getByText(/could not get a response/i)).toBeInTheDocument();
    expect(screen.getByText(/ECONNREFUSED: connect ECONNREFUSED/)).toBeInTheDocument();
    expect(screen.getByText(/is the server running/i)).toBeInTheDocument();
  });

  it('says so when the request was cancelled', () => {
    show({ status: 'done', result: result({ ok: false, cancelled: true, response: null }) });
    expect(screen.getByText(/request cancelled/i)).toBeInTheDocument();
  });

  it('previews an HTML response in a sandbox that runs no scripts', async () => {
    const { user } = show({
      status: 'done',
      result: result({
        sent: { method: 'GET', url: 'https://site.test/home', headers: [], body: null },
        response: response({
          mime: 'text/html',
          body: '<html><head></head><body><h1>Hello</h1><script>alert(1)</script></body></html>',
        }),
      }),
    });
    await user.click(screen.getByRole('radio', { name: 'Preview' }));
    const frame = screen.getByTitle('Response preview');
    expect(frame).toHaveAttribute('sandbox', '');
    expect(frame.getAttribute('srcdoc')).toContain('<base href="https://site.test/home">');
    expect(frame.getAttribute('srcdoc')).toContain('<h1>Hello</h1>');
    expect(
      screen.getByText(/scripts and files from other sites are not loaded/i),
    ).toBeInTheDocument();
  });

  it('previews an SVG as an image', async () => {
    const { user } = show({
      status: 'done',
      result: result({
        response: response({
          mime: 'image/svg+xml',
          body: '<svg xmlns="http://www.w3.org/2000/svg"/>',
        }),
      }),
    });
    await user.click(screen.getByRole('radio', { name: 'Preview' }));
    expect(screen.getByRole('img', { name: 'Response preview' }).getAttribute('src')).toMatch(
      /^data:image\/svg\+xml;charset=utf-8,/,
    );
  });

  it('has no preview for JSON', () => {
    show({ status: 'done', result: result() });
    expect(screen.queryByRole('radio', { name: 'Preview' })).not.toBeInTheDocument();
  });

  it('previews images', () => {
    show({
      status: 'done',
      result: result({
        response: response({ mime: 'image/png', bodyEncoding: 'base64', body: 'iVBORw0KGgo=' }),
      }),
    });
    expect(screen.getByRole('img', { name: 'Response image' })).toHaveAttribute(
      'src',
      'data:image/png;base64,iVBORw0KGgo=',
    );
  });

  it('warns when only the start of a large body is shown', () => {
    show({
      status: 'done',
      result: result({
        response: response({ bodyTruncated: true, size: { body: 9e6, headers: 1 } }),
      }),
    });
    expect(screen.getByText(/only the first/i)).toBeInTheDocument();
  });
});
