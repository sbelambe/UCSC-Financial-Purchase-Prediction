import { Search } from 'lucide-react';

interface FilterBarProps {
  selectedYear: string;
  selectedCategory: string;
  searchQuery: string;
  onYearChange: (year: string) => void;
  onCategoryChange: (category: string) => void;
  onSearchChange: (query: string) => void;
}

export function FilterBar({
  selectedYear,
  selectedCategory,
  searchQuery,
  onYearChange,
  onCategoryChange,
  onSearchChange,
}: FilterBarProps) {
  const years = ['2022', '2023', '2024', '2025', '2026'];
  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'office-supplies', label: 'Office Supplies' },
    { value: 'electronics', label: 'Electronics' },
    { value: 'furniture', label: 'Furniture' },
    { value: 'food-beverages', label: 'Food & Beverages' },
    { value: 'books', label: 'Books' },
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
          style={{ focusRing: '#003c6c' }}
        >
          {years.map((year) => (
            <option key={year} value={year}>
              Year: {year}
            </option>
          ))}
        </select>

        {/* Category Filter */}
        <select
          value={selectedCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-opacity-50 text-sm"
          style={{ focusRing: '#003c6c' }}
        >
          {categories.map((category) => (
            <option key={category.value} value={category.value}>
              {category.label}
            </option>
          ))}
        </select>

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
            placeholder="Search product name, etc."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-opacity-50 text-sm"
            style={{ focusRing: '#003c6c' }}
          />
        </div>
      </div>
    </div>
  );
}
