import { ReactNode, useState, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Dashboard } from './components/Dashboard';
import { Chatbot } from './components/Chatbot';
import { AppHeader } from './components/AppHeader';
import { AuthProvider } from './context/AuthContext';
import { TooltipProvider } from './components/ui/tooltip';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import DatasetExplorer from './pages/DatasetExplorer';
import Reports from './pages/Reports';
import Help from './pages/Help';
import About from './pages/About';

type AuthenticatedLayoutProps = {
  currentView: 'dashboard' | 'dataset-explorer' | 'reports' | 'help' | 'about';
  children: ReactNode;
};

// QueryClient lives outside any component so it is never destroyed on re-renders or
// route navigations. gcTime is set high so cached data survives while the user is
// on another page (Dataset Explorer, Reports) and is still there when they come back.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      // Keep cached data for 1 hour after all observers unmount (default is 5 min).
      gcTime: 60 * 60 * 1000,
    },
  },
});

// ---------------------------------------------------------------------------
// Sequential startup prefetch — runs once when the app first loads.
// Populates the QueryClient cache with the four main datasets in priority order
// (Amazon → Bookstore → CruzBuy → OneCard) so that tabs open instantly even
// after navigating away to Dataset Explorer or Reports and back again.
// ---------------------------------------------------------------------------
const PREFETCH_DATASETS = ['amazon', 'bookstore', 'cruzbuy', 'onecard'] as const;

async function prefetchAllDatasets() {
  const DEFAULT_YEAR    = 'All Time';
  const DEFAULT_QUARTER = 'All Quarters';

  for (const dataset of PREFETCH_DATASETS) {
    // ── top-items (default filter state — matches what Dashboard loads first) ──
    const topItemsParams = new URLSearchParams({
      dataset,
      search_query:     '',
      selected_year:    DEFAULT_YEAR,
      selected_quarter: DEFAULT_QUARTER,
      min_spend:        '0',
      limit:            '20',
      sort_mode:        'frequency',
      high_impact_only: 'false',
    }).toString();

    // ── spend-over-time ──
    const spendParams = new URLSearchParams({
      dataset,
      time_period:      'month',
      selected_year:    DEFAULT_YEAR,
      selected_quarter: DEFAULT_QUARTER,
    }).toString();

    // ── top-patterns (item dimension, default) ──
    const patternParams = new URLSearchParams({
      dataset,
      search_query:     '',
      selected_year:    DEFAULT_YEAR,
      selected_quarter: DEFAULT_QUARTER,
      min_spend:        '0',
      limit:            '5',
      sort_mode:        'frequency',
      group_by:         'item',
    }).toString();

    // Run the three per-dataset queries in parallel, then move to next dataset.
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey:  ['top-items', topItemsParams],
        queryFn:   () => fetch(`/api/analytics/top-items/bigquery?${topItemsParams}`).then((r) => r.json()).then((p) => p.data),
        staleTime: 30 * 60 * 1000,
      }),
      queryClient.prefetchQuery({
        queryKey:  ['spend-series', spendParams],
        queryFn:   () =>
          fetch(`/api/analytics/spend-over-time/bigquery?${spendParams}`)
            .then((r) => r.json())
            .then((p) => ({ combined: p.data?.combined ?? [], datasets: p.data?.datasets ?? {} })),
        staleTime: 30 * 60 * 1000,
      }),
      queryClient.prefetchQuery({
        queryKey:  ['top-patterns', patternParams],
        queryFn:   () => fetch(`/api/analytics/top-items/bigquery?${patternParams}`).then((r) => r.json()).then((p) => p.data),
        staleTime: 30 * 60 * 1000,
      }),
      // Home-tab dataset preview cards (limit=10, no filters)
      queryClient.prefetchQuery({
        queryKey:  ['dataset-preview', dataset],
        queryFn:   () =>
          fetch(`/api/analytics/top-items/bigquery?dataset=${dataset}&limit=10`)
            .then((r) => r.json())
            .then((p) => p.data?.items ?? []),
        staleTime: 30 * 60 * 1000,
      }),
    ]);
  }

  // ── Overall summary (Home tab metrics) ──
  const base = `selected_year=${encodeURIComponent(DEFAULT_YEAR)}&selected_quarter=${encodeURIComponent(DEFAULT_QUARTER)}&dataset=overall`;
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey:  ['overall-merchants', DEFAULT_YEAR, DEFAULT_QUARTER],
      queryFn:   () =>
        fetch(`/api/analytics/top-items/bigquery?${base}&group_by=merchant&sort_mode=cost&limit=100`)
          .then((r) => r.json()).then((p) => p.data?.items ?? []),
      staleTime: 30 * 60 * 1000,
    }),
    queryClient.prefetchQuery({
      queryKey:  ['overall-top-category', DEFAULT_YEAR, DEFAULT_QUARTER],
      queryFn:   () =>
        fetch(`/api/analytics/top-items/bigquery?${base}&group_by=category&sort_mode=cost&limit=10`)
          .then((r) => r.json())
          .then((p) => {
            const items = (p.data?.items ?? []) as any[];
            const valid = items.find((it: any) => {
              const n = String(it?.clean_item_name ?? '').trim().toLowerCase();
              return n.length > 0 && n !== 'unknown' && n !== '—' && n !== '-';
            });
            return valid ?? items[0] ?? null;
          }),
      staleTime: 30 * 60 * 1000,
    }),
    queryClient.prefetchQuery({
      queryKey:  ['overall-spend', DEFAULT_YEAR, DEFAULT_QUARTER],
      queryFn:   () =>
        fetch(`/api/analytics/spend-over-time/bigquery?${base}&time_period=month`)
          .then((r) => r.json()).then((p) => p.data?.combined ?? []),
      staleTime: 30 * 60 * 1000,
    }),
  ]);

  // ── ML insights (Amazon + Bookstore) ──
  const period = '1_quarter';
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey:  ['amazon-insights', period, false],
      queryFn:   () =>
        fetch(`/api/analytics/amazon-insights?time_period=${period}&dev_mode=false`)
          .then((r) => r.json()).then((p) => p.data),
      staleTime: 30 * 60 * 1000,
    }),
    queryClient.prefetchQuery({
      queryKey:  ['bookstore-insights', period, false],
      queryFn:   () =>
        fetch(`/api/analytics/bookstore-insights?time_period=${period}&dev_mode=false`)
          .then((r) => r.json()).then((p) => p.data),
      staleTime: 30 * 60 * 1000,
    }),
  ]);
}

// ---------------------------------------------------------------------------
// AUTHENTICATED LAYOUT
// Wrapper used on every protected page to render the header, main content, and chatbot.
// ---------------------------------------------------------------------------
function AuthenticatedLayout({ currentView, children }: AuthenticatedLayoutProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshMsg(null);

    try {
      const response = await fetch('/api/refresh', {
        method: 'POST',
      });

      const data = await response.json();

      if (data?.changed_files?.length > 0) {
        setRefreshMsg(
          `Updated files:\n${data.changed_files.join('\n')}`
        );
      } else {
        setRefreshMsg(data?.message || 'No changes made to the data.');
      }
    } catch (error) {
      setRefreshMsg('Refresh failed. Is the backend running?');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        currentView={currentView}
        isRefreshing={isRefreshing}
        refreshMsg={refreshMsg}
        onRefresh={handleRefresh}
      />

      <main className="max-w-[1800px] mx-auto w-full min-w-0 px-6 py-6">{children}</main>

      <Chatbot
        isOpen={isChatOpen}
        onToggle={() => setIsChatOpen(!isChatOpen)}
        currentView={currentView}
      />
    </div>
  );
}

function DashboardPage() {
  return (
    <AuthenticatedLayout currentView="dashboard">
      <Dashboard />
    </AuthenticatedLayout>
  );
}

function DatasetExplorerPage() {
  return (
    <AuthenticatedLayout currentView="dataset-explorer">
      <DatasetExplorer />
    </AuthenticatedLayout>
  );
}

function ReportsPage() {
  return (
    <AuthenticatedLayout currentView="reports">
      <Reports />
    </AuthenticatedLayout>
  );
}

function HelpPage() {
  return (
    <AuthenticatedLayout currentView="help">
      <Help />
    </AuthenticatedLayout>
  );
}

function AboutPage() {
  return (
    <AuthenticatedLayout currentView="about">
      <About />
    </AuthenticatedLayout>
  );
}

// ---------------------------------------------------------------------------
// APPLICATION ROOT
// Sets up query caching, authentication, routing, and protected page layout.
// ---------------------------------------------------------------------------
export default function App() {
  // Fire-and-forget: pre-warm the QueryClient cache with all four datasets
  // in priority order as soon as the app mounts.
  useEffect(() => { prefetchAllDatasets(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/dataset-explorer" element={<DatasetExplorerPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/help" element={<HelpPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}