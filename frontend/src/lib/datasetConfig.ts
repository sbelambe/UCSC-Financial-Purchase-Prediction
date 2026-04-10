export type DatasetSchemaColumn = {
  canonical_name: string;
  available: boolean;
  display_in_table?: boolean;
  source_name?: string | null;
  cleaned_name?: string | null;
  available_in?: string[];
  common_to_all?: boolean;
};

export type DatasetSchema = {
  dataset: string;
  label: string;
  metric_type: 'currency' | 'quantity' | 'mixed';
  metric_label: string;
  group_label: string;
  columns: DatasetSchemaColumn[];
};

export const FALLBACK_DATASET_SCHEMAS: Record<string, DatasetSchema> = {
  overall: {
    dataset: 'overall',
    label: 'Overall',
    metric_type: 'mixed',
    metric_label: 'Total Metric',
    group_label: 'Source Group',
    columns: [],
  },
  amazon: {
    dataset: 'amazon',
    label: 'Amazon',
    metric_type: 'currency',
    metric_label: 'Total Spend',
    group_label: 'Merchant Name',
    columns: [],
  },
  cruzbuy: {
    dataset: 'cruzbuy',
    label: 'CruzBuy',
    metric_type: 'currency',
    metric_label: 'Total Spend',
    group_label: 'Merchant Name',
    columns: [],
  },
  onecard: {
    dataset: 'onecard',
    label: 'OneCard',
    metric_type: 'currency',
    metric_label: 'Total Spend',
    group_label: 'Merchant Name',
    columns: [],
  },
  bookstore: {
    dataset: 'bookstore',
    label: 'Bookstore',
    metric_type: 'quantity',
    metric_label: 'Total Quantity',
    group_label: 'Category',
    columns: [],
  },
};
