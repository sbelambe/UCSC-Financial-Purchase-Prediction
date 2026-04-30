import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import { cn } from '../components/ui/utils';

type DatasetKey = 'amazon' | 'onecard' | 'cruzbuy' | 'bookstore';
type SearchField = 'all' | 'item' | 'merchant' | 'category';
type SortDirection = 'asc' | 'desc';

type DatasetSchemaColumn = {
  canonical_name: string;
  available: boolean;
  display_in_table?: boolean;
  source_name?: string | null;
  cleaned_name?: string | null;
};

type DatasetExplorerResponse = {
  dataset: DatasetKey;
  label: string;
  columns: string[];
  rows: Array<Record<string, string | number | null>>;
  page: number;
  page_size: number;
  total_rows: number;
  total_pages: number;
  sort_by: string;
  sort_dir: SortDirection;
  available_filters: {
    merchants: string[];
    categories: string[];
  };
  schema: {
    metric_type: 'currency' | 'quantity' | 'mixed';
    columns: DatasetSchemaColumn[];
  };
};

const DATASET_OPTIONS: { key: DatasetKey; label: string }[] = [
  { key: 'amazon', label: 'Amazon' },
  { key: 'onecard', label: 'OneCard' },
  { key: 'cruzbuy', label: 'CruzBuy' },
  { key: 'bookstore', label: 'Bookstore' },
];

const SEARCH_OPTIONS: { value: SearchField; label: string }[] = [
  { value: 'all', label: 'All columns' },
  { value: 'item', label: 'Item name/details' },
  { value: 'merchant', label: 'Merchant' },
  { value: 'category', label: 'Category' },
];

function formatCellValue(column: string, value: string | number | null) {
  if (value === null || value === '') return '-';

  if (typeof value === 'number') {
    if (column === 'Quantity') {
      return value.toLocaleString();
    }

    if (/(Subtotal|Sales Tax|Total Price)/.test(column)) {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
    }
  }

  return String(value);
}

export default function DatasetExplorer() {
  const [activeDataset, setActiveDataset] = useState<DatasetKey>('amazon');
  const [search, setSearch] = useState('');
  const [searchField, setSearchField] = useState<SearchField>('all');
  const [merchantFilter, setMerchantFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState('Transaction Date');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [data, setData] = useState<DatasetExplorerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams({
        dataset: activeDataset,
        page: String(page),
        page_size: String(pageSize),
        search,
        search_field: searchField,
        merchant: merchantFilter === 'all' ? '' : merchantFilter,
        category: categoryFilter === 'all' ? '' : categoryFilter,
        start_date: startDate,
        end_date: endDate,
        sort_by: sortBy,
        sort_dir: sortDir,
      });

      setLoading(true);
      setError(null);

      fetch(`http://127.0.0.1:8000/api/dataset-explorer?${params.toString()}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok) {
            throw new Error(payload?.detail || 'Failed to load dataset.');
          }
          return payload.data as DatasetExplorerResponse;
        })
        .then((payload) => {
          setData(payload);
          setSortBy(payload.sort_by);
          setSortDir(payload.sort_dir);
        })
        .catch((fetchError) => {
          if ((fetchError as Error).name === 'AbortError') return;
          setError(fetchError instanceof Error ? fetchError.message : 'Failed to load dataset.');
          setData(null);
        })
        .finally(() => {
          setLoading(false);
        });
    }, 200);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [activeDataset, page, pageSize, search, searchField, merchantFilter, categoryFilter, startDate, endDate, sortBy, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [activeDataset, search, searchField, merchantFilter, categoryFilter, startDate, endDate, pageSize]);

  const columns = data?.columns || [];

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortBy(column);
    setSortDir(column === 'Transaction Date' ? 'desc' : 'asc');
  };

  const clearFilters = () => {
    setSearch('');
    setSearchField('all');
    setMerchantFilter('all');
    setCategoryFilter('all');
    setStartDate('');
    setEndDate('');
    setPage(1);
    setSortBy('Transaction Date');
    setSortDir('desc');
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-slate-900">Dataset Explorer</h2>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
                      aria-label="Dataset Explorer info"
                    >
                      <Info size={16} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent sideOffset={8}>
                    Browse cleaned purchasing datasets with search, filters, sorting, and pagination.
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-sm text-slate-500">
                A cleaner, faster way to inspect the latest processed CSV data without leaving the app.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {DATASET_OPTIONS.map((dataset) => (
                <button
                  key={dataset.key}
                  onClick={() => setActiveDataset(dataset.key)}
                  className={cn(
                    'rounded-lg border px-4 py-2 text-sm font-semibold transition-all',
                    activeDataset === dataset.key
                      ? 'border-transparent text-white shadow-sm'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  )}
                  style={activeDataset === dataset.key ? { backgroundColor: '#003c6c' } : undefined}
                >
                  {dataset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
            <div className="xl:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Search
              </label>
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search items, merchants, categories..."
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Search Scope
              </label>
              <Select value={searchField} onValueChange={(value) => setSearchField(value as SearchField)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEARCH_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Merchant
              </label>
              <Select value={merchantFilter} onValueChange={setMerchantFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All merchants" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All merchants</SelectItem>
                  {(data?.available_filters.merchants || []).map((merchant) => (
                    <SelectItem key={merchant} value={merchant}>
                      {merchant}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Category
              </label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {(data?.available_filters.categories || []).map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Start Date
              </label>
              <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                End Date
              </label>
              <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-200 px-6 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {data?.label || DATASET_OPTIONS.find((dataset) => dataset.key === activeDataset)?.label} Cleaned Dataset
            </h3>
            <p className="text-sm text-slate-500">
              {data ? `${data.total_rows.toLocaleString()} rows available` : 'Loading the latest cleaned data'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-28">
              <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25 rows</SelectItem>
                  <SelectItem value="50">50 rows</SelectItem>
                  <SelectItem value="100">100 rows</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error}
          </div>
        )}

        <div className="p-6">
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  {columns.map((column) => {
                    const isActiveSort = sortBy === column;

                    return (
                      <TableHead key={column} className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleSort(column)}
                          className="flex items-center gap-2 font-semibold text-slate-700 transition-colors hover:text-slate-900"
                        >
                          <span>{column}</span>
                          {isActiveSort ? (
                            sortDir === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                          ) : null}
                        </button>
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={Math.max(columns.length, 1)} className="px-4 py-10 text-center text-slate-500">
                      Loading dataset...
                    </TableCell>
                  </TableRow>
                ) : data?.rows.length ? (
                  data.rows.map((row, index) => (
                    <TableRow key={`${data.dataset}-${index}`}>
                      {columns.map((column) => (
                        <TableCell key={column} className="max-w-[280px] px-4 py-3 text-slate-700">
                          <span className="block truncate" title={formatCellValue(column, row[column])}>
                            {formatCellValue(column, row[column])}
                          </span>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={Math.max(columns.length, 1)} className="px-4 py-10 text-center text-slate-500">
                      No rows matched the current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-slate-500">
              {data
                ? `Page ${data.page} of ${data.total_pages} | Showing ${data.rows.length.toLocaleString()} rows`
                : 'Preparing table'}
            </p>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
                disabled={!data || data.page <= 1 || loading}
              >
                <ChevronLeft size={16} />
                Previous
              </Button>
              <Button
                variant="outline"
                onClick={() => setPage((current) => (data ? Math.min(current + 1, data.total_pages) : current))}
                disabled={!data || data.page >= data.total_pages || loading}
              >
                Next
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
