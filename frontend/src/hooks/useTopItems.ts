import { useQuery } from '@tanstack/react-query';
import type { DatasetSchema } from '../lib/datasetConfig';
import { getOriginalCategoriesForBroad } from '../lib/categoryMapping';

interface Params {
  activeDatasetKey: string;
  selectedYear: string;
  selectedQuarter: string;
  deferredSearchQuery: string;
  minSpend: number;
  selectedLimit: number;
  selectedSortMode: 'frequency' | 'cost';
  selectedCategory: string;
  highImpactOnly: boolean;
}

type TopItemsData = { items: any[]; schema?: DatasetSchema; warnings?: string[] };

export function useTopItems(params: Params) {
  const {
    activeDatasetKey, selectedYear, selectedQuarter, deferredSearchQuery,
    minSpend, selectedLimit, selectedSortMode, selectedCategory, highImpactOnly,
  } = params;

  const urlParams = new URLSearchParams({
    dataset:           activeDatasetKey,
    search_query:      deferredSearchQuery,
    selected_year:     selectedYear,
    selected_quarter:  selectedQuarter,
    min_spend:         String(minSpend || 0),
    limit:             String(selectedLimit),
    sort_mode:         selectedSortMode,
    high_impact_only:  String(highImpactOnly),
  });
  if (selectedCategory !== 'all') {
    const originals = getOriginalCategoriesForBroad(selectedCategory);
    if (originals.length > 0) urlParams.set('category_filter', originals.join('|'));
  }
  const paramStr = urlParams.toString();

  const { data, isLoading, error } = useQuery<TopItemsData>({
    queryKey:  ['top-items', paramStr],
    queryFn:   async () => {
      const res     = await fetch(`/api/analytics/top-items/bigquery?${paramStr}`);
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.detail || 'Failed to load top items.');
      return payload.data as TopItemsData;
    },
    staleTime: 30 * 60 * 1000,
  });

  return {
    topItems: data?.items    ?? [],
    isLoading,
    error: error
      ? (error as Error).message
      : (data?.warnings?.length ? data.warnings.join(' ') : null),
    schema: data?.schema ?? null,
  };
}
