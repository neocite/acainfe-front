export const PUBLIC_DOCUMENT_TTL_MS = 60 * 60 * 1000;

export type PublicDocumentOptions = {
  fetcher?: typeof fetch;
  now?: () => number;
  warn?: (message: string) => void;
};

/** Fixed public URLs only: no user credentials, redirects or arbitrary targets. */
export function cachedPublicDocument(
  url: string,
  fallback: unknown,
  valid: (value: unknown) => boolean,
  options: PublicDocumentOptions = {},
) {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? Date.now;
  const warn = options.warn ?? console.warn;
  let cached: { content: string; fetchedAt: number } | undefined;
  let pending: Promise<{ content: string; fetchedAt: number }> | undefined;

  async function refresh() {
    let content = JSON.stringify(fallback);
    try {
      const response = await fetcher(url, {
        headers: { Accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error('Upstream unavailable');
      const value: unknown = await response.json();
      if (!valid(value)) throw new Error('Invalid public document');
      content = JSON.stringify(value);
    } catch {
      // Cache failures too: an unavailable deployment must not cause a request storm.
      warn(`[agent-resources] ${url} unavailable or invalid; serving the local fallback for up to one hour.`);
    }
    cached = { content, fetchedAt: now() };
    return cached;
  }

  return async () => {
    if (cached && now() - cached.fetchedAt < PUBLIC_DOCUMENT_TTL_MS) return cached;
    if (!pending) pending = refresh().finally(() => { pending = undefined; });
    return pending;
  };
}
