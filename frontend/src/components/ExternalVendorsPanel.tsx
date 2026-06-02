import { useEffect, useState } from 'react';
import { Building2, RefreshCw } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';

// -----------------------------------------------------------------------------
// EXTERNAL VENDOR PANEL TYPE
// Data structure used by the external vendor ranking panel.
// -----------------------------------------------------------------------------
type Vendor = {
  rank: number;
  merchant_name: string;
  purchase_count: number;
  total_spend: number;
  datasets: string[];
  row_share_pct: number;
  spend_share_pct: number;
};

// -----------------------------------------------------------------------------
// HELPER FUNCTIONS
// -----------------------------------------------------------------------------
const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);

// -----------------------------------------------------------------------------
// DATASET BUTTON STYLING
// -----------------------------------------------------------------------------
const DATASET_COLORS: Record<string, string> = {
  amazon: 'bg-amber-100 text-amber-800',
  cruzbuy: 'bg-blue-100 text-blue-800',
  onecard: 'bg-violet-100 text-violet-800',
  procard: 'bg-emerald-100 text-emerald-800',
};

// -----------------------------------------------------------------------------
// COMPONENT PROPS
// -----------------------------------------------------------------------------
interface Props {
  limit?: number;
}

export function ExternalVendorsPanel({ limit = 10 }: Props) {
  // ---------------------------------------------------------------------------
  // EXTERNAL VENDORS STATE
  // ---------------------------------------------------------------------------
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [totalVendors, setTotalVendors] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // GET EXTERNAL VENDORS
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/analytics/external-vendors?limit=${limit}`)
      .then(async (res) => {
        const payload = await res.json();
        if (!res.ok) throw new Error(payload?.detail || 'Failed to load external vendors.');
        return payload;
      })
      .then((res) => {
        if (cancelled) return;
        setVendors(res.data?.vendors || []);
        setTotalVendors(res.data?.total_vendors || 0);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [limit]);

  // ---------------------------------------------------------------------------
  // DERIVED METRICS
  // Summary values used in the panel header and table totals.
  // ---------------------------------------------------------------------------
  const topSpendShare = vendors.reduce((sum, v) => sum + v.spend_share_pct, 0);

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  return (
    <section className="w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          {/* Title */}
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[#003c6c]">Top External Vendors</h2>
          </div>
          {/* Subtitle */}
          <p className="mt-1 text-sm text-slate-950">
            Top-spend vendors identified across Amazon, CruzBuy, and OneCard/ProCard purchase history.
          </p>
        </div>
        {/* Top length of total vendors... */}
        {!loading && !error && vendors.length > 0 && (
          <div className="text-xs text-slate-500">
            Top {vendors.length} of {totalVendors.toLocaleString()} vendors ·{' '}
            <span className="font-semibold text-slate-900">
              {topSpendShare.toFixed(1)}%
            </span>{' '}
            of total spend
          </div>
        )}
      </div>

      {error && (
        <div className="mt-5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <RefreshCw className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">{error}</div>
            <div className="mt-1 text-xs">
              Open <code>backend/data_cleaning/data_mining.ipynb</code> and run the
              cell titled "Combine external vendors across…" to generate the CSV.
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="mt-5 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      )}

      {!loading && !error && vendors.length === 0 && (
        <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
          No vendors found in the combined ranking.
        </div>
      )}

      {/* Table Header */}
      {!loading && !error && vendors.length > 0 && (
        <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
          <Table className="min-w-full text-sm">
            <TableHeader className="bg-slate-50">
              <TableRow className="sticky top-0 bg-slate-100 text-left text-xs font-bold uppercase tracking-wide">
                <TableHead className="px-4 py-3 font-bold text-[#2d66ae]">#</TableHead>
                <TableHead className="px-4 py-3 font-bold text-[#2d66ae]">Vendor</TableHead>
                <TableHead className="px-4 py-3 font-bold text-[#2d66ae]">Sources</TableHead>
                <TableHead className="px-4 py-3 font-bold text-right text-[#2d66ae]">Transactions</TableHead>
                <TableHead className="px-4 py-3 font-bold text-right text-[#2d66ae]">Total Spend</TableHead>
                <TableHead className="px-4 py-3 font-bold text-right text-[#2d66ae]">Share</TableHead>
              </TableRow>
            </TableHeader>
            {/* Table Body */}
            <TableBody>
              {vendors.map((v) => (
                <TableRow
                  key={`${v.rank}-${v.merchant_name}`}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                >
                  <TableCell className="px-4 py-3 text-xs text-slate-950">{v.rank}</TableCell>
                  <TableCell className="px-4 py-3 font-semibold text-slate-950">
                    {v.merchant_name || 'Unknown'}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {v.datasets.map((d) => (
                        <span
                          key={d}
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                            DATASET_COLORS[d] || 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-xs text-right text-slate-950">
                    {v.purchase_count.toLocaleString()}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right text-xs font-semibold text-[#2d66ae]">
                    {formatCurrency(v.total_spend)}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-xs text-right text-slate-950">
                    {v.spend_share_pct.toFixed(2)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

export default ExternalVendorsPanel;
