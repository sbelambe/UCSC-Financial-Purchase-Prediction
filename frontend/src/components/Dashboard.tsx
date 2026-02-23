import { useState, useEffect } from 'react';
import { TabNavigation } from './TabNavigation';
import { FilterBar } from './FilterBar';
import { useAuth } from '../context/AuthContext';
import TopItemsChart from './TopItemsChart';
import TransactionsOverTimeChart from './TransactionsOverTimeChart';
import { TopItemsTable } from './TopItemsTable';
import previewData from '../data/preview_top_20_data.json';
import previewSpendOverTimeData from '../data/preview_spend_over_time_data.json';

const buildCombinedSpendSeries = (preview: { [key: string]: { period: string; spend: number }[] }) => {
  const combinedMap: { [period: string]: number } = {};
  ['amazon', 'cruzbuy', 'pcard'].forEach((key) => {
    (preview[key] || []).forEach((point) => {
      combinedMap[point.period] = (combinedMap[point.period] || 0) + Number(point.spend || 0);
    });
  });

  return Object.entries(combinedMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, spend]) => ({ period, spend }));
};


const mergePreviewData = (rawPreview: any, tab: string) => {
  const merged: { [key: string]: any } = {};
  const tabToKeyMap: { [key: string]: string } = {
    'Amazon': 'amazon',
    'ProCard': 'pcard',
    'OneBuy': 'cruzbuy',
    'Bookstore': 'baytree'
  };


  const processDataset = (dataset: any[], source: string) => {
    dataset.forEach((item: any) => {
      const name = item.clean_item_name;
      if (!merged[name]) {
        merged[name] = { clean_item_name: name, count: 0, total_spent: 0, vendors: [] };
      }
      merged[name].count += item.count || 0;
      merged[name].total_spent += item.total_spent || 0;
      if (Array.isArray(item.vendors)) {
        item.vendors.forEach((realVendor: string) => {
          // Only add the vendor if it isn't already in the array to prevent duplicates
          if (!merged[name].vendors.includes(realVendor)) {
            merged[name].vendors.push(realVendor);
          }
        });
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


  // passive cache states
  const [liveRawTopItems, setLiveRawTopItems] = useState<any>(null);
  const [liveRawSpend, setLiveRawSpend] = useState<any>(null);

  // active display states
  const [topItems, setTopItems] = useState<any[]>([]);
  const [isLoadingTopItems, setIsLoadingTopItems] = useState(true);
  const [spendSeries, setSpendSeries] = useState<{ period: string; spend: number }[]>([]);
  const [isLoadingSpend, setIsLoadingSpend] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  const tabToSeriesKeyMap: { [key: string]: string } = {
    Overall: 'combined',
    Amazon: 'amazon',
    ProCard: 'pcard',
    OneBuy: 'cruzbuy',
    Bookstore: 'combined',
  };

  const previewSpendByTab = previewSpendOverTimeData as { [key: string]: { period: string; spend: number }[] };

  // only runs when mode switches to live data, and only fetches if cache is empty
  useEffect(() => {
      if (isPreviewMode) {
        setIsLoadingTopItems(false);
        setIsLoadingSpend(false);
        return;
      }

      if (user && !liveRawTopItems) {
        setIsLoadingTopItems(true);
        fetch(`http://127.0.0.1:8000/api/analytics/top-items?user_id=${user.uid}`)
          .then(res => res.json())
          .then(res => { 
              setLiveRawTopItems(res.data || {}); 
              setIsLoadingTopItems(false); 
          })
          .catch(() => setIsLoadingTopItems(false));
      }

      if (user && !liveRawSpend) {
        setIsLoadingSpend(true);
        fetch('http://127.0.0.1:8000/api/analytics/spend-over-time?interval=month&include_refunds=true')
          .then((res) => res.json())
          .then((res) => {
            setLiveRawSpend(res.data || {});
            setIsLoadingSpend(false);
          })
          .catch(() => setIsLoadingSpend(false));
      }
    }, [user, isPreviewMode]); // Note: activeTab is REMOVED from the dependency array!


  // runs instantly on tab changes (e.g. Amazon -> Pcard) using cached data
  useEffect(() => {
      // Route Top Items
      if (isPreviewMode) {
        setTopItems(mergePreviewData(previewData, activeTab));
      } else if (liveRawTopItems) {
        setTopItems(mergePreviewData(liveRawTopItems, activeTab));
      }

      // Route Spend Over Time
      const seriesKey = tabToSeriesKeyMap[activeTab] || 'combined';
      if (isPreviewMode) {
        const combinedSeries = previewSpendByTab.combined || buildCombinedSpendSeries(previewSpendByTab);
        setSpendSeries(previewSpendByTab[seriesKey] || combinedSeries || []);
      } else if (liveRawSpend) {
        const liveSeriesByKey: { [key: string]: { period: string; spend: number }[] } = {
          combined: liveRawSpend.combined || [],
          amazon: liveRawSpend.datasets?.amazon || [],
          cruzbuy: liveRawSpend.datasets?.cruzbuy || [],
          pcard: liveRawSpend.datasets?.pcard || [],
        };
        setSpendSeries(liveSeriesByKey[seriesKey] || liveSeriesByKey.combined || []);
      }
    }, [activeTab, isPreviewMode, liveRawTopItems, liveRawSpend]);

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-40 bg-gray-50/95 backdrop-blur py-2">
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
      
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

            <TransactionsOverTimeChart
              data={spendSeries}
              loading={isLoadingSpend}
              title={`Spend Over Time (${activeTab})`}
            />

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
