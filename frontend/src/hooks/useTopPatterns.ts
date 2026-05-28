import { useQuery } from '@tanstack/react-query';
import type { PatternDimension } from '../lib/dashboardTypes';

interface Params {
  activeDatasetKey: string;
  deferredSearchQuery: string;
  minSpend: number;
  selectedPatternDimension: PatternDimension;
  selectedQuarter: string;
  selectedSortMode: 'frequency' | 'cost';
  selectedYear: string;
}

type PatternsData = { items: any[]; warnings?: string[] };

export function useTopPatterns(params: Params) {
  const {
    activeDatasetKey, deferredSearchQuery, minSpend,
    selectedPatternDimension, selectedQuarter, selectedSortMode, selectedYear,
  } = params;

  const urlParams = new URLSearchParams({
    dataset:          activeDatasetKey,
    search_query:     deferredSearchQuery,
    selected_year:    selectedYear,
    selected_quarter: selectedQuarter,
    min_spend:        String(minSpend || 0),
    limit:            '5',
    sort_mode:        selectedSortMode,
    group_by:         selectedPatternDimension,
  });
  const paramStr = urlParams.toString();

  const { data, isLoading, error } = useQuery<PatternsData>({
    queryKey:  ['top-patterns', paramStr],
    queryFn:   async () => {
      const res     = await fetch(`/api/analytics/top-items/bigquery?${paramStr}`);
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.detail || 'Failed to load patterns.');
      return payload.data as PatternsData;
    },
    staleTime: 30 * 60 * 1000,
  });

  return {
    patterns: data?.items ?? [],
    isLoading,
    error: error
      ? (error as Error).message
      : (data?.warnings?.length ? data.warnings.join(' ') : null),
  };
}
