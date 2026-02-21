import { useState, useEffect } from 'react';
import { TabNavigation } from './TabNavigation';
import { useAuth } from '../context/AuthContext';
import TopItemsChart from './TopItemsChart';
import { TopItemsTable } from './TopItemsTable';

export function Dashboard() {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<
    'Overall' | 'OneBuy' | 'ProCard' | 'Amazon' | 'Bookstore'
  >('Overall');

  const [topItems, setTopItems] = useState<any[]>([]);
  const [isLoadingTopItems, setIsLoadingTopItems] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!user) return;

    setTopItems([]);
    setIsLoadingTopItems(true);

    const BACKEND_URL = import.meta.env.VITE_API_URL;


    fetch(
      `${BACKEND_URL}/api/analytics/top-items?user_id=${user.uid}&vendor=${activeTab.toLowerCase()}`
    )
      .then(res => res.json())
      .then(res => {
        setTopItems(res.data || []);
        setIsLoadingTopItems(false);
      })
      .catch(err => {
        console.error("Error fetching top items:", err);
        setIsLoadingTopItems(false);
      });
  }, [user, activeTab]);

  return (
    <div className="space-y-6">
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* --- CHART SECTION --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 min-h-[650px] flex flex-col">
        {isLoadingTopItems ? (
          <div className="flex flex-1 items-center justify-center">
            Loading...
          </div>
        ) : (
          <div className="space-y-8 flex-1">
            <div className="h-[450px] w-full">
              <TopItemsChart data={topItems} />
            </div>

            <div className="flex justify-center">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="px-6 py-2 text-sm font-semibold text-blue-700 bg-blue-50 rounded-full hover:bg-blue-100 transition-colors"
              >
                {showDetails ? "Hide Table" : "Show Detailed Breakdown"}
              </button>
            </div>

            {showDetails && <TopItemsTable data={topItems} />}
          </div>
        )}
      </div>
    </div>
  );
}
