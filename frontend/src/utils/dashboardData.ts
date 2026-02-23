export function generateDashboardData(
  tab: string,
  year: string,
  category: string
) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  // Generate monthly spending data
  const monthlyData = months.map((month) => ({
    month,
    amount: Math.floor(Math.random() * 50000) + 30000,
  }));

  // Generate transaction volume data
  const transactionData = months.map((month) => ({
    month,
    transactions: Math.floor(Math.random() * 300) + 150,
  }));

  // Category breakdown
  const categoryData = [
    { name: 'Office Supplies', value: 45000 },
    { name: 'Electronics', value: 35000 },
    { name: 'Furniture', value: 28000 },
    { name: 'Food & Beverages', value: 18000 },
    { name: 'Books', value: 12000 },
  ];

  // Vendor data based on tab
  let vendorData = [];
  if (tab === 'Overall') {
    vendorData = [
      { name: 'Amazon', amount: 85000 },
      { name: 'OneBuy', amount: 65000 },
      { name: 'ProCard', amount: 52000 },
      { name: 'Bookstore', amount: 38000 },
    ];
  } else {
    vendorData = [
      { name: 'Q1', amount: 45000 },
      { name: 'Q2', amount: 52000 },
      { name: 'Q3', amount: 48000 },
      { name: 'Q4', amount: 63000 },
    ];
  }

  // Top products
  const topProducts = [
    { name: 'Printer Paper', value: 8500 },
    { name: 'USB Drives', value: 7200 },
    { name: 'Laptops', value: 6800 },
    { name: 'Office Chairs', value: 5400 },
    { name: 'Notebooks', value: 4900 },
  ];

  // Quarterly comparison
  const quarterlyData = [
    { quarter: 'Q1', current: 45000, previous: 38000 },
    { quarter: 'Q2', current: 52000, previous: 46000 },
    { quarter: 'Q3', current: 48000, previous: 51000 },
    { quarter: 'Q4', current: 63000, previous: 55000 },
  ];

  // Summary metrics
  const totalSpend = monthlyData.reduce((sum, m) => sum + m.amount, 0);
  const totalTransactions = transactionData.reduce((sum, t) => sum + t.transactions, 0);

  return {
    totalSpend,
    totalTransactions,
    topVendorSpend: { name: 'Amazon', amount: 85000 },
    topVendorTransactions: { name: 'OneBuy', count: 1247 },
    topCategory: { name: 'Office Supplies', amount: 45000 },
    mostPurchasedItem: { name: 'Printer Paper (A4)', quantity: 2450 },
    monthlyData,
    transactionData,
    categoryData,
    vendorData,
    topProducts,
    quarterlyData,
  };
}
