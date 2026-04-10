import React, { useMemo } from 'react';
import { AlertCircle, CheckCircle, TrendingUp } from 'lucide-react';

interface TopItem {
    clean_item_name: string;
    count: number;
    total_spent: number;
}

interface InventoryInsightProps {
    amazonData: TopItem[];
    bookstoreData: TopItem[];
}

/**
 * Component: InventoryInsights
 * Description: Cross-references high-frequency/high-cost Amazon purchases against 
 * current Bookstore inventory. Outputs a list of items that should be stocked 
 * internally to capture rogue spend. Includes a template placeholder for Sprint 6 predictions.
 */
export function InventoryInsights({ amazonData, bookstoreData }: InventoryInsightProps) {
    // memoize the sorting/filtering logic so it only runs when data changes
    const insights = useMemo(() => {
        if (!amazonData || !bookstoreData) 
            return [];

        // define high impact: sort amazon data by total spent (descending) and get the top 5
        const highImpactAmazon = [...amazonData]
        .sort((a, b) => b.total_spent - a.total_spent)
        .slice(0, 5);

        // cross-reference with bookstore data
        return highImpactAmazon.map(amazonItem => {
            const isInBookstore = bookstoreData.some(
                bookItem => bookItem.clean_item_name.toLowerCase() === amazonItem.clean_item_name.toLowerCase()
            );

            return {
                ...amazonItem,
                isStockedLocally: isInBookstore
            };
        });
    }, [amazonData, bookstoreData]);

    // if no insights available
    if (insights.length === 0) 
        return null;

return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
        <TrendingUp className="text-blue-600" size={20} />
        Inventory Insights
      </h3>
      <p className="text-sm text-gray-600 mb-6">
        Comparing high-impact external Amazon purchases against Baytree Bookstore inventory.
      </p>

      <div className="space-y-4">
        {insights.map((item, index) => (
          <div key={index} className="flex items-start justify-between p-4 border rounded-lg bg-gray-50">
            <div>
              <p className="font-semibold text-gray-800">{item.clean_item_name}</p>
              <p className="text-sm text-gray-500">
                External Spend: ${item.total_spent.toLocaleString()} ({item.count} orders)
              </p>
              
              {/* for next sprint */}
              <div className="mt-2 text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded inline-block border border-purple-100">
                Sprint 6 Prediction Template
              </div>
            </div>

            <div className="flex items-center gap-2">
              {item.isStockedLocally ? (
                <span className="flex items-center gap-1 text-sm font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full">
                  <CheckCircle size={16} />
                  Stocked in Bookstore
                </span>
              ) : (
                <span className="flex items-center gap-1 text-sm font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
                  <AlertCircle size={16} />
                  Needs Stocking
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}