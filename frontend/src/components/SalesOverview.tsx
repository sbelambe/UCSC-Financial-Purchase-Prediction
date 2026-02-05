import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DollarSign, TrendingUp, Package, Users } from 'lucide-react';
import { useState } from 'react';

interface SalesOverviewProps {
  data: any;
  metric: string;
}

export function SalesOverview({ data, metric }: SalesOverviewProps) {
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  const getMetricLabel = () => {
    switch (metric) {
      case 'revenue':
        return 'Revenue';
      case 'units':
        return 'Units Sold';
      case 'profit':
        return 'Profit';
      default:
        return 'Revenue';
    }
  };

  const formatValue = (value: number) => {
    if (metric === 'units') {
      return value.toLocaleString();
    }
    return `$${(value / 1000).toFixed(1)}k`;
  };

  return (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          icon={<DollarSign size={24} />}
          label="Total Revenue"
          value={`$${data.summary.totalRevenue.toLocaleString()}`}
          trend="+12.5%"
          trendUp={true}
        />
        <MetricCard
          icon={<Package size={24} />}
          label="Units Sold"
          value={data.summary.totalUnits.toLocaleString()}
          trend="+8.3%"
          trendUp={true}
        />
        <MetricCard
          icon={<TrendingUp size={24} />}
          label="Avg Order Value"
          value={`$${data.summary.avgOrderValue}`}
          trend="+5.2%"
          trendUp={true}
        />
        <MetricCard
          icon={<Users size={24} />}
          label="Total Orders"
          value={data.summary.totalOrders.toLocaleString()}
          trend="-2.1%"
          trendUp={false}
        />
      </div>

      {/* Main Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold" style={{ color: '#003c6c' }}>
            {getMetricLabel()} Over Time
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setChartType('line')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                chartType === 'line'
                  ? 'text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              style={chartType === 'line' ? { backgroundColor: '#003c6c' } : {}}
            >
              Line Chart
            </button>
            <button
              onClick={() => setChartType('bar')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                chartType === 'bar'
                  ? 'text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              style={chartType === 'bar' ? { backgroundColor: '#003c6c' } : {}}
            >
              Bar Chart
            </button>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={350}>
          {chartType === 'line' ? (
            <LineChart data={data.monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#6b7280" />
              <YAxis stroke="#6b7280" tickFormatter={formatValue} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
                formatter={(value: number) => [formatValue(value), getMetricLabel()]}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey={metric}
                stroke="#003c6c"
                strokeWidth={3}
                dot={{ fill: '#003c6c', r: 4 }}
                activeDot={{ r: 6, fill: '#fdc700' }}
                name={getMetricLabel()}
              />
            </LineChart>
          ) : (
            <BarChart data={data.monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#6b7280" />
              <YAxis stroke="#6b7280" tickFormatter={formatValue} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
                formatter={(value: number) => [formatValue(value), getMetricLabel()]}
              />
              <Legend />
              <Bar dataKey={metric} fill="#003c6c" name={getMetricLabel()} radius={[8, 8, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  trend,
  trendUp,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend: string;
  trendUp: boolean;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-3">
        <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#f0f5ff' }}>
          <div style={{ color: '#003c6c' }}>{icon}</div>
        </div>
        <span
          className={`text-sm font-medium px-2 py-1 rounded ${
            trendUp ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}
        >
          {trend}
        </span>
      </div>
      <p className="text-sm text-gray-600 mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color: '#003c6c' }}>
        {value}
      </p>
    </div>
  );
}
