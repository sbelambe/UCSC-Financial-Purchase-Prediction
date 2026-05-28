import { useQueries } from '@tanstack/react-query';
import { DATASET_PREVIEW_CONFIG, type DatasetPreview } from '../lib/dashboardTypes';

export function useDatasetPreviews(activeTab: string) {
  const enabled = activeTab === 'Home';

  const results = useQueries({
    queries: DATASET_PREVIEW_CONFIG.map((d) => ({
      queryKey:  ['dataset-preview', d.key],
      queryFn:   async (): Promise<any[]> => {
        const res = await fetch(`/api/analytics/top-items/bigquery?dataset=${d.key}&limit=10`);
        const p   = await res.json();
        return (p.data?.items ?? []) as any[];
      },
      enabled,
      staleTime: 30 * 60 * 1000,
    })),
  });

  const previews: DatasetPreview = Object.fromEntries(
    DATASET_PREVIEW_CONFIG.map((d, i) => [d.key, results[i].data ?? []]),
  );

  return {
    previews,
    isLoading: results.some((r) => r.isLoading),
  };
}
