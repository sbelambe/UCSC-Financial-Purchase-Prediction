// This Dashboard component is the main view for users to analyze their spending 
// data. It includes tabbed navigation for different datasets, a filter bar for 
// refining the data,and visualizations like charts and tables. The component 
// supports both a preview mode with static data and a live mode that fetches 
// real data from the backend. Users can also upload projection files to see 
// how future spending might look based on staged projections.
import { useState, useEffect, useMemo } from 'react';
import { TabNavigation } from './TabNavigation';
import { FilterBar } from './FilterBar';
import { useAuth } from '../context/AuthContext';
import TopItemsChart from './TopItemsChart';
import TransactionsOverTimeChart from './TransactionsOverTimeChart';
import { TopItemsTable } from './TopItemsTable';
import { ProjectionUploader } from './ProjectionUploader';
import { InventoryInsights } from './InventoryInsights';
import previewData from '../data/preview_top_20_data.json';
import previewSpendOverTimeData from '../data/preview_spend_over_time_data.json';


// --- TYPES & CONSTANTS ---
// A single point on the spend-over-time chart. `pending_spend` is only 
// populated when a staged projection has been blended into preview mode
type SpendPoint = { period: string; spend: number; pending_spend?: number };

type SpendTimePeriod = 'day' | 'week' | 'month' | 'year';
type DatasetKey = 'amazon' | 'cruzbuy' | 'onecard' | 'bookstore';
type SpendPreviewByTab = Record<DatasetKey, Partial<Record<SpendTimePeriod, SpendPoint[]>>> & { combined?: any };
type QuarterKey = 'fall24' | 'winter25' | 'spring25' | 'summer25' | 'fall25' | 'winter26';
type SpendRangeMode = 'term' | 'year';

// These term windows drive the "Term" selector below and determine which 
// monthly buckets should be shown in the spend chart for each academic quarter
const QUARTER_RANGES: Record<QuarterKey, { label: string; startMonth: string; endMonth: string }> = {
  // Update these date windows as needed.
  fall24: { label: 'Fall24', startMonth: '2024-10', endMonth: '2024-12' },
  winter25: { label: 'Winter25', startMonth: '2025-01', endMonth: '2025-03' },
  spring25: { label: 'Spring25', startMonth: '2025-04', endMonth: '2025-06' },
  summer25: { label: 'Summer25', startMonth: '2025-07', endMonth: '2025-09' },
  fall25: { label: 'Fall25', startMonth: '2025-10', endMonth: '2025-12' },
  winter26: { label: 'Winter26', startMonth: '2026-01', endMonth: '2026-03' },
};


// --- HELPER FUNCTIONS ---
// buildCombinedSpendSeries()
// Combines all datasets into a single series for the "Overall" tab, summing 
// spend across sources by period
const buildCombinedSpendSeries = (preview: SpendPreviewByTab, timePeriod: SpendTimePeriod) => {
  const combinedMap: { [period: string]: number } = {};
  (['amazon', 'cruzbuy', 'onecard', 'bookstore'] as DatasetKey[]).forEach((key) => {
    (getPreviewSeries(preview, key, timePeriod) || []).forEach((point) => {
      combinedMap[point.period] = (combinedMap[point.period] || 0) + Number(point.spend || 0);
    });
  });

  return Object.entries(combinedMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, spend]) => ({ period, spend }));
};

// getPreviewSeries()
// Handles inconsistencies in the preview data structure, ensuring we can 
// extract a clean series for any given dataset and time period
const getPreviewSeries = (
  preview: any,
  key: DatasetKey,
  timePeriod: SpendTimePeriod = 'month'
): SpendPoint[] => {
  // Just in case there are instances of pcard
  const source = key === 'onecard'
    ? (preview?.onecard ?? preview?.pcard)
    : preview?.[key];

  if (Array.isArray(source)) return source as SpendPoint[];
  if (source && Array.isArray(source[timePeriod])) return source[timePeriod] as SpendPoint[];
  return [];
};

// --- Time Filtering Functions ---
// monthWindow()
// Expands a YYYY-MM -> YYYY-MM range into every month in that interval so 
// charts can render zero-value months instead of skipping missing data 
// entirely. Ex: ['2025-01', '2025-02', ...]
const monthWindow = (startMonth: string, endMonth: string) => {
  const months: string[] = [];
  const cursor = new Date(`${startMonth}-01T00:00:00Z`);
  const end = new Date(`${endMonth}-01T00:00:00Z`);
  while (cursor <= end) {
    const y = cursor.getUTCFullYear();
    const m = String(cursor.getUTCMonth() + 1).padStart(2, '0');
    months.push(`${y}-${m}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
};

// filterSeriesByQuarter()
// Filters a raw spend series to only include points that fall within the
// specified quarter, and fills in any missing months with zero values so the
// chart renders continuous time even if there were no transactions in a given 
// month
const filterSeriesByQuarter = (points: SpendPoint[], quarterKey: QuarterKey): SpendPoint[] => {
  const { startMonth, endMonth } = QUARTER_RANGES[quarterKey];
  const spendByMonth: Record<string, {spend: number, pending: number}> = {};
  
  points.forEach((p) => {
    if (p.period >= startMonth && p.period <= endMonth) {
      spendByMonth[p.period] = { spend: Number(p.spend) || 0, pending: Number(p.pending_spend) || 0 };
    }
  });

  return monthWindow(startMonth, endMonth).map((month) => ({
    period: month,
    spend: spendByMonth[month]?.spend || 0,
    pending_spend: spendByMonth[month]?.pending || 0
  }));
};

// availableYearsFromSeries()
// Extracts all unique years from a raw spend series to populate the "Year" filter 
// dropdown. Ensures years are valid 4-digit numbers and sorts them in ascending 
// order
const availableYearsFromSeries = (points: SpendPoint[]): string[] =>
  Array.from(new Set(points.map((p) => String(p.period).slice(0, 4))))
    .filter((y) => /^\d{4}$/.test(y))
    .sort((a, b) => a.localeCompare(b));

// filterSeriesByYear()
// filterSeriesByQuarter but for the "Year" selector
const filterSeriesByYear = (points: SpendPoint[], year: string): SpendPoint[] => {
  const spendByMonth: Record<string, {spend: number, pending: number}> = {};
  
  points.forEach((p) => {
    if (String(p.period).startsWith(`${year}-`)) {
      spendByMonth[p.period] = { spend: Number(p.spend) || 0, pending: Number(p.pending_spend) || 0 };
    }
  });

  return monthWindow(`${year}-01`, `${year}-12`).map((month) => ({
    period: month,
    spend: spendByMonth[month]?.spend || 0,
    pending_spend: spendByMonth[month]?.pending || 0
  }));
};

// mergePreviewData()
// The preview data is structured in a way that can lead to duplicate items across
// datasets (e.g. the same laptop purchase might appear in both Amazon and OneCard
// datasets). This function merges those duplicates together, summing their counts
// and spend, and combining their vendor lists. It also applies the year filter 
// to ensure that only items from the selected year are included in the merged 
// results.
const mergePreviewData = (rawPreview: any, tab: string, filterYear: string) => {
  const merged: { [key: string]: any } = {};
  const tabToKeyMap: { [key: string]: string } = {
    'Amazon': 'amazon',
    'OneCard': 'onecard',
    'CruzBuy': 'cruzbuy',
    'Bookstore': 'bookstore'
  };

  // This function processes a single dataset (e.g. Amazon) and merges its items 
  // into the `merged` map.
  const processDataset = (dataset: any[]) => {
    dataset.forEach((item: any) => {
      if (filterYear !== 'All Time' && item.year && item.year !== filterYear) return; 

      const name = item.clean_item_name || "Miscellaneous";

      if (!merged[name]) {
        merged[name] = { 
          clean_item_name: name, count: 0, total_spent: 0, vendors: [], projected_count: 0, projected_spent: 0 
        };
      }

      if (item.projected_count || item.projected_spent) {
        merged[name].projected_count += item.projected_count || 0;
        merged[name].projected_spent += item.projected_spent || 0;
      } else {
        merged[name].count += item.count || 0;
        merged[name].total_spent += item.total_spent || 0;
      }

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
    if (key && rawPreview[key]) processDataset(rawPreview[key] as any[]);
  }

  return Object.values(merged)
    .filter((item: any) => {
      const totalCount = Number(item.count || 0) + Number(item.projected_count || 0);
      const totalSpend = Number(item.total_spent || 0) + Number(item.projected_spent || 0);
      return totalCount > 0 || totalSpend > 0;
    })
    .sort((a: any, b: any) =>
      (b.count + b.projected_count) - (a.count + a.projected_count)
    );
};


// --- MAIN COMPONENT ---
export function Dashboard() {
  const { user } = useAuth();

  // Controls which dataset the user is currently viewing and whether we're in
  //  preview mode or live mode
  const [activeTab, setActiveTab] = useState<'Overall' | 'CruzBuy' | 'OneCard' | 'Amazon' | 'Bookstore'>('Overall');
  const [isPreviewMode, setIsPreviewMode] = useState(true);

  // Passive cache states
  // Raw data pulled from the backend that doesn't get directly rendered, but 
  // is used as the source of truth that we blend staged projections into and then 
  // extract display data from. This way we can keep the original backend data 
  // separate and unmodified while still allowing users to see how their projections
  // impact the charts and tables in preview mode
  const [liveRawTopItems, setLiveRawTopItems] = useState<any>(null);
  const [liveRawSpend, setLiveRawSpend] = useState<any>(null);

  // Staged projection data that the user uploads in preview mode, which gets
  // blended into the charts and tables alongside the raw data
  const [projectedData, setProjectedData] = useState<{
      dataset: string, 
      data: any[], 
      time_data: {period: string, pending_spend: number}[] 
  } | null>(null);

  // Active display states
  // Top items states
  const [topItems, setTopItems] = useState<any[]>([]);
  const [isLoadingTopItems, setIsLoadingTopItems] = useState(true);
  
  // Spend states
  // `rawSpendSeries` is the unfiltered, unmodified series pulled from the 
  // backend (with projections blended in for preview mode)
  // `spendSeries` is the filtered series that actually gets passed to the 
  // chart based
  const [rawSpendSeries, setRawSpendSeries] = useState<SpendPoint[]>([]);
  const [spendSeries, setSpendSeries] = useState<SpendPoint[]>([]);
  const [isLoadingSpend, setIsLoadingSpend] = useState(true);
  
  // Filter & UI States for dashboard controls
  const [showDetails, setShowDetails] = useState(false);
  const [selectedYear, setSelectedYear] = useState('All Time');
  const [selectedQuarter, setSelectedQuarter] = useState<QuarterKey>('winter25');
  const [spendRangeMode, setSpendRangeMode] = useState<SpendRangeMode>('term');
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [minSpend, setMinSpend] = useState<number>(0);

  // This map helps us determine which series to pull from the raw spend data
  // based on the active tab, since the API returns all datasets together and we
  // need to extract the relevant one for the current view
  const tabToSeriesKeyMap: { [key: string]: string } = {
    Overall: 'combined',
    Amazon: 'amazon',
    Bookstore: 'bookstore',
    CruzBuy: 'cruzbuy',
    OneCard: 'onecard',
  };

  const previewSpendByTab = previewSpendOverTimeData as unknown as SpendPreviewByTab;


  // 1. RAW DATA FETCH (Runs once per session)
  // On initial load, we fetch the raw data for both the top items and spend-over-time
  // charts and store it in separate states. This raw data is what we use as the source 
  // of truth
  useEffect(() => {
    if (isPreviewMode) return;

    if (user && !liveRawTopItems) {
      fetch(`http://127.0.0.1:8000/api/analytics/top-items?user_id=${user.uid}`)
        .then(res => res.json())
        .then(res => setLiveRawTopItems(res.data || {}))
        .catch(console.error);
    }

    if (!liveRawSpend) {
      fetch('http://127.0.0.1:8000/api/analytics/spend-over-time?time_period=month&include_refunds=true')
        .then((res) => res.json())
        .then((res) => setLiveRawSpend(res.data || {}))
        .catch(console.error);
    }
  }, [user, isPreviewMode, liveRawTopItems, liveRawSpend]);


  // 2. TAB SWITCHING: TOP ITEMS & PROJECTIONS
  // Whenever the user switches tabs, we need to update the top items table and chart
  // to reflect the relevant dataset. Additionally, if we're in preview mode and the 
  // user has uploaded a projection, we need to blend that projection data into the 
  // raw data for the active tab before extracting the top items to display, so that 
  // users can see how their projections impact the top items in real time as they 
  // switch between tabs and filters
  useEffect(() => {
    setIsLoadingTopItems(true);
    let baseTopItems = isPreviewMode ? previewData : liveRawTopItems;
    
    if (baseTopItems) {
      // Deep copy the base data to avoid mutating the original raw data when we 
      // blend in projections
      const combinedData = JSON.parse(JSON.stringify(baseTopItems));
      
      // Merge staged projections into the relevant dataset in the raw data, tagging 
      // them with `projected_count`
      if (projectedData && isPreviewMode) {
        const targetKey = projectedData.dataset; 
        if (!combinedData[targetKey]) combinedData[targetKey] = [];

        const taggedProjectedData = projectedData.data.map((item: any) => ({
            ...item,
            projected_count: item.count,
            projected_spent: item.total_spent
        }));
        combinedData[targetKey] = [...combinedData[targetKey], ...taggedProjectedData];
      }
      
      setTopItems(mergePreviewData(combinedData, activeTab, selectedYear));
      setIsLoadingTopItems(false);
    } 
    
    else if (user && !isPreviewMode) {
      fetch(`http://127.0.0.1:8000/api/analytics/top-items?user_id=${user.uid}&vendor=${activeTab.toLowerCase()}`)
        .then(res => res.json())
        .then(res => { 
          const fetchedData = res.data || {};
          
          if (!Array.isArray(fetchedData)) {
            // If it's an object (Overall view), flatten it into an array
            setTopItems(mergePreviewData(fetchedData, activeTab, selectedYear));
          } else {
            // If it's already a flat array (Specific vendor view), just set it
            setTopItems(fetchedData);
          }
          
          setIsLoadingTopItems(false); 
        })
        .catch(() => setIsLoadingTopItems(false));
    }
  }, [user, isPreviewMode, activeTab, liveRawTopItems, projectedData, selectedYear]);


  // 3. TAB SWITCHING: SPEND SERIES (Historical + Projections)
  // Similar to the top items, when the user switches tabs we also need to update the
  // spend-over-time chart to show the relevant dataset. This is a bit more complex than
  // the top items because we also need to blend in any pending spend from the projection
  // uploader, which involves matching the time buckets from the projection with the raw
  // series and summing the pending spend with the historical spend for any overlapping
  // periods, as well as ensuring that any new periods introduced by the projection are added
  // to the series so they show up on the chart 
  useEffect(() => {
    setIsLoadingSpend(true);
    const seriesKey = tabToSeriesKeyMap[activeTab] || 'combined';
    let currentRawSeries: SpendPoint[] = [];

    if (isPreviewMode) {
      const periodSeriesByKey: Record<string, SpendPoint[]> = {
        amazon: getPreviewSeries(previewSpendByTab, 'amazon', 'month'),
        cruzbuy: getPreviewSeries(previewSpendByTab, 'cruzbuy', 'month'),
        onecard: getPreviewSeries(previewSpendByTab, 'onecard', 'month'),
        bookstore: getPreviewSeries(previewSpendByTab, 'bookstore', 'month'),
        combined: buildCombinedSpendSeries(previewSpendByTab, 'month'),
      };
      currentRawSeries = [...(periodSeriesByKey[seriesKey] || periodSeriesByKey.combined || [])];
    } else if (liveRawSpend) {
      const liveSeriesByKey: { [key: string]: SpendPoint[] } = {
        combined: liveRawSpend?.combined || [],
        amazon: liveRawSpend?.datasets?.amazon || [],
        cruzbuy: liveRawSpend?.datasets?.cruzbuy || [],
        onecard: liveRawSpend?.datasets?.onecard || [],
        bookstore: liveRawSpend?.datasets?.bookstore || [],
      };
      currentRawSeries = [...(liveSeriesByKey[seriesKey] || liveSeriesByKey.combined || [])];
    }

    // Merge projected pending spend into the raw series
    if (projectedData && isPreviewMode && (activeTab === 'Overall' || tabToSeriesKeyMap[activeTab] === projectedData.dataset)) {
      projectedData.time_data.forEach(pendingMonth => {
        const existingMonthIndex = currentRawSeries.findIndex(s => s.period === pendingMonth.period);
        if (existingMonthIndex >= 0) {
            currentRawSeries[existingMonthIndex].pending_spend = pendingMonth.pending_spend;
        } else {
            currentRawSeries.push({ period: pendingMonth.period, spend: 0, pending_spend: pendingMonth.pending_spend });
        }
      });
      currentRawSeries.sort((a, b) => a.period.localeCompare(b.period));
    }

    setRawSpendSeries(currentRawSeries);
    setIsLoadingSpend(false);
  }, [isPreviewMode, activeTab, liveRawSpend, projectedData]);


  // 4. UPDATE AVAILABLE YEARS FOR CHART
  // Whenever the raw spend series updates (either from live fetch or from blending 
  // in projections), we need to recalculate the available years for the "Year" filter 
  // dropdown, since the projection data might introduce new years that weren't in the 
  // original raw data. This ensures that users can filter by any year that has data, 
  // including projected data in preview mode
  useEffect(() => {
    const years = availableYearsFromSeries(rawSpendSeries);
    setAvailableYears(years);
  }, [rawSpendSeries]);


  // 5. APPLY TIME FILTERS TO SPEND CHART
  // Whenever the raw spend series, selected quarter, selected year, or spend range 
  // mode changes, we need to re-filter the raw series to extract the relevant points 
  // for the chart based on the current filters. This ensures that the spend-over-time 
  // chart always reflects the user's selected time range, whether they're looking at a 
  // specific term or a specific year, and that it updates in real time as they change 
  // those filters
  useEffect(() => {
    if (spendRangeMode === 'term') {
      setSpendSeries(filterSeriesByQuarter(rawSpendSeries, selectedQuarter));
    } else {
      const targetYear = selectedYear === 'All Time' ? availableYears[availableYears.length - 1] : selectedYear;
      if (targetYear) {
         setSpendSeries(filterSeriesByYear(rawSpendSeries, targetYear));
      } else {
         setSpendSeries(rawSpendSeries);
      }
    }
  }, [rawSpendSeries, selectedQuarter, spendRangeMode, selectedYear, availableYears]);


  // 6. APPLY ITEM FILTERS TO TABLE/CHART (Search, Categories, Min Spend)
  // This useMemo block applies the search query, category filter, and minimum spend 
  // filter to the top items before they get passed to the chart and table for rendering. 
  // This way we can keep the original top items data intact and just derive a filtered 
  // version for display based on the user's current filter settings. The filtering logic 
  // checks each item against the search query (matching against item name and vendor names), 
  // the selected category (using keyword matching on the item name), and the minimum spend 
  // (summing historical and projected spend), and only includes items that pass all active 
  // filters in the final `filteredTopItems` array that gets rendered in the chart and table 
  // views. 
  const filteredTopItems = useMemo(() => {
    if (!topItems || !Array.isArray(topItems)) return [];
    
    return topItems.filter(item => {
      const name = item.clean_item_name.toLowerCase();

      // Search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const hasVendorMatch = item.vendors?.some((v: { name: string }) => v.name.toLowerCase().includes(query));
        if (!name.includes(query) && !hasVendorMatch) return false;
      }

      // Categories
      if (selectedCategory !== 'all') {
        if (selectedCategory === 'technology' && !(/laptop|monitor|adapter|switch|drive|ipad|macbook|workstation|mouse|battery/.test(name))) return false;
        if (selectedCategory === 'lab-supplies' && !(/centrifuge|glove|pipette|beaker|dna|microscope|slide|goggle|parafilm/.test(name))) return false;
        if (selectedCategory === 'office' && !(/paper|marker|board|chair|stapler|pad|post-it|binder|toner/.test(name))) return false;
        if (selectedCategory === 'facilities' && !(/bulb|filter|trash|ladder|vest|handle|soap|wipe/.test(name))) return false;
      }

      // Minimum Spend (Historical + Staged)
      if (minSpend > 0) {
        const combinedSpend = (item.total_spent || 0) + (item.projected_spent || 0);
        if (combinedSpend < minSpend) return false;
      }

      return true;
    });
  }, [topItems, searchQuery, selectedCategory, minSpend]);


  // The return statement below renders the entire dashboard
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
          onProjectionSuccess={(dataset, data, time_data) => setProjectedData({ dataset, data, time_data })}
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
          minSpend={minSpend}
          onYearChange={setSelectedYear}
          onCategoryChange={setSelectedCategory}
          onSearchChange={setSearchQuery}
          onMinSpendChange={setMinSpend}
        />
      </div>

      {/* --- CHART SECTION --- */}
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
              title={`Spend Over Time (${activeTab}, ${spendRangeMode === 'term' ? QUARTER_RANGES[selectedQuarter].label : selectedYear})`}
            />
            
            <div className="flex justify-center gap-3">
              <select
                value={spendRangeMode}
                onChange={(e) => setSpendRangeMode(e.target.value as SpendRangeMode)}
                className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700"
              >
                <option value="term">Term</option>
                <option value="year">Year</option>
              </select>
              {spendRangeMode === 'term' ? (
                <select
                  value={selectedQuarter}
                  onChange={(e) => setSelectedQuarter(e.target.value as QuarterKey)}
                  className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700"
                >
                  {(Object.entries(QUARTER_RANGES) as [QuarterKey, { label: string }][]).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              ) : (
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700"
                >
                   <option value="All Time">All Time</option>
                  {availableYears.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              )}
            </div>
            {/* Keep term boundaries editable in QUARTER_RANGES above. */}
            {/* Month values come from monthly summaries, grouped before this view. */}

            <div className="flex justify-center">
              <button onClick={() => setShowDetails(!showDetails)} className="px-6 py-2 text-sm font-semibold text-blue-700 bg-blue-50 rounded-full hover:bg-blue-100 transition-colors">
                {showDetails ? "Hide Table" : "Show Detailed Breakdown"}
              </button>
            </div>

            {/* show inventory levels for data */}
            {showDetails && activeTab === 'Bookstore' && (
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-800 mb-2">Current Campus Bookstore Inventory</h3>
                <p className="text-sm text-gray-500 mb-4">
                  *Inventory levels approximated based on recent point-of-sale data.
                </p>
                <TopItemsTable data={filteredTopItems} showProjected={isPreviewMode && projectedData !== null} />
              </div>
            )}

            {showDetails && activeTab !== 'Bookstore' && (
              <div className="mb-6">
                <TopItemsTable data={filteredTopItems} showProjected={isPreviewMode && projectedData !== null} />
              </div>
            )}

            {/* shows inventory insights if amazon or bookstore tabs are selected */}
            {(activeTab === 'Amazon' || activeTab === 'Bookstore') && (
              <InventoryInsights 
                amazonData={(isPreviewMode ? previewData?.amazon : liveRawTopItems?.amazon) || []} 
                bookstoreData={(isPreviewMode ? previewData?.bookstore : liveRawTopItems?.bookstore) || []} 
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
