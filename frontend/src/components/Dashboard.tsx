// Dashboard — main view. All data-fetching lives in the hooks imported below;
// this file is responsible for wiring state together and rendering the two
// tab layouts (Home and the per-dataset drill-down).
import { useState, useEffect, useMemo, useDeferredValue } from 'react';

import { TabNavigation }          from './TabNavigation';
import { FilterBar }              from './FilterBar';
import TopItemsChart              from './TopItemsChart';
import HighImpactScatterPlot      from './HighImpactScatterPlot';
import TransactionsOverTimeChart  from './TransactionsOverTimeChart';
import ItemSpendTrendChart        from './ItemSpendTrendChart';
import { TopItemsTable }          from './TopItemsTable';
import { InventoryInsights, type InsightRow } from './InventoryInsights';
import { PurchasePlan }           from './PurchasePlan';
import { MetricsGrid }            from './MetricsGrid';
import { ExternalVendorsPanel }   from './ExternalVendorsPanel';
import { ChartCarousel, type ChartSlide } from './ChartCarousel';

import { FALLBACK_DATASET_SCHEMAS, type DatasetSchema } from '../lib/datasetConfig';
import {
  TAB_TO_DATASET, DATASET_PREVIEW_CONFIG,
  shouldExcludeFromCharts, isValidMetricName, getAvailablePatternDimensions,
  patternDimensionLabel, patternDimensionDescription, formatCurrency,
  type DashboardTab, type QuarterName, type PatternDimension,
} from '../lib/dashboardTypes';

import { useTopItems }         from '../hooks/useTopItems';
import { useSpendSeries }      from '../hooks/useSpendSeries';
import { useTopPatterns }      from '../hooks/useTopPatterns';
import { useOverallSummary }   from '../hooks/useOverallSummary';
import { useDatasetPreviews }  from '../hooks/useDatasetPreviews';


export function Dashboard() {
  // --- Tab & filter state ---
  const [activeTab, setActiveTab]               = useState<DashboardTab>('Home');
  const [selectedYear, setSelectedYear]         = useState('All Time');
  const [selectedQuarter, setSelectedQuarter]   = useState<QuarterName>('All Quarters');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery]           = useState('');
  const [minSpend, setMinSpend]                 = useState<number>(0);
  const [selectedLimit, setSelectedLimit]       = useState<number>(20);
  const [selectedSortMode, setSelectedSortMode] = useState<'frequency' | 'cost'>('frequency');
  const [highImpactOnly, setHighImpactOnly]     = useState<boolean>(false);
  const [activeChartSlide, setActiveChartSlide] = useState(0);
  const [selectedPatternDimension, setSelectedPatternDimension] = useState<PatternDimension>('item');
  const [activeSchema, setActiveSchema]         = useState<DatasetSchema | null>(FALLBACK_DATASET_SCHEMAS.overall);
  const [insightsData, setInsightsData]         = useState<{ amazon: any[]; bookstore: any[] }>({ amazon: [], bookstore: [] });
  const [purchasePlan, setPurchasePlan]         = useState<{
    item: InsightRow; dataset: string; unitPrice: number | null; recommendedQty: number;
  }[]>([]);

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const activeDatasetKey    = TAB_TO_DATASET[activeTab] || 'overall';
  const planCategories      = useMemo(() => new Set(purchasePlan.map((p) => p.item.category)), [purchasePlan]);

  // --- Dataset schema ---
  useEffect(() => {
    fetch(`/api/analytics/dataset-config?dataset=${activeDatasetKey}`)
      .then((r) => r.json())
      .then((res) => setActiveSchema(res.data || FALLBACK_DATASET_SCHEMAS[activeDatasetKey]))
      .catch(()  => setActiveSchema(FALLBACK_DATASET_SCHEMAS[activeDatasetKey] || FALLBACK_DATASET_SCHEMAS.overall));
  }, [activeDatasetKey]);

  // Reset chart to slide 0 on tab change
  useEffect(() => { setActiveChartSlide(0); }, [activeTab]);

  // --- Data hooks ---
  const { topItems, isLoading: isLoadingTopItems, error: topItemsError, schema: topItemsSchema } =
    useTopItems({ activeDatasetKey, selectedYear, selectedQuarter, deferredSearchQuery, minSpend, selectedLimit, selectedSortMode, selectedCategory, highImpactOnly });

  const { spendSeries, availableYears, isLoading: isLoadingSpend } =
    useSpendSeries({ activeTab, activeDatasetKey, selectedYear, selectedQuarter });

  const { patterns: topPatterns, isLoading: isLoadingTopPatterns, error: topPatternsError } =
    useTopPatterns({ activeDatasetKey, deferredSearchQuery, minSpend, selectedPatternDimension, selectedQuarter, selectedSortMode, selectedYear });

  const { merchants: overallMerchants, topCategory: overallTopCategory, combinedSpend: overallCombinedSpend } =
    useOverallSummary({ activeTab, selectedYear, selectedQuarter });

  const { previews: datasetPreviews, isLoading: datasetPreviewsLoading } =
    useDatasetPreviews(activeTab);

  // Sync schema from top-items response
  useEffect(() => { if (topItemsSchema) setActiveSchema(topItemsSchema); }, [topItemsSchema]);

  // Keep pattern dimension valid when dataset changes
  const availablePatternDimensions = useMemo(
    () => getAvailablePatternDimensions(activeSchema, activeDatasetKey),
    [activeSchema, activeDatasetKey],
  );
  useEffect(() => {
    if (!availablePatternDimensions.includes(selectedPatternDimension))
      setSelectedPatternDimension(availablePatternDimensions[0] || 'item');
  }, [availablePatternDimensions, selectedPatternDimension]);

  // Fetch baseline top-items for purchase plan unit-price estimation
  useEffect(() => {
    if (!['Home', 'Amazon', 'Bookstore'].includes(activeTab)) return;
    Promise.all([
      fetch('/api/analytics/top-items/bigquery?dataset=amazon&limit=100').then((r) => r.json()),
      fetch('/api/analytics/top-items/bigquery?dataset=bookstore&limit=100').then((r) => r.json()),
    ])
      .then(([aRes, bRes]) => setInsightsData({ amazon: aRes.data?.items || [], bookstore: bRes.data?.items || [] }))
      .catch(console.error);
  }, [activeTab]);

  // --- Derived data ---
  const filteredTopItems = useMemo(() => topItems || [], [topItems]);
  const chartTopItems    = useMemo(
    () => filteredTopItems.filter((item) => !shouldExcludeFromCharts(item, activeDatasetKey)),
    [filteredTopItems, activeDatasetKey],
  );

  const overallMetricsData = useMemo(() => {
    const totalSpend        = overallCombinedSpend.reduce((s, p) => s + (Number(p.spend) || 0), 0);
    const totalTransactions = overallMerchants.reduce((s, m) => s + (Number(m.count) || 0), 0);
    // Skip items whose name is blank / "Unknown" so the card shows a real vendor
    const topByCount  = [...overallMerchants]
      .sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0))
      .find(isValidMetricName);
    const topBySpend  = overallMerchants.find(isValidMetricName);
    const topItemFreq = [...(topItems || [])].filter((it) => !shouldExcludeFromCharts(it, 'overall'))
      .sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0))[0];
    return {
      totalSpend, totalTransactions,
      topVendorSpend:         { name: topBySpend?.clean_item_name || '—',  amount:   Number(topBySpend?.total_spent) || 0 },
      topVendorTransactions:  { name: topByCount?.clean_item_name || '—',  count:    Number(topByCount?.count)       || 0 },
      topCategory:            { name: overallTopCategory?.clean_item_name || '—', amount: Number(overallTopCategory?.total_spent) || 0 },
      mostPurchasedItem:      { name: topItemFreq?.clean_item_name || '—', quantity: Number(topItemFreq?.count)      || 0 },
    };
  }, [overallCombinedSpend, overallMerchants, overallTopCategory, topItems]);

  // --- Handlers ---
  const handleAddToPlan = (item: InsightRow) => {
    setPurchasePlan((prev) => {
      if (prev.some((p) => p.item.category === item.category)) return prev;
      const baseItems  = activeDatasetKey === 'amazon' ? insightsData.amazon : insightsData.bookstore;
      const catLower   = item.category.toLowerCase();
      const match      = baseItems.find((ti: any) => {
        const n = String(ti.clean_item_name || '').toLowerCase();
        return n.includes(catLower) || catLower.includes(n);
      });
      const unitPrice      = match && match.count > 0 ? match.total_spent / match.count : null;
      const recommendedQty = activeDatasetKey === 'bookstore'
        ? Math.max(0, item.predicted_demand - Math.max(0, item.current_stock))
        : item.predicted_demand;
      return [...prev, { item, dataset: activeDatasetKey, unitPrice, recommendedQty }];
    });
  };

  // --- Chart slides (shared between both tab layouts) ---
  const patternDimensionControls = (
    <div className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
      {availablePatternDimensions.map((dim) => (
        <button
          key={dim}
          type="button"
          onClick={() => setSelectedPatternDimension(dim)}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
            selectedPatternDimension === dim
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
          }`}
        >
          {patternDimensionLabel(dim)}
        </button>
      ))}
    </div>
  );

  const displayedPatternData  = selectedPatternDimension === 'item' ? chartTopItems.slice(0, 5) : topPatterns;
  const displayedPatternError = selectedPatternDimension === 'item' ? topItemsError : topPatternsError;

  const chartSlides: ChartSlide[] = [
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
      subtitle: 'Search for an item keyword and track its spending trends over time.',
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

  const stickyNav = (
    <div className="sticky top-0 z-40 bg-gray-50/95 backdrop-blur py-2">
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );

  // =========================================================================
  // HOME TAB
  // =========================================================================
  if (activeTab === 'Home') {
    return (
      <div className="w-full min-w-0 space-y-6">
        {stickyNav}

        {/* SlugSmart overview + MetricsGrid */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-[#003c6c]">SlugSmart Overview</h1>
          <p className="mt-2 text-sm leading-6 text-slate-950">
            <b>Welcome to SlugSmart!</b> SlugSmart is a procurement analytics and financial
            decision-support platform for the UCSC Financial Affairs office. With SlugSmart,
            users can upload and view cleaned Amazon, CruzBuy, and OneCard purchase datasets 
            and Bay Tree Bookstore sales datasets. In addition, they can analyze spending trends, 
            discover stocking opportunities through predictive insights, and view and export 
            periodic summary reports.<br /><br />
            To get started, upload procurement datasets to the Google Drive folder and press
            the "Refresh Data" button at the top. Then, explore this page to view what needs
            attention right now: Amazon demand insights, high-impact purchases, the top items
            appearing across datasets, and Amazon-specific spending analytics graphs. To view
            a dataset more in-depth, click on its tab at the top.
          </p>
          <div className="mt-6">
            <MetricsGrid data={overallMetricsData} />
          </div>
        </section>

        {/* Amazon ML insights + purchase plan */}
        <section className="space-y-3">
          <InventoryInsights activeTab="Amazon" onAddToPlan={handleAddToPlan} planCategories={planCategories} />
          <PurchasePlan
            items={purchasePlan.filter((p) => p.dataset === 'amazon')}
            onRemove={(cat) => setPurchasePlan((prev) => prev.filter((p) => p.item.category !== cat))}
            onClearAll={() => setPurchasePlan((prev) => prev.filter((p) => p.dataset !== 'amazon'))}
          />
        </section>

        {/* Top items across all datasets */}
        <section className="w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-[#003c6c]">Top Items Across Datasets</h2>
          <p className="mt-1 text-sm text-slate-950">
            View the most-bought external items and most-sold Bookstore items across all four data
            sources. To dive deeper into a specific dataset, press the "Open" button on its card.
          </p>
          <div className="mt-5 grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
            {DATASET_PREVIEW_CONFIG.map((dataset) => {
              const Icon  = dataset.icon;
              const items = datasetPreviews[dataset.key] || [];
              return (
                <div key={dataset.key} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-4 grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
                    <div className="shrink-0 rounded-lg bg-white p-2 shadow-sm">
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
                    <div className="h-40 animate-pulse rounded-lg border border-slate-200 bg-white/70" />
                  ) : items.length === 0 ? (
                    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">No preview rows available.</div>
                  ) : (
                    <ol className="space-y-2">
                      {items.slice(0, 10).map((item, i) => (
                        <li key={`${dataset.key}-${item.clean_item_name}-${i}`} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-slate-950" title={item.clean_item_name}>
                              {i + 1}. {item.clean_item_name}
                            </div>
                            <div className="text-xs text-slate-500">{Number(item.count || 0).toLocaleString()} purchases</div>
                          </div>
                          <div className="shrink-0 text-xs font-semibold text-[#2d66ae]">{formatCurrency(item.total_spent)}</div>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <ExternalVendorsPanel limit={10} />

        {/* Spending analytics charts */}
        <section className="w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-[#003c6c]">Amazon Spending Analytics Graphs</h2>
          <p className="mt-1 mb-5 text-sm text-slate-950">
            Visualizations for analyzing spending trends: Top Purchase Patterns, High Impact Items,
            Spend Over Time, and Item-level Spend Trends.
          </p>
          <ChartCarousel
            slides={chartSlides}
            activeSlide={activeChartSlide}
            onSlideChange={setActiveChartSlide}
            isLoading={isLoadingTopPatterns}
            error={displayedPatternError}
          />
        </section>
      </div>
    );
  }

  // =========================================================================
  // DATASET TABS (Amazon, Bookstore, CruzBuy, OneCard)
  // =========================================================================
  return (
    <div className="w-full min-w-0 space-y-6">
      {stickyNav}

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

      {/* Top items table */}
      <div className="w-full max-w-full min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        {isLoadingTopItems ? (
          <div className="flex min-h-[240px] items-center justify-center">Loading…</div>
        ) : (
          <div className="w-full max-w-full min-w-0 space-y-4 overflow-hidden">
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

      {/* Chart carousel + ML insights */}
      <div className="w-full min-w-0 rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <ChartCarousel
          slides={chartSlides}
          activeSlide={activeChartSlide}
          onSlideChange={setActiveChartSlide}
          isLoading={isLoadingTopPatterns}
          error={displayedPatternError}
        />

        {(activeTab === 'Amazon' || activeTab === 'Bookstore') && (
          <div className="mt-8 space-y-4">
            <InventoryInsights
              activeTab={activeTab}
              onAddToPlan={handleAddToPlan}
              planCategories={planCategories}
            />
            <PurchasePlan
              items={purchasePlan.filter((p) => p.dataset === activeDatasetKey)}
              onRemove={(cat) => setPurchasePlan((prev) => prev.filter((p) => p.item.category !== cat))}
              onClearAll={() => setPurchasePlan((prev) => prev.filter((p) => p.dataset !== activeDatasetKey))}
            />
          </div>
        )}
      </div>
    </div>
  );
}
