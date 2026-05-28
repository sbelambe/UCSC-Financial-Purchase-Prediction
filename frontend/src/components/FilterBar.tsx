// Renders the filter bar at the top of the dashboard
import { Search, Zap } from 'lucide-react';
import React from 'react';
import { BROAD_CATEGORIES } from '../lib/categoryMapping';

type QuarterName = 'All Quarters' | 'Fall' | 'Winter' | 'Spring' | 'Summer';

// Define the props for the FilterBar component, including the
// current filter values and the callback functions to update them
interface FilterBarProps {
  selectedYear: string;
  selectedQuarter: QuarterName;
  selectedCategory: string;
  availableYears: string[];
  searchQuery: string;
  minSpend: number;
  selectedLimit: number;
  selectedSortMode: 'frequency' | 'cost';
  highImpactOnly: boolean;
  isLiveMode?: boolean;
  onYearChange: (year: string) => void;
  onQuarterChange: (quarter: QuarterName) => void;
  onCategoryChange: (category: string) => void;
  onSearchChange: (query: string) => void;
  onMinSpendChange: (minSpend: number) => void;
  onLimitChange: (limit: number) => void;
  onSortModeChange: (sortMode: 'frequency' | 'cost') => void;
  onHighImpactChange: (highImpactOnly: boolean) => void;
}

// The FilterBar component renders dropdowns for year and category filters,
// an input for minimum spend, and a search bar
export function FilterBar({
  selectedYear,
  selectedQuarter,
  selectedCategory,
  availableYears,
  searchQuery,
  minSpend,
  selectedLimit,
  selectedSortMode,
  highImpactOnly,
  isLiveMode = false,
  onYearChange,
  onQuarterChange,
  onCategoryChange,
  onSearchChange,
  onMinSpendChange,
  onLimitChange,
  onSortModeChange,
  onHighImpactChange,
}: FilterBarProps) {
  // Added 'All Time' so the dashboard doesn't default to an empty view
  const years = ['All Time', ...Array.from(new Set(availableYears))];
  
  
  const quarters = [
    'All Quarters',
    'Fall',
    'Winter',
    'Spring',
    'Summer',
  ]; 

  const categories = BROAD_CATEGORIES;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">

      {/* Search — full width on its own row */}
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={isLiveMode ? 'Search items, e.g. paper, pens, notebooks…' : 'Search item name, vendor, etc.'}
          className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-opacity-50 text-sm"
          style={{ outlineColor: '#003c6c' }}
        />
      </div>

      {/* Filter controls — wrapping row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 mr-1">
          Filters
        </span>

        {/* Year */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-gray-500">Year</label>
          <select
            value={selectedYear}
            onChange={(e) => onYearChange(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-opacity-50 text-sm bg-white"
            style={{ outlineColor: '#003c6c' }}
          >
            {years.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        {/* Quarter */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-gray-500">Quarter</label>
          <select
            value={selectedQuarter}
            onChange={(e) => onQuarterChange(e.target.value as QuarterName)}
            className="px-3 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-opacity-50 text-sm bg-white"
            style={{ outlineColor: '#003c6c' }}
          >
            {quarters.map((quarter) => (
              <option key={quarter} value={quarter}>{quarter}</option>
            ))}
          </select>
        </div>

        {/* Category */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-gray-500">Category</label>
          <select
            value={selectedCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-opacity-50 text-sm bg-white"
            style={{ outlineColor: '#003c6c' }}
          >
            {categories.map((category) => (
              <option key={category.value} value={category.value}>{category.label}</option>
            ))}
          </select>
        </div>

        {/* Min Spend */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-gray-500">Min $</label>
          <input
            type="number"
            min="0"
            step="100"
            value={minSpend || ''}
            onChange={(e) => onMinSpendChange(Number(e.target.value))}
            placeholder="0"
            className="w-20 px-3 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-opacity-50 text-sm"
            style={{ outlineColor: '#003c6c' }}
          />
        </div>

        {/* Limit */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-gray-500">Limit</label>
          <select
            value={selectedLimit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="px-3 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-opacity-50 text-sm bg-white"
            style={{ outlineColor: '#003c6c' }}
          >
            {[10, 20, 50].map((limit) => (
              <option key={limit} value={limit}>{limit}</option>
            ))}
          </select>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-gray-500">Sort</label>
          <select
            value={selectedSortMode}
            onChange={(e) => onSortModeChange(e.target.value as 'frequency' | 'cost')}
            className="px-3 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-opacity-50 text-sm bg-white"
            style={{ outlineColor: '#003c6c' }}
          >
            <option value="frequency">Frequency</option>
            <option value="cost">Cost</option>
          </select>
        </div>

        {/* High-Impact toggle */}
        <button
          type="button"
          onClick={() => onHighImpactChange(!highImpactOnly)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 transition-all text-sm font-medium ${
            highImpactOnly
              ? 'bg-purple-100 border-purple-400 text-purple-700'
              : 'bg-white border-gray-300 text-gray-600 hover:border-purple-300'
          }`}
          title="Show only high-spend and frequently purchased items"
        >
          <Zap size={14} />
          High-Impact
        </button>
      </div>

    </div>
  );
}
