export function generateMockData(year: string, product: string) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const baseRevenue = parseInt(year) >= 2024 ? 85000 : 70000;
  const variance = product === 'all' ? 1 : 0.6;

  const monthlyData = months.map((month, index) => {
    const seasonalFactor = 1 + Math.sin((index / 12) * Math.PI * 2) * 0.3;
    const revenue = Math.round((baseRevenue + Math.random() * 15000) * seasonalFactor * variance);
    const units = Math.round(revenue / 150);
    const profit = Math.round(revenue * 0.35);

    return {
      month,
      revenue,
      units,
      profit,
    };
  });

  const totalRevenue = monthlyData.reduce((sum, d) => sum + d.revenue, 0);
  const totalUnits = monthlyData.reduce((sum, d) => sum + d.units, 0);
  const avgOrderValue = Math.round(totalRevenue / (totalUnits / 2));
  const totalOrders = Math.round(totalUnits / 2);

  const productData = [
    { name: 'Electronics', value: Math.round(totalRevenue * 0.35) },
    { name: 'Office Supplies', value: Math.round(totalRevenue * 0.28) },
    { name: 'Food & Beverages', value: Math.round(totalRevenue * 0.18) },
    { name: 'Furniture', value: Math.round(totalRevenue * 0.12) },
    { name: 'Other', value: Math.round(totalRevenue * 0.07) },
  ];

  return {
    monthlyData,
    summary: {
      totalRevenue,
      totalUnits,
      avgOrderValue,
      totalOrders,
    },
    productData,
  };
}

export function generateVendorData(year: string) {
  const vendors = ['Amazon', 'Safeway', 'Staples'];
  
  const summary = [
    { name: 'Amazon', totalItems: 1247, color: '#FF9900' },
    { name: 'Safeway', totalItems: 583, color: '#E31837' },
    { name: 'Staples', totalItems: 892, color: '#CC0000' },
  ];

  const mostPurchased = [
    { name: 'Printer Paper (A4)', vendor: 'Amazon', quantity: 245, spent: 3920 },
    { name: 'USB Flash Drives', vendor: 'Staples', quantity: 180, spent: 2700 },
    { name: 'Coffee Pods', vendor: 'Safeway', quantity: 156, spent: 1872 },
  ];

  const leastPurchased = [
    { name: 'Specialty Markers', vendor: 'Staples', quantity: 12, spent: 180 },
    { name: 'Organic Snacks', vendor: 'Safeway', quantity: 8, spent: 120 },
    { name: 'HDMI Cables', vendor: 'Amazon', quantity: 15, spent: 225 },
  ];

  return {
    summary,
    mostPurchased,
    leastPurchased,
  };
}
