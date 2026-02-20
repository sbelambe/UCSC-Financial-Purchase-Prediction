import { useState, useEffect } from 'react';
import { TabNavigation } from './TabNavigation';
import { FilterBar } from './FilterBar';
import { MetricsGrid } from './MetricsGrid';
import { ChartsGrid } from './ChartsGrid';
import { generateDashboardData } from '../utils/dashboardData';
import { useAuth } from '../context/AuthContext';
import TopItemsChart from './TopItemsChart';
import { TopItemsTable } from './TopItemsTable';
import previewData from '../data/preview_data.json'


const mergePreviewData = (rawPreview: any) => {
  const merged: { [key: string]: any } = {};
  
  // 1. Iterate using Object.entries to get the source name (e.g., 'amazon')
  Object.entries(rawPreview).forEach(([sourceName, dataset]: [string, any]) => {
    if (!Array.isArray(dataset)) return;

    dataset.forEach((item: any) => {
      const name = item.clean_item_name;
      
      if (!merged[name]) {
        merged[name] = { 
          clean_item_name: name, 
          count: 0, 
          total_spent: 0,
          vendors: [], // Initialize empty vendors array
        };
      }
      
      merged[name].count += item.count || 0;
      merged[name].total_spent += item.total_spent || 0;

      // 2. Format the source name (e.g., 'amazon' -> 'Amazon')
      const displaySource = sourceName.charAt(0).toUpperCase() + sourceName.slice(1);
      
      // 3. Only add the vendor if it's not already in the list
      if (!merged[name].vendors.includes(displaySource)) {
        merged[name].vendors.push(displaySource);
      }
    });
  });

  return Object.values(merged).sort((a, b) => b.count - a.count);
};


/**
 * Dashboard Component
 * The main view for authenticated users. Displays financial metrics and charts.
 * * Features:
 * - Tab switching (Overall vs Specific Vendors)
 * - Filtering by Year and Category
 * - Search functionality
 */
export function Dashboard() {
  // get user info
  const {user, signOut} = useAuth();

  // --- State Management ---
  const [activeTab, setActiveTab] = useState<'Overall' | 'OneBuy' | 'ProCard' | 'Amazon' | 'Bookstore'>('Overall');
  const [selectedYear, setSelectedYear] = useState('2024');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPreviewMode, setIsPreviewMode] = useState(true);
  const [topItems, setTopItems] = useState<any[]>([]);
  const [isLoadingTopItems, setIsLoadingTopItems] = useState(true);
  const [showDetails, setShowDetails] = useState(false);


  // --- Data Generation ---
  const data = generateDashboardData(activeTab, selectedYear, selectedCategory);

  // data controller for preview/live data
  useEffect(() => {
    // 1. Reset states so we don't show "ghost" data from the previous mode
    setTopItems([]);
    setIsLoadingTopItems(true);
    setShowDetails(false); // Hide the table when switching for a clean UI

    if (isPreviewMode) {
      console.log("Mode: PREVIEW (Local JSON)");
      // Process the local data immediately
      const merged = mergePreviewData(previewData);
      setTopItems(merged);
      setIsLoadingTopItems(false);
    } else {
      // 2. LIVE DATA PATH
      if (!user) {
        setIsLoadingTopItems(false);
        return;
      }
      
      console.log("Mode: LIVE (Firestore API)");
      fetch(`http://127.0.0.1:8000/api/analytics/top-items?user_id=${user.uid}`)
        .then(async (res) => {
          if (!res.ok) throw new Error("Backend unavailable");
          const response = await res.json();
          setTopItems(response.data || []);
        })
        .catch(err => {
          console.error("Failed to load live analytics:", err);
          // Fallback: If Live fails, automatically toggle back to Preview here
        })
        .finally(() => {
          setIsLoadingTopItems(false);
        });
    }
  }, [user, isPreviewMode]); // Effect re-triggers every time the toggle is flipped

  // Debug log to see exactly what React is holding
  useEffect(() => {
    if (topItems.length > 0) {
      console.log(`Rendering ${topItems.length} items in ${isPreviewMode ? 'Preview' : 'Live'} mode`);
      console.table(topItems.slice(0, 5));
    }
  }, [topItems, isPreviewMode]);

  return (
    <div className="space-y-6">
      {/* TABS */}
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* FILTER BAR */}
      <FilterBar
        selectedYear={selectedYear}
        selectedCategory={selectedCategory}
        searchQuery={searchQuery}
        onYearChange={setSelectedYear}
        onCategoryChange={setSelectedCategory}
        onSearchChange={setSearchQuery}
      />


      {/* --- STAGING / PREVIEW BANNER --- */}
      <div className={`p-4 rounded-xl border flex justify-between items-center transition-all duration-300 ${
        isPreviewMode 
          ? 'bg-amber-50 border-amber-200 shadow-sm' 
          : 'bg-blue-50 border-blue-200 shadow-sm'
      }`}>
        <div className="flex items-center">
          <div className={`p-2 rounded-lg mr-4 ${isPreviewMode ? 'bg-amber-500' : 'bg-blue-600'}`}>
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isPreviewMode ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              )}
            </svg>
          </div>
          <div>
            <p className="text-xs text-gray-600">
              {isPreviewMode 
                ? "Showing preview data" 
                : "Showing live data"}
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsPreviewMode(!isPreviewMode)}
          className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
            isPreviewMode 
              ? 'bg-amber-600 text-white hover:bg-amber-700' 
              : 'bg-white text-blue-700 border border-blue-200 hover:bg-blue-50'
          }`}
        >
          {isPreviewMode ? "Switch to Live Mode" : "View Data Preview"}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 min-h-[400px]">
        <div className="space-y-8">
          <div className="pt-6 border-t border-gray-100">
            <div className={`p-6 rounded-xl border transition-colors ${isPreviewMode ? 'bg-amber-50/30 border-amber-100' : 'bg-gray-50 border-gray-200'}`}>
              
              {isLoadingTopItems ? (
                <div className="flex h-[350px] items-center justify-center text-gray-500">
                  <div className={`animate-spin rounded-full h-8 w-8 border-b-2 mr-3 ${isPreviewMode ? 'border-amber-600' : 'border-blue-900'}`}></div>
                  Syncing data display...
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Visual Top 5 Chart */}
                  <TopItemsChart data={topItems} />

                  {topItems.length > 5 && (
                    <>
                      <div className="flex justify-center pt-2">
                        <button
                          onClick={() => setShowDetails(!showDetails)}
                          className={`px-6 py-2 text-sm font-semibold rounded-full transition-all duration-200 ${
                            isPreviewMode 
                              ? 'text-amber-700 bg-amber-100 hover:bg-amber-200' 
                              : 'text-blue-700 bg-blue-100 hover:bg-blue-200'
                          }`}
                        >
                          {showDetails ? "Hide Detailed Breakdown" : "Show More (Detailed Breakdown)"}
                        </button>
                      </div>

                      {showDetails && (
                        <div className="mt-6 pt-6 border-t border-gray-200 animate-in fade-in slide-in-from-top-4 duration-500">
                          <h3 className="text-lg font-bold text-gray-700 mb-4">Detailed Expenditure Breakdown</h3>
                          <TopItemsTable data={topItems} />
                        </div>
                      )}
                    </>
                  )}
                  {topItems.length === 0 && (
                    <div className="h-[200px] flex items-center justify-center text-gray-400 italic">
                      No matching purchase data found for this selection.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

}
