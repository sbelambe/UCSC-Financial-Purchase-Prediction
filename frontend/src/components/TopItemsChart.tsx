// Component for displaying a bar chart of the top 5 most frequently purchased
// items, with a dropdown to switch between frequency and total spend metrics.
import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, Legend } from 'recharts';
import type { TopItem } from './TopItemsTable';
import TopItemDrilldownPanel from './TopItemDrilldownPanel';

// TopItems Chart Component
// This component takes in an array of purchase data and visualizes the top 5 most
// frequently purchased items using a bar chart
const TopItemsChart = ({
  data,
  metricLabel = 'Total Spend',
  metricType = 'currency',
  title = 'Top Purchase Patterns',
  description = 'Compare the top purchase patterns across the selected dimension.',
  enableDrilldown = true,
  enableCostMetric = true,
}: {
  data: TopItem[];
  metricLabel?: string;
  metricType?: 'currency' | 'quantity' | 'mixed';
  title?: string;
  description?: string;
  enableDrilldown?: boolean;
  enableCostMetric?: boolean;
}) => {
  // state to track which metric is selected from the dropdown
  const [metric, setMetric] = useState<'count' | 'spend' | 'cost_per_item'>('count');
  const [selectedItem, setSelectedItem] = useState<TopItem | null>(null);

  type ChartDataPoint = TopItem & {
    name: string;
    fullName: string;
  };

  const chartData = useMemo(() => {
    const sortedData = [...(data || [])].sort((a, b) => {
      if (metric === 'spend') {
        return (b.total_spent || 0) - (a.total_spent || 0);
      } else if (metric === 'cost_per_item') {
        return (b.cost_per_item || 0) - (a.cost_per_item || 0);
      } else {
        return (b.count || 0) - (a.count || 0);
      }
    });

    // Map and truncate only the top 5
    return sortedData.slice(0, 5).map((item): ChartDataPoint => ({
      // Truncate to 15-20 characters for the X-axis label
      name: item.clean_item_name.length > 20 
        ? item.clean_item_name.substring(0, 20) + '...' 
        : item.clean_item_name,
      count: item.count || 0,
      total_spent: Number(item.total_spent) || 0,
      cost_per_item: Number(item.cost_per_item) || 0,
      quantity: Number(item.quantity) || 0,
      fullName: item.clean_item_name,

      vendors: item.vendors || [],
      row_values: item.row_values,
      is_condensed: item.is_condensed,
      condensed_group: item.condensed_group,
      drilldown_items: item.drilldown_items,
      dataset: item.dataset,
      clean_item_name: item.clean_item_name,
    }));
  }, [data, metric]);

  useEffect(() => {
    if (metric === 'cost_per_item' && !enableCostMetric) {
      setMetric('count');
    }
  }, [metric, enableCostMetric]);

  useEffect(() => {
    if (!enableDrilldown) {
      setSelectedItem(null);
      return;
    }
    if (!selectedItem) return;
    const stillVisible = chartData.some((item) => item.fullName === selectedItem.clean_item_name);
    if (!stillVisible) {
      setSelectedItem(null);
    }
  }, [chartData, selectedItem, enableDrilldown]);

  const COLORS = ['#003c6c', '#2d66ae', '#4f8fd0', '#7baee8', '#9cc6ee'];

  //Currency Formatter for the tooltip and y-axis
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  // Smart Y-Axis formatter to prevent large numbers from overlapping
  const yAxisFormatter = (value: number) => {
    if ((metric === 'spend' || metric === 'cost_per_item') && metricType !== 'quantity') {
      if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
      if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
      return `$${value.toFixed(0)}`;
    }
    // Format large transaction counts with commas
    return new Intl.NumberFormat('en-US').format(value);
  };

  return (
    <div className="w-full min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      
      {/* Flex Header with Dropdown */}
      <div className="mb-4 flex flex-col gap-3 px-4 sm:items-center">
        <h3 className="text-lg font-bold leading-tight text-[#003c6c]">
          {title}
        </h3>
        <select
          value={metric}
          onChange={(e) => setMetric(e.target.value as 'count' | 'spend' | 'cost_per_item')}
          className="cursor-pointer rounded-lg border border-[#2d66ae] bg-[#2d66ae] px-3 py-2 text-sm font-semibold text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2d66ae]"
          style={{ outlineColor: '#003c6c' }}
        >
          <option value="count">Number of Transactions</option>
          <option value="spend">{metricLabel}</option>
          {enableCostMetric && <option value="cost_per_item">Cost Per Item</option>}
        </select>
      </div>
      
      <div className="mb-3 px-4 text-xs text-slate-500">
      </div>

      <div className={`grid min-w-0 grid-cols-1 gap-6 ${enableDrilldown ? 'lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]' : ''}`}>
        <div className="w-full overflow-x-auto">
          <div className="mx-auto min-w-[680px]">
            <BarChart
              width={760}
              height={500}
              data={chartData}
              margin={{ top: 20, right: 20, left: 10, bottom: 100 }}
            >
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
              <XAxis 
                dataKey="name"
                interval={0}
                angle={-45} 
                textAnchor="end" 
                height={100} 
                tick={{ fontSize: 11, fill: '#475569' }}
                tickFormatter={(value) => 
                  value.length > 15 ? `${value.substring(0, 15)}...` : value 
                } 
              />
              
              <YAxis tick={{ fontSize: 11, fill: '#475569' }} tickFormatter={yAxisFormatter} width={80} />

              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload as ChartDataPoint;
                    return (
                      <div className="z-50 rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
                        <p className="mb-2 border-b border-slate-200 pb-1 text-sm font-bold text-[#003c6c]">
                          {d.fullName}
                        </p>
                        <div className="space-y-1">
                          <p className={`text-xs font-semibold ${metric === 'count' ? 'text-[#2d66ae]' : 'text-slate-500'}`}>
                            Frequency: <span className="font-mono text-slate-600">{d.count}</span>
                          </p>
                          <p className={`text-xs font-semibold ${metric === 'spend' ? 'text-[#2d66ae]' : 'text-slate-500'}`}>
                            {metricLabel}: <span className="font-mono text-slate-600">{metricType === 'quantity' ? new Intl.NumberFormat('en-US').format(d.total_spent) : formatCurrency(d.total_spent)}</span>
                          </p>
                          <p className={`text-xs font-semibold ${metric === 'cost_per_item' ? 'text-[#2d66ae]' : 'text-slate-500'}`}>
                            Cost Per Item: <span className="font-mono text-slate-600">{formatCurrency(d.cost_per_item || 0)}</span>
                          </p>
                          <p className="text-xs font-semibold text-slate-500">
                            Quantity: <span className="font-mono text-slate-600">{new Intl.NumberFormat('en-US').format(d.quantity || 0)}</span>
                          </p>

                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              <Bar
                dataKey={metric === 'count' ? "count" : (metric === 'cost_per_item' ? 'cost_per_item' : "total_spent")}
                name={
                  metric === 'count'
                    ? "Current Frequency"
                    : (metric === 'cost_per_item' ? "Cost Per Item" : metricLabel)
                }
                radius={[4, 4, 0, 0]}
              >
                {chartData.map((entry, index) => {
                  const isSelected = selectedItem?.clean_item_name === entry.clean_item_name;
                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                      cursor={enableDrilldown ? 'pointer' : 'default'}
                      stroke={isSelected ? '#0f172a' : undefined}
                      strokeWidth={isSelected ? 2 : 0}
                      onClick={() => enableDrilldown && setSelectedItem(entry)}
                    />
                  );
                })}
              </Bar>

            </BarChart>
          </div>
        </div>

        {enableDrilldown && (
          <TopItemDrilldownPanel
            selectedItem={selectedItem}
            metricLabel={metricLabel}
            metricType={metricType}
          />
        )}
      </div>
    </div>
  );
};

export default TopItemsChart;