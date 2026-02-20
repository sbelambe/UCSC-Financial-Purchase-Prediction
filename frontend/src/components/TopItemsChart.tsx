import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';

const TopItemsChart = ({ data }: { data: any[] }) => {
  // Transform data and log it one last time
  const chartData = (data || []).slice(0, 5).map(item => ({
    // Truncate to 15-20 characters for the X-axis label
    name: item.clean_item_name.length > 20 
      ? item.clean_item_name.substring(0, 20) + '...' 
      : item.clean_item_name,
    count: item.count,
    fullName: item.clean_item_name // Keep the full name for the Tooltip
  }));

  const COLORS = ['#1e3a8a', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'];

  return (
    <div className="w-full bg-gray-100 p-4 rounded-lg border-2 border-dashed border-gray-300">
      <h3 className="text-lg font-bold text-gray-700 mb-4 text-center">Most Frequent Purchases</h3>
      
      <div className="flex justify-center">
        <BarChart
          width={500}
          height={400} // Increased height slightly to accommodate rotated text
          data={data.slice(0, 5)}
          margin={{ top: 20, right: 30, left: 20, bottom: 100 }} // 1. Added large bottom margin
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis 
            dataKey="clean_item_name" 
            interval={0} // 2. Forces all labels to show
            angle={-45}  // 3. Tilts the text
            textAnchor="end" // 4. Aligns the end of the text to the tick mark
            height={100} // 5. Gives the X-Axis space to render the tilt
            tick={{ fontSize: 11, fill: '#4b5563' }}
            tickFormatter={(value) => 
              value.length > 15 ? `${value.substring(0, 15)}...` : value 
            } // 6. Truncates long strings
          />
          <YAxis />
          <Tooltip 
            /* Tooltip still shows the full name even if the axis is truncated */
            formatter={(value, name, props) => [value, "Quantity"]}
            labelStyle={{ fontWeight: 'bold' }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.slice(0, 5).map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </div>
    </div>
  );
};

export default TopItemsChart;