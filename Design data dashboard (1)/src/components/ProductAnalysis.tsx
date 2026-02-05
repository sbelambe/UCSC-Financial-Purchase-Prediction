import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface ProductAnalysisProps {
  data: any;
}

const COLORS = ['#003c6c', '#fdc700', '#2563eb', '#10b981', '#8b5cf6'];

export function ProductAnalysis({ data }: ProductAnalysisProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold mb-6" style={{ color: '#003c6c' }}>
        Sales by Product Category
      </h2>

      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data.productData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {data.productData.map((entry: any, index: number) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => `$${value.toLocaleString()}`}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="mt-6 space-y-3">
        {data.productData.map((product: any, index: number) => (
          <div key={product.name} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="text-sm font-medium text-gray-700">{product.name}</span>
            </div>
            <span className="text-sm font-bold" style={{ color: '#003c6c' }}>
              ${product.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
