import type { CondensedDrilldownItem, TopItem, VendorStat } from './TopItemsTable';

// -----------------------------------------------------------------------------
// TOP ITEM DRILLDOWN PANEL TYPES
// Types and helpers for the item drilldown side panel.
// -----------------------------------------------------------------------------

type MetricType = 'currency' | 'quantity' | 'mixed';

interface TopItemDrilldownPanelProps {
  selectedItem: TopItem | null;
  metricLabel: string;
  metricType: MetricType;
}

const PROJECT_DETAIL_KEYWORDS = /(project|fund|account|department|dept|cost center|program|chartstring|index|foapal|allocation)/i;
const CURRENCY_KEYWORDS = /(amount|total|subtotal|tax|price|cost|spend)/i;

// -----------------------------------------------------------------------------
// FORMATTERS
// Number and currency formatting helpers for the drilldown panel.
// -----------------------------------------------------------------------------
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
};

const formatNumber = (value: number) => {
  return new Intl.NumberFormat('en-US').format(value);
};

const formatFieldValue = (key: string, value: string | number | null, metricType: MetricType) => {
  if (value === null || value === undefined || value === '') {
    return 'N/A';
  }

  if (typeof value === 'number') {
    if (metricType !== 'quantity' && CURRENCY_KEYWORDS.test(key)) {
      return formatCurrency(value);
    }
    return formatNumber(value);
  }

  return String(value);
};

const sortVendors = (vendors: VendorStat[]) => {
  return [...vendors].sort((a, b) => {
    const spendDelta = Number(b.spend || 0) - Number(a.spend || 0);
    if (spendDelta !== 0) return spendDelta;
    return Number(b.count || 0) - Number(a.count || 0);
  });
};

const sortDrilldownItems = (items: CondensedDrilldownItem[]) => {
  return [...items].sort((a, b) => {
    const spendDelta = Number(b.total_spent || 0) - Number(a.total_spent || 0);
    if (spendDelta !== 0) return spendDelta;
    return Number(b.count || 0) - Number(a.count || 0);
  });
};

export default function TopItemDrilldownPanel({
  selectedItem,
  metricLabel,
  metricType,
}: TopItemDrilldownPanelProps) {
  if (!selectedItem) {
    return (
      <div className="h-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h4 className="text-sm font-bold text-[#003c6c]">Detailed Breakdown</h4>
        <p className="mt-2 text-xs text-slate-500">
          Click a bar to inspect its drilldown information.
        </p>
      </div>
    );
  }

  const baseMetric = Number(selectedItem.total_spent || 0);
  const pendingMetric = Number(selectedItem.projected_spent || 0);
  const combinedMetric = baseMetric + pendingMetric;

  const baseFrequency = Number(selectedItem.count || 0);
  const pendingFrequency = Number(selectedItem.projected_count || 0);
  const combinedFrequency = baseFrequency + pendingFrequency;

  const vendors = sortVendors(selectedItem.vendors || []).filter(
    (vendor) => Number(vendor.count || 0) > 0 || Number(vendor.spend || 0) > 0
  );

  const entries = Object.entries(selectedItem.row_values || {}).filter(([, value]) => value !== null && value !== '');
  const projectEntries = entries.filter(([key]) => PROJECT_DETAIL_KEYWORDS.test(key));
  const otherEntries = entries.filter(([key]) => !PROJECT_DETAIL_KEYWORDS.test(key)).slice(0, 8);
  const drilldownItems = sortDrilldownItems(selectedItem.drilldown_items || []).filter(
    (item) => Number(item.count || 0) > 0 || Number(item.total_spent || 0) > 0
  );

  const metricValue = (value: number) => {
    if (metricType === 'quantity') return formatNumber(value);
    return formatCurrency(value);
  };

  return (
    <div className="h-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      {/* Header */}
      <h4 className="text-sm font-bold text-[#003c6c]">Detailed Breakdown</h4>
      <p className="mt-1 text-xs text-slate-500">{selectedItem.clean_item_name}</p>
      {selectedItem.is_condensed && (
        <p className="mt-1 text-xs font-medium text-[#2d66ae]">
          Condensed group: {selectedItem.condensed_group || selectedItem.clean_item_name}
        </p>
      )}

      {/* Summary cards */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#2d66ae]">Frequency</p>
          <p className="text-sm font-bold text-slate-950">{formatNumber(combinedFrequency)}</p>
          {pendingFrequency > 0 && (
            <p className="text-[11px] text-slate-500">{formatNumber(baseFrequency)} current + {formatNumber(pendingFrequency)} pending</p>
          )}
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#2d66ae]">{metricLabel}</p>
          <p className="text-sm font-bold text-slate-950">{metricValue(combinedMetric)}</p>
          {pendingMetric > 0 && (
            <p className="text-[11px] text-slate-500">{metricValue(baseMetric)} current + {metricValue(pendingMetric)} pending</p>
          )}
        </div>
      </div>

      {/* Condensed group drilldown */}
      {selectedItem.is_condensed && (
        <div className="mt-4">
          <h5 className="text-xs font-semibold uppercase tracking-wide text-[#2d66ae]">Underlying Purchases</h5>
          {drilldownItems.length === 0 ? (
            <p className="mt-2 text-xs text-slate-400">No sub-item rows available for this condensed group.</p>
          ) : (
            <div className="mt-2 space-y-2 max-h-[260px] overflow-y-auto pr-1">
              {drilldownItems.slice(0, 10).map((subItem) => {
                const subItemVendors = sortVendors(subItem.vendors || []).slice(0, 3);
                return (
                  <div
                    key={`${subItem.clean_item_name}-${subItem.count}-${subItem.total_spent}`}
                    className="rounded-md border border-slate-200 bg-slate-50 p-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-semibold text-slate-800">{subItem.clean_item_name}</p>
                      <p className="text-xs font-semibold text-[#2d66ae]">{metricValue(Number(subItem.total_spent || 0))}</p>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {formatNumber(Number(subItem.count || 0))} transactions
                    </p>
                    {subItemVendors.length > 0 && (
                      <p className="mt-1 text-[11px] text-slate-500">
                        Vendors: {subItemVendors.map((vendor) => vendor.name || 'Unknown').join(', ')}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Vendor breakdown */}
      <div className="mt-4">
        <h5 className="text-xs font-semibold uppercase tracking-wide text-[#2d66ae]">Vendor Breakdown</h5>
        {vendors.length === 0 ? (
          <p className="mt-2 text-xs text-slate-400">No vendor-level breakdown available.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {vendors.slice(0, 6).map((vendor) => (
              <div key={`${vendor.name}-${vendor.count}-${vendor.spend}`} className="rounded-md border border-slate-100 bg-slate-50 p-2">
                <div className="flex items-center justify-between">
                  <p className="truncate pr-2 text-xs font-semibold text-slate-700">{vendor.name || 'Unknown vendor'}</p>
                  <p className="text-xs font-semibold text-[#2d66ae]">{metricValue(Number(vendor.spend || 0))}</p>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">{formatNumber(Number(vendor.count || 0))} transactions</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Project and allocation fields */}
      {projectEntries.length > 0 && (
        <div className="mt-4">
          <h5 className="text-xs font-semibold uppercase tracking-wide text-[#2d66ae]">Project and Allocation Fields</h5>
          <div className="mt-2 space-y-1">
            {projectEntries.map(([key, value]) => (
              <div key={key} className="flex items-start justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                <span className="text-[11px] font-medium text-slate-600">{key}</span>
                <span className="break-all text-right text-[11px] text-slate-700">{formatFieldValue(key, value, metricType)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Other dataset details */}
      {otherEntries.length > 0 && (
        <div className="mt-4">
          <h5 className="text-xs font-semibold uppercase tracking-wide text-[#2d66ae]">Other Dataset Details</h5>
          <div className="mt-2 space-y-1">
            {otherEntries.map(([key, value]) => (
              <div key={key} className="flex items-start justify-between gap-3 rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5">
                <span className="text-[11px] font-medium text-slate-600">{key}</span>
                <span className="text-[11px] text-slate-700 text-right break-all">{formatFieldValue(key, value, metricType)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}