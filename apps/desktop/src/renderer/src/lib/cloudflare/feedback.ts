import { cloudflareErrorCode, cloudflareErrorMessage } from '@shared/cloudflareErrors';
import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { queryKeys } from '@/lib/queryKeys';

/**
 * What to tell the user about a failed Cloudflare call. A refusal for want of a permission, a
 * token Cloudflare no longer accepts, or a locked vault also changes what the token card should
 * say, so its status is fetched again.
 */

function aboutTheToken(error: unknown): boolean {
  const code = cloudflareErrorCode(error);
  return code === 'missing-permission' || code === 'token-rejected' || code === 'locked';
}

/** For a failed change, in an event handler. */
export function cloudflareFailureText(error: unknown, queryClient: QueryClient): string {
  if (aboutTheToken(error)) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.cloudflareStatus });
  }
  return cloudflareErrorMessage(error);
}

/**
 * For a failed query, while rendering: the words to show, with the token status refreshed once
 * per failure (from an effect, so rendering itself never starts a fetch).
 */
export function useCloudflareError(error: unknown): string | null {
  return useCloudflareErrors([error])[0] ?? null;
}

/** The same for several queries at once, such as one per connected account. */
export function useCloudflareErrors(errors: readonly unknown[]): (string | null)[] {
  const queryClient = useQueryClient();
  const aboutToken = errors.some((error) => error && aboutTheToken(error));
  const signature = errors.map((error) => (error ? cloudflareErrorMessage(error) : '')).join('\n');
  useEffect(() => {
    if (aboutToken) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cloudflareStatus });
    }
  }, [aboutToken, signature, queryClient]);
  return errors.map((error) => (error ? cloudflareErrorMessage(error) : null));
}
