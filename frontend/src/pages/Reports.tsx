import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CalendarDays, Download, FileText } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Button } from '../components/ui/button';

type ReportDataset = 'overall' | 'amazon' | 'cruzbuy' | 'onecard' | 'bookstore';
type ReportPeriod = 'month' | 'week';
type MetricType = 'currency' | 'quantity' | 'mixed';

type RankedSummaryRow = {
  name: string;
  count: number;
  total_spent: number;
};

type PeriodSummaryReport = {
  dataset: ReportDataset;
  period: ReportPeriod;
  period_key: string;
  period_label: string;
  schema?: {
    label: string;
    metric_type: MetricType;
    metric_label: string;
  };
  summary: {
    total_spend: number;
    transaction_count: number;
    top_item: RankedSummaryRow | null;
    top_merchant: RankedSummaryRow | null;
    top_category: RankedSummaryRow | null;
  };
  top_items: RankedSummaryRow[];
  top_merchants: RankedSummaryRow[];
  top_categories: RankedSummaryRow[];
  warnings?: string[];
};

const datasetOptions: { value: ReportDataset; label: string }[] = [
  { value: 'overall', label: 'Overall' },
  { value: 'amazon', label: 'Amazon' },
  { value: 'cruzbuy', label: 'CruzBuy' },
  { value: 'onecard', label: 'OneCard' },
  { value: 'bookstore', label: 'Bookstore' },
];

const periodOptions: { value: ReportPeriod; label: string }[] = [
  { value: 'month', label: 'Monthly' },
  { value: 'week', label: 'Weekly' },
];

const formatNumber = (value: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value || 0);

const formatMetric = (
  value: number,
  metricType: MetricType = 'currency'
) => {
  if (metricType === 'currency') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value || 0);
  }

  return formatNumber(value);
};

const csvCell = (value: string | number | null | undefined) => {
  const raw = value == null ? '' : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
};

const downloadCsv = (report: PeriodSummaryReport) => {
  const rows = [
    ['Section', 'Name', 'Count', 'Total'],
    ['Summary', 'Total', report.summary.transaction_count, report.summary.total_spend],
    ...report.top_items.map((row) => ['Top Items', row.name, row.count, row.total_spent]),
    ...report.top_merchants.map((row) => ['Top Merchants', row.name, row.count, row.total_spent]),
    ...report.top_categories.map((row) => ['Top Categories', row.name, row.count, row.total_spent]),
  ];

  const heading = [
    ['Dataset', report.schema?.label || report.dataset],
    ['Period', report.period],
    ['Period Key', report.period_key],
    [],
  ];

  const csv = [...heading, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `summary-report-${report.dataset}-${report.period_key || 'latest'}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="bg-slate-50 from-white to-gray-50 rounded-lg border-2 p-4 shadow-sm">
      <div className="text-sm font-semibold  text-[#2d66ae]">{label}</div>
      <div className="mt-2 truncate text-2xl font-bold text-slate-900">{value}</div>
      {detail && <div className="mt-1 truncate text-sm text-slate-500">{detail}</div>}
    </div>
  );
}

function RankedTable({
  title,
  rows,
  metricType,
}: {
  title: string;
  rows: RankedSummaryRow[];
  metricType: MetricType;
}) {
  return (
    <section className="bg-slate-50 from-white to-gray-50 rounded-lg border-2 p-4 shadow-sm">
      <h3 className="text-lg font-bold text-[#003c6c]">{title}</h3>
      <div className="mt-4 overflow-x-auto border border-slate-200 rounded-lg bg-white">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-100 text-xs uppercase text-[#2d66ae]">
            <tr>
              <th className="py-2 pl-4 pr-4 font-semibold">Name</th>
              <th className="py-2 pr-4 text-right font-semibold">Transactions</th>
              <th className="py-2 pr-4 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y bg-white divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td className="py-4 text-slate-500" colSpan={3}>
                  No data available for this period.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={`${title}-${row.name}`}>
                  <td className="max-w-[320px] truncate py-3 pl-4 pr-4 font-medium text-slate-800">
                    {row.name}
                  </td>
                  <td className="py-3 pr-4 text-right text-slate-600">{formatNumber(row.count)}</td>
                  <td className="py-3 pr-4 text-right font-semibold text-slate-900">
                    {formatMetric(row.total_spent, metricType)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function Reports() {
  const [dataset, setDataset] = useState<ReportDataset>('overall');
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [date, setDate] = useState('');
  const [report, setReport] = useState<PeriodSummaryReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDate('');
  }, [period]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      dataset,
      period,
      limit: '5',
    });
    if (date) {
      params.set('date', date);
    }

    setIsLoading(true);
    setError(null);

    fetch(`/api/analytics/period-summary?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload?.detail || 'Failed to load the summary report.');
        }
        return payload;
      })
      .then((payload) => {
        setReport(payload.data);
      })
      .catch((fetchError) => {
        if (fetchError.name === 'AbortError') return;
        setReport(null);
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load the summary report.');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [dataset, period, date]);

  const metricType = report?.schema?.metric_type || 'currency';
  const metricLabel = report?.schema?.metric_label || 'Total';
  const selectedDatasetLabel = useMemo(
    () => datasetOptions.find((option) => option.value === dataset)?.label || 'Overall',
    [dataset]
  );

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <section className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-[#003c6c]">Periodic Reports</h1>
          <p className="mt-2 text-sm leading-6 text-slate-95">
            Generate and export weekly or monthly transaction summary reports for Amazon, CruzBuy,
            OneCard, Bookstore, or combined dataset activity. Reports provide key metrics, top
            items, leading merchants, and category trends for the selected reporting period.
            The default report is the most recent month for Overall).<br /> ⠀
          </p>
        </div>
      </section>

      <section className="bg-slate-50 from-white to-gray-50 rounded-lg border-2 p-4">
        <h2 className="text-lg font-semibold text-[#003c6c]">Report Configuration</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase text-[#2d66ae]">Dataset</span>
            <Select value={dataset} onValueChange={(value) => setDataset(value as ReportDataset)}>
              <SelectTrigger className="h-10 min-w-40 border-slate-200 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {datasetOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase text-[#2d66ae]">Period</span>
            <Select value={period} onValueChange={(value) => setPeriod(value as ReportPeriod)}>
              <SelectTrigger className="h-10 min-w-36 border-slate-200 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase text-[#2d66ae]">
              {period === 'month' ? 'Month' : 'Week'}
            </span>
            <div className="flex h-10 min-w-36 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
              <CalendarDays size={16} className="text-[#003c6c]" />
              <input
                type={period}
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="w-40 bg-transparent text-sm outline-none"
              />
            </div>
          </label>

          <Button
            type="button"
            onClick={() => report && downloadCsv(report)}
            disabled={!report || isLoading}
            className="h-10 border border-[#2d66ae] bg-[#2d66ae] text-white hover:bg-[#003c6c]"
          >
            <Download size={16} />
            Export CSV
          </Button>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {report?.warnings && report.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {report.warnings.join(' ')}
        </div>
      )}

      <section className="space-y-4 mt-6">
        <div>
          <h2 className="text-lg font-semibold text-[#003c6c]">Report Overview</h2>
          <p className="mt-1 text-sm text-slate-950">
            Key metrics and highlights for the selected reporting period.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label={`${selectedDatasetLabel} ${metricLabel}`}
          value={isLoading ? 'Loading...' : formatMetric(report?.summary.total_spend || 0, metricType)}
          detail={report?.period_key ? `${period === 'month' ? 'Month' : 'Week'} ${report.period_key}` : 'Latest available period'}
        />
        <SummaryCard
          label="Transactions"
          value={isLoading ? 'Loading...' : formatNumber(report?.summary.transaction_count || 0)}
          detail="Rows included in this report"
        />
        <SummaryCard
          label="Top Item"
          value={isLoading ? 'Loading...' : report?.summary.top_item?.name || 'No data'}
          detail={
            report?.summary.top_item
              ? formatMetric(report.summary.top_item.total_spent, metricType)
              : undefined
          }
        />
        <SummaryCard
          label="Top Merchant"
          value={isLoading ? 'Loading...' : report?.summary.top_merchant?.name || 'No data'}
          detail={
            report?.summary.top_merchant
              ? formatMetric(report.summary.top_merchant.total_spent, metricType)
              : undefined
          }
        />
        </div>
      </section>

      <section className="space-y-4 mt-6">
        <div>
          <h2 className="text-lg font-semibold text-[#003c6c]">Report Rankings</h2>
          <p className="text-sm text-slate-600">
            Review the most significant items, merchants, and categories during the selected reporting period.
          </p>
        </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <RankedTable title="Top Items" rows={report?.top_items || []} metricType={metricType} />
        <RankedTable title="Top Merchants" rows={report?.top_merchants || []} metricType={metricType} />
        <RankedTable title="Top Categories" rows={report?.top_categories || []} metricType={metricType} />
      </div>
    </section>

      {!isLoading && report && report.summary.transaction_count === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          <BarChart3 size={18} />
          No transactions matched this period. Try clearing the date field to load the latest available period.
        </div>
      )}
      </div>
    );
  }