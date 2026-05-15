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
import { FALLBACK_DATASET_SCHEMAS, type DatasetSchema } from '../lib/datasetConfig';
import { getOriginalCategoriesForBroad } from '../lib/categoryMapping';


// --- TYPES & CONSTANTS ---
// A single point on the spend-over-time chart. `pending_spend` is only 
// populated when a staged projection has been blended into preview mode
type SpendPoint = { period: string; spend: number; pending_spend?: number };
type PatternDimension = 'item' | 'merchant' | 'category';

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

const timePeriodToMonths = (tp: string): number => {
  switch (tp) {
    case '1_month': return 1;
    case '1_quarter': return 3;
    case '6_months': return 6;
    case '1_year': return 12;
    default: return 3;
  }
};

const getFutureMonths = (numMonths: number): string[] => {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < numMonths; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
};

const computePredictionProjection = (
  predictions: { item: InsightRow; timePeriod: string }[],
  topItems: any[],
  dataset: string
): { dataset: string; data: any[]; time_data: { period: string; pending_spend: number }[] } | null => {
  if (predictions.length === 0) return null;

  const dataItems: any[] = [];
  const timeMap: Record<string, number> = {};

  predictions.forEach(({ item, timePeriod }) => {
    const catLower = item.category.toLowerCase();
    const match = topItems.find((ti: any) => {
      const name = String(ti.clean_item_name || '').toLowerCase();
      return name.includes(catLower) || catLower.includes(name);
    });

    const avgUnitPrice = match && match.count > 0 ? match.total_spent / match.count : null;
    const projectedCost = avgUnitPrice != null ? item.predicted_demand * avgUnitPrice : null;

    dataItems.push({
      clean_item_name: item.category,
      count: item.predicted_demand,
      total_spent: projectedCost ?? 0,
      vendors: [],
      year: 'Projected',
    });

    if (projectedCost != null) {
      const numMonths = timePeriodToMonths(timePeriod);
      const months = getFutureMonths(numMonths);
      const spendPerMonth = projectedCost / numMonths;
      months.forEach((period) => {
        timeMap[period] = (timeMap[period] || 0) + spendPerMonth;
      });
    }
  });

  const time_data = Object.entries(timeMap)
    .map(([period, pending_spend]) => ({ period, pending_spend }))
    .sort((a, b) => a.period.localeCompare(b.period));

  return { dataset, data: dataItems, time_data };
};

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


// --- MAIN COMPONENT ---
export function Dashboard() {
  const [activeTab, setActiveTab] = useState<'Overall' | 'CruzBuy' | 'OneCard' | 'Amazon' | 'Bookstore'>('Amazon');

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
  const [projectedData, setProjectedData] = useState<{
    dataset: string;
    data: any[];
    time_data: { period: string; pending_spend: number }[];
  } | null>(null);
  const [acceptedPredictions, setAcceptedPredictions] = useState<
    { item: InsightRow; timePeriod: string }[]
  >([]);
  const acceptedCategories = useMemo(
    () => new Set(acceptedPredictions.map((p) => p.item.category)),
    [acceptedPredictions]
  );
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const topItemsCacheRef = useRef<Record<string, { items: any[]; schema?: DatasetSchema | null; warnings?: string[] }>>({});
  const topPatternsCacheRef = useRef<Record<string, { items: any[]; warnings?: string[] }>>({});
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
    }, [activeDatasetKey, selectedYear, selectedQuarter, deferredSearchQuery, minSpend, selectedLimit, selectedSortMode, selectedCategory, highImpactOnly, projectedData]);

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
      subtitle: 'View the leading items, merchants, or categories for the active dataset.',
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
      subtitle: 'Search for an item keyword and track matching purchases over time.',
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
    if (activeTab === 'Amazon' || activeTab === 'Bookstore') {
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


  // Recompute projectedData whenever accepted predictions or the active dataset changes
  useEffect(() => {
    if (acceptedPredictions.length === 0) {
      setProjectedData(null);
      return;
    }
    const baseItems =
      activeDatasetKey === 'amazon' ? insightsData.amazon : insightsData.bookstore;
    const projection = computePredictionProjection(
      acceptedPredictions,
      baseItems,
      activeDatasetKey
    );
    setProjectedData(projection);
  }, [acceptedPredictions, activeDatasetKey, insightsData]);

  const handleFollowPrediction = (item: InsightRow, timePeriod: string) => {
    setAcceptedPredictions((prev) => {
      const exists = prev.some((p) => p.item.category === item.category);
      if (exists) return prev;
      return [...prev, { item, timePeriod }];
    });
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

            {projectedData && (
              <div className="rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-800 flex items-start gap-2">
                <span className="mt-0.5 w-2 h-2 rounded-full bg-purple-500 shrink-0 animate-pulse" />
                <span>
                  <strong>ML Projection active</strong> — purple figures below are estimated future values based on accepted ML predictions. Historical (actual) data remains unchanged as the base layer.
                </span>
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
        {isLoadingTopPatterns ? (
          <div className="flex flex-1 items-center justify-center">Loading...</div>
        ) : (
          <div className="space-y-8 flex-1">
            {acceptedPredictions.length > 0 && (
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 rounded-full bg-purple-500 animate-pulse" />
                    <span className="font-bold text-purple-900">Projection Active</span>
                  </div>
                  <button
                    onClick={() => setAcceptedPredictions([])}
                    className="px-4 py-2 bg-white border border-purple-200 text-purple-700 rounded-lg text-sm font-bold shadow-sm hover:bg-purple-50 transition-colors"
                  >
                    Clear All
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mt-1">
                  {acceptedPredictions.map(({ item }) => (
                    <span
                      key={item.category}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-medium"
                    >
                      {item.category}
                      <button
                        onClick={() =>
                          setAcceptedPredictions((prev) =>
                            prev.filter((p) => p.item.category !== item.category)
                          )
                        }
                        className="ml-1 hover:text-purple-500 leading-none"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

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
              <InventoryInsights
                activeTab={activeTab}
                onFollowPrediction={handleFollowPrediction}
                acceptedCategories={acceptedCategories}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}