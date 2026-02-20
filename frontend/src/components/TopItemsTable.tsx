export interface TopItem {
  clean_item_name: string;
  count: number;
  total_spent: number;
  vendors: string[];
}

/**
 * TopItemsTable - Alignment Optimized
 * Fixed column widths to ensure Rank and Item Name stay grouped.
 */
export function TopItemsTable({ data }: { data: TopItem[] }) {
  const displayData = (data || []).slice(0, 20);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        {/* 'table-fixed' is the magic key for alignment */}
        <table className="w-full text-left text-sm table-fixed border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-gray-200">
              {/* Explicitly set percentage or px widths for EVERY header */}
              <th className="p-4 font-semibold text-slate-700 w-[60px]">#</th>
              <th className="p-4 font-semibold text-slate-700 w-[40%]">Item Name</th>
              <th className="p-4 font-semibold text-slate-700 text-center w-[100px]">Freq.</th>
              <th className="p-4 font-semibold text-slate-700 text-right w-[140px]">Total Spent</th>
              <th className="p-4 font-semibold text-slate-700 w-[25%]">Vendors</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayData.map((item, index) => (
              <tr 
                key={index} 
                className="group hover:bg-slate-50/80 transition-colors odd:bg-white even:bg-slate-50/20 text-center"
              >
                {/* Each <td> will now strictly follow the <th> width above */}
                <td className="p-4 text-gray-400 font-mono text-xs">{index + 1}</td>
                
                <td className="p-4 font-semibold text-slate-900 truncate text-center" title={item.clean_item_name}>
                  {item.clean_item_name}
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
                {/* Added 'justify-center' to align the flex items with the centered header */}
                <div className="flex flex-wrap items-center justify-center gap-2">
                    {(item.vendors || []).length > 0 ? (
                    (item.vendors || []).map((v, i) => (
                        <span 
                        key={i} 
                        className="text-slate-900 font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-wide"
                        >
                        {v}
                        </span>
                    ))
                    ) : (
                    <span className="text-gray-300 italic text-xs">N/A</span>
                    )}
                </div>
                </td>

              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}