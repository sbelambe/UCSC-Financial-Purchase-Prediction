// Types, constants, and pure utility functions shared across Dashboard
// and its hooks/sub-components. Nothing in here has side-effects.

import { BarChart3, Boxes, Building2, ShoppingBag } from 'lucide-react';
import type { DatasetSchema } from './datasetConfig';

// --- Core types ---
export type SpendPoint      = { period: string; spend: number; pending_spend?: number };
export type PatternDimension = 'item' | 'merchant' | 'category';
export type DashboardTab    = 'Home' | 'Overall' | 'CruzBuy' | 'OneCard' | 'Amazon' | 'Bookstore';
export type QuarterName     = 'All Quarters' | 'Fall' | 'Winter' | 'Spring' | 'Summer';
export type DatasetPreview  = Record<string, any[]>;

// --- Tab routing maps ---
export const TAB_TO_SERIES_KEY: Record<string, string> = {
  Home: 'amazon', Overall: 'combined', Amazon: 'amazon',
  Bookstore: 'bookstore', CruzBuy: 'cruzbuy', OneCard: 'onecard',
};

export const TAB_TO_DATASET: Record<string, string> = {
  Home: 'amazon', Overall: 'overall', Amazon: 'amazon',
  Bookstore: 'bookstore', CruzBuy: 'cruzbuy', OneCard: 'onecard',
};

// --- Home tab dataset preview config ---
export const DATASET_PREVIEW_CONFIG = [
  { key: 'amazon',    label: 'Amazon',    description: 'External purchases on Amazon.com',                               icon: ShoppingBag },
  { key: 'cruzbuy',   label: 'CruzBuy',   description: 'External purchases made through student and employee requests.', icon: Building2   },
  { key: 'onecard',   label: 'OneCard',   description: 'External purchases using the UCSC employee Visa card.',          icon: BarChart3   },
  { key: 'bookstore', label: 'Bookstore', description: 'Campus store sales.',                                            icon: Boxes       },
] as const;

// --- Chart-exclusion helpers ---
const EXCLUDED_CONDENSED_GROUPS = new Set(['gift cards', 'food bulk purchases', 'business services']);

export const shouldExcludeFromCharts = (item: any, datasetKey: string): boolean => {
  if (datasetKey === 'amazon') {
    const name = String(item.clean_item_name || '').trim().toLowerCase();
    const cat  = String(item.row_values?.Category || item.row_values?.category || '').trim().toLowerCase();
    if (name === 'gift cards' || cat === 'gift cards') return true;
  }
  return EXCLUDED_CONDENSED_GROUPS.has(String(item.condensed_group || '').trim().toLowerCase());
};

// --- Schema helpers ---
export const hasSchemaColumn = (schema: DatasetSchema | null, name: string): boolean =>
  Boolean(schema?.columns?.some((c) => c.canonical_name === name && c.available));

export const getAvailablePatternDimensions = (
  schema: DatasetSchema | null,
  datasetKey: string,
): PatternDimension[] => {
  const dims: PatternDimension[] = ['item'];
  if (datasetKey !== 'bookstore' && hasSchemaColumn(schema, 'Merchant Name')) dims.push('merchant');
  if (datasetKey !== 'overall'   && hasSchemaColumn(schema, 'Category'))      dims.push('category');
  return dims;
};

export const patternDimensionLabel = (d: PatternDimension) =>
  d === 'merchant' ? 'Merchants' : d === 'category' ? 'Categories' : 'Items';

export const patternDimensionDescription = (d: PatternDimension) =>
  d === 'merchant' ? 'Compare the external merchants with the highest purchase activity.' :
  d === 'category' ? 'Compare the categories with the highest purchase activity.' :
  'Compare the most frequently purchased items and inspect detailed item-level breakdowns.';

// --- Metric name validation ---
// Returns true when an item's clean_item_name is a real, displayable value.
// Skips rows where BigQuery returns null, empty string, 'Unknown', or a dash
// placeholder so metrics fall through to the next-best entry instead.
export const isValidMetricName = (item: any): boolean => {
  const n = String(item?.clean_item_name ?? '').trim().toLowerCase();
  return n.length > 0 && n !== 'unknown' && n !== '—' && n !== '-';
};

// --- Misc utilities ---
export const availableYearsFromSeries = (points: SpendPoint[]): string[] =>
  Array.from(new Set(points.map((p) => String(p.period).slice(0, 4))))
    .filter((y) => /^\d{4}$/.test(y))
    .sort((a, b) => a.localeCompare(b));

export const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
    .format(Number(amount || 0));
