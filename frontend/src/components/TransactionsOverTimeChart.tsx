import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

type SpendPoint = {
  period: string;
  spend: number;
};

type TransactionsOverTimeChartProps = {
  data: SpendPoint[];
  title?: string;
  loading?: boolean;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);

const TransactionsOverTimeChart: React.FC<TransactionsOverTimeChartProps> = ({
  data,
  title = 'Spend Over Time',
  loading = false,
}) => {
  const chartData = (data || []).map((d) => ({
    period: String(d.period),
    spend: Number(d.spend) || 0,
  }));

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

  return (
    <div className="w-full bg-gray-100 p-4 rounded-lg border-2 border-dashed border-gray-300">
      <h3 className="text-lg font-bold text-gray-700 mb-4 text-center">{title}</h3>
      <div className="flex justify-center">
        <LineChart
          width={700}
          height={380}
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
            tickFormatter={(value) => formatCurrency(Number(value))}
          />
          <Tooltip
            formatter={(value: number) => formatCurrency(Number(value))}
            labelFormatter={(label) => `Period: ${label}`}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="spend"
            stroke="#1e3a8a"
            strokeWidth={3}
            dot={{ r: 3, fill: '#1e3a8a' }}
            activeDot={{ r: 5 }}
            name="Spend"
          />
        </LineChart>
      </div>
    </div>
  );
};

export default TransactionsOverTimeChart;
