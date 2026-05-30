import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  PackageSearch,
  Sparkles,
  FlaskConical,
} from 'lucide-react';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { ItemHistoryDrawer } from './ItemHistoryDrawer';
import { FeedbackModal } from './FeedbackModal';

export interface InsightRow {
  category: string;
  current_stock: number;
  predicted_demand: number;
  certainty_score: number;
  lower_bound: number;
  upper_bound: number;
  external_volume: number;
  historical_avg: number;
  trend_direction: 'growing' | 'declining' | 'stable';
  action: 'Critical Reorder' | 'Reorder Soon' | 'Monitor Closely' | 'Adequate Stock' | 'Dead Stock Risk' | 'Declining Signal' | 'High Demand Signal';
  reasoning: string;
  cost_per_item?: number | null;
  is_online?: boolean;
}

interface Props {
  activeTab: string;
  onAddToPlan?: (item: InsightRow) => void;
  planCategories?: Set<string>;
}

/**
 * Displays a responsive grid of cards showing inventory status, ML predictions, and trends.
 * Handles fetching dynamic data from either the Bookstore or Amazon endpoints based on the active tab,
 * and manages local state for development mode toggles, time periods, and action filters.
 * @param {Props} props - The component props.
 * @param {string} props.activeTab - The currently selected tab ('Amazon' or 'Bookstore'), which determines which API endpoint to fetch data from.
 * @returns {JSX.Element} The rendered grid of inventory insights and associated portal modals.
 */
export function InventoryInsights({ activeTab, onAddToPlan, planCategories }: Props) {
  const isAmazon = activeTab === 'Amazon';

  const [timePeriod, setTimePeriod] = useState<string>('1_quarter');
  const [devMode, setDevMode] = useState<boolean>(false);
  const [actionFilter, setActionFilter] = useState<string>('All');
  const [selectedItem, setSelectedItem] = useState<InsightRow | null>(null);
  const [feedbackItem, setFeedbackItem] = useState<InsightRow | null>(null);

  // Reset filter when switching tabs or toggling dev mode so stale selection doesn't carry over
  useEffect(() => { setActionFilter('All'); }, [activeTab, devMode]);

  const {
    data: bookstoreInsights = [],
    isLoading: bookstoreLoading,
    error: bookstoreError,
  } = useQuery({
    queryKey: ['bookstore-insights', timePeriod, devMode],
    queryFn: async ({ signal }) => {
      const url = `/api/analytics/bookstore-insights?time_period=${timePeriod}&dev_mode=${devMode}`;
      const response = await fetch(url, { signal });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.detail || 'Failed to load ML predictions.');
      return payload.data as InsightRow[];
    },
    staleTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    enabled: !isAmazon,
  });

  const {
    data: amazonInsights = [],
    isLoading: amazonLoading,
    error: amazonError,
  } = useQuery({
    queryKey: ['amazon-insights', timePeriod, devMode],
    queryFn: async ({ signal }) => {
      const url = `/api/analytics/amazon-insights?time_period=${timePeriod}&dev_mode=${devMode}`;
      const response = await fetch(url, { signal });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.detail || 'Failed to load Amazon ML predictions.');
      return payload.data as InsightRow[];
    },
    staleTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    enabled: isAmazon,
  });

  const insights = isAmazon ? amazonInsights : bookstoreInsights;
  const loading = isAmazon ? amazonLoading : bookstoreLoading;
  const error = isAmazon ? amazonError : bookstoreError;

  const renderActionBadge = (action: string) => {
    const baseClass = "flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap transition-colors";
    switch (action) {
      case 'Critical Reorder':
      case 'Reorder Soon':
      case 'High Demand Signal':
        return <span className={`${baseClass} text-red-800 bg-red-100`}><AlertCircle className="size-3.5" /> {action}</span>;
      case 'Dead Stock Risk':
      case 'Declining Signal':
        return <span className={`${baseClass} text-rose-800 bg-rose-100`}><PackageSearch className="size-3.5" /> Overstock</span>;
      case 'Monitor Closely':
        return <span className={`${baseClass} text-amber-800 bg-amber-100`}><Clock className="size-3.5" /> {action}</span>;
      default:
        return <span className={`${baseClass} text-emerald-800 bg-emerald-100`}><CheckCircle className="size-3.5" /> Healthy</span>;
    }
  };

  const renderTrendIcon = (trend: string) => {
    switch (trend) {
      case 'growing': return <div className="rounded-lg bg-emerald-50 p-1.5"><TrendingUp className="size-4 text-emerald-700" /></div>;
      case 'declining': return <div className="rounded-lg bg-red-50 p-1.5"><TrendingDown className="size-4 text-red-700" /></div>;
      default: return <div className="rounded-lg bg-slate-100 p-1.5"><Minus className="size-4 text-slate-500" /></div>;
    }
  };

  // Map raw action values → display labels (matches badge rendering)
  const getDisplayLabel = (action: string): string => {
    if (action === 'Dead Stock Risk' || action === 'Declining Signal') return 'Overstock';
    if (action === 'Adequate Stock') return 'Healthy';
    return action;
  };

  // Chip colour config keyed by display label
  const FILTER_CHIP_STYLES: Record<string, { active: string; inactive: string }> = {
    'All':               { active: 'bg-[#003c6c] text-white border-[#003c6c]',            inactive: 'bg-white text-slate-600 border-slate-200 hover:border-[#003c6c] hover:text-[#003c6c]' },
    'Critical Reorder':  { active: 'bg-red-600 text-white border-red-600',                 inactive: 'bg-white text-red-700 border-red-200 hover:border-red-400' },
    'Reorder Soon':      { active: 'bg-red-500 text-white border-red-500',                 inactive: 'bg-white text-red-600 border-red-200 hover:border-red-400' },
    'High Demand Signal':{ active: 'bg-red-700 text-white border-red-700',                 inactive: 'bg-white text-red-800 border-red-200 hover:border-red-500' },
    'Monitor Closely':   { active: 'bg-amber-500 text-white border-amber-500',             inactive: 'bg-white text-amber-700 border-amber-200 hover:border-amber-400' },
    'Overstock':         { active: 'bg-rose-600 text-white border-rose-600',               inactive: 'bg-white text-rose-700 border-rose-200 hover:border-rose-400' },
    'Healthy':           { active: 'bg-emerald-600 text-white border-emerald-600',         inactive: 'bg-white text-emerald-700 border-emerald-200 hover:border-emerald-400' },
  };

  // Build chip list: "All" + unique display labels present in current data
  const labelCounts = insights.reduce<Record<string, number>>((acc, row) => {
    const label = getDisplayLabel(row.action);
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});
  const filterChips = ['All', ...Object.keys(labelCounts)];

  // Apply active filter to the grid
  const filteredInsights = actionFilter === 'All'
    ? insights
    : insights.filter(row => getDisplayLabel(row.action) === actionFilter);

  const title = isAmazon ? 'Amazon Demand Insights' : 'Inventory Insights';
  const subtitle = isAmazon
    ? 'Amazon Demand Insights uses AI-powered forecasting to highlight historical Amazon spending trends and drive campus bookstore stocking decisions, including identifying overstocked or understocked items. Press the buttons below to toggle between real/synthetic data or adjust historical forecast windows. Create a purchase plan by pressing "Add to Plan" under each desired item and exporting the list below.'
    : 'Bookstore stock overview via ML forecasting.';
  const currentLabel = 'Inventory';
  const forecastLabel = isAmazon ? 'ML Forecast' : 'ML Forecast';
  const emptyMessage = isAmazon
    ? 'No Amazon demand predictions available.'
    : 'No critical alerts detected.';

  return (
    <div className="w-full mb-10 flex flex-col gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm font-sans">
      {/* Header */}
      <div>
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-bold text-[#003c6c]">{title}</h3>
            {devMode && (
              <span className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-full bg-amber-100 text-amber-800 whitespace-nowrap">
                <FlaskConical className="size-3.5" /> DEV MODE - Synthetic Data
              </span>
            )}
          </div>
          <p className="text-sm text-slate-950">{subtitle}<br />  ⠀ </p>
        </div>

        <div className="flex flex-wrap items-center justify-start gap-3 md:justify-end">
          <button
            onClick={() => setDevMode(prev => !prev)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
              devMode
                ? 'border-amber-200 bg-amber-100 text-amber-800'
                : 'border-[#2d66ae] bg-[#2d66ae] text-[#ffffff] hover:border-[#2d66ae] hover:text-[#003c6c]'
            }`}
          >
            <FlaskConical className="size-4 " />
            {devMode ? 'Dev Mode' : 'Real Data'}
          </button>

          <div className="group flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 transition-colors duration-200 focus-within:border-[#2d66ae]">
            <Clock className="size-4 text-[#003c6c] transition-colors group-focus-within:text-[#003c6c]" />
            <select
              value={timePeriod}
              onChange={(e) => setTimePeriod(e.target.value)}
              className="w-full cursor-pointer appearance-none border-none bg-transparent text-xs font-semibold uppercase text-[#2d66ae] outline-none focus:ring-0"
            >
              <option value="1_month">Next 30 Days</option>
              <option value="1_quarter">Next 90 Days</option>
              <option value="6_months">Next 180 Days</option>
              <option value="1_year">Fiscal Year</option>
            </select>
          </div>
        </div>
      </div>

      {/* Action filter chips */}
      {!loading && insights.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {filterChips.map(label => {
            const styles = FILTER_CHIP_STYLES[label] ?? FILTER_CHIP_STYLES['All'];
            const isActive = actionFilter === label;
            return (
              <button
                key={label}
                onClick={() => setActionFilter(label)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${isActive ? styles.active : styles.inactive}`}
              >
                {label}
                {label !== 'All' && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isActive ? 'bg-white/25' : 'bg-slate-100'}`}>
                    {labelCounts[label]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="size-5" />
          <span>{error instanceof Error ? error.message : 'Connection Error'}</span>
        </div>
      )}

      {/* Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {loading ? (
          [...Array(8)].map((_, i) => (
            <div key={i} className="h-60 animate-pulse rounded-xl border border-slate-200 bg-white" />
          ))
        ) : filteredInsights.length === 0 ? (
          <div className="col-span-full rounded-xl border border-slate-200 bg-white py-16 text-center">
            <p className="text-lg font-medium text-slate-600">
              {insights.length === 0 ? emptyMessage : `No items match "${actionFilter}".`}
            </p>
          </div>
        ) : (
          filteredInsights.map((item, index) => {
            const safeStock = Math.max(0, item.current_stock);
            const safeLower = Math.max(0, item.lower_bound);
            const safeUpper = Math.max(0, item.upper_bound);
            const safeTarget = Math.max(0, item.predicted_demand);

            const maxScale = Math.max(safeUpper, safeStock, 1) * 1.15;
            const stockPos = Math.max(0, Math.min(100, (safeStock / maxScale) * 100));
            const lowerPos = Math.max(0, Math.min(100, (safeLower / maxScale) * 100));
            const upperPos = Math.max(0, Math.min(100, (safeUpper / maxScale) * 100));
            const targetPos = Math.max(0, Math.min(100, (safeTarget / maxScale) * 100));

            return (
              <Card
                key={index}
                onClick={() => setSelectedItem(item)}
                className="group flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
              >
                <div className="pointer-events-none absolute inset-0 z-10 bg-slate-950 opacity-0 transition-opacity duration-200 group-hover:opacity-[0.02]" />

                <CardHeader className="relative z-20 px-5 pb-2 pt-5">
                  <div className="flex justify-between items-start gap-4">
                    <CardTitle className="flex items-start gap-3 font-sans text-lg font-bold leading-tight text-[#003c6c]">
                      <span className="shrink-0">{renderTrendIcon(item.trend_direction)}</span>
                      <div className="flex flex-col">
                        <span>{item.category}</span>
                        
                        {!isAmazon && item.is_online !== undefined && (
                          <div className="mt-1 flex items-center gap-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                              item.is_online 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}>
                              {item.is_online ? 'Active Online' : 'Discontinued'}
                            </span>
                            
                            {item.cost_per_item !== null && (
                              <span className="text-xs font-semibold text-slate-500">
                                ${item.cost_per_item.toFixed(2)}
                              </span>
                            )}
                          </div>
                        )}
                        
                      </div>
                    </CardTitle>
                  </div>
                </CardHeader>

                <CardContent className="relative z-20 flex flex-1 flex-col px-5 pb-4">
                  <div className="mb-4 mt-1 flex items-center justify-between">
                    {renderActionBadge(item.action)}
                    <div className="flex items-center gap-1.5 rounded-full border border-[#2d66ae] bg-[#2d66ae] px-2.5 py-1 shadow-sm">
                      <Sparkles className="size-3 text-[#ffffff]" />
                      <span className="text-[10px] font-semibold text-white">{item.certainty_score}%</span>
                    </div>
                  </div>

                  <div className="mb-4 flex items-end gap-6">
                    {!isAmazon && (
                      <div className="min-w-0">
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#2d66ae]">{currentLabel}</div>
                        <div className={`truncate text-xl font-bold leading-none ${item.current_stock < 0 ? 'text-red-700' : 'text-slate-950'}`}>
                          {item.current_stock.toLocaleString()}
                        </div>
                      </div>
                    )}
                    {item.historical_avg > 0 && (
                      <div className="min-w-0">
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#2d66ae]">Hist. Avg</div>
                        <div className="truncate text-lg font-bold leading-none text-slate-950">
                          {item.historical_avg.toLocaleString()}
                        </div>
                      </div>
                    )}
                    <div className={`min-w-0 ${!isAmazon ? 'ml-auto text-right' : ''}`}>
                      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#2d66ae]">{forecastLabel}</div>
                      <div className="truncate text-xl font-bold leading-none text-slate-950">
                        {item.predicted_demand.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="relative mb-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="absolute h-full bg-[#2d66ae]"
                        style={{ left: `${lowerPos}%`, width: `${upperPos - lowerPos}%` }}
                      />
                      <div
                        className="absolute bottom-0 top-0 z-10 w-[2px] bg-[#003c6c]/70"
                        style={{ left: `${targetPos}%` }}
                      />
                      <div
                        className={`absolute bottom-0 top-0 z-20 w-2.5 -translate-x-1/2 rounded-full shadow-sm ${
                          item.action === 'Dead Stock Risk' || item.action === 'Declining Signal' ? 'bg-slate-600' :
                          item.action === 'Critical Reorder' || item.action === 'High Demand Signal' ? 'bg-red-700' : 'bg-[#003c6c]'
                        }`}
                        style={{ left: `${stockPos}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Low: {safeLower}</span>
                      <span>High: {safeUpper}</span>
                    </div>
                  </div>
                </CardContent>

                <div className="mt-auto flex items-center justify-between border-t border-slate-200 px-5 py-4">
                  {!isAmazon ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFeedbackItem(item);
                      }}
                      className="text-[10px] font-medium text-slate-500 underline transition-colors hover:text-[#003c6c]"
                    >
                      Flag Issue
                    </button>
                  ) : <span />}

                  <div className="flex items-center gap-2">
                    {onAddToPlan && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddToPlan(item);
                        }}
                        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                          planCategories?.has(item.category)
                            ? 'border-[#2d66ae] bg-[#2d66ae] text-white'
                            : 'border-[#2d66ae] bg-[#2d66ae] text-white hover:bg-[#003c6c]'
                        }`}
                      >
                        {planCategories?.has(item.category) ? 'Added to Plan' : 'Add to Plan'}
                      </button>
                    )}
                    <div className="flex items-center gap-1 text-[10px] font-semibold text-[#2d66ae] uppercase">
                      <Sparkles className="size-3" />
                      <span>Tap for details</span>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      <ItemHistoryDrawer
        item={selectedItem}
        devMode={devMode}
        onClose={() => setSelectedItem(null)}
      />

      {!isAmazon && (
        <FeedbackModal
          item={feedbackItem}
          onClose={() => setFeedbackItem(null)}
        />
      )}
    </div>
  );
}