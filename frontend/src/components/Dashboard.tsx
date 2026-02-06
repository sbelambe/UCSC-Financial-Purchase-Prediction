import { useState } from 'react';
import { TabNavigation } from './TabNavigation';
import { FilterBar } from './FilterBar';
import { MetricsGrid } from './MetricsGrid';
import { ChartsGrid } from './ChartsGrid';
import { generateDashboardData } from '../utils/dashboardData';
import { useAuth } from '../context/AuthContext';

export function Dashboard() {
  // get user info
  const {user, signOut} = useAuth();

  const [activeTab, setActiveTab] = useState<'Overall' | 'OneBuy' | 'ProCard' | 'Amazon' | 'Bookstore'>('Overall');
  const [selectedYear, setSelectedYear] = useState('2024');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const data = generateDashboardData(activeTab, selectedYear, selectedCategory);

  return (
    <div className="space-y-6">
      {/* header with logout button */}
      <div className="flex justify-between items-center mb-6">
         <div>
            <h1 className="text-2xl font-bold text-gray-800">Slugsmart Dashboard</h1>
            <p className="text-sm text-gray-500">Welcome, {user?.email}</p>
         </div>
         <button 
           onClick={signOut}
           className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded hover:bg-red-50"
         >
           Sign Out
         </button>
      </div>

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
