import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, Legend } from 'recharts';

const TopItemsChart = ({ data }: { data: any[] }) => {
  // transform data and log it one last time
  const chartData = (data || []).slice(0, 5).map(item => ({
    // truncate to 15-20 characters for the X-axis label
    name: item.clean_item_name.length > 20 
      ? item.clean_item_name.substring(0, 20) + '...' 
      : item.clean_item_name,
    count: item.count,
    total_spent: Number(item.total_spent) || 0,
    fullName: item.clean_item_name,
    projected_count: item.projected_count ? Number(item.projected_count) : undefined,
    projected_spent: item.projected_spent ? Number(item.projected_spent) : undefined,
  }));

  const COLORS = ['#1e3a8a', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'];

  // Currency Formatter for the tooltip
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  return (
    <div className="w-full bg-gray-100 p-4 rounded-lg border-2 border-dashed border-gray-300">
      <h3 className="text-lg font-bold text-gray-700 mb-4 text-center">Top 5 Most Frequent Purchases</h3>
      
      <div className="flex justify-center">
        <BarChart
          width={700}
          height={500}
          data={chartData} 
          margin={{ top: 20, right: 30, left: 20, bottom: 100 }} 
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis 
            dataKey="name"
            interval={0}
            angle={-45} 
            textAnchor="end" 
            height={100} 
            tick={{ fontSize: 11, fill: '#4b5563' }}
            tickFormatter={(value) => 
              value.length > 15 ? `${value.substring(0, 15)}...` : value 
            } 
          />
          <YAxis />

          <Tooltip 
            cursor={{ fill: '#f8fafc' }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const d = payload[0].payload; 
                return (
                  <div className="bg-white p-4 shadow-xl border border-slate-100 rounded-lg z-50">
                    <p className="font-bold text-slate-900 text-sm mb-2 border-b pb-1">
                      {d.fullName}
                    </p>
                    <div className="space-y-1">
                      <p className="text-blue-700 text-xs font-semibold">
                        Frequency: <span className="font-mono text-slate-600">{d.count}</span>
                      </p>
                      <p className="text-slate-500 text-xs font-semibold">
                        Total Cost: <span className="font-mono text-slate-600">{formatCurrency(d.total_spent)}</span>
                      </p>
                      
                      {/* display sandbox preview stats in the tooltip if they exist */}
                      {d.projected_count > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <p className="text-purple-700 text-xs font-semibold">
                            Pending Frequency: <span className="font-mono text-purple-600">+{d.projected_count}</span>
                          </p>
                          <p className="text-purple-500 text-xs font-semibold">
                            Pending Cost: <span className="font-mono text-purple-600">+{formatCurrency(d.projected_spent)}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />

          <Legend wrapperStyle={{ paddingTop: '10px' }} />

          {/* Base Historical Count Bar */}
          <Bar dataKey="count" name="Current Frequency" stackId="a" radius={[0, 0, 4, 4]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>

          {/* Sandbox Preview Stacked Bar */}
          <Bar 
            dataKey="projected_count" 
            name="Pending Upload" 
            stackId="a" 
            fill="#a855f7" 
            radius={[4, 4, 0, 0]} 
          />

        </BarChart>
      </div>
    </div>
  );
};

export default TopItemsChart;