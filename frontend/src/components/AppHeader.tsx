import { HelpCircle, LogOut, RefreshCw, TableProperties } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

type AppHeaderProps = {
  currentView: 'dashboard' | 'dataset-explorer';
  isRefreshing: boolean;
  refreshMsg: string | null;
  onRefresh: () => Promise<void>;
};

export function AppHeader({ currentView, isRefreshing, refreshMsg, onRefresh }: AppHeaderProps) {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  const navButtonClass =
    'flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all hover:bg-gray-50';

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-[1800px] mx-auto px-6 py-4 flex flex-col gap-4 xl:flex-row xl:justify-between xl:items-center">
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

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className={navButtonClass}
            style={
              currentView === 'dashboard'
                ? { borderColor: '#003c6c', backgroundColor: '#003c6c', color: 'white' }
                : { borderColor: '#003c6c', color: '#003c6c' }
            }
          >
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => navigate('/dataset-explorer')}
            className={navButtonClass}
            style={
              currentView === 'dataset-explorer'
                ? { borderColor: '#003c6c', backgroundColor: '#003c6c', color: 'white' }
                : { borderColor: '#003c6c', color: '#003c6c' }
            }
          >
            <TableProperties size={18} />
            <span>Dataset Explorer</span>
          </button>

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all hover:bg-gray-50 disabled:opacity-60"
            style={{ borderColor: '#003c6c', color: '#003c6c' }}
          >
            <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh Data'}</span>
          </button>

          <button
            onClick={() => alert('Help information will be displayed here')}
            className={navButtonClass}
            style={{ borderColor: '#003c6c', color: '#003c6c' }}
          >
            <HelpCircle size={20} />
            <span>Help</span>
          </button>

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

      {refreshMsg && (
        <div
          className="max-w-[1800px] mx-auto px-6 pb-3 text-sm"
          style={{ color: '#003c6c' }}
        >
          {refreshMsg}
        </div>
      )}
    </header>
  );
}
