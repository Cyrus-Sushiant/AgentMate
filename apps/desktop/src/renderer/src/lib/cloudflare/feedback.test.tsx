import { encodeCloudflareError } from '@shared/cloudflareErrors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { queryKeys } from '@/lib/queryKeys';
import { cloudflareFailureText, useCloudflareError } from './feedback';

describe('cloudflareFailureText', () => {
  it('fetches the token status again when the failure was about the token', () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const error = new Error(
      `Error invoking remote method 'cloudflare:createRecord': Error: ${encodeCloudflareError('missing-permission', 'Add Zone > DNS > Edit.', 'dns')}`,
    );

    expect(cloudflareFailureText(error, queryClient)).toBe('Add Zone > DNS > Edit.');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.cloudflareStatus });
  });

  it('leaves the status alone for other failures', () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    expect(cloudflareFailureText(new Error('Cloudflare took too long.'), queryClient)).toBe(
      'Cloudflare took too long.',
    );
    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe('useCloudflareError', () => {
  it('gives the words for a failed query and refreshes the token status once', async () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const error = new Error(encodeCloudflareError('token-rejected', 'Paste a new token.'));
    const { result, rerender } = renderHook(({ failure }) => useCloudflareError(failure), {
      initialProps: { failure: error as unknown },
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    expect(result.current).toBe('Paste a new token.');
    rerender({ failure: error });
    expect(invalidate).toHaveBeenCalledTimes(1);
    rerender({ failure: null });
    expect(result.current).toBeNull();
  });
});
