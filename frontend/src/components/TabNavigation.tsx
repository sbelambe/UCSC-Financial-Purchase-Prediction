interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tab: 'Overall' | 'OneCard' | 'ProCard' | 'Amazon' | 'Bookstore') => void;
}

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  const tabs = ['Overall', 'OneCard', 'ProCard', 'Amazon', 'Bookstore'];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-1 flex gap-1">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onTabChange(tab as any)}
          className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all ${
            activeTab === tab
              ? 'text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          style={activeTab === tab ? { backgroundColor: '#003c6c' } : {}}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
