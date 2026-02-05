import { useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { Chatbot } from './components/Chatbot';
import { LogOut, HelpCircle, RefreshCw } from 'lucide-react';

export default function App() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshMsg(null);

    try {
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
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center border-4"
              style={{ borderColor: '#003c6c', backgroundColor: 'white' }}
            >
              <span className="font-bold text-lg" style={{ color: '#003c6c' }}>
                UCSC
              </span>
            </div>
            <h1 className="text-2xl font-bold" style={{ color: '#003c6c' }}>
              UCSC Purchase Predictions
            </h1>
          </div>

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

            <button
              onClick={() =>
                alert('Logout functionality to be implemented later')
              }
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white transition-all hover:opacity-90"
              style={{ backgroundColor: '#003c6c' }}
            >
              <LogOut size={20} />
              <span>Logout</span>
            </button>
          </div>
        </div>

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
