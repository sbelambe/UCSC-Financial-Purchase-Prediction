import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard } from './components/Dashboard';
import { Chatbot } from './components/Chatbot';
import { LogOut, HelpCircle, RefreshCw } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';

/**
 * DashboardLayout Component
 * Wraps the Dashboard with the common Header, Refresh Logic, and Chatbot.
 * This ensures these elements are only visible when the user is logged in.
 */
function DashboardLayout() {
  const { signOut, user } = useAuth(); // Get signOut function and user info
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);

  /**
   * Triggers the backend pipeline to refresh data from Google Sheets/CSV.
   */
  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshMsg(null);

    try {
      // calls fastAPI endpoint
      const res = await fetch('http://127.0.0.1:8000/refresh', {
        method: 'POST',
      });

      const data = await res.json();

      if (data?.result) {
        setRefreshMsg(
          `Refreshed successfully. Amazon rows: ${data.result.amazon_rows}, CruzBuy rows: ${data.result.cruzbuy_rows}, ProCard rows: ${data.result.pcard_rows}`
        );
      } else {
        setRefreshMsg('Refresh completed');
      }
    } catch (err) {
      setRefreshMsg('Refresh failed. Is the backend running?');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-[1800px] mx-auto px-6 py-4 flex justify-between items-center">
          {/* Logo & Title */}
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center border-4"
              style={{ borderColor: '#003c6c', backgroundColor: 'white' }}
            >
              <span className="font-bold text-lg" style={{ color: '#003c6c' }}>
                UCSC
              </span>
            </div>
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold" style={{ color: '#003c6c' }}>
                UCSC Purchase Predictions
              </h1>
              <span className="text-xs text-gray-500">Logged in as: {user?.email}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all hover:bg-gray-50 disabled:opacity-60"
              style={{ borderColor: '#003c6c', color: '#003c6c' }}
            >
              <RefreshCw size={20} />
              <span>{isRefreshing ? 'Refreshing…' : 'Refresh Data'}</span>
            </button>

            <button
              onClick={() => alert('Help information will be displayed here')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all hover:bg-gray-50"
              style={{ borderColor: '#003c6c', color: '#003c6c' }}
            >
              <HelpCircle size={20} />
              <span>Help</span>
            </button>

            {/* logout button */}
            <button
              onClick={signOut}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white transition-all hover:opacity-90"
              style={{ backgroundColor: '#003c6c' }}
            >
              <LogOut size={20} />
              <span>Logout</span>
            </button>

          </div>
        </div>

        {/* Status Message (Refresh Results) */}
        {refreshMsg && (
          <div
            className="max-w-[1800px] mx-auto px-6 pb-3 text-sm"
            style={{ color: '#003c6c' }}
          >
            {refreshMsg}
          </div>
        )}
      </header>

      {/* Main Dashboard */}
      <main className="max-w-[1800px] mx-auto px-6 py-6">
        <Dashboard />
      </main>

      {/* Chatbot */}
      <Chatbot
        isOpen={isChatOpen}
        onToggle={() => setIsChatOpen(!isChatOpen)}
      />
    </div>
  );
}

/**
 * Main App Component
 * Handles the Routing and Authentication Provider wrapping.
 */
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<Login />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardLayout />} />
            {/* Default redirect to dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}