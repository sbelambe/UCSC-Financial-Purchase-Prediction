// Component for tabbed navigation between the overview and dataset drilldowns.
interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tab: 'Home' | 'Overall' | 'CruzBuy' | 'OneCard' | 'Amazon' | 'Bookstore') => void;
}

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
    const tabs = ['Home', 'Amazon', 'Bookstore', 'CruzBuy', 'OneCard'];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-1 flex flex-wrap gap-1">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onTabChange(tab as any)}
          className={`min-w-[120px] flex-1 px-6 py-3 rounded-lg font-medium transition-all ${
            activeTab === tab
              ? 'text-white shadow-sm'
              : 'text-[#003c6c] font-semibold hover:bg-gray-100'
          }`}
          style={activeTab === tab ? { backgroundColor: '#003c6c' } : {}}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}