import { useState, useEffect, useMemo } from 'react';
import { TabNavigation } from './TabNavigation';
import { FilterBar } from './FilterBar';
import { useAuth } from '../context/AuthContext';
import TopItemsChart from './TopItemsChart';
import TransactionsOverTimeChart from './TransactionsOverTimeChart';
import { TopItemsTable } from './TopItemsTable';
import { ProjectionUploader } from './ProjectionUploader';
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


const mergePreviewData = (rawPreview: any, tab: string,filterYear: string) => {
  const merged: { [key: string]: any } = {};
  const tabToKeyMap: { [key: string]: string } = {
    'Amazon': 'amazon',
    'ProCard': 'pcard',
    'OneBuy': 'cruzbuy',
    'Bookstore': 'baytree'
  };

  const processDataset = (dataset: any[]) => {
    dataset.forEach((item: any) => {
      // if a specific year is selected, ignore rows from other years
      if (filterYear !== 'All Time' && item.year && item.year !== filterYear) {
        return; 
      }

      // use the clean_item_name or fallback to "Unknown Item" if empty string
      const name = item.clean_item_name || "Miscellaneous";

      if (!merged[name]) {
        merged[name] = { 
          clean_item_name: name, 
          count: 0, 
          total_spent: 0, 
          vendors: [],
          projected_count: 0,
          projected_spent: 0 
        };
      }

      // if it's tagged as projected data from our router...
      if (item.projected_count || item.projected_spent) {
        merged[name].projected_count += item.projected_count || 0;
        merged[name].projected_spent += item.projected_spent || 0;
      } 
      // otherwise, treat it as historical base data
      else {
        merged[name].count += item.count || 0;
        merged[name].total_spent += item.total_spent || 0;
      }

      // handle Vendors
      if (Array.isArray(item.vendors)) {
        item.vendors.forEach((vendorData: any) => {
          const vName = typeof vendorData === 'string' ? vendorData : vendorData.name;
          const vCount = vendorData.count || 0;
          const vSpend = vendorData.spend || 0;

          const existingVendor = merged[name].vendors.find((v: any) => v.name === vName);
          if (existingVendor) {
            existingVendor.count += vCount;
            existingVendor.spend += vSpend;
          } else {
            merged[name].vendors.push({ name: vName, count: vCount, spend: vSpend });
          }
        });
      }
    });
  };

  if (tab === 'Overall') {
    Object.entries(rawPreview).forEach(([key, val]) => processDataset(val as any[]));
  } else {
    const key = tabToKeyMap[tab];
    if (key && rawPreview[key]) processDataset(rawPreview[key]);
  }

  return Object.values(merged).sort((a: any, b: any) => 
    (b.count + b.projected_count) - (a.count + a.projected_count)
  );
};


export function Dashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'Overall' | 'OneBuy' | 'ProCard' | 'Amazon' | 'Bookstore'>('Overall');
  const [isPreviewMode, setIsPreviewMode] = useState(true);


  // passive cache states
  const [liveRawTopItems, setLiveRawTopItems] = useState<any>(null);
  const [liveRawSpend, setLiveRawSpend] = useState<any>(null);
  const [projectedData, setProjectedData] = useState<{
      dataset: string, 
      data: any[], 
      time_data: {period: string, pending_spend: number}[] 
  } | null>(null);

  // active display states
  const [topItems, setTopItems] = useState<any[]>([]);
  const [isLoadingTopItems, setIsLoadingTopItems] = useState(true);
  const [spendSeries, setSpendSeries] = useState<{ period: string; spend: number; pending_spend?: number }[]>([]);
  const [isLoadingSpend, setIsLoadingSpend] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedYear, setSelectedYear] = useState('All Time');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const tabToSeriesKeyMap: { [key: string]: string } = {
    'Amazon': 'amazon',
    'OneCard': 'onecard',
    'CruzBuy': 'cruzbuy',
    'Bookstore': 'baytree'
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
    // --- Route Top Items ---
    let baseTopItems = isPreviewMode ? previewData : liveRawTopItems;
    
    if (baseTopItems) {
      // Deep copy to avoid mutating the original JSON/cache
      const combinedData = JSON.parse(JSON.stringify(baseTopItems));
      
      // Ensure we are in Preview Mode and have staged data
      if (projectedData && isPreviewMode) {
        const targetKey = projectedData.dataset; // e.g., 'amazon'
        
        if (!combinedData[targetKey]) {
            combinedData[targetKey] = [];
        }

        // TAG THE DATA: Convert 'count' to 'projected_count' so the Chart and Table can see the purple difference
        const taggedProjectedData = projectedData.data.map((item: any) => ({
            ...item,
            projected_count: item.count,      // Map backend 'count' to UI 'projected_count'
            projected_spent: item.total_spent // Map backend 'total_spent' to UI 'projected_spent'
        }));

        combinedData[targetKey] = [
            ...combinedData[targetKey], 
            ...taggedProjectedData
        ];
      }
      
      setTopItems(mergePreviewData(combinedData, activeTab, selectedYear));
    }

    // --- Route Spend Over Time (Historical Stacking) ---
    const seriesKey = tabToSeriesKeyMap[activeTab] || 'combined';
    let currentSpendSeries: { period: string; spend: number; pending_spend?: number }[] = [];

    if (isPreviewMode) {
      const combinedSeries = previewSpendByTab.combined || buildCombinedSpendSeries(previewSpendByTab);
      currentSpendSeries = [...(previewSpendByTab[seriesKey] || combinedSeries || [])];
    } else if (liveRawSpend) {
      const liveSeriesByKey: { [key: string]: any } = {
        combined: liveRawSpend.combined || [],
        amazon: liveRawSpend.datasets?.amazon || [],
        cruzbuy: liveRawSpend.datasets?.cruzbuy || [],
        pcard: liveRawSpend.datasets?.onecard || [],
      };
      currentSpendSeries = [...(liveSeriesByKey[seriesKey] || liveSeriesByKey.combined || [])];
    }

    // Merge the time data for the line chart
    if (projectedData && isPreviewMode) {
      if (activeTab === 'Overall' || tabToSeriesKeyMap[activeTab] === projectedData.dataset) {
        projectedData.time_data.forEach(pendingMonth => {
          const existingMonthIndex = currentSpendSeries.findIndex(s => s.period === pendingMonth.period);
          if (existingMonthIndex >= 0) {
              currentSpendSeries[existingMonthIndex].pending_spend = pendingMonth.pending_spend;
          } else {
              currentSpendSeries.push({
                  period: pendingMonth.period,
                  spend: 0,
                  pending_spend: pendingMonth.pending_spend
              });
          }
        });
        currentSpendSeries.sort((a, b) => a.period.localeCompare(b.period));
      }
    }

    setSpendSeries(currentSpendSeries);

  }, [activeTab, isPreviewMode, liveRawTopItems, liveRawSpend, projectedData, selectedYear]);


// --- DYNAMIC FILTERING ---
  const filteredTopItems = useMemo(() => {
    if (!topItems) return [];
    
    return topItems.filter(item => {
      const name = item.clean_item_name.toLowerCase();

      // 1. Search Query Filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        // Check both item name and vendor name
        const hasVendorMatch = item.vendors?.some((v: { name: string }) => v.name.toLowerCase().includes(query));
        
        if (!name.includes(query) && !hasVendorMatch) {
          return false;
        }
      }

      // 2. Category Filter (Regex mapping to your Python seed data)
      if (selectedCategory !== 'all') {
        if (selectedCategory === 'technology' && !(/laptop|monitor|adapter|switch|drive|ipad|macbook|workstation|mouse|battery/.test(name))) return false;
        if (selectedCategory === 'lab-supplies' && !(/centrifuge|glove|pipette|beaker|dna|microscope|slide|goggle|parafilm/.test(name))) return false;
        if (selectedCategory === 'office' && !(/paper|marker|board|chair|stapler|pad|post-it|binder|toner/.test(name))) return false;
        if (selectedCategory === 'facilities' && !(/bulb|filter|trash|ladder|vest|handle|soap|wipe/.test(name))) return false;
      }

      // 3. Year Filter 
      if (selectedYear !== 'All Time') {
        // If the backend attached a year to this item, enforce the filter
        if (item.year && item.year !== selectedYear) {
          return false;
        }
      }

      return true;
    });
  }, [topItems, searchQuery, selectedCategory, selectedYear]);

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

      {/* --- PROJECTION UPLOADER --- */}
      {isPreviewMode && (
        <ProjectionUploader 
          onProjectionSuccess={(dataset, data, time_data) => 
            setProjectedData({ dataset, data, time_data })
          }
          onClearProjection={() => setProjectedData(null)}
          hasActiveProjection={projectedData !== null}
        />
      )}

      {/* --- FILTER BAR --- */}
      <div className="my-6">
        <FilterBar 
          selectedYear={selectedYear}
          selectedCategory={selectedCategory}
          searchQuery={searchQuery}
          onYearChange={setSelectedYear}
          onCategoryChange={setSelectedCategory}
          onSearchChange={setSearchQuery}
        />
      </div>

      {/* --- CHART AND TABLE SECTION --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 min-h-[650px] flex flex-col">
        {isLoadingTopItems ? (
          <div className="flex flex-1 items-center justify-center">Loading...</div>
        ) : (
          <div className="space-y-8 flex-1">
            <div className="h-[450px] w-full">
               <TopItemsChart data={filteredTopItems} />
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

            {showDetails && <TopItemsTable data={filteredTopItems} />}
          </div>
        )}
      </div>
    </div>
  );
}
