import { DollarSign, ShoppingCart, TrendingUp, Package, Tag, BarChart3 } from 'lucide-react';

interface MetricsGridProps {
  data: any;
}

export function MetricsGrid({ data }: MetricsGridProps) {
  const metrics = [
    {
      icon: <DollarSign size={24} />,
      label: 'Total Spend',
      value: `$${data.totalSpend.toLocaleString()}`,
      subtext: 'All purchases',
    },
    {
      icon: <ShoppingCart size={24} />,
      label: 'Number of Transactions',
      value: data.totalTransactions.toLocaleString(),
      subtext: 'This period',
    },
    {
      icon: <TrendingUp size={24} />,
      label: 'Top Vendor by Spend',
      value: data.topVendorSpend.name,
      subtext: `$${data.topVendorSpend.amount.toLocaleString()}`,
    },
    {
      icon: <Package size={24} />,
      label: 'Top Vendor Transactions',
      value: data.topVendorTransactions.name,
      subtext: `${data.topVendorTransactions.count} transactions`,
    },
    {
      icon: <Tag size={24} />,
      label: 'Top Category',
      value: data.topCategory.name,
      subtext: `$${data.topCategory.amount.toLocaleString()}`,
    },
    {
      icon: <BarChart3 size={24} />,
      label: 'Most Purchased Item',
      value: data.mostPurchasedItem.name,
      subtext: `${data.mostPurchasedItem.quantity} units`,
    },
  ];

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4" style={{ color: '#003c6c' }}>
        Key Metrics
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {metrics.map((metric, index) => (
          <div
            key={index}
            className="bg-gradient-to-br from-white to-gray-50 rounded-lg border-2 p-4 hover:shadow-md transition-all"
            style={{ borderColor: '#e5e7eb' }}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
              style={{ backgroundColor: '#f0f5ff' }}
            >
              <div style={{ color: '#003c6c' }}>{metric.icon}</div>
            </div>
            <p className="text-xs text-gray-600 mb-1">{metric.label}</p>
            <p className="text-lg font-bold mb-1" style={{ color: '#003c6c' }}>
              {metric.value}
            </p>
            <p className="text-xs" style={{ color: '#fdc700' }}>
              {metric.subtext}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
