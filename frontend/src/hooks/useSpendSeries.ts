import { useQuery } from '@tanstack/react-query';
import { TAB_TO_SERIES_KEY, availableYearsFromSeries, type SpendPoint } from '../lib/dashboardTypes';

interface Params {
  activeTab: string;
  activeDatasetKey: string;
  selectedYear: string;
  selectedQuarter: string;
}

type SpendData = { combined: SpendPoint[]; datasets: Record<string, SpendPoint[]> };

export function useSpendSeries({ activeTab, activeDatasetKey, selectedYear, selectedQuarter }: Params) {
  const urlParams = new URLSearchParams({
    dataset:          activeDatasetKey,
    time_period:      'month',
    selected_year:    selectedYear,
    selected_quarter: selectedQuarter,
  });
  const paramStr = urlParams.toString();

  const { data, isLoading } = useQuery<SpendData>({
    queryKey:  ['spend-series', paramStr],
    queryFn:   async () => {
      const res     = await fetch(`/api/analytics/spend-over-time/bigquery?${paramStr}`);
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.detail);
      return {
        combined:  payload.data?.combined  ?? [],
        datasets:  payload.data?.datasets  ?? {},
      } as SpendData;
    },
    staleTime: 30 * 60 * 1000,
  });

  const seriesKey   = TAB_TO_SERIES_KEY[activeTab] ?? 'combined';
  const spendSeries: SpendPoint[] = data?.datasets?.[seriesKey] ?? data?.combined ?? [];

  return {
    spendSeries,
    availableYears: availableYearsFromSeries(spendSeries),
    isLoading,
  };
}
