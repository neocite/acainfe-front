import { FALLBACK_COVERAGE, parseCoverage, type PublicCoverage } from '../src/lib/coverage';

export function createCoverageLoader(base: () => string, request: typeof fetch = fetch) {
  let cached: PublicCoverage | undefined;
  let until = 0;
  return async (): Promise<PublicCoverage> => {
    if (cached && Date.now() < until) return cached;
    try {
      if (!base()) throw new Error('No API');
      const response = await request(`${base()}/v1/public/coverage`, {
        signal: AbortSignal.timeout(6000), headers: { 'ngrok-skip-browser-warning': '1' },
      });
      if (!response.ok) throw new Error('Coverage unavailable');
      cached = parseCoverage(await response.json());
      until = Date.now() + 300000;
    } catch {
      cached = FALLBACK_COVERAGE;
      until = Date.now() + 60000;
    }
    return cached;
  };
}
