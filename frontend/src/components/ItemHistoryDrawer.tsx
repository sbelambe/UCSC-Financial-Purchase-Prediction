import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { AlertCircle, CheckCircle, Clock, PackageSearch, Sparkles } from 'lucide-react';
import type { InsightRow } from './InventoryInsights';

interface ItemHistoryDrawerProps {
  item: InsightRow | null;
  devMode: boolean;
  onClose: () => void;
  datasetType?: 'bookstore' | 'amazon';
}

interface HistoryPoint {
  month: string;
  quantity: number;
}

// -----------------------------------------------------------------------------
// ITEM HISTORY DRAWER
// Drawer that shows a selected item's recent purchase history, forecast range,
// and AI reasoning used for the prediction.
// -----------------------------------------------------------------------------

const ACTION_STYLES: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  'Critical Reorder': {
    bg: 'bg-[#FFDAD6]', text: 'text-[#410002]',
    icon: <AlertCircle className="size-3.5" />,
  },
  'Reorder Soon': {
    bg: 'bg-[#FFDAD6]', text: 'text-[#410002]',
    icon: <AlertCircle className="size-3.5" />,
  },
  'Monitor Closely': {
    bg: 'bg-[#FFDF99]', text: 'text-[#261A00]',
    icon: <Clock className="size-3.5" />,
  },
  'Dead Stock Risk': {
    bg: 'bg-[#FFD8E4]', text: 'text-[#31111D]',
    icon: <PackageSearch className="size-3.5" />,
  },
  'Adequate Stock': {
    bg: 'bg-[#C4EED0]', text: 'text-[#00391C]',
    icon: <CheckCircle className="size-3.5" />,
  },
};

function ActionBadge({ action }: { action: string }) {
  const style = ACTION_STYLES[action] ?? ACTION_STYLES['Adequate Stock'];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-3 py-1 rounded-full ${style.bg} ${style.text}`}>
      {style.icon}
      {action === 'Dead Stock Risk' ? 'Overstock' : action}
    </span>
  );
}

function MetricTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex flex-col items-center bg-[#EFF4FB] rounded-[16px] px-4 py-3 min-w-0">
      <span className="text-[10px] text-[#2d66ae] uppercase font-semibold tracking-wide">{label}</span>
      <span className="text-lg font-bold text-slate-950 mt-1">{typeof value === 'number' ? value.toLocaleString() : value}</span>
      {sub && <span className="text-xs text-slate-500 mt-1">{sub}</span>}
    </div>
  );
}

export function ItemHistoryDrawer({ item, devMode, onClose, datasetType = 'bookstore' }: ItemHistoryDrawerProps) {
  const { data, isLoading } = useQuery<{ item_name: string; history: HistoryPoint[] }>({
    queryKey: ['item-history', item?.category, devMode, datasetType],
    queryFn: async ({ signal }) => {
      if (!item) throw new Error('No item selected');
      const url = `/api/analytics/item-history?item_name=${encodeURIComponent(item.category)}&dev_mode=${devMode}&dataset_type=${datasetType}`;
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error('Failed to load history');
      return res.json();
    },
    enabled: !!item,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const history = data?.history ?? [];
  const peak = history.length ? Math.max(...history.map(h => h.quantity)) : 0;

  return (
    <Sheet open={!!item} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl overflow-y-auto bg-[#F8FAFF] border-l border-[#DBEAFE] p-0"
      >
        {item && (
          <>
            {/* Header */}
            <SheetHeader className="px-6 pt-6 pb-4 border-b border-[#DBEAFE]">
              <div className="flex flex-col gap-2 min-w-0">
                {/* Title */}
                <SheetTitle className="text-lg font-sans font-bold text-[#003c6c] leading-snug">
                  {item.category}
                </SheetTitle>
                {/* Action Badge */}
                <ActionBadge action={item.action} />
              </div>
            </SheetHeader>

            <div className="px-6 py-5 flex flex-col gap-6">
              {/* Key metrics */}
              <div className="grid grid-cols-3 gap-3">
                <MetricTile label="Inventory" value={item.current_stock} sub="last 3 mo." />
                <MetricTile label="Forecast" value={item.predicted_demand} />
                {item.historical_avg > 0 && (
                  <MetricTile label="Hist. Avg" value={item.historical_avg} sub="same period" />
                )}
                <MetricTile label="Certainty" value={`${item.certainty_score}%`} />
              </div>

              {/* Purchase history chart */}
              <div>
                <h4 className="text-md font-semibold mb-4 text-[#003c6c]">
                  Monthly Purchase History
                </h4>

                {isLoading ? (
                  <div className="h-[200px] rounded-[16px] bg-[#EFF4FB] animate-pulse" />
                ) : history.length === 0 ? (
                  <div className="h-[200px] rounded-[16px] bg-[#EFF4FB] flex items-center justify-center">
                    <p className="text-xs text-slate-500">No historical data available.</p>
                  </div>
                ) : (
                  <div className="bg-[#EFF4FB] rounded-[16px] p-4">
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={history} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#DBEAFE" />
                        <XAxis
                          dataKey="month"
                          tick={{ fontSize: 10, fill: '#79747E' }}
                          tickFormatter={(v: string) => v.slice(2)}  // "2024-03" → "24-03"
                          interval="preserveStartEnd"
                        />
                        <YAxis tick={{ fontSize: 10, fill: '#79747E' }} />
                        <Tooltip
                          contentStyle={{ background: '#EFF4FB', border: '1px solid #DBEAFE', borderRadius: 12, fontSize: 12 }}
                          formatter={(value) => [
                            typeof value === 'number' ? value.toLocaleString() : value,
                            'Qty',
                          ]}
                        />
                        <Line
                          type="monotone"
                          dataKey="quantity"
                          stroke="#2d66ae"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4, fill: '#2d66ae' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                    <p className="text-[10px] text-[#79747E] mt-2 text-right">
                      Peak: {peak.toLocaleString()} units/month
                    </p>
                  </div>
                )}
              </div>

              {/* Prediction bounds */}
              <div>
                <h4 className="text-md font-semibold mb-4 text-[#003c6c]">Forecast Range</h4>
                <div className="bg-[#EFF4FB] rounded-[16px] p-4 flex flex-col gap-2">
                  <div className="flex justify-between text-[10px] text-[#2d66ae] uppercase font-bold">
                    <span>Low estimate</span>
                    <span className="font-medium">{item.lower_bound.toLocaleString()}</span>
                  </div>
                  <div className="relative h-2 bg-slate-200 rounded-full overflow-hidden">
                    {(() => {
                      const max = Math.max(item.upper_bound, item.current_stock, 1) * 1.15;
                      const lp = Math.min(100, (item.lower_bound / max) * 100);
                      const up = Math.min(100, (item.upper_bound / max) * 100);
                      const sp = Math.min(100, (item.current_stock / max) * 100);
                      return (
                        <>
                          <div className="absolute h-full bg-[#2d66ae]" style={{ left: `${lp}%`, width: `${up - lp}%` }} />
                          <div className="absolute top-0 bottom-0 w-2.5 rounded-full -translate-x-1/2 bg-red-700" style={{ left: `${sp}%` }} />
                        </>
                      );
                    })()}
                  </div>
                  <div className="flex justify-between text-[10px] text-[#2d66ae] uppercase font-bold">
                    <span>High estimate</span>
                    <span className="font-medium">{item.upper_bound.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* AI Reasoning */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="size-4 text-[#2d66ae]" />
                  <h4 className="text-md font-semibold text-[#003c6c]">Deep Analysis</h4>
                  
                </div>
                <div className="bg-[#EFF4FB] rounded-[16px] p-4">
                  <p className="mt-1 text-xs text-slate-950">{item.reasoning}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
