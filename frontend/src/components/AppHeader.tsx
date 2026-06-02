import { ChartPie, FileText, HelpCircle, Info, LogOut, RefreshCw, TableProperties } from 'lucide-react'
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// -----------------------------------------------------------------------------
// COMPONENT TYPES
// -----------------------------------------------------------------------------
type AppHeaderProps = {
  currentView: 'dashboard' | 'dataset-explorer' | 'reports' | 'help' | 'about';
  isRefreshing: boolean;
  refreshMsg: string | null;
  onRefresh: () => Promise<void>;
};

export function AppHeader({ currentView, isRefreshing, refreshMsg, onRefresh }: AppHeaderProps) {
  // ---------------------------------------------------------------------------
  // HOOKS & CONTEXT
  // ---------------------------------------------------------------------------
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  // ---------------------------------------------------------------------------
  // BUTTON STYLING
  // ---------------------------------------------------------------------------
  const navButtonClass =
    'flex items-center gap-2 rounded-lg border-2 px-5 py-2.5 text-sm font-semibold transition-all hover:shadow-md';

  const navButtonStyle = (isActive = false) =>
    isActive
      ? { borderColor: '#2d66ae', backgroundColor: '#2d66ae', color: '#ffffff' }
      : { borderColor: '#2d66ae', backgroundColor: '#ffffff', color: '#003c6c' };

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  return (
    <header className="border-b border-[#2d66ae]/50 bg-[#003c6c] shadow-sm">
      <div className="mx-auto flex max-w-[1800px] flex-col items-start gap-4 px-6 py-4">

        {/* ----------------------------------------------------------------- */}
        {/* LOGO, TITLE, & USER INFO */}
        {/* ----------------------------------------------------------------- */}
        <div className="flex min-w-0 items-center gap-4">
          <img
            src="/slugsmart.png"
            alt="SlugSmart logo"
            className="h-20 w-20 shrink-0 rounded-full object-contain"
          />
          {/* Title */}
          <div className="flex flex-col">
            <h1 className="text-4xl font-bold leading-none text-white">
              SlugSmart
            </h1>

            {/* Subtitle */}
            <p className="mt-1 text-m font-semibold leading-tight text-[#2a85de]">
              Turning UCSC Transaction Data Into Smarter Stocking Decisions
            </p>

            {/* Logged in as... */}
            <span className="mt-1 text-xs font-normal text-white">
              Logged in as: {user?.email}
            </span>
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* BUTTONS */}
        {/* ----------------------------------------------------------------- */}
        <div className="flex flex-wrap items-center justify-start gap-3">

          {/* Dashboard */}
          <button
            onClick={() => navigate('/dashboard')}
            className={navButtonClass}
            style={navButtonStyle(currentView === 'dashboard')}
          >
            <ChartPie size={18} />
            <span>Dashboard</span>
          </button>

          {/* Dataset Explorer */}
          <button
            onClick={() => navigate('/dataset-explorer')}
            className={navButtonClass}
            style={navButtonStyle(currentView === 'dataset-explorer')}
          >
            <TableProperties size={18} />
            <span>Dataset Explorer</span>
          </button>

          {/* Reports */}
          <button
            onClick={() => navigate('/reports')}
            className={navButtonClass}
            style={navButtonStyle(currentView === 'reports')}
          >
            <FileText size={18} />
            <span>Reports</span>
          </button>

          {/* Refresh Data */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className={`${navButtonClass} disabled:opacity-60`}
            style={navButtonStyle(false)}
          >
            <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh Data'}</span>
          </button>

          {/* Help */}
          <button
            onClick={() => navigate('/help')}
            className={navButtonClass}
            style={navButtonStyle(currentView === 'help')}
          >
            <HelpCircle size={20} />
            <span>Help</span>
          </button>

          {/* About */}
          <button
            onClick={() => navigate('/about')}
            className={navButtonClass}
            style={navButtonStyle(currentView === 'about')}
          >
            <Info size={20} />
            <span>About</span>
          </button>

          {/* Logout */}
          <button
            onClick={signOut}
            className="flex items-center gap-2 rounded-lg border-2 border-[#2d66ae] bg-[#2d66ae] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-md"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* REFRESH STATUS MESSAGE */}
      {/* --------------------------------------------------------------------- */}
      {refreshMsg && (
        <div
          className="mx-auto max-w-[1800px] px-6 pb-3 text-sm text-white"
        >
          {refreshMsg}
        </div>
      )}
    </header>
  );
}