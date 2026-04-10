import React, { useMemo } from 'react';
import {
  Cell,
  CartesianGrid,
  Legend,
  ReferenceLine,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type HighImpactScatterPlotProps = {
  data: any[];
  metricLabel?: string;
  metricType?: 'currency' | 'quantity' | 'mixed';
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);

const formatMetric = (value: number, metricType: HighImpactScatterPlotProps['metricType']) => {
  if (metricType === 'quantity') {
    return new Intl.NumberFormat('en-US').format(value);
  }
  return formatCurrency(value);
};

export function HighImpactScatterPlot({
  data,
  metricLabel = 'Total Spend',
  metricType = 'currency',
}: HighImpactScatterPlotProps) {
  const chartData = useMemo(
    () =>
      (data || []).map((item) => ({
        name: item.clean_item_name,
        frequency: Number(item.count || 0) + Number(item.projected_count || 0),
        metric: Number(item.total_spent || 0) + Number(item.projected_spent || 0),
      })),
    [data]
  );

  const averageFrequency =
    chartData.length > 0
      ? chartData.reduce((sum, item) => sum + item.frequency, 0) / chartData.length
      : 0;
  const averageMetric =
    chartData.length > 0
      ? chartData.reduce((sum, item) => sum + item.metric, 0) / chartData.length
      : 0;

  const classifyItem = (frequency: number, metric: number) => {
    if (frequency >= averageFrequency && metric >= averageMetric) {
      return 'High Impact Item';
    }
    if (frequency >= averageFrequency && metric < averageMetric) {
      return 'Frequent, Lower Cost';
    }
    if (frequency < averageFrequency && metric >= averageMetric) {
      return 'Less Frequent, Higher Cost';
    }
    return 'Lower Impact Item';
  };

  if (!chartData.length) {
    return (
      <div className="w-full bg-gray-100 p-4 rounded-lg border-2 border-dashed border-gray-300 h-[420px] flex items-center justify-center">
        No item data available for the high-impact scatter plot.
      </div>
    );
  }

  return (
    <div className="w-full bg-gray-100 p-4 rounded-lg border-2 border-dashed border-gray-300">
      <div className="mb-4 px-4">
        <h3 className="text-lg font-bold text-gray-700">High Impact Items</h3>
        <p className="text-sm text-gray-500">
          Items in the top-right quadrant combine high purchase frequency with high {metricLabel.toLowerCase()}.
        </p>
      </div>

      <div className="flex justify-center">
        <ScatterChart width={780} height={420} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="frequency"
            name="Frequency"
            tick={{ fontSize: 11, fill: '#4b5563' }}
            label={{ value: 'Number of Purchases', position: 'insideBottom', offset: -10 }}
          />
          <YAxis
            type="number"
            dataKey="metric"
            name={metricLabel}
            tick={{ fontSize: 11, fill: '#4b5563' }}
            tickFormatter={(value) => formatMetric(Number(value), metricType)}
            width={100}
            label={{
              value: metricLabel,
              angle: -90,
              position: 'insideLeft',
            }}
          />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0].payload;
              const label = classifyItem(point.frequency, point.metric);

              return (
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
                  <p className="mb-2 border-b pb-1 text-sm font-bold text-slate-900">
                    {point.name}
                  </p>
                  <p className="mb-2 text-xs font-semibold text-blue-700">
                    {label}
                  </p>
                  <div className="space-y-1 text-xs text-slate-600">
                    <p>
                      Frequency: <span className="font-mono">{new Intl.NumberFormat('en-US').format(point.frequency)}</span>
                    </p>
                    <p>
                      {metricLabel}: <span className="font-mono">{formatMetric(point.metric, metricType)}</span>
                    </p>
                  </div>
                </div>
              );
            }}
          />
          <Legend verticalAlign="bottom" align="center" wrapperStyle={{ paddingTop: '24px' }} />
          <ReferenceLine
            x={averageFrequency}
            stroke="#fca5a5"
            label={{ value: '', position: 'top', fill: '#b91c1c', fontSize: 11 }}
          />
          <ReferenceLine
            y={averageMetric}
            stroke="#fca5a5"
            label={{ value: '', position: 'right', fill: '#b91c1c', fontSize: 11 }}
          />
          <Scatter name="Items" data={chartData} fill="#2563eb">
            {chartData.map((_, index) => (
              <Cell key={`scatter-cell-${index}`} fill="#2563eb" />
            ))}
          </Scatter>
        </ScatterChart>
      </div>
    </div>
  );
}

export default HighImpactScatterPlot;
