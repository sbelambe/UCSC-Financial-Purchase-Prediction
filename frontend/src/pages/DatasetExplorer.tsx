import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, CalendarDays, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
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
import { cn } from '../components/ui/utils';

type DatasetKey = 'amazon' | 'onecard' | 'cruzbuy' | 'bookstore';
type SearchField = 'all' | 'item' | 'merchant' | 'category';
type SortDirection = 'asc' | 'desc';
type ExportFormat = 'csv' | 'xlsx' | 'json';

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
  const [isExporting, setIsExporting] = useState(false);
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

      fetch(`/api/dataset-explorer?${params.toString()}`, {
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

  const buildExplorerParams = () =>
    new URLSearchParams({
      dataset: activeDataset,
      search,
      search_field: searchField,
      merchant: merchantFilter === 'all' ? '' : merchantFilter,
      category: categoryFilter === 'all' ? '' : categoryFilter,
      start_date: startDate,
      end_date: endDate,
      sort_by: sortBy,
      sort_dir: sortDir,
    });

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

  const handleExport = async (format: ExportFormat) => {
    try {
      setIsExporting(true);
      setError(null);

      const params = buildExplorerParams();
      params.set('format', format);

      const response = await fetch(`/api/dataset-explorer/export?${params.toString()}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || 'Failed to export dataset.');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().slice(0, 10);

      link.href = downloadUrl;
      link.download = `${activeDataset}-dataset-${timestamp}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Failed to export dataset.');
    } finally {
      setIsExporting(false);
    }
  };
  
  return (
    <div className="w-full min-w-0 space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6">
          <div className="text-left">
            <h2 className="text-3xl font-bold text-[#003c6c]">Dataset Explorer</h2>
            <p className="mt-2 text-sm leading-6 text-slate-950">
              Welcome to the Dataset Explorer! This is a built-in CSV viewer that allows users to inspect,
              manipulate, and export the cleaned purchase and/or sales datasets. Use the buttons below to
              switch between datasets, search for attributes within a chosen scope, and filter for specific
              merchants, categories, or date ranges.
            </p>
          </div>

          <div>
            <h3 className="mb-4 text-lg font-semibold text-[#003c6c]">Cleaned Datasets</h3>
            <div className="flex flex-wrap items-center gap-3">
              {DATASET_OPTIONS.map((dataset) => (
                <button
                  key={dataset.key}
                  onClick={() => setActiveDataset(dataset.key)}
                  className={cn(
                    'rounded-lg border px-5 py-2.5 text-sm font-semibold transition-all',
                    activeDataset === dataset.key
                      ? 'border-[#003c6c] text-white shadow-sm'
                      : 'border-slate-200 bg-white text-[#003c6c] hover:bg-slate-50'
                  )}
                  style={activeDataset === dataset.key ? { backgroundColor: '#003c6c' } : undefined}
                >
                  {dataset.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-lg font-semibold text-[#003c6c]">Search and Filter Tools</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-[#2d66ae]">
                Search
              </label>
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search items, merchants, categories..."
                className="border-slate-200 bg-slate-50 text-sm font-medium text-slate-950 focus-visible:ring-[#2d66ae]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-[#2d66ae]">
                Search Scope
              </label>
              <Select value={searchField} onValueChange={(value) => setSearchField(value as SearchField)}>
                <SelectTrigger className="border-slate-200 bg-slate-50 text-sm text-slate-950">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-80 overflow-y-auto">
                  {SEARCH_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-[#2d66ae]">
                Merchant
              </label>
              <Select value={merchantFilter} onValueChange={setMerchantFilter}>
                <SelectTrigger className="border-slate-200 bg-slate-50 text-sm text-slate-950">
                  <SelectValue placeholder="All merchants" />
                </SelectTrigger>
                <SelectContent className="max-h-80 overflow-y-auto">
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
              <label className="mb-1 block text-xs font-semibold uppercase text-[#2d66ae]">
                Category
              </label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="border-slate-200 bg-slate-50 text-sm text-slate-950">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent className="max-h-80 overflow-y-auto">
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
              <label className="mb-1 block text-xs font-semibold uppercase text-[#2d66ae]">
                Start Date
              </label>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#003c6c]" />
                <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="border-slate-200 bg-slate-50 pl-9 text-sm text-slate-950 focus-visible:ring-[#2d66ae]" />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-[#2d66ae]">
                End Date
              </label>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#003c6c]" />
                <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="border-slate-200 bg-slate-50 pl-9 text-sm text-slate-950 focus-visible:ring-[#2d66ae]" />
              </div>
            </div>
          </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-5 border-b border-slate-200 px-6 py-5">
          <div className="text-left">
            <h3 className="text-xl font-bold text-[#003c6c]">
              Cleaned {data?.label || DATASET_OPTIONS.find((dataset) => dataset.key === activeDataset)?.label} Dataset
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-950">
              Use the buttons below to change the number of visible rows per page, clear any current filters, or export
              the current dataset view (CSV, XLSX, or JSON). Press the arrow next to a column name to sort the dataset
              by that column (ascending or descending).
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {data ? `${data.total_rows.toLocaleString()} rows available` : 'Loading the latest cleaned data'}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-start gap-3">
            <div className="w-28">
              <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
                <SelectTrigger className="border-slate-200 bg-slate-50 text-sm text-slate-950">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25 rows</SelectItem>
                  <SelectItem value="50">50 rows</SelectItem>
                  <SelectItem value="100">100 rows</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              onClick={clearFilters}
              className="border-slate-200 bg-white text-sm text-slate-950 hover:bg-slate-50"
            >
              Clear Filters
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  disabled={loading || isExporting}
                  className="border-[#2d66ae] bg-[#2d66ae] text-sm font-semibold text-white hover:bg-[#003c6c]"
                >
                  <Download size={16} />
                  {isExporting ? 'Exporting...' : 'Export As...'}
                                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40">
                <DropdownMenuItem onSelect={() => void handleExport('csv')} className="text-sm font-semibold text-[#003c6c]">
                  CSV
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void handleExport('xlsx')} className="text-sm font-semibold text-[#003c6c]">
                  XLSX
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void handleExport('json')} className="text-sm font-semibold text-[#003c6c]">
                  JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error}
          </div>
        )}

        <div className="p-6">
          <div className="overflow-auto rounded-xl border border-slate-200">
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
                          className="flex items-center gap-2 text-xs font-semibold uppercase text-[#2d66ae] transition-colors hover:text-[#003c6c]"
                        >
                          <span>{column}</span>
                          {isActiveSort ? (
                            sortDir === 'asc' ? <ArrowUp size={14} className="text-[#003c6c]" /> : <ArrowDown size={14} className="text-[#003c6c]" />
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
                        <TableCell key={column} className="max-w-[280px] px-4 py-3 text-slate-950">
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
                className="border-[#2d66ae] bg-[#2d66ae] text-sm font-semibold text-white hover:bg-slate-50"
              >
                <ChevronLeft size={16} />
                Previous
              </Button>
              <Button
                variant="outline"
                onClick={() => setPage((current) => (data ? Math.min(current + 1, data.total_pages) : current))}
                disabled={!data || data.page >= data.total_pages || loading}
                className="border-[#2d66ae] bg-[#2d66ae] text-sm font-semibold text-white hover:bg-slate-50"
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