import { useState } from 'react';
import { TabNavigation } from './TabNavigation';
import { FilterBar } from './FilterBar';
import { MetricsGrid } from './MetricsGrid';
import { ChartsGrid } from './ChartsGrid';
import { generateDashboardData } from '../utils/dashboardData';

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<'Overall' | 'OneBuy' | 'ProCard' | 'Amazon' | 'Bookstore'>('Overall');
  const [selectedYear, setSelectedYear] = useState('2024');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const data = generateDashboardData(activeTab, selectedYear, selectedCategory);

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
