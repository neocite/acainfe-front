import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { FALLBACK_COVERAGE, parseCoverage, type PublicCoverage } from '@/lib/coverage';

export function useCoverage(): PublicCoverage {
  const { data } = useQuery({
    queryKey: ['public-coverage'],
    staleTime: 60 * 1000,
    retry: 1,
    queryFn: async () => parseCoverage(await apiRequest('/public/coverage')),
  });
  return data ?? FALLBACK_COVERAGE;
}
