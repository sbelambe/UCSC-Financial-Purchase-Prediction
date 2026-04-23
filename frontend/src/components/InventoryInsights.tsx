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
  Sparkles 
} from 'lucide-react';

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export interface InsightRow {
  category: string;
  current_stock: number;
  predicted_demand: number;
  certainty_score: number;
  lower_bound: number;
  upper_bound: number;
  external_volume: number;
  trend_direction: 'growing' | 'declining' | 'stable';
  action: 'Critical Reorder' | 'Reorder Soon' | 'Monitor Closely' | 'Adequate Stock' | 'Dead Stock Risk';
  reasoning: string;
}

export function InventoryInsights() {
  const [timePeriod, setTimePeriod] = useState<string>('1_quarter');

  const { 
    data: insights = [], 
    isLoading: loading, 
    error 
  } = useQuery({
    queryKey: ['bookstore-insights', timePeriod],
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/analytics/bookstore-insights?time_period=${timePeriod}`, { signal });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.detail || 'Failed to load ML predictions.');
      return payload.data as InsightRow[];
    },
    staleTime: 1000 * 60 * 30,
  });

  // MD3 Tonal Badges
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
    // Base Surface Color applied to the main wrapper
    <div className="w-full mb-10 flex flex-col gap-8 bg-[#FFFBFE] p-4 md:p-8 rounded-[32px] font-sans">
      
      {/* MD3 Hero Header Container 
        Features atmospheric blur shapes, extra large radius (32px), and Surface Container background
      */}
      <div className="relative overflow-hidden bg-[#F3EDF7] rounded-[32px] p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 z-0 shadow-sm">
        {/* Organic Decorative Blurs */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-[#6750A4] opacity-10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/3 mix-blend-multiply pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-48 h-48 bg-[#7D5260] opacity-10 blur-3xl rounded-full translate-y-1/3 mix-blend-multiply pointer-events-none" />

        <div className="relative z-10">
          <h3 className="text-3xl font-medium text-[#1C1B1F] tracking-tight">Inventory Optimization</h3>
          <p className="text-base text-[#49454F] mt-1">High-density stock overview via ML forecasting.</p>
        </div>
        
        {/* MD3 Filled Text Field Style Input */}
        <div className="relative z-10 flex items-center gap-3 bg-[#E7E0EC] rounded-t-[12px] rounded-b-none border-b-2 border-[#79747E] focus-within:border-[#6750A4] transition-colors duration-200 px-4 py-3 cursor-pointer group">
          <Clock className="size-5 text-[#49454F] group-focus-within:text-[#6750A4] transition-colors" />
          <select 
            value={timePeriod}
            onChange={(e) => setTimePeriod(e.target.value)}
            className="border-none text-sm font-medium text-[#1C1B1F] bg-transparent focus:ring-0 cursor-pointer outline-none w-full appearance-none pr-6"
          >
            <option value="1_month">Next 30 Days</option>
            <option value="1_quarter">Next 90 Days</option>
            <option value="6_months">Next 180 Days</option>
            <option value="1_year">Fiscal Year</option>
          </select>
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
                // MD3 Card Styling: Large radius, surface container color, shadow elevation, tactile active scale
                className="group flex flex-col h-full overflow-hidden bg-[#F3EDF7] border-none rounded-[24px] shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-95 transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] cursor-pointer relative"
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
                      <div className="text-xs font-medium text-[#49454F] mb-1">Stock</div>
                      <div className={`text-3xl font-medium leading-none truncate ${item.current_stock < 0 ? 'text-[#BA1A1A]' : 'text-[#1C1B1F]'}`}>
                        {item.current_stock.toLocaleString()}
                      </div>
                    </div>
                    <div className="min-w-0 text-right">
                      <div className="text-xs font-medium text-[#6750A4] mb-1">Target</div>
                      <div className="text-3xl font-medium text-[#6750A4] leading-none truncate">
                        {item.predicted_demand.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  
                  {/* Visualizer Bar - Softened for MD3 */}
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

                {/* AI Reasoning - Surface Container Low for subtle separation */}
                <CardFooter className="bg-[#E7E0EC]/50 p-5 mt-auto relative z-20 group-hover:bg-[#E7E0EC] transition-colors duration-300">
                  <p className="text-sm text-[#49454F] leading-relaxed line-clamp-2" title={item.reasoning}>
                    {item.reasoning}
                  </p>
                </CardFooter>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}