import { useState, useEffect } from 'react';
import { TabNavigation } from './TabNavigation';
import { useAuth } from '../context/AuthContext';
import TopItemsChart from './TopItemsChart';
import TransactionsOverTimeChart from './TransactionsOverTimeChart';
import { TopItemsTable } from './TopItemsTable';
import previewData from '../data/preview_top_20_data.json';
import previewSpendOverTimeData from '../data/preview_spend_over_time_all_periods.json';

type SpendPoint = { period: string; spend: number };
type SpendTimePeriod = 'day' | 'week' | 'month' | 'year';
type DatasetKey = 'amazon' | 'cruzbuy' | 'pcard' | 'bookstore';
type SpendPreviewByTab = Record<DatasetKey, Partial<Record<SpendTimePeriod, SpendPoint[]>>>;
type QuarterKey = 'fall24' | 'winter25' | 'spring25' | 'summer25' | 'fall25' | 'winter26';
type SpendRangeMode = 'term' | 'year';

const QUARTER_RANGES: Record<QuarterKey, { label: string; startMonth: string; endMonth: string }> = {
  // Update these date windows as needed.
  fall24: { label: 'Fall24', startMonth: '2024-10', endMonth: '2024-12' },
  winter25: { label: 'Winter25', startMonth: '2025-01', endMonth: '2025-03' },
  spring25: { label: 'Spring25', startMonth: '2025-04', endMonth: '2025-06' },
  summer25: { label: 'Summer25', startMonth: '2025-07', endMonth: '2025-09' },
  fall25: { label: 'Fall25', startMonth: '2025-10', endMonth: '2025-12' },
  winter26: { label: 'Winter26', startMonth: '2026-01', endMonth: '2026-03' },
};

const buildCombinedSpendSeries = (preview: SpendPreviewByTab, timePeriod: SpendTimePeriod) => {
  const combinedMap: { [period: string]: number } = {};
  (['amazon', 'cruzbuy', 'pcard', 'bookstore'] as DatasetKey[]).forEach((key) => {
    (preview[key]?.[timePeriod] || []).forEach((point) => {
      combinedMap[point.period] = (combinedMap[point.period] || 0) + Number(point.spend || 0);
    });
  });

  return Object.entries(combinedMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, spend]) => ({ period, spend }));
};

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

const filterSeriesByQuarter = (points: SpendPoint[], quarterKey: QuarterKey): SpendPoint[] => {
  const { startMonth, endMonth } = QUARTER_RANGES[quarterKey];
  const spendByMonth: Record<string, number> = {};
  points.forEach((p) => {
    if (p.period >= startMonth && p.period <= endMonth) {
      spendByMonth[p.period] = Number(p.spend) || 0;
    }
  });

  return monthWindow(startMonth, endMonth).map((month) => ({
    period: month,
    spend: spendByMonth[month] || 0,
  }));
};

const availableYearsFromSeries = (points: SpendPoint[]): string[] =>
  Array.from(new Set(points.map((p) => String(p.period).slice(0, 4))))
    .filter((y) => /^\d{4}$/.test(y))
    .sort((a, b) => a.localeCompare(b));

const filterSeriesByYear = (points: SpendPoint[], year: string): SpendPoint[] => {
  const spendByMonth: Record<string, number> = {};
  points.forEach((p) => {
    if (String(p.period).startsWith(`${year}-`)) {
      spendByMonth[p.period] = Number(p.spend) || 0;
    }
  });

  return monthWindow(`${year}-01`, `${year}-12`).map((month) => ({
    period: month,
    spend: spendByMonth[month] || 0,
  }));
};


const mergePreviewData = (rawPreview: any, tab: string) => {
  const merged: { [key: string]: any } = {};
  const tabToKeyMap: { [key: string]: string } = {
    'Amazon': 'amazon',
    'ProCard': 'pcard',
    'OneBuy': 'cruzbuy',
    'Bookstore': 'bookstore',
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
  const [rawSpendSeries, setRawSpendSeries] = useState<SpendPoint[]>([]);
  const [spendSeries, setSpendSeries] = useState<SpendPoint[]>([]);
  const [isLoadingSpend, setIsLoadingSpend] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState<QuarterKey>('winter25');
  const [spendRangeMode, setSpendRangeMode] = useState<SpendRangeMode>('term');
  const [selectedYear, setSelectedYear] = useState('2025');
  const [availableYears, setAvailableYears] = useState<string[]>([]);

  const tabToSeriesKeyMap: { [key: string]: string } = {
    Overall: 'combined',
    Amazon: 'amazon',
    ProCard: 'pcard',
    OneBuy: 'cruzbuy',
    Bookstore: 'bookstore',
  };

  const previewSpendByTab = previewSpendOverTimeData as SpendPreviewByTab;

  useEffect(() => {
    if (!user) return;

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

  useEffect(() => {
    setIsLoadingSpend(true);
    const seriesKey = tabToSeriesKeyMap[activeTab] || 'combined';
    const sourcePeriod: SpendTimePeriod = 'month';

    if (isPreviewMode) {
      const periodSeriesByKey: Record<string, SpendPoint[]> = {
        amazon: previewSpendByTab.amazon?.[sourcePeriod] || [],
        cruzbuy: previewSpendByTab.cruzbuy?.[sourcePeriod] || [],
        pcard: previewSpendByTab.pcard?.[sourcePeriod] || [],
        bookstore: previewSpendByTab.bookstore?.[sourcePeriod] || [],
        combined: buildCombinedSpendSeries(previewSpendByTab, sourcePeriod),
      };
      setRawSpendSeries(periodSeriesByKey[seriesKey] || periodSeriesByKey.combined || []);
      setIsLoadingSpend(false);
      return;
    }

    fetch(`http://127.0.0.1:8000/api/analytics/spend-over-time?time_period=${sourcePeriod}&include_refunds=true`)
      .then((res) => res.json())
      .then((res) => {
        const apiData = res?.data || {};
        const liveSeriesByKey: { [key: string]: SpendPoint[] } = {
          combined: apiData?.combined || [],
          amazon: apiData?.datasets?.amazon || [],
          cruzbuy: apiData?.datasets?.cruzbuy || [],
          pcard: apiData?.datasets?.pcard || [],
          bookstore: apiData?.datasets?.bookstore || [],
        };
        setRawSpendSeries(liveSeriesByKey[seriesKey] || liveSeriesByKey.combined || []);
        setIsLoadingSpend(false);
      })
      .catch(() => {
        setRawSpendSeries([]);
        setIsLoadingSpend(false);
      });
  }, [isPreviewMode, activeTab]);

  useEffect(() => {
    const years = availableYearsFromSeries(rawSpendSeries);
    setAvailableYears(years);
    if (years.length && !years.includes(selectedYear)) {
      setSelectedYear(years[years.length - 1]);
    }
  }, [rawSpendSeries]);

  useEffect(() => {
    if (spendRangeMode === 'term') {
      setSpendSeries(filterSeriesByQuarter(rawSpendSeries, selectedQuarter));
      return;
    }
    setSpendSeries(filterSeriesByYear(rawSpendSeries, selectedYear));
  }, [rawSpendSeries, selectedQuarter, spendRangeMode, selectedYear]);

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
                    <option key={key} value={key}>
                      {val.label}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700"
                >
                  {availableYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
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

            {showDetails && <TopItemsTable data={topItems} />}
          </div>
        )}
      </div>
    </div>
  );
}
