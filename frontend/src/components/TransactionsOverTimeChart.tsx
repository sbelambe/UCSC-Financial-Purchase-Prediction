// Renders a line chart showing spend over time, with support for both
// historical spend and pending uploads
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

// Utility function to format numbers as USD currency
const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);

// Main component that renders the line chart
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
      <div className="w-full bg-gray-100 p-4 rounded-lg border-2 border-dashed border-gray-300 h-[360px] flex items-center justify-center">
        Loading spend trend...
      </div>
    );
  }

  if (!chartData.length) {
    return (
      <div className="w-full bg-gray-100 p-4 rounded-lg border-2 border-dashed border-gray-300 h-[360px] flex items-center justify-center">
        No spend trend data available.
      </div>
    );
  }

  const formatValue = (value: number) =>
    metricType === 'quantity'
      ? new Intl.NumberFormat('en-US').format(Number(value))
      : formatCurrency(Number(value));

  return (
    <div className="w-full bg-gray-100 p-4 rounded-lg border-2 border-dashed border-gray-300">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-lg font-bold text-gray-700">{title}</h3>
        {hasProjection && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-semibold border border-purple-200">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            ML Projection overlay active
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={380}>
        <LineChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="period"
            interval={0}
            angle={-30}
            textAnchor="end"
            height={70}
            tick={{ fontSize: 11, fill: '#4b5563' }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#4b5563' }}
            tickFormatter={formatValue}
          />
          <Tooltip
            formatter={(value, name) => [
              formatValue(Number(value)),
              name === 'pending_spend' ? 'ML Projection' : `Historical ${metricLabel}`,
            ]}
            labelFormatter={(label) => `Period: ${label}`}
            contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
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
              stroke="#7c3aed"
              strokeDasharray="4 2"
              strokeWidth={1.5}
              label={{ value: 'Projected →', position: 'insideTopRight', fontSize: 10, fill: '#7c3aed' }}
            />
          )}
          <Line
            type="monotone"
            dataKey="spend"
            stroke="#1e3a8a"
            strokeWidth={3}
            dot={{ r: 3, fill: '#1e3a8a' }}
            activeDot={{ r: 5 }}
            name="spend"
            connectNulls
          />
          {hasProjection && (
            <Line
              type="monotone"
              dataKey="pending_spend"
              stroke="#7c3aed"
              strokeWidth={2.5}
              strokeDasharray="6 3"
              dot={{ r: 4, fill: '#7c3aed', strokeWidth: 2, stroke: '#fff' }}
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
