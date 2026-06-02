// -----------------------------------------------------------------------------
// TRANSACTIONS OVER TIME CHART
// Line chart component for spend trends, historical totals, and projection overlays.
// -----------------------------------------------------------------------------
import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

// Defines the shape of each data point for the chart
type SpendPoint = {
  period: string;
  spend: number;
  pending_spend?: number;
};

// Props for the TransactionsOverTimeChart component
type TransactionsOverTimeChartProps = {
  data: SpendPoint[];
  title?: string;
  loading?: boolean;
  metricLabel?: string;
  metricType?: 'currency' | 'quantity' | 'mixed';
};

// -----------------------------------------------------------------------------
// UTILITY HELPERS
// Formatters used by the chart rendering and tooltip values.
// -----------------------------------------------------------------------------
// Utility function to format numbers as USD currency
const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);

// -----------------------------------------------------------------------------
// MAIN COMPONENT
// Renders the spend trend chart, header badge, and projection overlays.
// -----------------------------------------------------------------------------
const TransactionsOverTimeChart: React.FC<TransactionsOverTimeChartProps> = ({
  data,
  title = 'Spend Over Time',
  loading = false,
  metricLabel = 'Spend',
  metricType = 'currency',
}) => {
  const chartData = (data || []).map((d) => ({
    period: String(d.period),
    spend: Number(d.spend) || 0,
    pending_spend: d.pending_spend ? Number(d.pending_spend) : undefined,
  }));

  const hasProjection = chartData.some((d) => d.pending_spend != null);

  // First period that has projected data — used to draw a "today" reference line
  const projectionStartPeriod = hasProjection
    ? chartData.find((d) => d.pending_spend != null)?.period
    : undefined;

  if (loading) {
    return (
      <div className="flex h-[360px] w-full items-center justify-center rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
        Loading spend trend...
      </div>
    );
  }

  if (!chartData.length) {
    return (
      <div className="flex h-[360px] w-full items-center justify-center rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
        No spend trend data available.
      </div>
    );
  }

  const formatValue = (value: number) =>
    metricType === 'quantity'
      ? new Intl.NumberFormat('en-US').format(Number(value))
      : formatCurrency(Number(value));

  return (
    <div className="w-full min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      {/* Chart container with trend header and projection annotation */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold leading-tight text-[#003c6c]">{title}</h3>
        {hasProjection && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#2d66ae] bg-[#2d66ae] px-3 py-1 text-xs font-semibold text-white">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
            ML Projection overlay active
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={380}>
        <LineChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
        >
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="period"
            interval={0}
            angle={-30}
            textAnchor="end"
            height={70}
            tick={{ fontSize: 11, fill: '#475569' }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#475569' }}
            tickFormatter={formatValue}
          />
          <Tooltip
            formatter={(value, name) => [
              formatValue(Number(value)),
              name === 'pending_spend' ? 'ML Projection' : `Historical ${metricLabel}`,
            ]}
            labelFormatter={(label) => `Period: ${label}`}
            contentStyle={{ borderRadius: '8px', borderColor: '#e2e8f0', fontSize: '12px' }}
          />
          {hasProjection && (
            <Legend
              formatter={(value) =>
                value === 'pending_spend' ? 'ML Projection (estimated)' : `Historical ${metricLabel}`
              }
              wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
            />
          )}
          {projectionStartPeriod && (
            <ReferenceLine
              x={projectionStartPeriod}
              stroke="#2d66ae"
              strokeDasharray="4 2"
              strokeWidth={1.5}
              label={{ value: 'Projected ->', position: 'insideTopRight', fontSize: 10, fill: '#2d66ae' }}
            />
          )}
          <Line
            type="monotone"
            dataKey="spend"
            stroke="#003c6c"
            strokeWidth={3}
            dot={{ r: 3, fill: '#003c6c' }}
            activeDot={{ r: 5 }}
            name="spend"
            connectNulls
          />
          {hasProjection && (
            <Line
              type="monotone"
              dataKey="pending_spend"
              stroke="#2d66ae"
              strokeWidth={2.5}
              strokeDasharray="6 3"
              dot={{ r: 4, fill: '#2d66ae', strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 6 }}
              name="pending_spend"
              connectNulls
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TransactionsOverTimeChart;
