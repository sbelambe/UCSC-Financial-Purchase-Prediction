import React, { useState, useMemo } from 'react';

export interface TopItem {
  clean_item_name: string;
  count: number;
  total_spent: number;
  vendors: string[];
}

// Helper function to format the array of vendors
const formatVendors = (rawVendors: string[] | undefined) => {
    if (!Array.isArray(rawVendors) || rawVendors.length === 0) {
        return <span className="text-gray-300 italic text-xs">N/A</span>;
    }

    // --- Smart Vendor Filtering ---
    // Remove any completely blank entries
    let vendors = rawVendors.filter(v => typeof v === 'string' && v.trim() !== '');
    
    // Check if we have at least one "real" vendor
    const hasRealVendor = vendors.some(v => 
        v.toLowerCase() !== 'unknown' && v.toLowerCase() !== 'n/a'
    );
    
    // If we do, omit the "unknown" tags entirely
    if (hasRealVendor) {
        vendors = vendors.filter(v => 
            v.toLowerCase() !== 'unknown' && v.toLowerCase() !== 'n/a'
        );
    }

    // Fallback if filtering left us with an empty array
    if (vendors.length === 0) {
         return <span className="text-gray-300 italic text-xs">Unknown</span>;
    }

    if (vendors.length <= 3) {
        return (
            <div className="flex flex-wrap items-center justify-center gap-2">
                {vendors.map((v, i) => (
                    <span 
                        key={i} 
                        className="text-slate-900 font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-wide"
                    >
                        {v}
                    </span>
                ))}
            </div>
        );
    }

    const visibleVendors = vendors.slice(0, 3);
    const hiddenCount = vendors.length - 3;

    return (
        <div 
            className="flex flex-wrap items-center justify-center gap-2" 
            title={vendors.join(", ")} 
        >
            {visibleVendors.map((v, i) => (
                <span 
                    key={i} 
                    className="text-slate-900 font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-wide"
                >
                    {v}
                </span>
            ))}
            <span className="text-blue-500 font-bold px-2 py-0.5 text-[10px] tracking-wide">
                +{hiddenCount}
            </span>
        </div>
    );
};

type SortConfig = {
  key: keyof TopItem;
  direction: 'asc' | 'desc';
} | null;

// Helper function to abbreviate long product names
const truncateText = (text: string, maxLength: number = 55) => {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
};

/**
 * TopItemsTable - Alignment Optimized & Sortable
 * Fixed column widths to ensure Rank and Item Name stay grouped.
 */
export function TopItemsTable({ data }: { data: TopItem[] }) {
  // Setup state for sorting (Default to sorting by count, descending)
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'count', direction: 'desc' });

  // Sorting logic wrapped in useMemo for performance
  const sortedData = useMemo(() => {
    const sortableItems = [...(data || [])];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        // Handle array lengths specifically for vendors if we want to sort by number of vendors
        const valA = sortConfig.key === 'vendors' ? a.vendors.length : a[sortConfig.key];
        const valB = sortConfig.key === 'vendors' ? b.vendors.length : b[sortConfig.key];

        if (valA < valB) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (valA > valB) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [data, sortConfig]);

  // Apply the limit AFTER sorting so the top 20 is always accurate
  const displayData = sortedData.slice(0, 20);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Handler to update sort state when a header is clicked
  const requestSort = (key: keyof TopItem) => {
    let direction: 'asc' | 'desc' = 'desc'; // Default to descending for finance numbers
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  // Helper to render the sort arrow
  const getSortIcon = (key: keyof TopItem) => {
    if (!sortConfig || sortConfig.key !== key) return <span className="text-gray-300 ml-1">↕</span>;
    return sortConfig.direction === 'asc' ? <span className="text-blue-600 ml-1">▲</span> : <span className="text-blue-600 ml-1">▼</span>;
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm table-fixed border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-gray-200 select-none">
              <th className="p-4 font-semibold text-slate-700 w-[60px]">#</th>
              
              <th 
                className="p-4 font-semibold text-slate-700 w-[40%] cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => requestSort('clean_item_name')}
              >
                Item Name {getSortIcon('clean_item_name')}
              </th>
              
              <th 
                className="p-4 font-semibold text-slate-700 text-center w-[100px] cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => requestSort('count')}
              >
                Freq. {getSortIcon('count')}
              </th>
              
              <th 
                className="p-4 font-semibold text-slate-700 text-right w-[140px] cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => requestSort('total_spent')}
              >
                Total Spent {getSortIcon('total_spent')}
              </th>
              
              <th 
                className="p-4 font-semibold text-slate-700 w-[25%] text-center cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => requestSort('vendors')}
              >
                Vendors {getSortIcon('vendors')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayData.map((item, index) => (
              <tr 
                key={index} 
                className="group hover:bg-slate-50/80 transition-colors odd:bg-white even:bg-slate-50/20 text-center"
              >
                <td className="p-4 text-gray-400 font-mono text-xs">{index + 1}</td>
                
                <td className="p-4 font-semibold text-slate-900 truncate text-center" title={item.clean_item_name}>
                  {truncateText(item.clean_item_name)}
                </td>
                
                <td className="p-4 text-center">
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-bold bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/10">
                    {item.count.toLocaleString()}
                  </span>
                </td>
                
                <td className="p-4 text-center font-mono font-medium text-slate-900">
                  {formatCurrency(item.total_spent)}
                </td>
                
                <td className="p-4 text-center w-[25%]">
                    {formatVendors(item.vendors)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}