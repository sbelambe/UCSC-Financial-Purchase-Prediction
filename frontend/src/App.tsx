import { ReactNode, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Dashboard } from './components/Dashboard';
import { Chatbot } from './components/Chatbot';
import { AppHeader } from './components/AppHeader';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import DatasetExplorer from './pages/DatasetExplorer';

type AuthenticatedLayoutProps = {
  currentView: 'dashboard' | 'dataset-explorer';
  children: ReactNode;
};

function AuthenticatedLayout({ currentView, children }: AuthenticatedLayoutProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshMsg(null);

    try {
      const response = await fetch('http://127.0.0.1:8000/refresh', {
        method: 'POST',
      });

      const data = await response.json();

      if (data?.result) {
        setRefreshMsg(
          `Refreshed successfully. Amazon rows: ${data.result.amazon_rows}, CruzBuy rows: ${data.result.cruzbuy_rows}, OneCard rows: ${data.result.onecard_rows}, Bookstore rows: ${data.result.bookstore_rows}`
        );
      } else {
        setRefreshMsg(data?.message || 'Refresh completed');
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

      <Chatbot isOpen={isChatOpen} onToggle={() => setIsChatOpen(!isChatOpen)} />
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
    <AuthProvider>
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
    </AuthProvider>
  );
}
