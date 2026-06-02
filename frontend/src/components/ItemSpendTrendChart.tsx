import React, { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Search } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

// -----------------------------------------------------------------------------
// ITEM SPEND TREND TYPES
// Data types and shapes used by the spend trend chart component.
// -----------------------------------------------------------------------------

type DatasetKey = 'overall' | 'amazon' | 'cruzbuy' | 'onecard' | 'bookstore';
type TimePeriod = 'month' | 'quarter' | 'year';

type ItemTrendPoint = {
  period: string;
  total_spend: number;
  quantity: number;
  purchase_count: number;
};

type MatchedItem = {
  dataset: string;
  item_name: string;
  total_spend: number;
  quantity: number;
  purchase_count: number;
};

type ItemTrendResponse = {
  series: ItemTrendPoint[];
  matched_items: MatchedItem[];
  summary: {
    total_spend: number;
    purchase_count: number;
    total_quantity: number;
    average_period_spend: number;
  };
  schema?: {
    metric_label?: string;
    metric_type?: 'currency' | 'quantity' | 'mixed';
  };
  warnings?: string[];
};

type ItemSpendTrendChartProps = {
  activeDatasetKey: string;
  selectedYear: string;
  selectedQuarter: string;
};

const DATASET_OPTIONS: Array<{ value: DatasetKey; label: string }> = [
  { value: 'overall', label: 'All Datasets' },
  { value: 'amazon', label: 'Amazon' },
  { value: 'cruzbuy', label: 'CruzBuy' },
  { value: 'onecard', label: 'OneCard' },
  { value: 'bookstore', label: 'Bookstore' },
];

const TIME_PERIOD_OPTIONS: Array<{ value: TimePeriod; label: string }> = [
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
];

const datasetLabel = (dataset: string) =>
  DATASET_OPTIONS.find((option) => option.value === dataset)?.label || dataset;

// -----------------------------------------------------------------------------
// FORMATTERS
// Display helpers for currencies and quantities used in the chart.
// -----------------------------------------------------------------------------

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);

const formatNumber = (value: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);

const formatMetric = (value: number, metricType?: string) =>
  metricType === 'quantity' ? formatNumber(value) : formatCurrency(value);

const quarterFromMonth = (period: string) => {
  const [year, monthValue] = period.split('-');
  const month = Number(monthValue);
  if (!year || Number.isNaN(month)) return period;
  if (month <= 3) return `${year} Q1`;
  if (month <= 6) return `${year} Q2`;
  if (month <= 9) return `${year} Q3`;
  return `${year} Q4`;
};

const rollupSeries = (series: ItemTrendPoint[], timePeriod: TimePeriod) => {
  if (timePeriod !== 'quarter') return series;

  const grouped = new Map<string, ItemTrendPoint>();
  series.forEach((point) => {
    const period = quarterFromMonth(point.period);
    const existing = grouped.get(period) || {
      period,
      total_spend: 0,
      quantity: 0,
      purchase_count: 0,
    };
    existing.total_spend += Number(point.total_spend) || 0;
    existing.quantity += Number(point.quantity) || 0;
    existing.purchase_count += Number(point.purchase_count) || 0;
    grouped.set(period, existing);
  });

  return Array.from(grouped.values()).map((point) => ({
    ...point,
    total_spend: Math.round(point.total_spend * 100) / 100,
    quantity: Math.round(point.quantity * 100) / 100,
  }));
};

const ItemSpendTrendChart: React.FC<ItemSpendTrendChartProps> = ({
  activeDatasetKey,
  selectedYear,
  selectedQuarter,
}) => {
  // -------------------------------------------------------------------------
  // COMPONENT STATE
  // Track selected dataset, query text, API results, and load/error UI state.
  // -------------------------------------------------------------------------
  const normalizedActiveDataset = DATASET_OPTIONS.some((option) => option.value === activeDatasetKey)
    ? (activeDatasetKey as DatasetKey)
    : 'overall';
  const [dataset, setDataset] = useState<DatasetKey>(normalizedActiveDataset);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month');
  const [draftQuery, setDraftQuery] = useState('pens');
  const [submittedQuery, setSubmittedQuery] = useState('pens');
  const [trendData, setTrendData] = useState<ItemTrendResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDataset(normalizedActiveDataset);
  }, [normalizedActiveDataset]);

  const showDatasetSelector = normalizedActiveDataset === 'overall';
  
  useEffect(() => {
    const trimmedQuery = submittedQuery.trim();
    if (!trimmedQuery) {
      setTrendData(null);
      return;
    }

    const backendTimePeriod = timePeriod === 'quarter' ? 'month' : timePeriod;
    const params = new URLSearchParams({
      dataset,
      query: trimmedQuery,
      time_period: backendTimePeriod,
      selected_year: selectedYear,
      selected_quarter: selectedQuarter,
      limit: '8',
    });

    setLoading(true);
    setError(null);
    fetch(`/api/analytics/item-spend-over-time?${params.toString()}`)
      .then(async (res) => {
        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload?.detail || 'Failed to load item spend trends.');
        }
        return payload;
      })
      .then((payload) => {
        setTrendData(payload.data || null);
        setLoading(false);
      })
      .catch((fetchError) => {
        console.error('Item spend trend fetch failed:', fetchError);
        setTrendData(null);
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load item spend trends.');
        setLoading(false);
      });
  }, [dataset, selectedQuarter, selectedYear, submittedQuery, timePeriod]);

  // -------------------------------------------------------------------------
  // DERIVED VALUES
  // Memoize chart data and schema values from the latest API response.
  // -------------------------------------------------------------------------
  const chartData = useMemo(
    () => rollupSeries(trendData?.series || [], timePeriod),
    [trendData?.series, timePeriod]
  );
  const metricType = trendData?.schema?.metric_type;
  const metricLabel = trendData?.schema?.metric_label || 'Total Spend';
  const summary = trendData?.summary;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmittedQuery(draftQuery);
  };

  return (
    <div className="w-full min-w-0 space-y-5">
      {/* Search & controls */}
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-end"
      >
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#2d66ae]">
            Search item
          </label>
          <div className="flex gap-2">
            <Input
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.target.value)}
              placeholder="pens, notebooks, cheezits"
              className="border-slate-200 text-sm bg-slate-50 focus-visible:ring-[#2d66ae]"
            />
            <Button type="submit" className="bg-[#2d66ae] text-white hover:bg-[#003c6c]">
              <Search className="size-4" />
              Search
            </Button>
          </div>
        </div>
        {showDatasetSelector && (
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#2d66ae]">
              Dataset
            </label>
            <Select value={dataset} onValueChange={(value) => setDataset(value as DatasetKey)}>
              <SelectTrigger className="w-40 border-slate-200 bg-slate-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATASET_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#2d66ae]">
            Period
          </label>
          <Select value={timePeriod} onValueChange={(value) => setTimePeriod(value as TimePeriod)}>
            <SelectTrigger className="w-32 border-slate-200 bg-slate-50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_PERIOD_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </form>

      {/* Summary cards */}
      {summary && (
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#2d66ae]">{metricLabel}</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">
              {formatMetric(summary.total_spend, metricType)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
             <p className="text-xs font-semibold uppercase tracking-wide text-[#2d66ae]">Purchases</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{formatNumber(summary.purchase_count)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#2d66ae]">Average per period</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">
              {formatMetric(summary.average_period_spend, metricType)}
            </p>
          </div>
        </div>
      )}

      {/* Trend chart */}
      <div className="min-h-[320px] rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        {loading ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-slate-500">
            Loading item trend...
          </div>
        ) : error ? (
          <div className="flex h-[300px] items-center justify-center text-center text-sm text-red-600">
            {error}
          </div>
        ) : chartData.length ? (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData} margin={{ top: 16, right: 24, left: 8, bottom: 34 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="period"
                interval={0}
                angle={-30}
                textAnchor="end"
                height={68}
                tick={{ fontSize: 11, fill: '#475569' }}
              />
              <YAxis
                width={84}
                tick={{ fontSize: 11, fill: '#475569' }}
                tickFormatter={(value) => formatMetric(Number(value), metricType)}
              />
              <Tooltip
                formatter={(value) => [formatMetric(Number(value) || 0, metricType), metricLabel]}
                labelFormatter={(label) => `Period: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="total_spend"
                stroke="#003c6c"
                strokeWidth={3}
                dot={{ r: 3, fill: '#003c6c' }}
                activeDot={{ r: 5, fill: '#2d66ae' }}
                name={metricLabel}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[300px] items-center justify-center text-center text-sm text-slate-500">
            Search for an item keyword to see its trend across {datasetLabel(dataset)}.
          </div>
        )}
      </div>

      {Array.isArray(trendData?.warnings) && trendData.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {trendData.warnings.join(' ')}
        </div>
      )}

      {/* Matched items table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-[#003c6c]">Matched Items</h3>
          {submittedQuery.trim() && (
            <span className="text-xs text-slate-500">
              "{submittedQuery.trim()}" in {datasetLabel(dataset)}
            </span>
          )}
        </div>
        <div className="max-h-44 overflow-auto rounded-lg border border-slate-200">
          {(trendData?.matched_items || []).length ? (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-[#2d66ae]">
                <tr>
                  <th className="px-3 py-2 font-semibold">Item</th>
                  <th className="px-3 py-2 font-semibold">Dataset</th>
                  <th className="px-3 py-2 text-right font-semibold">{metricLabel}</th>
                  <th className="px-3 py-2 text-right font-semibold">Purchases</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {(trendData?.matched_items || []).map((item) => (
                  <tr key={`${item.dataset}-${item.item_name}`}>
                    <td className="max-w-[340px] truncate px-3 py-2 font-medium text-slate-950">
                      {item.item_name}
                    </td>
                    <td className="px-3 py-2 text-slate-950">{datasetLabel(item.dataset)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-[#2d66ae]">
                      {formatMetric(item.total_spend, metricType)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {formatNumber(item.purchase_count)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="bg-white px-4 py-8 text-center text-sm text-slate-500">
              No matching item names yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ItemSpendTrendChart;