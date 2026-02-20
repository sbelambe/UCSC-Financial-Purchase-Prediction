import { useState, useEffect } from 'react';
import { TabNavigation } from './TabNavigation';
import { FilterBar } from './FilterBar';
import { useAuth } from '../context/AuthContext';
import TopItemsChart from './TopItemsChart';
import { TopItemsTable } from './TopItemsTable';
import previewData from '../data/preview_data.json';


const mergePreviewData = (rawPreview: any, tab: string) => {
  const merged: { [key: string]: any } = {};
  const tabToKeyMap: { [key: string]: string } = {
    'Amazon': 'amazon',
    'ProCard': 'pcard',
    'OneBuy': 'cruzbuy'
  };


  const processDataset = (dataset: any[], source: string) => {
    dataset.forEach((item: any) => {
      const name = item.clean_item_name;
      if (!merged[name]) {
        merged[name] = { clean_item_name: name, count: 0, total_spent: 0, vendors: [] };
      }
      merged[name].count += item.count || 0;
      merged[name].total_spent += item.total_spent || 0;
      const displaySource = source.charAt(0).toUpperCase() + source.slice(1);
      if (!merged[name].vendors.includes(displaySource)) {
        merged[name].vendors.push(displaySource);
      }
    });
  };

  if (tab === 'Overall') {
    Object.entries(rawPreview).forEach(([key, val]) => processDataset(val as any[], key));
  } else {
    const key = tabToKeyMap[tab];
    if (key && rawPreview[key]) processDataset(rawPreview[key], key);
  }

  return Object.values(merged).sort((a: any, b: any) => b.count - a.count);
};


export function Dashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'Overall' | 'OneBuy' | 'ProCard' | 'Amazon' | 'Bookstore'>('Overall');
  const [isPreviewMode, setIsPreviewMode] = useState(true);
  const [topItems, setTopItems] = useState<any[]>([]);
  const [isLoadingTopItems, setIsLoadingTopItems] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    setTopItems([]);
    setIsLoadingTopItems(true);

    if (isPreviewMode) {
      const data = mergePreviewData(previewData, activeTab);
      setTopItems(data);
      setIsLoadingTopItems(false);
    } else if (user) {
      fetch(`http://127.0.0.1:8000/api/analytics/top-items?user_id=${user.uid}&vendor=${activeTab.toLowerCase()}`)
        .then(res => res.json())
        .then(res => { setTopItems(res.data || []); setIsLoadingTopItems(false); })
        .catch(() => setIsLoadingTopItems(false));
    }
  }, [user, isPreviewMode, activeTab]);

  return (
    <div className="space-y-6">
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      
      {/* --- STAGING BANNER --- */}
      <div className={`p-4 rounded-xl border flex justify-between items-center transition-all ${
        isPreviewMode ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'
      }`}>
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${isPreviewMode ? 'bg-amber-500 animate-pulse' : 'bg-blue-600'}`} />
          <span className="font-bold text-gray-800">{isPreviewMode ? "Preview Mode" : "Live Mode"}</span>
        </div>
        <button onClick={() => setIsPreviewMode(!isPreviewMode)} className="px-4 py-2 bg-white border rounded-lg text-sm font-bold shadow-sm">
          {isPreviewMode ? "Switch to Live" : "View Preview"}
        </button>
      </div>

      {/* --- CHART SECTION --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 min-h-[650px] flex flex-col">
        {isLoadingTopItems ? (
          <div className="flex flex-1 items-center justify-center">Loading...</div>
        ) : (
          <div className="space-y-8 flex-1">
            <div className="h-[450px] w-full">
               <TopItemsChart data={topItems} />
            </div>

            <div className="flex justify-center">
              <button onClick={() => setShowDetails(!showDetails)} className="px-6 py-2 text-sm font-semibold text-blue-700 bg-blue-50 rounded-full hover:bg-blue-100 transition-colors">
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