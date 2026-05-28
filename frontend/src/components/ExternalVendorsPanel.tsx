// ExternalVendorsPanel
// Reads the pre-computed combined external-vendor ranking from
// /api/analytics/external-vendors and renders it as a compact ranked table on
// the Overall tab. The ranking is built once in the notebook (see
// backend/data_cleaning/data_mining.ipynb) so this component is a cheap file
// read on the backend — safe to mount on page load.
import { useEffect, useState } from 'react';
import { Building2, RefreshCw } from 'lucide-react';

type Vendor = {
  rank: number;
  merchant_name: string;
  purchase_count: number;
  total_spend: number;
  datasets: string[];
  row_share_pct: number;
  spend_share_pct: number;
};

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);

const DATASET_COLORS: Record<string, string> = {
  amazon: 'bg-amber-100 text-amber-800',
  cruzbuy: 'bg-blue-100 text-blue-800',
  onecard: 'bg-violet-100 text-violet-800',
  procard: 'bg-emerald-100 text-emerald-800',
};

interface Props {
  limit?: number;
}

export function ExternalVendorsPanel({ limit = 10 }: Props) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [totalVendors, setTotalVendors] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const topSpendShare = vendors.reduce((sum, v) => sum + v.spend_share_pct, 0);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-bold text-slate-900">Top External Vendors</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Ranked across Amazon, CruzBuy, OneCard, and ProCard. Derived from the
            cleaned source CSVs — re-run the notebook cell to refresh.
          </p>
        </div>
        {!loading && !error && vendors.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Top {vendors.length} of {totalVendors.toLocaleString()} vendors ·{' '}
            <span className="font-semibold text-slate-900">
              {topSpendShare.toFixed(1)}%
            </span>{' '}
            of total spend
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
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
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      )}

      {!loading && !error && vendors.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
          No vendors found in the combined ranking.
        </div>
      )}

      {!loading && !error && vendors.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-2 py-2 font-medium">#</th>
                <th className="px-2 py-2 font-medium">Vendor</th>
                <th className="px-2 py-2 font-medium">Sources</th>
                <th className="px-2 py-2 text-right font-medium">Transactions</th>
                <th className="px-2 py-2 text-right font-medium">Total Spend</th>
                <th className="px-2 py-2 text-right font-medium">Share</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr
                  key={`${v.rank}-${v.merchant_name}`}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                >
                  <td className="px-2 py-3 font-mono text-xs text-slate-500">{v.rank}</td>
                  <td className="px-2 py-3 font-medium text-slate-900">
                    {v.merchant_name || 'Unknown'}
                  </td>
                  <td className="px-2 py-3">
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
                  </td>
                  <td className="px-2 py-3 text-right font-mono text-slate-700">
                    {v.purchase_count.toLocaleString()}
                  </td>
                  <td className="px-2 py-3 text-right font-mono text-slate-900">
                    {formatCurrency(v.total_spend)}
                  </td>
                  <td className="px-2 py-3 text-right text-xs text-slate-500">
                    {v.spend_share_pct.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default ExternalVendorsPanel;
