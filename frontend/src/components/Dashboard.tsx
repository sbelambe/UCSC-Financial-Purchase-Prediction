import { useEffect, useState } from 'react';
import { TabNavigation } from './TabNavigation';
import { FilterBar } from './FilterBar';
import { MetricsGrid } from './MetricsGrid';
import { ChartsGrid } from './ChartsGrid';
import { generateDashboardData } from '../utils/dashboardData';
import { useAuth } from '../context/AuthContext';

/**
 * Dashboard Component
 * The main view for authenticated users. Displays financial metrics and charts.
 * * Features:
 * - Tab switching (Overall vs Specific Vendors)
 * - Filtering by Year and Category
 * - Search functionality
 */
export function Dashboard() {
  // get user info
  const {user} = useAuth();

  // --- State Management ---
  const [activeTab, setActiveTab] = useState<'Overall' | 'OneBuy' | 'ProCard' | 'Amazon' | 'Bookstore'>('Overall');
  const [selectedYear, setSelectedYear] = useState('2024');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [bookstoreData, setBookstoreData] = useState<any | null>(null);
  const [bookstoreLoading, setBookstoreLoading] = useState(false);
  const [bookstoreError, setBookstoreError] = useState<string | null>(null);

  // --- Data Generation ---
  const baseData = generateDashboardData(activeTab, selectedYear, selectedCategory);

  useEffect(() => {
    if (activeTab !== 'Bookstore') {
      setBookstoreError(null);
      setBookstoreLoading(false);
      return;
    }

    let isMounted = true;
    setBookstoreLoading(true);
    setBookstoreError(null);

    fetch('http://127.0.0.1:8000/api/analytics/bookstore-items?top_n=10&lookback_days=90')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Request failed (${res.status})`);
        }
        return res.json();
      })
      .then((payload) => {
        if (!isMounted) return;
        setBookstoreData(payload);
      })
      .catch((err) => {
        if (!isMounted) return;
        setBookstoreError(err?.message || 'Unable to load bookstore analytics');
        setBookstoreData(null);
      })
      .finally(() => {
        if (!isMounted) return;
        setBookstoreLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeTab]);

  const mapBookstoreToDashboardData = (apiData: any, fallback: any) => {
    const mostBought = Array.isArray(apiData?.most_bought) ? apiData.most_bought : [];
    const leastBought = Array.isArray(apiData?.least_bought) ? apiData.least_bought : [];
    const combined = [...mostBought, ...leastBought];

    const categoryTotals = combined.reduce((acc: Record<string, number>, row: any) => {
      const category = row?.product_category || 'Uncategorized';
      const quantity = Number(row?.quantity || 0);
      acc[category] = (acc[category] || 0) + quantity;
      return acc;
    }, {});

    const categoryData = Object.entries(categoryTotals)
      .map(([name, value]) => ({ name, value: Number(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const topProducts = mostBought.slice(0, 5).map((row: any) => ({
      name: String(row?.item || 'Unknown'),
      value: Number(row?.quantity || 0),
    }));

    const totalUnits = mostBought.reduce((sum: number, row: any) => sum + Number(row?.quantity || 0), 0);
    const totalTransactions = Number(apiData?.total_rows || 0);
    const topCategory = categoryData[0] || { name: fallback.topCategory.name, value: fallback.topCategory.amount };
    const mostPurchased = mostBought[0];

    return {
      ...fallback,
      totalTransactions: totalTransactions || fallback.totalTransactions,
      topVendorTransactions: {
        name: 'Bookstore',
        count: totalTransactions || fallback.topVendorTransactions.count,
      },
      vendorData: [
        { name: 'Bookstore', amount: totalUnits },
      ],
      topProducts: topProducts.length ? topProducts : fallback.topProducts,
      categoryData: categoryData.length ? categoryData : fallback.categoryData,
      topCategory: {
        name: topCategory.name,
        amount: Number(topCategory.value || fallback.topCategory.amount),
      },
      mostPurchasedItem: mostPurchased
        ? { name: String(mostPurchased.item), quantity: Number(mostPurchased.quantity || 0) }
        : fallback.mostPurchasedItem,
    };
  };

  const data = activeTab === 'Bookstore' && bookstoreData
    ? mapBookstoreToDashboardData(bookstoreData, baseData)
    : baseData;

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Filter Bar */}
      <FilterBar
        selectedYear={selectedYear}
        selectedCategory={selectedCategory}
        searchQuery={searchQuery}
        onYearChange={setSelectedYear}
        onCategoryChange={setSelectedCategory}
        onSearchChange={setSearchQuery}
      />

      {/* Main Content Area */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 min-h-[400px]">
        {activeTab === 'Bookstore' && bookstoreLoading && (
          <div className="mb-4 text-sm text-gray-500">Loading bookstore analytics...</div>
        )}
        {activeTab === 'Bookstore' && bookstoreError && (
          <div className="mb-4 text-sm text-red-600">{bookstoreError}. Showing fallback data.</div>
        )}
        <div className="space-y-8">
          {/* Metrics Grid */}
          <MetricsGrid data={data} />

          {/* Charts Grid */}
          <ChartsGrid data={data} activeTab={activeTab} />
        </div>
      </div>
    </div>
  );
}
