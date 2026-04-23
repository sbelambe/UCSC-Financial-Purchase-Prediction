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

type QuarterName = 'All Quarters' | 'Fall' | 'Winter' | 'Spring' | 'Summer';

const quarterForMonthDay = (month: number, day: number): QuarterName => {
  if (
    (month === 9 && day >= 15) ||
    month === 10 ||
    month === 11 ||
    month === 12
  ) {
    return 'Fall';
  }

  if (
    month === 1 ||
    month === 2 ||
    (month === 3 && day <= 20)
  ) {
    return 'Winter';
  }

  if (
    (month === 3 && day >= 21) ||
    month === 4 ||
    month === 5 ||
    (month === 6 && day <= 20)
  ) {
    return 'Spring';
  }

  return 'Summer';
};

const filterSeriesByQuarterName = (
  points: SpendPoint[],
  quarter: QuarterName
): SpendPoint[] => {
  if (quarter === 'All Quarters') return points;

  return points.filter((p) => {
    const [yearStr, monthStr] = String(p.period).split('-');
    const month = Number(monthStr);

    if (!yearStr || !monthStr || Number.isNaN(month)) {
      return false;
    }

    // Since spend series is monthly, use a representative day in that month
    // to classify the month into your quarter system.
    let representativeDay = 15;

    if (month === 3) representativeDay = 21;
    if (month === 6) representativeDay = 21;
    if (month === 9) representativeDay = 15;
    if (month === 12) representativeDay = 15;

    return quarterForMonthDay(month, representativeDay) === quarter;
  });
};

// availableYearsFromSeries()
// Extracts all unique years from a raw spend series to populate the "Year" filter 
// dropdown. Ensures years are valid 4-digit numbers and sorts them in ascending 
// order
const availableYearsFromSeries = (points: SpendPoint[]): string[] =>
  Array.from(new Set(points.map((p) => String(p.period).slice(0, 4))))
    .filter((y) => /^\d{4}$/.test(y))
    .sort((a, b) => a.localeCompare(b));

const filterSeriesByYear = (points: SpendPoint[], year: string): SpendPoint[] => {
  return points.filter((p) => String(p.period).startsWith(`${year}-`));
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
  const [selectedQuarter, setSelectedQuarter] = useState<QuarterName>('All Quarters');
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [minSpend, setMinSpend] = useState<number>(0);
  const [selectedLimit, setSelectedLimit] = useState<number>(20);
  const [selectedSortMode, setSelectedSortMode] = useState<'frequency' | 'cost'>('frequency');
  const [insightsData, setInsightsData] = useState<{amazon: any[], bookstore: any[]}>({ amazon: [], bookstore: [] });
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
      selected_quarter: selectedQuarter,
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
    }, [activeDatasetKey, selectedYear, selectedQuarter, deferredSearchQuery, minSpend, selectedLimit, selectedSortMode, projectedData]);

  // 2. BIGQUERY SPEND SERIES
  useEffect(() => {
    setIsLoadingSpend(true);

    const params = new URLSearchParams({
      dataset: activeDatasetKey,
      time_period: 'month',
      selected_year: selectedYear,
      selected_quarter: selectedQuarter,
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
  }, [activeTab, activeDatasetKey, projectedData, selectedYear, selectedQuarter]);


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
    setSpendSeries(rawSpendSeries);
  }, [rawSpendSeries]);

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

  // Fetch baseline data specifically for the Inventory Insights cross-reference
  useEffect(() => {
    if (activeTab === 'Amazon' || activeTab === 'Bookstore') {
      Promise.all([
        fetch('http://127.0.0.1:8000/api/analytics/top-items/bigquery?dataset=amazon&limit=100').then(r => r.json()),
        fetch('http://127.0.0.1:8000/api/analytics/top-items/bigquery?dataset=bookstore&limit=100').then(r => r.json())
      ])
      .then(([amazonRes, bookstoreRes]) => {
        setInsightsData({
          amazon: amazonRes.data?.items || [],
          bookstore: bookstoreRes.data?.items || []
        });
      })
      .catch(console.error);
    }
  }, [activeTab]);


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
        selectedQuarter={selectedQuarter}
        selectedCategory={selectedCategory}
        searchQuery={searchQuery}
        minSpend={minSpend}
        selectedLimit={selectedLimit}
        selectedSortMode={selectedSortMode}
        isLiveMode
        onYearChange={setSelectedYear}
        onQuarterChange={setSelectedQuarter}
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
                <h2 className="text-xl font-bold text-slate-900">
                  {activeTab === 'Bookstore' ? 'Current Campus Bookstore Inventory' : 'Top Items'}
                </h2>
                <p className="text-sm text-slate-500">
                  {activeTab === 'Bookstore' 
                    ? '*Inventory levels approximated based on recent point-of-sale BigQuery data.'
                    : 'Live BigQuery results'}
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
              title={`${activeSchema?.metric_label || 'Spend Over Time'} (${activeTab}, ${selectedYear}, ${selectedQuarter})`}
            />

            {/* shows inventory insights if amazon or bookstore tabs are selected */}
            {(activeTab === 'Amazon' || activeTab === 'Bookstore') && (
              <InventoryInsights 
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
