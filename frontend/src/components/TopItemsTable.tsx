import React, { useState, useMemo } from 'react';

// --- Interfaces ---

export interface VendorStat {
  name: string;
  count: number;
  spend: number;
}

export interface TopItem {
  clean_item_name: string;
  count: number;
  total_spent: number;
  vendors: VendorStat[];
  projected_count?: number; // Sandbox staging data
  projected_spent?: number; // Sandbox staging data
}

type SortConfig = {
  key: keyof TopItem;
  direction: 'asc' | 'desc';
} | null;

// --- Helper Functions ---

/**
 * Formats the vendor tags in the main table row.
 * Handles filtering of empty/unknown vendors and displays a "+X" badge for overflow.
 */
const formatVendors = (rawVendors: VendorStat[] | undefined) => {
  if (!Array.isArray(rawVendors) || rawVendors.length === 0) {
    return <span className="text-gray-300 italic text-xs">N/A</span>;
  }

  let vendors = rawVendors.map(v => v.name).filter(name => name && name.trim() !== '');
  const hasRealVendor = vendors.some(v => v.toLowerCase() !== 'unknown' && v.toLowerCase() !== 'n/a');
  
  if (hasRealVendor) {
    vendors = vendors.filter(v => v.toLowerCase() !== 'unknown' && v.toLowerCase() !== 'n/a');
  }

  if (vendors.length === 0) return <span className="text-gray-300 italic text-xs">Unknown</span>;

  const visibleVendors = vendors.slice(0, 3);
  const hiddenCount = vendors.length - 3;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2" title={vendors.join(", ")}>
      {visibleVendors.map((v, i) => (
        <span key={i} className="text-slate-900 font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-wide bg-slate-100">
          {v}
        </span>
      ))}
      {hiddenCount > 0 && (
        <span className="text-blue-500 font-bold px-2 py-0.5 text-[10px] tracking-wide">
          +{hiddenCount}
        </span>
      )}
    </div>
  );
};

const truncateText = (text: string, maxLength: number = 55) => {
  if (!text) return "";
  return text.length <= maxLength ? text : text.substring(0, maxLength) + "...";
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

const formatSpendOrNA = (amount: number) => {
  const numeric = Number(amount || 0);
  return numeric > 0 ? formatCurrency(numeric) : 'N/A';
};

// --- Main Component ---

/**
 * TopItemsTable
 * Features:
 * 1. Staging Sandbox: Displays purple badges for pending CSV data.
 * 2. Combined Sorting: Ranks items based on the sum of current + projected data.
 * 3. Expandable Rows: Shows a detailed, sortable vendor breakdown.
 */
export function TopItemsTable({ data, showProjected = false }: { data: TopItem[]; showProjected?: boolean }) {
  // Main Table State
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'count', direction: 'desc' });
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // Nested Vendor Table State
  const [nestedSortConfig, setNestedSortConfig] = useState<{
    key: keyof VendorStat;
    direction: 'asc' | 'desc';
  } | null>({ key: 'spend', direction: 'desc' });

  // --- Sorting Logic ---

  const sortedData = useMemo(() => {
    const sortableItems = [...(data || [])];
    
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const { key, direction } = sortConfig;
        let valA: string | number;
        let valB: string | number;

        // Custom Logic: Sort by the COMBINED total (Base + Projected)
        if (key === 'count') {
          valA = (a.count || 0) + (a.projected_count || 0);
          valB = (b.count || 0) + (b.projected_count || 0);
        } else if (key === 'total_spent') {
          valA = (a.total_spent || 0) + (a.projected_spent || 0);
          valB = (b.total_spent || 0) + (b.projected_spent || 0);
        } else if (key === 'vendors') {
          valA = a.vendors?.length || 0;
          valB = b.vendors?.length || 0;
        } else {
          valA = a[key] ?? (typeof a[key] === 'string' ? "" : 0);
          valB = b[key] ?? (typeof b[key] === 'string' ? "" : 0);
        }

        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [data, sortConfig]);

  const displayData = sortedData.slice(0, 20);

  const requestSort = (key: keyof TopItem) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: keyof TopItem) => {
    if (!sortConfig || sortConfig.key !== key) return <span className="text-gray-300 ml-1">↕</span>;
    return sortConfig.direction === 'asc' ? <span className="text-blue-600 ml-1">▲</span> : <span className="text-blue-600 ml-1">▼</span>;
  };

  const requestNestedSort = (key: keyof VendorStat) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (nestedSortConfig && nestedSortConfig.key === key && nestedSortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setNestedSortConfig({ key, direction });
  };

  const getNestedSortIcon = (key: keyof VendorStat) => {
    if (!nestedSortConfig || nestedSortConfig.key !== key) return <span className="text-gray-300 ml-1">↕</span>;
    return nestedSortConfig.direction === 'asc' ? <span className="text-blue-600 ml-1">▲</span> : <span className="text-blue-600 ml-1">▼</span>;
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm table-fixed border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-gray-200 select-none">
              <th className="p-4 font-semibold text-slate-700 w-[60px]">#</th>
              <th className="p-4 font-semibold text-slate-700 w-[40%] cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('clean_item_name')}>
                Item Name {getSortIcon('clean_item_name')}
              </th>
              <th className="p-4 font-semibold text-slate-700 text-center w-[120px] cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('count')}>
                Freq. {getSortIcon('count')}
              </th>
              <th className="p-4 font-semibold text-slate-700 text-right w-[160px] cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('total_spent')}>
                Total Spent {getSortIcon('total_spent')}
              </th>
              <th className="p-4 font-semibold text-slate-700 w-[25%] text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('vendors')}>
                Vendors {getSortIcon('vendors')}
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {displayData.map((item, index) => {
              const isExpanded = expandedRow === index;
              const nonZeroVendors = (item.vendors || []).filter(
                (v) => Number(v.count || 0) > 0 || Number(v.spend || 0) > 0
              );
              const hasMultipleVendors = nonZeroVendors.length > 1;

              return (
                <React.Fragment key={index}>
                  <tr 
                    onClick={() => hasMultipleVendors && setExpandedRow(isExpanded ? null : index)}
                    className={`group transition-colors odd:bg-white even:bg-slate-50/20 ${hasMultipleVendors ? 'hover:bg-slate-100 cursor-pointer' : ''}`}
                  >
                    <td className="p-4 text-gray-400 font-mono text-xs text-left">
                      <span className={`mr-2 inline-block w-3 ${hasMultipleVendors ? 'text-blue-500' : ''}`}>
                        {hasMultipleVendors ? (isExpanded ? '▼' : '▶') : '\u00A0'}
                      </span>
                      {index + 1}
                    </td>

                    <td className="p-4 font-semibold text-slate-900 truncate" title={item.clean_item_name}>
                      {truncateText(item.clean_item_name)}
                    </td>

                    {/* FREQUENCY CELL */}
                    <td className="p-4 text-center">
                      <div className="flex flex-col items-center justify-center space-y-1">
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-bold bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/10">
                          {item.count.toLocaleString()}
                        </span>
                        {showProjected && Number(item.projected_count || 0) > 0 && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-700/20">
                            +{Number(item.projected_count).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* SPEND CELL */}
                    <td className="p-4 text-right font-mono font-medium text-slate-900">
                      <div className="flex flex-col items-end justify-center">
                        <span>{formatSpendOrNA(item.total_spent)}</span>
                        {showProjected && Number(item.projected_spent || 0) > 0 && (
                          <span className="text-[10px] font-bold text-purple-600 mt-0.5">
                            (+{formatCurrency(Number(item.projected_spent))})
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-4 text-center">
                      {formatVendors(item.vendors)}
                    </td>
                  </tr>

                  {/* EXPANDED VENDOR BREAKDOWN */}
                  {isExpanded && hasMultipleVendors && (
                    <tr className="bg-slate-50 border-b border-gray-200 shadow-inner">
                      <td colSpan={5} className="p-4 pl-12">
                        <div className="bg-white rounded border border-gray-200 overflow-hidden shadow-sm">
                          <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
                              <tr>
                                <th className="px-4 py-2 cursor-pointer hover:bg-gray-100" onClick={() => requestNestedSort('name')}>
                                  Vendor Name {getNestedSortIcon('name')}
                                </th>
                                <th className="px-4 py-2 text-center w-32 cursor-pointer hover:bg-gray-100" onClick={() => requestNestedSort('count')}>
                                  Quantity {getNestedSortIcon('count')}
                                </th>
                                <th className="px-4 py-2 text-right w-40 cursor-pointer hover:bg-gray-100" onClick={() => requestNestedSort('spend')}>
                                  Total Spend {getNestedSortIcon('spend')}
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {[...nonZeroVendors].sort((a, b) => {
                                if (!nestedSortConfig) return 0;
                                const { key, direction } = nestedSortConfig;
                                if (key === 'name') return direction === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
                                const valA = a[key]; const valB = b[key];
                                return direction === 'asc' ? valA - valB : valB - valA;
                              }).map((vendor, vIndex) => (
                                <tr key={vIndex} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-4 py-2 font-semibold text-slate-800">{vendor.name}</td>
                                  <td className="px-4 py-2 text-center font-mono text-slate-600">{vendor.count}</td>
                                  <td className="px-4 py-2 text-right font-mono font-medium text-slate-900">{formatSpendOrNA(vendor.spend)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}