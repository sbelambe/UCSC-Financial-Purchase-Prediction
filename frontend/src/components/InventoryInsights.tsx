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

interface RecommendationRow {
  item_name: string;
  category: string;
  amazon_count: number;
  suggested_reason: string;
}

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
  action: 'Critical Reorder' | 'Reorder Soon' | 'Monitor Closely' | 'Adequate Stock' | 'Dead Stock Risk';
  reasoning: string;
}

export function InventoryInsights() {
  // set default time to 1 quarter (3 months)
  const [timePeriod, setTimePeriod] = useState<string>('1_quarter');
  const [devMode, setDevMode] = useState<boolean>(false);
  const [lookback, setLookback] = useState<string>('2_year');
  const [selectedItem, setSelectedItem] = useState<InsightRow | null>(null);

  const {
    data: insights = [],
    isLoading: loading,
    error,
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
  });

  const {
    data: recommendations,
  } = useQuery({
    queryKey: ['amazon-bookstore-recommendations'],
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/analytics/amazon-bookstore-recommendations', { signal });
      if (!response.ok) throw new Error('Failed to load recommendations.');
      return response.json() as Promise<{ overlap: RecommendationRow[]; gaps: RecommendationRow[] }>;
    },
    staleTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });

  // Action badges for status of bookstore stock
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
      default: return <div className="p-1.5 bg-[#E7E0EC] rounded-full"><Minus className="size-4 text-[#49454F]" /></div>;
    }
  };

  return (
    <div className="w-full mb-10 flex flex-col gap-8 bg-[#FFFBFE] p-4 md:p-8 rounded-[32px] font-sans">
      <div className="relative overflow-hidden bg-[#F3EDF7] rounded-[32px] p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 z-0 shadow-sm">
        <div className="absolute top-0 right-0 w-72 h-72 bg-[#6750A4] opacity-10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/3 mix-blend-multiply pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-48 h-48 bg-[#7D5260] opacity-10 blur-3xl rounded-full translate-y-1/3 mix-blend-multiply pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <h3 className="text-3xl font-medium text-[#1C1B1F] tracking-tight">Inventory Insights</h3>
            {devMode && (
              <span className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1 rounded-full bg-[#FFDF99] text-[#261A00] whitespace-nowrap">
                <FlaskConical className="size-3.5" /> DEV MODE — Synthetic Data
              </span>
            )}
          </div>
          <p className="text-base text-[#49454F] mt-1">Bookstore stock overview via ML forecasting.</p>
        </div>

        <div className="relative z-10 flex items-center gap-4 flex-wrap justify-end">
          {/* Dev mode toggle */}
          <button
            onClick={() => setDevMode(prev => !prev)}
            className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-[10px] border transition-colors ${
              devMode
                ? 'bg-[#FFDF99] border-[#F5C842] text-[#261A00]'
                : 'bg-[#E7E0EC] border-[#79747E] text-[#49454F] hover:border-[#6750A4]'
            }`}
          >
            <FlaskConical className="size-3.5" />
            {devMode ? 'Dev Mode' : 'Real Data'}
          </button>

          {/* Lookback selector */}
          <div className="flex items-center gap-3 bg-[#E7E0EC] rounded-t-[12px] rounded-b-none border-b-2 border-[#79747E] focus-within:border-[#6750A4] transition-colors duration-200 px-4 py-3 cursor-pointer group">
            <TrendingUp className="size-5 text-[#49454F] group-focus-within:text-[#6750A4] transition-colors" />
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

          {/* Time period selector */}
          <div className="flex items-center gap-3 bg-[#E7E0EC] rounded-t-[12px] rounded-b-none border-b-2 border-[#79747E] focus-within:border-[#6750A4] transition-colors duration-200 px-4 py-3 cursor-pointer group">
            <Clock className="size-5 text-[#49454F] group-focus-within:text-[#6750A4] transition-colors" />
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

      {/* Grid Container */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {loading ? (
          [...Array(8)].map((_, i) => (
            <div key={i} className="h-72 rounded-[24px] bg-[#F3EDF7] animate-pulse" />
          ))
        ) : insights.length === 0 ? (
          <div className="col-span-full py-16 text-center rounded-[24px] bg-[#F3EDF7]">
            <p className="text-[#49454F] font-medium text-lg">No critical alerts detected.</p>
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
                onClick={() => setSelectedItem(item)}
                className="group flex flex-col h-full overflow-hidden bg-[#F3EDF7] border-none rounded-[24px] shadow-sm hover:shadow-md hover:scale-[1.02] cursor-pointer"
              >
                {/* State Layer Overlay (invisible until hover) */}
                <div className="absolute inset-0 bg-[#1C1B1F] opacity-0 group-hover:opacity-[0.04] transition-opacity duration-300 pointer-events-none z-10" />

                <CardHeader className="pb-2 pt-6 px-6 relative z-20">
                  <div className="flex justify-between items-start gap-4">
                    <CardTitle className="text-lg font-medium text-[#1C1B1F] flex items-center gap-3 truncate">
                      {renderTrendIcon(item.trend_direction)}
                      <span className="truncate" title={item.category}>{item.category}</span>
                    </CardTitle>
                  </div>
                </CardHeader>

                <CardContent className="px-6 pb-4 flex-1 flex flex-col justify-end relative z-20">
                  
                  {/* Status & Confidence Row */}
                  <div className="flex items-center justify-between mb-6 mt-2">
                    {renderActionBadge(item.action)}
                    <div className="flex items-center gap-1.5 bg-[#E8DEF8] px-2.5 py-1 rounded-full">
                      <Sparkles className="size-3 text-[#6750A4]" />
                      <span className="text-[10px] font-medium text-[#1D192B]">{item.certainty_score}%</span>
                    </div>
                  </div>

                  {/* Core Numbers */}
                  <div className="flex justify-between items-end mb-4">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-[#49454F] mb-1">Inventory</div>
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
                      <div className="text-xs font-medium text-[#6750A4] mb-1">ML Forecast</div>
                      <div className="text-3xl font-medium text-[#6750A4] leading-none truncate">
                        {item.predicted_demand.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  
                  {/* Visualizer Bar for stock */}
                  <div>
                    <div className="relative w-full h-2.5 bg-[#E7E0EC] rounded-full overflow-hidden mb-2">
                      <div 
                        className="absolute h-full bg-[#E8DEF8]"
                        style={{ left: `${lowerPos}%`, width: `${upperPos - lowerPos}%` }}
                      />
                      <div 
                        className="absolute top-0 bottom-0 w-[2px] bg-[#6750A4]/40 z-10" 
                        style={{ left: `${targetPos}%` }} 
                      />
                      <div 
                        className={`absolute top-0 bottom-0 w-2.5 rounded-full z-20 transform -translate-x-1/2 shadow-sm ${
                          item.action === 'Dead Stock Risk' ? 'bg-[#7D5260]' : 
                          item.action === 'Critical Reorder' ? 'bg-[#BA1A1A]' : 'bg-[#6750A4]'
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

                <div className="flex items-center justify-end mb-4 mt-auto pt-4 border-t border-[#E7E0EC]/50 px-6">
                  <div className="flex items-center gap-1 text-[10px] font-medium text-[#6750A4]">
                    <Sparkles className="size-3" />
                    <span>Tap for details</span>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Item History Drawer */}
      <ItemHistoryDrawer
        item={selectedItem}
        devMode={devMode}
        onClose={() => setSelectedItem(null)}
      />

      {/* Amazon Purchase Signals */}
      {recommendations && (recommendations.overlap.length > 0 || recommendations.gaps.length > 0) && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <ShoppingBag className="size-5 text-[#6750A4]" />
            <h4 className="text-xl font-medium text-[#1C1B1F]">Amazon Purchase Signals</h4>
          </div>

          {recommendations.overlap.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-[#49454F] uppercase tracking-wide">Also in Bookstore — Keep Stocked</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {recommendations.overlap.map((item, i) => (
                  <Card key={i} className="bg-[#F3EDF7] border-none rounded-[20px] shadow-sm">
                    <CardHeader className="pb-1 pt-5 px-5">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-sm font-medium text-[#1C1B1F] leading-snug line-clamp-2">{item.item_name}</CardTitle>
                        <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#C4EED0] text-[#00391C]">In Stock</span>
                      </div>
                    </CardHeader>
                    <CardContent className="px-5 pb-5">
                      <p className="text-xs text-[#49454F] mb-2">{item.category}</p>
                      <div className="flex items-center gap-1.5 mb-3">
                        <Sparkles className="size-3 text-[#6750A4]" />
                        <span className="text-xs font-medium text-[#6750A4]">{item.amazon_count.toLocaleString()} Amazon orders</span>
                      </div>
                      <p className="text-xs text-[#49454F] leading-relaxed">{item.suggested_reason}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {recommendations.gaps.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-[#49454F] uppercase tracking-wide">High Amazon Demand — Not in Bookstore</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {recommendations.gaps.map((item, i) => (
                  <Card key={i} className="bg-[#FFF8F0] border-none rounded-[20px] shadow-sm">
                    <CardHeader className="pb-1 pt-5 px-5">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-sm font-medium text-[#1C1B1F] leading-snug line-clamp-2">{item.item_name}</CardTitle>
                        <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#FFDF99] text-[#261A00]">Gap</span>
                      </div>
                    </CardHeader>
                    <CardContent className="px-5 pb-5">
                      <p className="text-xs text-[#49454F] mb-2">{item.category}</p>
                      <div className="flex items-center gap-1.5 mb-3">
                        <AlertCircle className="size-3 text-[#B45309]" />
                        <span className="text-xs font-medium text-[#B45309]">{item.amazon_count.toLocaleString()} Amazon orders</span>
                      </div>
                      <p className="text-xs text-[#49454F] leading-relaxed">{item.suggested_reason}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}