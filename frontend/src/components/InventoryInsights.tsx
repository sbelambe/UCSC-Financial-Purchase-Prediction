import React, { useEffect, useState} from 'react';
import {useQuery} from '@tanstack/react-query'
import { AlertCircle, CheckCircle, TrendingUp, Clock, Sparkles } from 'lucide-react';

interface InsightRow {
  category: string;
  current_stock: number;
  predicted_demand: number;
  action: 'Critical Reorder' | 'Reorder Soon' | 'Monitor Closely' | 'Adequate Stock';
  reasoning: string;
}

interface InsightsResponse {
  status: string;
  time_period: string;
  data: InsightRow[];
}

/**
 * Component: InventoryInsights
 * Description: Cross-references high-frequency/high-cost Amazon purchases against 
 * current Bookstore inventory. Outputs a list of items that should be stocked 
 * internally to capture rogue spend. Includes a template placeholder for Sprint 6 predictions.
 */
export function InventoryInsights() {
  const [timePeriod, setTimePeriod] = useState<string>('1_quarter');


  // React Query automatically tracks loading states, caches the data, and aborts stale requests
  const { 
    data: insights = [], 
    isLoading: loading, 
    error 
  } = useQuery({
    queryKey: ['bookstore-insights', timePeriod],
    queryFn: async ({ signal }) => {
      // The signal is passed by React Query to auto-abort if the user clicks away quickly
      const response = await fetch(`/api/analytics/bookstore-insights?time_period=${timePeriod}`, { signal });
      
      console.log("1. Server responded with status:", response.status);
      const payload = await response.json();
      console.log("2. JSON Payload parsed successfully:", payload);
      
      if (!response.ok) {
        throw new Error(payload?.detail || 'Failed to load ML predictions.');
      }
      
      console.log("3. Setting state with data array of length:", payload.data.length);
      return payload.data as InsightRow[];
    },
    // Keep the data fresh in the user's browser for 30 minutes to prevent spamming BigQuery
    staleTime: 1000 * 60 * 30,
  });

  // Helper function to map the ML action to the appropriate visual badge
  const renderActionBadge = (action: string) => {
    switch (action) {
      case 'Critical Reorder':
      case 'Reorder Soon':
        return (
          <span className="flex items-center gap-1 text-sm font-bold text-red-600 bg-red-50 px-3 py-1 rounded-full">
            <AlertCircle size={16} />
            {action}
          </span>
        );
      case 'Monitor Closely':
        return (
          <span className="flex items-center gap-1 text-sm font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
            <Clock size={16} />
            {action}
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-sm font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full">
            <CheckCircle size={16} />
            {action}
          </span>
        );
    }
  };

return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
      
      {/* 1. Header & Controls Section (Flexbox keeps them on the same line) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 border-b border-gray-100 pb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
            <TrendingUp className="text-blue-600" size={22} />
            Inventory Insights
          </h3>
          <p className="text-sm text-gray-500">
            Predictive demand forecasting based on historical trends.
          </p>
        </div>
        
        {/* Dropdown constrained to a smaller width */}
        <div className="flex flex-col gap-1 w-full sm:w-48">
          <select 
            id="timePeriod"
            value={timePeriod}
            onChange={(e) => setTimePeriod(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="1_month">Next Month</option>
            <option value="1_quarter">Next Quarter</option>
            <option value="6_months">Next 6 Months</option>
            <option value="1_year">Next Year</option>
          </select>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 mb-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg">
          {error instanceof Error ? error.message : 'Unknown error occurred'}
        </div>
      )}

      {/* Data Rendering Section */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-12 text-center text-gray-500 font-medium">
            <div className="animate-pulse flex flex-col items-center gap-2">
               <div className="h-6 w-6 border-b-2 border-blue-600 rounded-full animate-spin"></div>
               Calculating predictions from BigQuery ML...
            </div>
          </div>
        ) : insights.length === 0 ? (
          <div className="p-8 text-center text-gray-500 border rounded-lg bg-gray-50">
            No predictions available for this time period.
          </div>
        ) : (
          insights.map((item, index) => {
            // Calculate percentage for the visual bar (capped at 100%)
            const stockPercent = item.predicted_demand > 0 
              ? Math.min((item.current_stock / item.predicted_demand) * 100, 100) 
              : 100;

            return (
              <div key={index} className="flex flex-col p-5 border border-gray-200 rounded-xl bg-white hover:border-blue-200 transition-colors shadow-sm gap-4">
                
                {/* Top Row: Title and Badge */}
                <div className="flex justify-between items-start">
                  <h4 className="font-bold text-gray-900 text-lg">{item.category}</h4>
                  <div>{renderActionBadge(item.action)}</div>
                </div>

                {/* Middle Row: Visual Data Bar */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">
                      Stock: <span className="font-semibold text-gray-900">{item.current_stock.toLocaleString()}</span>
                    </span>
                    <span className="text-gray-600">
                      Demand: <span className="font-semibold text-blue-700">{item.predicted_demand.toLocaleString()}</span>
                    </span>
                  </div>
                  {/* The Progress Bar Container */}
                  <div className="w-full bg-gray-100 rounded-full h-2.5 mb-1 overflow-hidden">
                    <div 
                      className={`h-2.5 rounded-full ${stockPercent < 20 ? 'bg-red-500' : stockPercent < 50 ? 'bg-amber-500' : 'bg-green-500'}`} 
                      style={{ width: `${stockPercent}%` }}
                    ></div>
                  </div>
                </div>
                
                {/* Bottom Row: AI Reasoning */}
                <div className="mt-1 flex items-start gap-3 text-sm text-indigo-900 bg-indigo-50/50 p-4 rounded-lg border border-indigo-100/50">
                  <Sparkles className="text-indigo-500 shrink-0 mt-0.5" size={18} />
                  <p className="leading-relaxed">
                    <span className="font-semibold mr-1">AI Reasoning: </span> 
                    {item.reasoning}
                  </p>
                </div>

              </div>
            );
          })
        )}
      </div>
    </div>
  );
}