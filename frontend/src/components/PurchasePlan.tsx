import React from 'react';
import { Download, Trash2, ShoppingCart } from 'lucide-react';
import type { InsightRow } from './InventoryInsights';
import { Button } from './ui/button';

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
    <div className="w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-start gap-3">
          <ShoppingCart className="size-5 text-[#2d66ae] mt-1" />
          <div>
            <h3 className="text-xl font-bold text-[#003c6c]">Purchase Plan</h3>
            <p className="text-sm text-slate-950">
              Lists items for procurement plans after reviewing the ML forecast insights. Press "Export CSV" when
              done or remove an item(s) with the trash icon or "Clear All".
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={handleExport}
            className="border-[#2d66ae] bg-[#2d66ae] text-sm font-semibold text-white hover:bg-[#003c6c]"
          >
            <Download className="size-4" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={onClearAll}
            className="border-slate-200 bg-white text-sm text-slate-950 hover:bg-slate-50"
          >
            Clear All
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto rounded-xl border border-slate-200 bg-white ">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200">
              <th className="px-5 py-3 text-xs font-semibold text-[#2d66ae] uppercase">Item</th>
              <th className="px-5 py-3 text-xs font-semibold text-[#2d66ae] uppercase text-center">Status</th>
              <th className="px-5 py-3 text-xs font-semibold text-[#2d66ae] uppercase text-right">Rec. Qty</th>
              <th className="px-5 py-3 text-xs font-semibold text-[#2d66ae] uppercase text-right">Est. Spend</th>
              <th className="px-5 py-3 text-xs font-semibold text-[#2d66ae] uppercase">Impact</th>
              <th className="px-5 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {enriched.map(({ item, dataset, recommendedQty, estimatedCost, unitPrice }) => (
              <tr key={item.category} className="hover:bg-[#F5F9FF] transition-colors">
                <td className="px-5 py-4 font-medium text-[#003c6c] max-w-[200px]">
                  <div className="truncate" title={item.category}>{item.category}</div>
                  <div className="text-xs text-slate-500 capitalize mt-0.5">{dataset}</div>
                </td>
                <td className="px-5 py-4 text-center">
                  <span className={`inline-flex items-center text-[11px] font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${ACTION_COLORS[item.action] ?? 'text-slate-700 bg-slate-100'}`}>
                    {item.action}
                  </span>
                </td>
                <td className="px-5 py-4 text-right text-xs font-normal text-slate-950">
                  {recommendedQty.toLocaleString()}
                </td>
                <td className="px-5 py-4 text-right text-xs font-normal text-slate-950">
                  {estimatedCost != null
                    ? formatCurrency(estimatedCost)
                    : <span className="text-slate-500 text-xs font-normal italic">Price unavailable</span>
                  }
                </td>
                <td className="px-5 py-4 text-left text-xs font-normal text-slate-950">
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
                  <Button
                    variant="ghost"
                    onClick={() => onRemove(item.category)}
                    className="text-[#49454F] hover:text-[#BA1A1A] transition-colors"
                    title="Remove from plan"
                  >
                    <Trash2 className="size-4 text-[#003c6c]" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
          {hasAnyPrice && (
            <tfoot>
              <tr className="bg-slate-50 border-t border-slate-200">
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
