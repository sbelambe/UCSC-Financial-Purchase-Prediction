import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Clock,
  TrendingDown,
  Minus,
  PackageSearch,
  Sparkles,
  FlaskConical,
  ShoppingBag,
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
}

interface Props {
  activeTab: string;
  onFollowPrediction?: (item: InsightRow, timePeriod: string) => void;
  acceptedCategories?: Set<string>;
}

/**
 * Displays a responsive grid of cards showing inventory status, ML predictions, and trends.
 * Handles fetching dynamic data from either the Bookstore or Amazon endpoints based on the active tab,
 * and manages local state for development mode toggles, time periods, and historical lookback intervals.
 * @param {Props} props - The component props.
 * @param {string} props.activeTab - The currently selected tab ('Amazon' or 'Bookstore'), which determines which API endpoint to fetch data from.
 * @returns {JSX.Element} The rendered grid of inventory insights and associated portal modals.
 */
export function InventoryInsights({ activeTab, onFollowPrediction, acceptedCategories }: Props) {
  const isAmazon = activeTab === 'Amazon';

  const [timePeriod, setTimePeriod] = useState<string>('1_quarter');
  const [devMode, setDevMode] = useState<boolean>(false);
  const [lookback, setLookback] = useState<string>('2_year');
  const [selectedItem, setSelectedItem] = useState<InsightRow | null>(null);
  const [feedbackItem, setFeedbackItem] = useState<InsightRow | null>(null);

  const {
    data: bookstoreInsights = [],
    isLoading: bookstoreLoading,
    error: bookstoreError,
  } = useQuery({
    queryKey: ['bookstore-insights', timePeriod, devMode, lookback],
    queryFn: async ({ signal }) => {
      const url = `/api/analytics/bookstore-insights?time_period=${timePeriod}&dev_mode=${devMode}&lookback=${lookback}`;
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
    queryKey: ['amazon-insights', timePeriod, devMode, lookback],
    queryFn: async ({ signal }) => {
      const url = `/api/analytics/amazon-insights?time_period=${timePeriod}&dev_mode=${devMode}&lookback=${lookback}`;
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
    const baseClass = "flex items-center gap-1.5 text-[11px] font-medium px-3 py-1 rounded-full whitespace-nowrap transition-colors";
    switch (action) {
      case 'Critical Reorder':
      case 'Reorder Soon':
        return <span className={`${baseClass} text-[#410002] bg-[#FFDAD6]`}><AlertCircle className="size-3.5" /> {action}</span>;
      case 'Dead Stock Risk':
        return <span className={`${baseClass} text-[#31111D] bg-[#FFD8E4]`}><PackageSearch className="size-3.5" /> Overstock</span>;
      case 'Monitor Closely':
        return <span className={`${baseClass} text-[#261A00] bg-[#FFDF99]`}><Clock className="size-3.5" /> {action}</span>;
      default:
        return <span className={`${baseClass} text-[#00391C] bg-[#C4EED0]`}><CheckCircle className="size-3.5" /> Healthy</span>;
    }
  };

  const renderTrendIcon = (trend: string) => {
    switch (trend) {
      case 'growing': return <div className="p-1.5 bg-[#C4EED0]/50 rounded-full"><TrendingUp className="size-4 text-[#00391C]" /></div>;
      case 'declining': return <div className="p-1.5 bg-[#FFDAD6]/50 rounded-full"><TrendingDown className="size-4 text-[#410002]" /></div>;
      default: return <div className="p-1.5 bg-[#C5D8F6] rounded-full"><Minus className="size-4 text-[#49454F]" /></div>;
    }
  };

  const title = isAmazon ? 'Amazon Demand Insights' : 'Inventory Insights';
  const subtitle = isAmazon
    ? 'Amazon purchase demand by category via ML forecasting.'
    : 'Bookstore stock overview via ML forecasting.';
  const currentLabel = isAmazon ? 'Recent Orders' : 'Inventory';
  const forecastLabel = isAmazon ? 'ML Forecast' : 'ML Forecast';
  const emptyMessage = isAmazon
    ? 'No Amazon demand predictions available.'
    : 'No critical alerts detected.';

  return (
    <div className="w-full mb-10 flex flex-col gap-8 bg-[#F5F9FF] p-4 md:p-8 rounded-[32px] font-sans">
      {/* Header */}
      <div className="relative overflow-hidden bg-[#EBF3FF] rounded-[32px] p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 z-0 shadow-sm">
        <div className="absolute top-0 right-0 w-72 h-72 bg-[#1D69C4] opacity-10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/3 mix-blend-multiply pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-48 h-48 bg-[#1255A1] opacity-10 blur-3xl rounded-full translate-y-1/3 mix-blend-multiply pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            {isAmazon
              ? <ShoppingBag className="size-6 text-[#1D69C4]" />
              : <Sparkles className="size-5 text-[#1D69C4]" />
            }
            <h3 className="text-3xl font-medium text-[#1C1B1F] tracking-tight">{title}</h3>
            {devMode && (
              <span className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1 rounded-full bg-[#FFDF99] text-[#261A00] whitespace-nowrap">
                <FlaskConical className="size-3.5" /> DEV MODE — Synthetic Data
              </span>
            )}
          </div>
          <p className="text-base text-[#49454F] mt-1">{subtitle}</p>
        </div>

        <div className="relative z-10 flex items-center gap-4 flex-wrap justify-end">
          <button
            onClick={() => setDevMode(prev => !prev)}
            className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-[10px] border transition-colors ${
              devMode
                ? 'bg-[#FFDF99] border-[#F5C842] text-[#261A00]'
                : 'bg-[#C5D8F6] border-[#7BAEE8] text-[#0A3A6E] hover:border-[#1D69C4]'
            }`}
          >
            <FlaskConical className="size-3.5" />
            {devMode ? 'Dev Mode' : 'Real Data'}
          </button>

          <div className="flex items-center gap-3 bg-[#C5D8F6] rounded-t-[12px] rounded-b-none border-b-2 border-[#7BAEE8] focus-within:border-[#1D69C4] transition-colors duration-200 px-4 py-3 cursor-pointer group">
            <TrendingUp className="size-5 text-[#49454F] group-focus-within:text-[#1D69C4] transition-colors" />
            <select
              value={lookback}
              onChange={(e) => setLookback(e.target.value)}
              className="border-none text-sm font-medium text-[#1C1B1F] bg-transparent focus:ring-0 cursor-pointer outline-none w-full appearance-none"
            >
              <option value="1_year">vs. 1 Year ago</option>
              <option value="2_year">vs. 2 Year avg</option>
              <option value="3_year">vs. 3 Year avg</option>
            </select>
          </div>

          <div className="flex items-center gap-3 bg-[#C5D8F6] rounded-t-[12px] rounded-b-none border-b-2 border-[#7BAEE8] focus-within:border-[#1D69C4] transition-colors duration-200 px-4 py-3 cursor-pointer group">
            <Clock className="size-5 text-[#49454F] group-focus-within:text-[#1D69C4] transition-colors" />
            <select
              value={timePeriod}
              onChange={(e) => setTimePeriod(e.target.value)}
              className="border-none text-sm font-medium text-[#1C1B1F] bg-transparent focus:ring-0 cursor-pointer outline-none w-full appearance-none"
            >
              <option value="1_month">Next 30 Days</option>
              <option value="1_quarter">Next 90 Days</option>
              <option value="6_months">Next 180 Days</option>
              <option value="1_year">Fiscal Year</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 text-sm text-[#410002] bg-[#FFDAD6] rounded-[16px] flex items-center gap-3">
          <AlertCircle className="size-5" />
          <span>{error instanceof Error ? error.message : 'Connection Error'}</span>
        </div>
      )}

      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {loading ? (
          [...Array(8)].map((_, i) => (
            <div key={i} className="h-72 rounded-[24px] bg-[#EBF3FF] animate-pulse" />
          ))
        ) : insights.length === 0 ? (
          <div className="col-span-full py-16 text-center rounded-[24px] bg-[#EBF3FF]">
            <p className="text-[#49454F] font-medium text-lg">{emptyMessage}</p>
          </div>
        ) : (
          insights.map((item, index) => {
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
                onClick={() => !isAmazon && setSelectedItem(item)}
                className={`group flex flex-col h-full overflow-hidden bg-[#EBF3FF] border-none rounded-[24px] shadow-sm hover:shadow-md hover:scale-[1.02] ${!isAmazon ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div className="absolute inset-0 bg-[#1C1B1F] opacity-0 group-hover:opacity-[0.04] transition-opacity duration-300 pointer-events-none z-10" />

                <CardHeader className="pb-2 pt-6 px-6 relative z-20">
                  <div className="flex justify-between items-start gap-4">
                    <CardTitle className="text-lg font-medium text-[#1C1B1F] flex items-start gap-3">
                      <span className="shrink-0">{renderTrendIcon(item.trend_direction)}</span>
                      <span>{item.category}</span>
                    </CardTitle>
                  </div>
                </CardHeader>

                <CardContent className="px-6 pb-4 flex-1 flex flex-col justify-end relative z-20">
                  <div className="flex items-center justify-between mb-6 mt-2">
                    {renderActionBadge(item.action)}
                    <div className="flex items-center gap-1.5 bg-[#D0E4FF] px-2.5 py-1 rounded-full">
                      <Sparkles className="size-3 text-[#1D69C4]" />
                      <span className="text-[10px] font-medium text-[#0F172A]">{item.certainty_score}%</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-end mb-4">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-[#49454F] mb-1">{currentLabel}</div>
                      <div className={`text-3xl font-medium leading-none truncate ${item.current_stock < 0 ? 'text-[#BA1A1A]' : 'text-[#1C1B1F]'}`}>
                        {item.current_stock.toLocaleString()}
                      </div>
                    </div>
                    {item.historical_avg > 0 && (
                      <div className="min-w-0 text-center">
                        <div className="text-xs font-medium text-[#49454F] mb-1">Hist. Avg</div>
                        <div className="text-xl font-medium text-[#49454F] leading-none truncate">
                          {item.historical_avg.toLocaleString()}
                        </div>
                      </div>
                    )}
                    <div className="min-w-0 text-right">
                      <div className="text-xs font-medium text-[#1D69C4] mb-1">{forecastLabel}</div>
                      <div className="text-3xl font-medium text-[#1D69C4] leading-none truncate">
                        {item.predicted_demand.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="relative w-full h-2.5 bg-[#C5D8F6] rounded-full overflow-hidden mb-2">
                      <div
                        className="absolute h-full bg-[#D0E4FF]"
                        style={{ left: `${lowerPos}%`, width: `${upperPos - lowerPos}%` }}
                      />
                      <div
                        className="absolute top-0 bottom-0 w-[2px] bg-[#1D69C4]/40 z-10"
                        style={{ left: `${targetPos}%` }}
                      />
                      <div
                        className={`absolute top-0 bottom-0 w-2.5 rounded-full z-20 transform -translate-x-1/2 shadow-sm ${
                          item.action === 'Dead Stock Risk' || item.action === 'Declining Signal' ? 'bg-[#1255A1]' :
                          item.action === 'Critical Reorder' || item.action === 'High Demand Signal' ? 'bg-[#BA1A1A]' : 'bg-[#1D69C4]'
                        }`}
                        style={{ left: `${stockPos}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-[#49454F] font-medium">
                      <span>Low: {safeLower}</span>
                      <span>High: {safeUpper}</span>
                    </div>
                  </div>
                </CardContent>

                <div className="flex items-center justify-between mb-4 mt-auto pt-4 border-t border-[#C5D8F6]/50 px-6">
                  {!isAmazon ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFeedbackItem(item);
                      }}
                      className="text-[10px] text-[#49454F] hover:text-[#1D69C4] underline font-medium transition-colors"
                    >
                      Flag Issue
                    </button>
                  ) : <span />}

                  <div className="flex items-center gap-2">
                    {onFollowPrediction && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onFollowPrediction(item, timePeriod);
                        }}
                        className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                          acceptedCategories?.has(item.category)
                            ? 'bg-purple-100 border-purple-300 text-purple-700'
                            : 'bg-[#EBF3FF] border-[#C5D8F6] text-[#1D69C4] hover:bg-[#D0E4FF]'
                        }`}
                      >
                        {acceptedCategories?.has(item.category) ? 'Accepted ✓' : 'Follow prediction'}
                      </button>
                    )}
                    {!isAmazon && (
                      <div className="flex items-center gap-1 text-[10px] font-medium text-[#1D69C4]">
                        <Sparkles className="size-3" />
                        <span>Tap for details</span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* ItemHistoryDrawer only for bookstore */}
      {!isAmazon && (
        <>
          <ItemHistoryDrawer
            item={selectedItem}
            devMode={devMode}
            onClose={() => setSelectedItem(null)}
          />
          
          <FeedbackModal 
            item={feedbackItem} 
            onClose={() => setFeedbackItem(null)} 
          />
        </>
      )}
    </div>
  );
}
