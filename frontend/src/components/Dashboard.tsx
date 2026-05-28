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
import ItemSpendTrendChart from './ItemSpendTrendChart';
import { TopItemsTable } from './TopItemsTable';
import { InventoryInsights, type InsightRow } from './InventoryInsights';
import { PurchasePlan } from './PurchasePlan';
import { FALLBACK_DATASET_SCHEMAS, type DatasetSchema } from '../lib/datasetConfig';
import { getOriginalCategoriesForBroad } from '../lib/categoryMapping';
import { AlertTriangle, BarChart3, Boxes, Building2, ShoppingBag, Sparkles, TrendingUp } from 'lucide-react';


// --- TYPES & CONSTANTS ---
// A single point on the spend-over-time chart. `pending_spend` is only 
// populated when a staged projection has been blended into preview mode
type SpendPoint = { period: string; spend: number; pending_spend?: number };
type PatternDimension = 'item' | 'merchant' | 'category';
type DashboardTab = 'Home' | 'Overall' | 'CruzBuy' | 'OneCard' | 'Amazon' | 'Bookstore';
type QuarterName = 'All Quarters' | 'Fall' | 'Winter' | 'Spring' | 'Summer';

// availableYearsFromSeries()
// Extracts all unique years from a raw spend series to populate the "Year" filter 
// dropdown. Ensures years are valid 4-digit numbers and sorts them in ascending 
// order
const availableYearsFromSeries = (points: SpendPoint[]): string[] =>
  Array.from(new Set(points.map((p) => String(p.period).slice(0, 4))))
    .filter((y) => /^\d{4}$/.test(y))
    .sort((a, b) => a.localeCompare(b));

const EXCLUDED_CONDENSED_GROUPS = new Set([
  'gift cards',
  'food bulk purchases',
  'business services',
]);

const shouldExcludeFromCharts = (item: any, activeDatasetKey: string) => {
  if (activeDatasetKey === 'amazon') {
    const cleanName = String(item.clean_item_name || '').trim().toLowerCase();
    const categoryValue = String(item.row_values?.Category || item.row_values?.category || '').trim().toLowerCase();
    if (cleanName === 'gift cards' || categoryValue === 'gift cards') return true;
  }

  const condensedGroup = String(item.condensed_group || '').trim().toLowerCase();
  return EXCLUDED_CONDENSED_GROUPS.has(condensedGroup);
};

const hasSchemaColumn = (schema: DatasetSchema | null, canonicalName: string) =>
  Boolean(schema?.columns?.some((column) => column.canonical_name === canonicalName && column.available));

const getAvailablePatternDimensions = (
  schema: DatasetSchema | null,
  datasetKey: string
): PatternDimension[] => {
  const dimensions: PatternDimension[] = ['item'];

  if (datasetKey !== 'bookstore' && hasSchemaColumn(schema, 'Merchant Name')) {
    dimensions.push('merchant');
  }

  if (datasetKey !== 'overall' && hasSchemaColumn(schema, 'Category')) {
    dimensions.push('category');
  }

  return dimensions;
};

const patternDimensionLabel = (dimension: PatternDimension) => {
  if (dimension === 'merchant') return 'Merchants';
  if (dimension === 'category') return 'Categories';
  return 'Items';
};

const patternDimensionDescription = (dimension: PatternDimension) => {
  if (dimension === 'merchant') return 'Compare the external merchants with the highest purchase activity.';
  if (dimension === 'category') return 'Compare the categories with the highest purchase activity.';
  return 'Compare the most frequently purchased items and inspect detailed item-level breakdowns.';
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));

const datasetPreviewConfig = [
  {
    key: 'amazon',
    label: 'Amazon',
    description: 'External purchases on Amazon.com',
    icon: ShoppingBag,
  },
  {
    key: 'cruzbuy',
    label: 'CruzBuy',
    description: 'External purchases made through student and employee requests.',
    icon: Building2,
  },
  {
    key: 'onecard',
    label: 'OneCard',
    description: 'External purchases using the UCSC employee Visa card.',
    icon: BarChart3,
  },
  {
    key: 'bookstore',
    label: 'Bookstore',
    description: 'Campus store sales.',
    icon: Boxes,
  },
] as const;

type DatasetPreview = Record<string, any[]>;

// --- MAIN COMPONENT ---
export function Dashboard() {
  const [activeTab, setActiveTab] = useState<DashboardTab>('Home');

  // Active display states
  // Top items states
  const [topItems, setTopItems] = useState<any[]>([]);
  const [isLoadingTopItems, setIsLoadingTopItems] = useState(true);
  const [topItemsError, setTopItemsError] = useState<string | null>(null);
  const [activeSchema, setActiveSchema] = useState<DatasetSchema | null>(FALLBACK_DATASET_SCHEMAS.overall);
  const [selectedPatternDimension, setSelectedPatternDimension] = useState<PatternDimension>('item');
  const [topPatterns, setTopPatterns] = useState<any[]>([]);
  const [isLoadingTopPatterns, setIsLoadingTopPatterns] = useState(true);
  const [topPatternsError, setTopPatternsError] = useState<string | null>(null);
  
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
  const [highImpactOnly, setHighImpactOnly] = useState<boolean>(false);
  const [activeChartSlide, setActiveChartSlide] = useState(0);
  const [insightsData, setInsightsData] = useState<{amazon: any[], bookstore: any[]}>({ amazon: [], bookstore: [] });
  const [datasetPreviews, setDatasetPreviews] = useState<DatasetPreview>({});
  const [datasetPreviewsLoading, setDatasetPreviewsLoading] = useState(false);
  const [purchasePlan, setPurchasePlan] = useState<{
    item: InsightRow;
    dataset: string;
    unitPrice: number | null;
    recommendedQty: number;
  }[]>([]);
  const planCategories = useMemo(
    () => new Set(purchasePlan.map((p) => p.item.category)),
    [purchasePlan]
  );
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const topItemsCacheRef = useRef<Record<string, { items: any[]; schema?: DatasetSchema | null; warnings?: string[] }>>({});
  const topPatternsCacheRef = useRef<Record<string, { items: any[]; warnings?: string[] }>>({});
  const spendSeriesCacheRef = useRef<Record<string, { combined: SpendPoint[]; datasets: Record<string, SpendPoint[]> }>>({});

  // This map helps us determine which series to pull from the raw spend data
  // based on the active tab, since the API returns all datasets together and we
  // need to extract the relevant one for the current view
  const tabToSeriesKeyMap: { [key: string]: string } = {
    Home: 'amazon',
    Overall: 'combined',
    Amazon: 'amazon',
    Bookstore: 'bookstore',
    CruzBuy: 'cruzbuy',
    OneCard: 'onecard',
  };

  const tabToBigQueryDatasetMap: { [key: string]: string } = {
    Home: 'amazon',
    Overall: 'overall',
    Amazon: 'amazon',
    Bookstore: 'bookstore',
    CruzBuy: 'cruzbuy',
    OneCard: 'onecard',
  };

  const activeDatasetKey = tabToBigQueryDatasetMap[activeTab] || 'overall';

  const topAmazonItem = useMemo(() => {
    if (!Array.isArray(topItems) || topItems.length === 0) return null;
    return [...topItems].sort((a, b) => Number(b.count || 0) - Number(a.count || 0))[0];
  }, [topItems]);

  const highImpactCount = useMemo(
    () => topItems.filter((item) => item.is_high_impact || (item.is_high_spend && item.is_frequent)).length,
    [topItems]
  );

  const totalVisibleSpend = useMemo(
    () => topItems.reduce((sum, item) => sum + Number(item.total_spent || 0), 0),
    [topItems]
  );

  useEffect(() => {
    fetch(`/api/analytics/dataset-config?dataset=${activeDatasetKey}`)
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

  useEffect(() => {
    if (activeTab !== 'Home') return;

    setDatasetPreviewsLoading(true);
    Promise.all(
      datasetPreviewConfig.map((dataset) =>
        fetch(`/api/analytics/top-items/bigquery?dataset=${dataset.key}&limit=10`)
          .then((res) => res.json())
          .then((payload) => [dataset.key, payload.data?.items || []] as const)
      )
    )
      .then((entries) => {
        setDatasetPreviews(Object.fromEntries(entries));
      })
      .catch((error) => {
        console.error('Dataset previews fetch failed:', error);
        setDatasetPreviews({});
      })
      .finally(() => setDatasetPreviewsLoading(false));
  }, [activeTab]);

  useEffect(() => {
    setActiveChartSlide(0);
  }, [activeTab]);

  const availablePatternDimensions = useMemo(
    () => getAvailablePatternDimensions(activeSchema, activeDatasetKey),
    [activeSchema, activeDatasetKey]
  );

  useEffect(() => {
    if (!availablePatternDimensions.includes(selectedPatternDimension)) {
      setSelectedPatternDimension(availablePatternDimensions[0] || 'item');
    }
  }, [availablePatternDimensions, selectedPatternDimension]);

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
      high_impact_only: String(highImpactOnly),
    });
    if (selectedCategory !== 'all') {
      const originals = getOriginalCategoriesForBroad(selectedCategory);
      if (originals.length > 0) {
        params.set('category_filter', originals.join('|'));
      }
    }
    const cacheKey = params.toString();
    const cachedTopItems = topItemsCacheRef.current[cacheKey];
    if (cachedTopItems) {
      setTopItems(cachedTopItems.items || []);
      if (cachedTopItems.schema) {
        setActiveSchema(cachedTopItems.schema);
      }
      if (Array.isArray(cachedTopItems.warnings) && cachedTopItems.warnings.length > 0) {
        setTopItemsError(cachedTopItems.warnings.join(' '));
      }
      setIsLoadingTopItems(false);
      return;
    }

    fetch(`/api/analytics/top-items/bigquery?${params.toString()}`)
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
        setTopItems(res.data?.items || []);
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
    }, [activeDatasetKey, selectedYear, selectedQuarter, deferredSearchQuery, minSpend, selectedLimit, selectedSortMode, selectedCategory, highImpactOnly]);

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
      setRawSpendSeries([...(cachedSeriesByKey[seriesKey] || cachedSeriesByKey.combined || [])]);
      setIsLoadingSpend(false);
      return;
    }

    fetch(`/api/analytics/spend-over-time/bigquery?${params.toString()}`)
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
        setRawSpendSeries([...(liveSeriesByKey[seriesKey] || liveSeriesByKey.combined || [])]);
        setIsLoadingSpend(false);
      })
      .catch((error) => {
        console.error('BigQuery spend-over-time fetch failed:', error);
        setRawSpendSeries([]);
        setIsLoadingSpend(false);
      });
  }, [activeTab, activeDatasetKey, selectedYear, selectedQuarter]);


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
    return topItems;
  }, [topItems]);

  const chartTopItems = useMemo(
    () => filteredTopItems.filter((item) => !shouldExcludeFromCharts(item, activeDatasetKey)),
    [filteredTopItems, activeDatasetKey]
  );
  const displayedPatternData = selectedPatternDimension === 'item' ? chartTopItems.slice(0, 5) : topPatterns;
  const displayedPatternError = selectedPatternDimension === 'item' ? topItemsError : topPatternsError;
  const patternDimensionControls = (
    <div className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
      {availablePatternDimensions.map((dimension) => {
        const isActive = selectedPatternDimension === dimension;
        return (
          <button
            key={dimension}
            type="button"
            onClick={() => setSelectedPatternDimension(dimension)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
              isActive
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
            }`}
          >
            {patternDimensionLabel(dimension)}
          </button>
        );
      })}
    </div>
  );
  const chartSlides = [
    {
      title: 'Top Purchase Patterns',
      subtitle: 'View the leading items, merchants, or categories for the current dataset.',
      headerActions: patternDimensionControls,
      content: (
        <TopItemsChart
          data={displayedPatternData}
          metricLabel={activeSchema?.metric_label}
          metricType={activeSchema?.metric_type}
          title={`Top 5 ${patternDimensionLabel(selectedPatternDimension)}`}
          description={patternDimensionDescription(selectedPatternDimension)}
          enableDrilldown={selectedPatternDimension === 'item'}
          enableCostMetric={selectedPatternDimension === 'item'}
        />
      ),
    },
    {
      title: 'High Impact Items',
      subtitle: 'Compare high-frequency and high-spend purchases.',
      headerActions: null,
      content: (
        <HighImpactScatterPlot
          data={chartTopItems.slice(0, selectedLimit)}
          metricLabel={activeSchema?.metric_label}
          metricType={activeSchema?.metric_type}
        />
      ),
    },
    {
      title: 'Total Spend Over Time',
      subtitle: 'Track spending trends across the selected time period.',
      headerActions: null,
      content: (
        <TransactionsOverTimeChart
          data={spendSeries}
          loading={isLoadingSpend}
          metricLabel={activeSchema?.metric_label}
          metricType={activeSchema?.metric_type}
          title={`${activeSchema?.metric_label || 'Spend Over Time'} (${activeTab}, ${selectedYear}, ${selectedQuarter})`}
        />
      ),
    },
    {
      title: 'Item Spend Trends',
      subtitle: 'Search for an item keyword and track its spending trends and matching purchases over time.',
      headerActions: null,
      content: (
        <ItemSpendTrendChart
          activeDatasetKey={activeDatasetKey}
          selectedYear={selectedYear}
          selectedQuarter={selectedQuarter}
        />
      ),
    },
  ];
  
  const activeSlide = chartSlides[activeChartSlide] || chartSlides[0];
  
  const goToPreviousSlide = () => {
    setActiveChartSlide((current) =>
      current === 0 ? chartSlides.length - 1 : current - 1
    );
  };
  
  const goToNextSlide = () => {
    setActiveChartSlide((current) =>
      current === chartSlides.length - 1 ? 0 : current + 1
    );
  };

  useEffect(() => {
    setIsLoadingTopPatterns(true);
    setTopPatternsError(null);

    const params = new URLSearchParams({
      dataset: activeDatasetKey,
      search_query: deferredSearchQuery,
      selected_year: selectedYear,
      selected_quarter: selectedQuarter,
      min_spend: String(minSpend || 0),
      limit: '5',
      sort_mode: selectedSortMode,
      group_by: selectedPatternDimension,
    });
    const cacheKey = params.toString();
    const cachedTopPatterns = topPatternsCacheRef.current[cacheKey];
    if (cachedTopPatterns) {
      setTopPatterns(cachedTopPatterns.items || []);
      if (Array.isArray(cachedTopPatterns.warnings) && cachedTopPatterns.warnings.length > 0) {
        setTopPatternsError(cachedTopPatterns.warnings.join(' '));
      }
      setIsLoadingTopPatterns(false);
      return;
    }

    fetch(`/api/analytics/top-items/bigquery?${params.toString()}`)
      .then(async (res) => {
        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload?.detail || 'Failed to load top purchase patterns.');
        }
        return payload;
      })
      .then((res) => {
        topPatternsCacheRef.current[cacheKey] = {
          items: res.data?.items || [],
          warnings: res.data?.warnings || [],
        };
        setTopPatterns(res.data?.items || []);
        if (Array.isArray(res.data?.warnings) && res.data.warnings.length > 0) {
          setTopPatternsError(res.data.warnings.join(' '));
        }
        setIsLoadingTopPatterns(false);
      })
      .catch((error) => {
        console.error('Top purchase patterns fetch failed:', error);
        setTopPatterns([]);
        setTopPatternsError(error instanceof Error ? error.message : 'Failed to load top purchase patterns.');
        setIsLoadingTopPatterns(false);
      });
  }, [activeDatasetKey, deferredSearchQuery, minSpend, selectedPatternDimension, selectedQuarter, selectedSortMode, selectedYear]);

  // Fetch baseline data specifically for the Inventory Insights cross-reference
  useEffect(() => {
    if (activeTab === 'Home' || activeTab === 'Amazon' || activeTab === 'Bookstore') {
      Promise.all([
        fetch('/api/analytics/top-items/bigquery?dataset=amazon&limit=100').then(r => r.json()),
        fetch('/api/analytics/top-items/bigquery?dataset=bookstore&limit=100').then(r => r.json())
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


  const handleAddToPlan = (item: InsightRow) => {
    setPurchasePlan((prev) => {
      if (prev.some((p) => p.item.category === item.category)) return prev;
      const baseItems = activeDatasetKey === 'amazon' ? insightsData.amazon : insightsData.bookstore;
      const catLower = item.category.toLowerCase();
      const match = baseItems.find((ti: any) => {
        const name = String(ti.clean_item_name || '').toLowerCase();
        return name.includes(catLower) || catLower.includes(name);
      });
      const unitPrice = match && match.count > 0 ? match.total_spent / match.count : null;
      const recommendedQty = activeDatasetKey === 'bookstore'
        ? Math.max(0, item.predicted_demand - Math.max(0, item.current_stock))
        : item.predicted_demand;
      return [...prev, { item, dataset: activeDatasetKey, unitPrice, recommendedQty }];
    });
  };

  if (activeTab === 'Home') {
    return (
      <div className="w-full min-w-0 space-y-6">
        <div className="sticky top-0 z-40 bg-gray-50/95 backdrop-blur py-2">
          <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-6">
            <div>
              <div>
              </div>
              <h1 className="text-3xl font-bold text-[#003c6c]">SlugSmart Overview</h1>
              <p className="mt-2 text-sm leading-6 text-slate-950">
                <b>Welcome to SlugSmart!</b> SlugSmart is a procurement analytics and financial 
                decision-support platform for the UCSC Financial Affairs office. With SlugSmart, 
                users can upload and view cleaned purchase and sales datasets, analyze spending 
                trends, discover stocking opportunities through predictive insights, and view and 
                export periodic summary reports.<br />
                <br />
                To get started, upload procurement datasets to the Google Drive folder and press
                the "Refresh Data" button at the top. Then, explore this page to view what needs 
                attention right now: Amazon demand insights, high-impact purchases, the top items 
                appearing across datasets, and Amazon-specific spending analytics graphs. To view 
                a dataset more in-depth, click on its tab at the top.
              </p>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase text-[#2d66ae]">
                  <AlertTriangle className="size-4 text-[#003c6c]" />
                  High impact items
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-950">{highImpactCount}</div>
                <p className="text-xs text-slate-500">Number of Amazon items with high spend and frequency.</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase text-[#2d66ae]">
                  <ShoppingBag className="size-4 text-[#003c6c]" />
                  Top item or item group
                </div>
                <div className="mt-2 truncate text-lg font-bold text-slate-950" title={topAmazonItem?.clean_item_name || ''}>
                  {topAmazonItem?.clean_item_name || 'Loading'}
                </div>
                <p className="text-xs text-slate-500">
                  {topAmazonItem ? `${Number(topAmazonItem.count || 0).toLocaleString()} recent purchases.` : 'Loading'}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase text-[#2d66ae]">
                  <TrendingUp className="size-4 text-[#003c6c]" />
                  Total spend
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-950">{formatCurrency(totalVisibleSpend)}</div>
                <p className="text-xs text-slate-500"> Across the current Amazon top items.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div>
          </div>
          <InventoryInsights
            activeTab="Amazon"
            onAddToPlan={handleAddToPlan}
            planCategories={planCategories}
          />
          <PurchasePlan
            items={purchasePlan.filter((p) => p.dataset === 'amazon')}
            onRemove={(category) =>
              setPurchasePlan((prev) => prev.filter((p) => p.item.category !== category))
            }
            onClearAll={() =>
              setPurchasePlan((prev) => prev.filter((p) => p.dataset !== 'amazon'))
            }
          />
        </section>

        <section className="w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 w-full min-w-0 text-left">
            <h2 className="text-xl font-bold text-[#003c6c]">Top Items Across Datasets</h2>
            <p className="mt-1 text-sm text-slate-950">
              View the most-bought external items and most-sold Bookstore items across all four data sources to understand 
              what is high in demand. To dive deeper into a specific dataset, press the "Open" button on its card.
            </p>
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
            {datasetPreviewConfig.map((dataset) => {
              const Icon = dataset.icon;
              const items = datasetPreviews[dataset.key] || [];

              return (
                <div key={dataset.key} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-4 grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
                    <div className="shrink-0 rounded-lg bg-white p-2 text-[#003c6c] shadow-sm">
                      <Icon className="size-4 text-[#2d66ae]" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold leading-tight text-[#003c6c]">{dataset.label}</h3>
                      <p className="text-xs leading-5 text-slate-500">{dataset.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab(dataset.label as DashboardTab)}
                      className="shrink-0 rounded-lg border border-[#2d66ae] bg-[#2d66ae] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#003c6c]"
                    >
                      Open
                    </button>
                  </div>

                  {datasetPreviewsLoading ? (
                    <div className="h-40 rounded-lg border border-slate-200 bg-white/70 animate-pulse" />
                  ) : items.length === 0 ? (
                    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">No preview rows available.</div>
                  ) : (
                    <ol className="space-y-2">
                      {items.slice(0, 10).map((item, index) => (
                        <li key={`${dataset.key}-${item.clean_item_name}-${index}`} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-slate-800" title={item.clean_item_name}>
                              {index + 1}. {item.clean_item_name}
                            </div>
                            <div className="text-xs text-slate-500">{Number(item.count || 0).toLocaleString()} purchases</div>
                          </div>
                          <div className="shrink-0 text-xs font-semibold text-[#2d66ae]">
                            {formatCurrency(item.total_spent)}
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-[#003c6c]">Amazon Spending Analytics Graphs</h2>
            <p className="mt-1 text-sm text-slate-950">
              The Spending Analytics Graphs encompass various tools and visualizations to aid in analyzing spending trends.
              They include a Top Purchase Patterns bar chart with a drilldown panel, a High Impact Items scatterplot, a Total Spend Over Time line
              graph, and Total Spend Over Time on specific items line graph with a built-in search bar.
            </p>
          </div>
          {isLoadingTopPatterns ? (
            <div className="flex min-h-[420px] items-center justify-center">Loading...</div>
          ) : (
            <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-5">
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <h3 className="text-lg font-bold leading-tight text-[#003c6c]">{activeSlide.title}</h3>
                  <p className="text-sm text-slate-500">{activeSlide.subtitle}</p>
                </div>
                {activeSlide.headerActions}
              </div>
              {activeChartSlide === 0 && displayedPatternError && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {displayedPatternError}
                </div>
              )}

              <div className="relative flex min-h-[470px] w-full min-w-0 items-center justify-center">
                <button
                  type="button"
                  onClick={goToPreviousSlide}
                  className="absolute left-0 z-10 ml-2 rounded-full border border-[#2d66ae] bg-[#2d66ae] px-3 py-2 text-lg font-bold text-white shadow-md hover:bg-[#003c6c]"
                  aria-label="Previous chart"
                >
                  &lsaquo;
                </button>
                <div className="w-full min-w-0 max-w-5xl px-10">{activeSlide.content}</div>
                <button
                  type="button"
                  onClick={goToNextSlide}
                  className="absolute right-0 z-10 mr-2 rounded-full border border-[#2d66ae] bg-[#2d66ae] px-3 py-2 text-lg font-bold text-white shadow-md hover:bg-[#003c6c]"
                  aria-label="Next chart"
                >
                  &rsaquo;
                </button>
              </div>

              <div className="mt-4 flex justify-center gap-2">
                {chartSlides.map((slide, index) => (
                  <button
                    key={slide.title}
                    type="button"
                    onClick={() => setActiveChartSlide(index)}
                    className={`h-2.5 rounded-full transition-all ${
                      activeChartSlide === index ? 'w-8 bg-[#2d66ae]' : 'w-2.5 bg-slate-300'
                    }`}
                    aria-label={`Show ${slide.title}`}
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    );
  };

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
        highImpactOnly={highImpactOnly}
        availableYears={availableYears}
        isLiveMode
        onYearChange={setSelectedYear}
        onQuarterChange={setSelectedQuarter}
        onCategoryChange={setSelectedCategory}
        onSearchChange={setSearchQuery}
        onMinSpendChange={setMinSpend}
        onLimitChange={setSelectedLimit}
        onSortModeChange={setSelectedSortMode}
        onHighImpactChange={setHighImpactOnly}
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

            <TopItemsTable
              data={filteredTopItems.slice(0, selectedLimit)}
              showProjected={false}
              schema={activeSchema}
              sortMode={selectedSortMode}
            />
          </div>
        )}
      </div>

      {/* --- CHART SECTION --- */}
      <div className="w-full min-w-0 rounded-xl border border-gray-200 bg-white p-8 shadow-sm min-h-[650px] flex flex-col">
        {isLoadingTopPatterns ? (
          <div className="flex flex-1 items-center justify-center">Loading...</div>
        ) : (
          <div className="space-y-8 flex-1">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{activeSlide.title}</h2>
                  <p className="text-sm text-slate-500">{activeSlide.subtitle}</p>
                  {activeChartSlide === 0 && activeDatasetKey === 'overall' && selectedPatternDimension === 'merchant' && (
                    <p className="mt-1 text-xs text-slate-500">
                      Merchant rankings exclude datasets without merchant fields.
                    </p>
                  )}
                </div>
                {activeSlide.headerActions}
              </div>
               {activeChartSlide === 0 && displayedPatternError && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {displayedPatternError}
                </div>
              )}

              <div className="min-h-[470px] w-full flex justify-center">
                <div className="relative w-full min-h-[470px] flex items-center justify-center">
                  
                  {/* LEFT BUTTON */}
                  <button
                    type="button"
                    onClick={goToPreviousSlide}
                    className="absolute left-0 z-10 ml-2 rounded-full bg-white shadow-md border border-slate-200 px-3 py-2 text-lg font-bold text-slate-700 hover:bg-slate-100"
                  >
                    ‹
                  </button>

                  {/* CONTENT */}
                  <div className="w-full max-w-4xl">
                    {activeSlide.content}
                  </div>

                  {/* RIGHT BUTTON */}
                  <button
                    type="button"
                    onClick={goToNextSlide}
                    className="absolute right-0 z-10 mr-2 rounded-full bg-white shadow-md border border-slate-200 px-3 py-2 text-lg font-bold text-slate-700 hover:bg-slate-100"
                  >
                    ›
                  </button>

                </div>
              </div>

              <div className="mt-4 flex justify-center gap-2">
                {chartSlides.map((slide, index) => (
                  <button
                    key={slide.title}
                    type="button"
                    onClick={() => setActiveChartSlide(index)}
                    className={`h-2.5 rounded-full transition-all ${
                      activeChartSlide === index ? 'w-8 bg-slate-900' : 'w-2.5 bg-slate-300'
                    }`}
                    aria-label={`Show ${slide.title}`}
                  />
                ))}
              </div>
            </div>

            {/* shows inventory insights if amazon or bookstore tabs are selected */}
            {(activeTab === 'Amazon' || activeTab === 'Bookstore') && (
              <>
                <InventoryInsights
                  activeTab={activeTab}
                  onAddToPlan={handleAddToPlan}
                  planCategories={planCategories}
                />
                <PurchasePlan
                  items={purchasePlan.filter((p) => p.dataset === activeDatasetKey)}
                  onRemove={(category) =>
                    setPurchasePlan((prev) => prev.filter((p) => p.item.category !== category))
                  }
                  onClearAll={() =>
                    setPurchasePlan((prev) => prev.filter((p) => p.dataset !== activeDatasetKey))
                  }
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}