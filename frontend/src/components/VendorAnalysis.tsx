import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Package } from 'lucide-react';
import { generateVendorData } from '../utils/mockData';

interface VendorAnalysisProps {
  year: string;
}

export function VendorAnalysis({ year }: VendorAnalysisProps) {
  const vendorData = generateVendorData(year);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-6">
        <Package size={20} style={{ color: '#003c6c' }} />
        <h2 className="text-lg font-semibold" style={{ color: '#003c6c' }}>
          External Vendor Purchases
        </h2>
      </div>

      {/* Vendor Summary Cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {vendorData.summary.map((vendor) => (
          <div
            key={vendor.name}
            className="p-3 rounded-lg border-2 transition-all hover:shadow-md"
            style={{ borderColor: vendor.color }}
          >
            <p className="text-xs text-gray-600 mb-1">{vendor.name}</p>
            <p className="text-lg font-bold" style={{ color: '#003c6c' }}>
              {vendor.totalItems}
            </p>
            <p className="text-xs text-gray-500">items</p>
          </div>
        ))}
      </div>

      {/* Most Purchased Items */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={16} className="text-green-600" />
          <h3 className="text-sm font-semibold text-gray-700">Most Purchased (Need Less Stock)</h3>
        </div>
        <div className="space-y-2">
          {vendorData.mostPurchased.map((item) => (
            <div key={item.name} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">{item.name}</p>
                <p className="text-xs text-gray-600">
                  {item.vendor} • {item.quantity} units
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-green-700">${item.spent.toLocaleString()}</p>
                <p className="text-xs text-gray-500">spent</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Least Purchased Items */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <TrendingDown size={16} className="text-orange-600" />
          <h3 className="text-sm font-semibold text-gray-700">Least Purchased (Need More Stock)</h3>
        </div>
        <div className="space-y-2">
          {vendorData.leastPurchased.map((item) => (
            <div key={item.name} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">{item.name}</p>
                <p className="text-xs text-gray-600">
                  {item.vendor} • {item.quantity} units
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-orange-700">${item.spent.toLocaleString()}</p>
                <p className="text-xs text-gray-500">spent</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
