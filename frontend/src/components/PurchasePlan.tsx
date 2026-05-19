import React from 'react';
import { Download, Trash2, ShoppingCart } from 'lucide-react';
import type { InsightRow } from './InventoryInsights';

export interface PlanItem {
  item: InsightRow;
  dataset: string;
  unitPrice: number | null;
  recommendedQty: number;
}

interface Props {
  items: PlanItem[];
  onRemove: (category: string) => void;
  onClearAll: () => void;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const ACTION_COLORS: Record<string, string> = {
  'Critical Reorder': 'text-[#410002] bg-[#FFDAD6]',
  'Reorder Soon':     'text-[#410002] bg-[#FFDAD6]',
  'Monitor Closely':  'text-[#261A00] bg-[#FFDF99]',
  'Dead Stock Risk':  'text-[#31111D] bg-[#FFD8E4]',
  'Adequate Stock':   'text-[#00391C] bg-[#C4EED0]',
};

export function PurchasePlan({ items, onRemove, onClearAll }: Props) {
  if (items.length === 0) return null;

  const enriched = items.map((p) => ({
    ...p,
    estimatedCost: p.unitPrice != null ? p.recommendedQty * p.unitPrice : null,
  }));

  const total = enriched.reduce((sum, p) => sum + (p.estimatedCost ?? 0), 0);
  const hasAnyPrice = enriched.some((p) => p.estimatedCost != null);

  const handleExport = () => {
    const header = ['Item', 'Dataset', 'Status', 'Recommended Qty', 'Avg. Historical Price', 'Est. Spend', 'Impact'];
    const rows = enriched.map((p) => [
      p.item.category,
      p.dataset,
      p.item.action,
      String(p.recommendedQty),
      p.unitPrice != null ? formatCurrency(p.unitPrice) : 'N/A',
      p.estimatedCost != null ? formatCurrency(p.estimatedCost) : 'N/A',
      p.dataset === 'bookstore'
        ? `On-campus revenue opportunity: ${p.estimatedCost != null ? formatCurrency(p.estimatedCost) : 'N/A'}`
        : `Budget allocation needed: ${p.estimatedCost != null ? formatCurrency(p.estimatedCost) : 'N/A'}`,
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'purchase-plan.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full bg-[#F5F9FF] rounded-[32px] p-4 md:p-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <ShoppingCart className="size-5 text-[#1D69C4]" />
          <div>
            <h3 className="text-xl font-medium text-[#1C1B1F]">Purchase Plan</h3>
            <p className="text-sm text-[#49454F]">
              Items flagged for procurement based on ML forecasts.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-[#1D69C4] text-white rounded-xl text-sm font-semibold hover:bg-[#1255A1] transition-colors"
          >
            <Download className="size-4" />
            Export CSV
          </button>
          <button
            onClick={onClearAll}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-[#C5D8F6] text-[#49454F] rounded-xl text-sm font-semibold hover:bg-[#EBF3FF] transition-colors"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-[#C5D8F6] bg-white">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="bg-[#EBF3FF] border-b border-[#C5D8F6]">
              <th className="px-5 py-3 font-semibold text-[#1C1B1F]">Item</th>
              <th className="px-5 py-3 font-semibold text-[#1C1B1F] text-center">Status</th>
              <th className="px-5 py-3 font-semibold text-[#1C1B1F] text-right">Rec. Qty</th>
              <th className="px-5 py-3 font-semibold text-[#1C1B1F] text-right">Est. Spend</th>
              <th className="px-5 py-3 font-semibold text-[#1C1B1F]">Impact</th>
              <th className="px-5 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EBF3FF]">
            {enriched.map(({ item, dataset, recommendedQty, estimatedCost, unitPrice }) => (
              <tr key={item.category} className="hover:bg-[#F5F9FF] transition-colors">
                <td className="px-5 py-4 font-medium text-[#1C1B1F] max-w-[200px]">
                  <div className="truncate" title={item.category}>{item.category}</div>
                  <div className="text-xs text-[#49454F] capitalize mt-0.5">{dataset}</div>
                </td>
                <td className="px-5 py-4 text-center">
                  <span className={`inline-flex items-center text-[11px] font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${ACTION_COLORS[item.action] ?? 'text-[#49454F] bg-[#EBF3FF]'}`}>
                    {item.action}
                  </span>
                </td>
                <td className="px-5 py-4 text-right font-mono font-semibold text-[#1C1B1F]">
                  {recommendedQty.toLocaleString()}
                </td>
                <td className="px-5 py-4 text-right font-mono font-semibold text-[#1C1B1F]">
                  {estimatedCost != null
                    ? formatCurrency(estimatedCost)
                    : <span className="text-[#49454F] text-xs font-normal italic">Price unavailable</span>
                  }
                </td>
                <td className="px-5 py-4 text-sm text-[#49454F] max-w-[220px]">
                  {dataset === 'bookstore'
                    ? estimatedCost != null
                      ? `On-campus revenue opportunity: ${formatCurrency(estimatedCost)}`
                      : 'Restock to meet on-campus demand'
                    : estimatedCost != null
                      ? `Allocate ${formatCurrency(estimatedCost)} in budget for projected demand`
                      : 'Budget allocation recommended'
                  }
                </td>
                <td className="px-5 py-4">
                  <button
                    onClick={() => onRemove(item.category)}
                    className="text-[#49454F] hover:text-[#BA1A1A] transition-colors"
                    title="Remove from plan"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {hasAnyPrice && (
            <tfoot>
              <tr className="bg-[#EBF3FF] border-t border-[#C5D8F6]">
                <td colSpan={3} className="px-5 py-3 font-semibold text-[#1C1B1F] text-right">
                  Total Estimated Spend
                </td>
                <td className="px-5 py-3 font-bold text-[#1D69C4] text-right font-mono text-base">
                  {formatCurrency(total)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
