import { Calendar, Package, TrendingUp } from 'lucide-react';

interface FilterPanelProps {
  selectedYear: string;
  selectedProduct: string;
  selectedMetric: string;
  onYearChange: (year: string) => void;
  onProductChange: (product: string) => void;
  onMetricChange: (metric: string) => void;
}

export function FilterPanel({
  selectedYear,
  selectedProduct,
  selectedMetric,
  onYearChange,
  onProductChange,
  onMetricChange,
}: FilterPanelProps) {
  const years = ['2022', '2023', '2024', '2025', '2026'];
  const products = [
    { value: 'all', label: 'All Products' },
    { value: 'electronics', label: 'Electronics' },
    { value: 'office', label: 'Office Supplies' },
    { value: 'food', label: 'Food & Beverages' },
    { value: 'furniture', label: 'Furniture' },
  ];
  const metrics = [
    { value: 'revenue', label: 'Revenue' },
    { value: 'units', label: 'Units Sold' },
    { value: 'profit', label: 'Profit' },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold mb-4" style={{ color: '#003c6c' }}>
        Filters & Controls
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Year Filter */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <Calendar size={16} style={{ color: '#003c6c' }} />
            Year
          </label>
          <div className="flex flex-wrap gap-2">
            {years.map((year) => (
              <button
                key={year}
                onClick={() => onYearChange(year)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedYear === year
                    ? 'text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                style={selectedYear === year ? { backgroundColor: '#003c6c' } : {}}
              >
                {year}
              </button>
            ))}
          </div>
        </div>

        {/* Product Filter */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <Package size={16} style={{ color: '#003c6c' }} />
            Product Category
          </label>
          <select
            value={selectedProduct}
            onChange={(e) => onProductChange(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-opacity-50"
            style={{ focusRing: '#003c6c' }}
          >
            {products.map((product) => (
              <option key={product.value} value={product.value}>
                {product.label}
              </option>
            ))}
          </select>
        </div>

        {/* Metric Filter */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <TrendingUp size={16} style={{ color: '#003c6c' }} />
            View By
          </label>
          <select
            value={selectedMetric}
            onChange={(e) => onMetricChange(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-opacity-50"
            style={{ focusRing: '#003c6c' }}
          >
            {metrics.map((metric) => (
              <option key={metric.value} value={metric.value}>
                {metric.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
