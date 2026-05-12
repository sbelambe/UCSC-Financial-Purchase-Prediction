import { ReactNode, useState } from 'react';
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

type AuthenticatedLayoutProps = {
  currentView: 'dashboard' | 'dataset-explorer';
  children: ReactNode;
};

// so the cache isn't destroyed on re-renders
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Prevents spamming the backend if the user switches tabs frequently
      refetchOnWindowFocus: false, 
      // Safe fallback: if a network request fails, try one more time before showing an error
      retry: 1, 
    },
  },
});

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

export default function App() {
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
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}