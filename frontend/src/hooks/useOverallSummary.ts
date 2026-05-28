import { useQuery } from '@tanstack/react-query';
import { isValidMetricName, type SpendPoint } from '../lib/dashboardTypes';

interface Params {
  activeTab: string;
  selectedYear: string;
  selectedQuarter: string;
}

export function useOverallSummary({ activeTab, selectedYear, selectedQuarter }: Params) {
  const enabled = activeTab === 'Home';
  const base    = { dataset: 'overall', selected_year: selectedYear, selected_quarter: selectedQuarter };

  const merchantParams = new URLSearchParams({ ...base, group_by: 'merchant', sort_mode: 'cost', limit: '100' }).toString();
  // Fetch 10 so we can fall through to the first one with a real name
  const categoryParams = new URLSearchParams({ ...base, group_by: 'category', sort_mode: 'cost', limit: '10' }).toString();
  const spendParams    = new URLSearchParams({ ...base, time_period: 'month' }).toString();

  const { data: merchants = [] } = useQuery<any[]>({
    queryKey:  ['overall-merchants', selectedYear, selectedQuarter],
    queryFn:   async () => {
      const res = await fetch(`/api/analytics/top-items/bigquery?${merchantParams}`);
      const p   = await res.json();
      return (p.data?.items ?? []) as any[];
    },
    enabled,
    staleTime: 30 * 60 * 1000,
  });

  const { data: topCategory = null } = useQuery<any | null>({
    queryKey:  ['overall-top-category', selectedYear, selectedQuarter],
    queryFn:   async () => {
      const res   = await fetch(`/api/analytics/top-items/bigquery?${categoryParams}`);
      const p     = await res.json();
      const items = (p.data?.items ?? []) as any[];
      // Return the first item that has a real displayable name; fall back to [0]
      return items.find(isValidMetricName) ?? items[0] ?? null;
    },
    enabled,
    staleTime: 30 * 60 * 1000,
  });

  const { data: combinedSpend = [] } = useQuery<SpendPoint[]>({
    queryKey:  ['overall-spend', selectedYear, selectedQuarter],
    queryFn:   async () => {
      const res = await fetch(`/api/analytics/spend-over-time/bigquery?${spendParams}`);
      const p   = await res.json();
      return (p.data?.combined ?? []) as SpendPoint[];
    },
    enabled,
    staleTime: 30 * 60 * 1000,
  });

  return { merchants, topCategory, combinedSpend };
}
