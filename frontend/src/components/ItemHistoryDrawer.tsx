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
}

interface HistoryPoint {
  month: string;
  quantity: number;
}

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
    <div className="flex flex-col items-center bg-[#F3EDF7] rounded-[16px] px-4 py-3 min-w-0">
      <span className="text-[10px] font-medium text-[#49454F] uppercase tracking-wide mb-1">{label}</span>
      <span className="text-2xl font-medium text-[#1C1B1F] leading-none">{typeof value === 'number' ? value.toLocaleString() : value}</span>
      {sub && <span className="text-[10px] text-[#79747E] mt-1">{sub}</span>}
    </div>
  );
}

export function ItemHistoryDrawer({ item, devMode, onClose }: ItemHistoryDrawerProps) {
  const { data, isLoading } = useQuery<{ item_name: string; history: HistoryPoint[] }>({
    queryKey: ['item-history', item?.category, devMode],
    queryFn: async ({ signal }) => {
      if (!item) throw new Error('No item selected');
      const url = `/api/analytics/item-history?item_name=${encodeURIComponent(item.category)}&dev_mode=${devMode}`;
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
        className="w-full sm:max-w-xl overflow-y-auto bg-[#FFFBFE] border-l border-[#E7E0EC] p-0"
      >
        {item && (
          <>
            {/* Header */}
            <SheetHeader className="px-6 pt-6 pb-4 border-b border-[#E7E0EC]">
              <div className="flex flex-col gap-2 min-w-0">
                <SheetTitle className="text-lg font-medium text-[#1C1B1F] leading-snug">
                  {item.category}
                </SheetTitle>
                <ActionBadge action={item.action} />
              </div>
            </SheetHeader>

            <div className="px-6 py-5 flex flex-col gap-6">
              {/* Key metrics */}
              <div className="grid grid-cols-4 gap-3">
                <MetricTile label="Inventory" value={item.current_stock} sub="last 3 mo." />
                <MetricTile label="ML Forecast" value={item.predicted_demand} />
                {item.historical_avg > 0 && (
                  <MetricTile label="Hist. Avg" value={item.historical_avg} sub="same period" />
                )}
                <MetricTile label="Certainty" value={`${item.certainty_score}%`} />
              </div>

              {/* Purchase history chart */}
              <div>
                <h4 className="text-sm font-medium text-[#1C1B1F] mb-3">
                  Monthly Purchase History
                </h4>

                {isLoading ? (
                  <div className="h-[200px] rounded-[16px] bg-[#F3EDF7] animate-pulse" />
                ) : history.length === 0 ? (
                  <div className="h-[200px] rounded-[16px] bg-[#F3EDF7] flex items-center justify-center">
                    <p className="text-sm text-[#49454F]">No historical data available.</p>
                  </div>
                ) : (
                  <div className="bg-[#F3EDF7] rounded-[16px] p-4">
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={history} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E7E0EC" />
                        <XAxis
                          dataKey="month"
                          tick={{ fontSize: 10, fill: '#79747E' }}
                          tickFormatter={(v: string) => v.slice(2)}  // "2024-03" → "24-03"
                          interval="preserveStartEnd"
                        />
                        <YAxis tick={{ fontSize: 10, fill: '#79747E' }} />
                        <Tooltip
                          contentStyle={{ background: '#F3EDF7', border: '1px solid #E7E0EC', borderRadius: 12, fontSize: 12 }}
                          formatter={(v: number) => [v.toLocaleString(), 'Qty']}
                        />
                        <Line
                          type="monotone"
                          dataKey="quantity"
                          stroke="#6750A4"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4, fill: '#6750A4' }}
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
                <h4 className="text-sm font-medium text-[#1C1B1F] mb-2">Forecast Range</h4>
                <div className="bg-[#F3EDF7] rounded-[16px] p-4 flex flex-col gap-2">
                  <div className="flex justify-between text-xs text-[#49454F]">
                    <span>Low estimate</span>
                    <span className="font-medium">{item.lower_bound.toLocaleString()}</span>
                  </div>
                  <div className="relative h-2 bg-[#E7E0EC] rounded-full overflow-hidden">
                    {(() => {
                      const max = Math.max(item.upper_bound, item.current_stock, 1) * 1.15;
                      const lp = Math.min(100, (item.lower_bound / max) * 100);
                      const up = Math.min(100, (item.upper_bound / max) * 100);
                      const sp = Math.min(100, (item.current_stock / max) * 100);
                      return (
                        <>
                          <div className="absolute h-full bg-[#E8DEF8]" style={{ left: `${lp}%`, width: `${up - lp}%` }} />
                          <div className="absolute top-0 bottom-0 w-2.5 rounded-full -translate-x-1/2 bg-[#6750A4]" style={{ left: `${sp}%` }} />
                        </>
                      );
                    })()}
                  </div>
                  <div className="flex justify-between text-xs text-[#49454F]">
                    <span>High estimate</span>
                    <span className="font-medium">{item.upper_bound.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* AI Reasoning */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="size-4 text-[#6750A4]" />
                  <h4 className="text-sm font-medium text-[#1C1B1F]">Deep Analysis</h4>
                </div>
                <div className="bg-[#F3EDF7] rounded-[16px] p-4">
                  <p className="text-sm text-[#49454F] leading-relaxed">{item.reasoning}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
