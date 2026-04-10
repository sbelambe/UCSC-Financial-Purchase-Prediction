// This Dashboard component is the main view for users to analyze their spending 
// data. It includes tabbed navigation for different datasets, a filter bar for 
// refining the data,and visualizations like charts and tables. The component 
// supports both a preview mode with static data and a live mode that fetches 
// real data from the backend. Users can also upload projection files to see 
// how future spending might look based on staged projections.
import { useState, useEffect, useMemo, useDeferredValue, useRef } from 'react';
import { TabNavigation } from './TabNavigation';
import { FilterBar } from './FilterBar';
import TopItemsChart from './TopItemsChart';
import HighImpactScatterPlot from './HighImpactScatterPlot';
import TransactionsOverTimeChart from './TransactionsOverTimeChart';
import { TopItemsTable } from './TopItemsTable';
import { ProjectionUploader } from './ProjectionUploader';
import { InventoryInsights } from './InventoryInsights';
import { FALLBACK_DATASET_SCHEMAS, type DatasetSchema } from '../lib/datasetConfig';


// --- TYPES & CONSTANTS ---
// A single point on the spend-over-time chart. `pending_spend` is only 
// populated when a staged projection has been blended into preview mode
type SpendPoint = { period: string; spend: number; pending_spend?: number };
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

const mergeProjectedTopItems = (
  baseItems: any[],
  projection: { dataset: string; data: any[] } | null,
  activeDatasetKey: string
) => {
  if (!projection) return baseItems;
  if (!(activeDatasetKey === 'overall' || activeDatasetKey === projection.dataset)) {
    return baseItems;
  }

  return [
    ...baseItems,
    ...projection.data.map((item: any) => ({
      ...item,
      projected_count: item.count,
      projected_spent: item.total_spent,
    })),
  ];
};

const mergeProjectedSpendSeries = (
  baseSeries: SpendPoint[],
  projection: { dataset: string; time_data: { period: string; pending_spend: number }[] } | null,
  activeDatasetKey: string
) => {
  if (!projection) return baseSeries;
  if (!(activeDatasetKey === 'overall' || activeDatasetKey === projection.dataset)) {
    return baseSeries;
  }

  const merged = [...baseSeries];
  projection.time_data.forEach((pendingMonth) => {
    const existingMonthIndex = merged.findIndex((s) => s.period === pendingMonth.period);
    if (existingMonthIndex >= 0) {
      merged[existingMonthIndex].pending_spend = pendingMonth.pending_spend;
    } else {
      merged.push({ period: pendingMonth.period, spend: 0, pending_spend: pendingMonth.pending_spend });
    }
  });

  return merged.sort((a, b) => a.period.localeCompare(b.period));
};

const shouldExcludeAmazonGiftCardsFromCharts = (item: any, activeDatasetKey: string) => {
  if (activeDatasetKey !== 'amazon') return false;

  const cleanName = String(item.clean_item_name || '').trim().toLowerCase();
  const categoryValue = String(item.row_values?.Category || item.row_values?.category || '').trim().toLowerCase();
  return cleanName === 'gift cards' || categoryValue === 'gift cards';
};


// --- MAIN COMPONENT ---
export function Dashboard() {
  const [activeTab, setActiveTab] = useState<'Overall' | 'CruzBuy' | 'OneCard' | 'Amazon' | 'Bookstore'>('Amazon');

  // Active display states
  // Top items states
  const [topItems, setTopItems] = useState<any[]>([]);
  const [isLoadingTopItems, setIsLoadingTopItems] = useState(true);
  const [topItemsError, setTopItemsError] = useState<string | null>(null);
  const [activeSchema, setActiveSchema] = useState<DatasetSchema | null>(FALLBACK_DATASET_SCHEMAS.overall);
  
  // Spend states
  // `rawSpendSeries` is the unfiltered, unmodified series pulled from the 
  // backend (with projections blended in for preview mode)
  // `spendSeries` is the filtered series that actually gets passed to the 
  // chart based
  const [rawSpendSeries, setRawSpendSeries] = useState<SpendPoint[]>([]);
  const [spendSeries, setSpendSeries] = useState<SpendPoint[]>([]);
  const [isLoadingSpend, setIsLoadingSpend] = useState(true);
  
  // Filter & UI States
  const [selectedYear, setSelectedYear] = useState('All Time');
  const [selectedQuarter, setSelectedQuarter] = useState<QuarterKey>('winter25');
  const [spendRangeMode, setSpendRangeMode] = useState<SpendRangeMode>('year');
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [minSpend, setMinSpend] = useState<number>(0);
  const [selectedLimit, setSelectedLimit] = useState<number>(20);
  const [selectedSortMode, setSelectedSortMode] = useState<'frequency' | 'cost'>('frequency');
  const [projectedData, setProjectedData] = useState<{
    dataset: string;
    data: any[];
    time_data: { period: string; pending_spend: number }[];
  } | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const topItemsCacheRef = useRef<Record<string, { items: any[]; schema?: DatasetSchema | null; warnings?: string[] }>>({});
  const spendSeriesCacheRef = useRef<Record<string, { combined: SpendPoint[]; datasets: Record<string, SpendPoint[]> }>>({});

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

  const tabToBigQueryDatasetMap: { [key: string]: string } = {
    Overall: 'overall',
    Amazon: 'amazon',
    Bookstore: 'bookstore',
    CruzBuy: 'cruzbuy',
    OneCard: 'onecard',
  };

  const activeDatasetKey = tabToBigQueryDatasetMap[activeTab] || 'overall';

  useEffect(() => {
    fetch(`http://127.0.0.1:8000/api/analytics/dataset-config?dataset=${activeDatasetKey}`)
      .then(async (res) => {
        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload?.detail || 'Failed to load dataset schema.');
        }
        return payload;
      })
      .then((res) => setActiveSchema(res.data || FALLBACK_DATASET_SCHEMAS[activeDatasetKey]))
      .catch(() => setActiveSchema(FALLBACK_DATASET_SCHEMAS[activeDatasetKey] || FALLBACK_DATASET_SCHEMAS.overall));
  }, [activeDatasetKey]);

  // 1. BIGQUERY TOP ITEMS
  useEffect(() => {
    setIsLoadingTopItems(true);
    setTopItemsError(null);

    const params = new URLSearchParams({
      dataset: activeDatasetKey,
      search_query: deferredSearchQuery,
      selected_year: selectedYear,
      min_spend: String(minSpend || 0),
      limit: String(selectedLimit),
      sort_mode: selectedSortMode,
    });
    const cacheKey = params.toString();
    const cachedTopItems = topItemsCacheRef.current[cacheKey];
    if (cachedTopItems) {
      setTopItems(mergeProjectedTopItems(cachedTopItems.items || [], projectedData, activeDatasetKey));
      if (cachedTopItems.schema) {
        setActiveSchema(cachedTopItems.schema);
      }
      if (Array.isArray(cachedTopItems.warnings) && cachedTopItems.warnings.length > 0) {
        setTopItemsError(cachedTopItems.warnings.join(' '));
      }
      setIsLoadingTopItems(false);
      return;
    }

    fetch(`http://127.0.0.1:8000/api/analytics/top-items/bigquery?${params.toString()}`)
      .then(async (res) => {
        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload?.detail || 'Failed to load BigQuery top items.');
        }
        return payload;
      })
      .then((res) => {
        topItemsCacheRef.current[cacheKey] = {
          items: res.data?.items || [],
          schema: res.data?.schema || null,
          warnings: res.data?.warnings || [],
        };
        setTopItems(mergeProjectedTopItems(res.data?.items || [], projectedData, activeDatasetKey));
        if (res.data?.schema) {
          setActiveSchema(res.data.schema);
        }
        if (Array.isArray(res.data?.warnings) && res.data.warnings.length > 0) {
          setTopItemsError(res.data.warnings.join(' '));
        }
        setIsLoadingTopItems(false);
      })
      .catch((error) => {
        console.error('BigQuery top items fetch failed:', error);
        setTopItems([]);
        setTopItemsError(error instanceof Error ? error.message : 'Failed to load BigQuery top items.');
        setIsLoadingTopItems(false);
      });
  }, [activeDatasetKey, selectedYear, deferredSearchQuery, minSpend, selectedLimit, selectedSortMode, projectedData]);

  // 2. BIGQUERY SPEND SERIES
  useEffect(() => {
    setIsLoadingSpend(true);

    const params = new URLSearchParams({
      dataset: activeDatasetKey,
      time_period: 'month',
    });
    const cacheKey = params.toString();
    const cachedSpendSeries = spendSeriesCacheRef.current[cacheKey];
    if (cachedSpendSeries) {
      const seriesKey = tabToSeriesKeyMap[activeTab] || 'combined';
      const cachedSeriesByKey: { [key: string]: SpendPoint[] } = {
        combined: cachedSpendSeries.combined || [],
        amazon: cachedSpendSeries.datasets?.amazon || [],
        cruzbuy: cachedSpendSeries.datasets?.cruzbuy || [],
        onecard: cachedSpendSeries.datasets?.onecard || [],
        bookstore: cachedSpendSeries.datasets?.bookstore || [],
      };
      setRawSpendSeries(
        mergeProjectedSpendSeries(
          [...(cachedSeriesByKey[seriesKey] || cachedSeriesByKey.combined || [])],
          projectedData,
          activeDatasetKey
        )
      );
      setIsLoadingSpend(false);
      return;
    }

    fetch(`http://127.0.0.1:8000/api/analytics/spend-over-time/bigquery?${params.toString()}`)
      .then(async (res) => {
        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload?.detail || 'Failed to load BigQuery spend-over-time data.');
        }
        return payload;
      })
      .then((res) => {
        spendSeriesCacheRef.current[cacheKey] = {
          combined: res.data?.combined || [],
          datasets: res.data?.datasets || {},
        };
        const seriesKey = tabToSeriesKeyMap[activeTab] || 'combined';
        const liveSeriesByKey: { [key: string]: SpendPoint[] } = {
          combined: res.data?.combined || [],
          amazon: res.data?.datasets?.amazon || [],
          cruzbuy: res.data?.datasets?.cruzbuy || [],
          onecard: res.data?.datasets?.onecard || [],
          bookstore: res.data?.datasets?.bookstore || [],
        };
        setRawSpendSeries(
          mergeProjectedSpendSeries(
            [...(liveSeriesByKey[seriesKey] || liveSeriesByKey.combined || [])],
            projectedData,
            activeDatasetKey
          )
        );
        setIsLoadingSpend(false);
      })
      .catch((error) => {
        console.error('BigQuery spend-over-time fetch failed:', error);
        setRawSpendSeries([]);
        setIsLoadingSpend(false);
      });
  }, [activeTab, activeDatasetKey, projectedData]);


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

      // Categories
      if (selectedCategory !== 'all') {
        if (selectedCategory === 'technology' && !(/laptop|monitor|adapter|switch|drive|ipad|macbook|workstation|mouse|battery/.test(name))) return false;
        if (selectedCategory === 'lab-supplies' && !(/centrifuge|glove|pipette|beaker|dna|microscope|slide|goggle|parafilm/.test(name))) return false;
        if (selectedCategory === 'office' && !(/paper|marker|board|chair|stapler|pad|post-it|binder|toner/.test(name))) return false;
        if (selectedCategory === 'facilities' && !(/bulb|filter|trash|ladder|vest|handle|soap|wipe/.test(name))) return false;
      }

      return true;
    });
  }, [topItems, selectedCategory]);

  const chartTopItems = useMemo(
    () => filteredTopItems.filter((item) => !shouldExcludeAmazonGiftCardsFromCharts(item, activeDatasetKey)),
    [filteredTopItems, activeDatasetKey]
  );


  // The return statement below renders the entire dashboard
  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="sticky top-0 z-40 bg-gray-50/95 backdrop-blur py-2">
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
      
      {/* --- FILTER BAR --- */}
      <div className="my-6 w-full min-w-0">
        <FilterBar 
          selectedYear={selectedYear}
          selectedCategory={selectedCategory}
          searchQuery={searchQuery}
          minSpend={minSpend}
          selectedLimit={selectedLimit}
          selectedSortMode={selectedSortMode}
          isLiveMode
          onYearChange={setSelectedYear}
          onCategoryChange={setSelectedCategory}
          onSearchChange={setSearchQuery}
          onMinSpendChange={setMinSpend}
          onLimitChange={setSelectedLimit}
          onSortModeChange={setSelectedSortMode}
        />
      </div>

      <div className="w-full max-w-full min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        {isLoadingTopItems ? (
          <div className="flex min-h-[240px] items-center justify-center">Loading...</div>
        ) : (
          <div className="w-full max-w-full min-w-0 space-y-4 overflow-hidden">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Top Items</h2>
                <p className="text-sm text-slate-500">
                  Live BigQuery results
                </p>
              </div>
            </div>

            {topItemsError && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {topItemsError}
              </div>
            )}

            {projectedData && (
              <div className="rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-800">
                Projection overlay active for {projectedData.dataset}. BigQuery data is still the base layer.
              </div>
            )}

            <TopItemsTable
              data={filteredTopItems.slice(0, selectedLimit)}
              showProjected={projectedData !== null}
              schema={activeSchema}
              sortMode={selectedSortMode}
            />
          </div>
        )}
      </div>

      {/* --- CHART SECTION --- */}
      <div className="w-full min-w-0 rounded-xl border border-gray-200 bg-white p-8 shadow-sm min-h-[650px] flex flex-col">
        {isLoadingTopItems ? (
          <div className="flex flex-1 items-center justify-center">Loading...</div>
        ) : (
          <div className="space-y-8 flex-1">
            <ProjectionUploader
              onProjectionSuccess={(dataset, data, time_data) => setProjectedData({ dataset, data, time_data })}
              onClearProjection={() => setProjectedData(null)}
              hasActiveProjection={projectedData !== null}
            />

            <div className="h-[450px] w-full">
               <TopItemsChart
                 data={chartTopItems.slice(0, selectedLimit)}
                 metricLabel={activeSchema?.metric_label}
                 metricType={activeSchema?.metric_type}
               />
            </div>

            <HighImpactScatterPlot
              data={chartTopItems.slice(0, selectedLimit)}
              metricLabel={activeSchema?.metric_label}
              metricType={activeSchema?.metric_type}
            />

            <TransactionsOverTimeChart
              data={spendSeries}
              loading={isLoadingSpend}
              metricLabel={activeSchema?.metric_label}
              metricType={activeSchema?.metric_type}
              title={`${activeSchema?.metric_label || 'Spend Over Time'} (${activeTab}, ${spendRangeMode === 'term' ? QUARTER_RANGES[selectedQuarter].label : selectedYear})`}
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
