// Renders the filter bar at the top of the dashboard
import { Search } from 'lucide-react';
import React from 'react';

// Define the props for the FilterBar component, including the
// current filter values and the callback functions to update them
interface FilterBarProps {
  selectedYear: string;
  selectedCategory: string;
  searchQuery: string;
  minSpend: number;
  selectedLimit: number;
  selectedSortMode: 'frequency' | 'cost';
  isLiveMode?: boolean;
  onYearChange: (year: string) => void;
  onCategoryChange: (category: string) => void;
  onSearchChange: (query: string) => void;
  onMinSpendChange: (minSpend: number) => void;
  onLimitChange: (limit: number) => void;
  onSortModeChange: (sortMode: 'frequency' | 'cost') => void;
}

// The FilterBar component renders dropdowns for year and category filters,
// an input for minimum spend, and a search bar
export function FilterBar({
  selectedYear,
  selectedCategory,
  searchQuery,
  minSpend,
  selectedLimit,
  selectedSortMode,
  isLiveMode = false,
  onYearChange,
  onCategoryChange,
  onSearchChange,
  onMinSpendChange,
  onLimitChange,
  onSortModeChange,
}: FilterBarProps) {
  // Added 'All Time' so the dashboard doesn't default to an empty view
  const years = ['All Time', '2026', '2025', '2024']; 
  
  // Custom categories matching your campus procurement data
  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'technology', label: 'Technology & IT' },
    { value: 'lab-supplies', label: 'Lab & Science Supplies' },
    { value: 'office', label: 'Office & Classroom' },
    { value: 'facilities', label: 'Facilities & Maintenance' },
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center gap-4">
        <div className="text-sm font-medium text-gray-700">Filter:</div>
        
        {/* Year Filter */}
        <select
          value={selectedYear}
          onChange={(e) => onYearChange(e.target.value)}
          className="px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-opacity-50 text-sm"
          style={{ outlineColor: '#003c6c' }}
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {year === 'All Time' ? year : `Year: ${year}`}
            </option>
          ))}
        </select>

        {/* Category Filter */}
        <select
          value={selectedCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-opacity-50 text-sm"
          style={{ outlineColor: '#003c6c' }}
        >
          {categories.map((category) => (
            <option key={category.value} value={category.value}>
              {category.label}
            </option>
          ))}
        </select>

        

        {/* Minimum Spend Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 font-medium">Min $</span>
          <input
            type="number"
            min="0"
            step="100"
            value={minSpend || ''}
            onChange={(e) => onMinSpendChange(Number(e.target.value))}
            placeholder="0"
            className="w-24 p-1 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-opacity-50 text-sm"
            style={{ outlineColor: '#003c6c' }}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 font-medium">Limit</span>
          <select
            value={selectedLimit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-opacity-50 text-sm"
            style={{ outlineColor: '#003c6c' }}
          >
            {[10, 20, 50].map((limit) => (
              <option key={limit} value={limit}>
                {limit}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 font-medium">Sort</span>
          <select
            value={selectedSortMode}
            onChange={(e) => onSortModeChange(e.target.value as 'frequency' | 'cost')}
            className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-opacity-50 text-sm"
            style={{ outlineColor: '#003c6c' }}
          >
            <option value="frequency">Frequency</option>
            <option value="cost">Cost</option>
          </select>
        </div>

        {/* Search Bar */}
        <div className="flex-1 relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={isLiveMode ? 'BigQuery search: paper, vendor:amazon, year:2025' : 'Search item name, vendor, etc.'}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-opacity-50 text-sm"
            style={{ outlineColor: '#003c6c' }}
          />
        </div>

      </div>
    </div>
  );
}
