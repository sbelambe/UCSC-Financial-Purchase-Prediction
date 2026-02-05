import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

interface ChartsGridProps {
  data: any;
  activeTab: string;
}

const COLORS = ['#003c6c', '#fdc700', '#2563eb', '#10b981', '#8b5cf6', '#ef4444'];

export function ChartsGrid({ data, activeTab }: ChartsGridProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-4" style={{ color: '#003c6c' }}>
        Data Visualizations
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Spending Trend */}
        <ChartCard title="Monthly Spending Trend">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data.monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#6b7280" style={{ fontSize: '12px' }} />
              <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="amount"
                stroke="#003c6c"
                strokeWidth={3}
                dot={{ fill: '#003c6c', r: 4 }}
                activeDot={{ r: 6, fill: '#fdc700' }}
                name="Spending"
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Category Breakdown */}
        <ChartCard title="Spending by Category">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={data.categoryData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={90}
                fill="#8884d8"
                dataKey="value"
              >
                {data.categoryData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Vendor Comparison */}
        <ChartCard title="Vendor Comparison">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.vendorData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '12px' }} />
              <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Bar dataKey="amount" fill="#003c6c" radius={[8, 8, 0, 0]} name="Amount Spent" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Transaction Volume */}
        <ChartCard title="Transaction Volume Over Time">
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={data.transactionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#6b7280" style={{ fontSize: '12px' }} />
              <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="transactions"
                stroke="#003c6c"
                fill="#003c6c"
                fillOpacity={0.3}
                name="Transactions"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Top Products */}
        <ChartCard title="Top 5 Products by Spend">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.topProducts} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" stroke="#6b7280" style={{ fontSize: '12px' }} />
              <YAxis type="category" dataKey="name" stroke="#6b7280" style={{ fontSize: '12px' }} width={100} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="value" fill="#fdc700" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Quarterly Comparison */}
        <ChartCard title="Quarterly Spend Comparison">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.quarterlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="quarter" stroke="#6b7280" style={{ fontSize: '12px' }} />
              <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Bar dataKey="current" fill="#003c6c" radius={[8, 8, 0, 0]} name="Current Year" />
              <Bar dataKey="previous" fill="#94a3b8" radius={[8, 8, 0, 0]} name="Previous Year" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border-2 border-gray-200 p-5 hover:shadow-md transition-all">
      <h3 className="text-sm font-semibold mb-4 text-gray-700">{title}</h3>
      {children}
    </div>
  );
}
