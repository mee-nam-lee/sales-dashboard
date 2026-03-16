import React, { useState } from 'react';
import GroupDashboard from './components/GroupDashboard';
import EntityDashboard from './components/EntityDashboard';
import ChatPopup from './components/ChatPopup';
import { RefreshCw, MessageSquare } from 'lucide-react';
import './App.css';

const TABS = [
  { id: 'group', label: 'LG Group', type: 'group' },
  { id: 'lge', label: 'LGE', type: 'entity', entityName: 'LG전자' },
  { id: 'lgair', label: 'LG AIR', type: 'entity', entityName: 'LG경영개발원AI연구원' },
  { id: 'lguplus', label: 'LG Uplus', type: 'entity', entityName: 'LG유플러스' },
  { id: 'lgcns', label: 'LG CNS', type: 'entity', entityName: 'LGCNS' },
  { id: 'lgensol', label: 'LG 엔솔', type: 'entity', entityName: 'LG에너지솔루션' },
  { id: 'lgchem', label: 'LG 화학', type: 'entity', entityName: 'LG화학' },
  { id: 'lxpantos', label: 'LX 판토스', type: 'entity', entityName: 'LX판토스' },
  { id: 'serveone', label: '서브원', type: 'entity', entityName: '서브원' },
  { id: 'lghh', label: 'LG 생활건강', type: 'entity', entityName: 'LG생활건강' },
];

const App = () => {
  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem('activeTabId');
    return TABS.find(t => t.id === saved) || TABS[0];
  });
  const [isChatOpen, setIsChatOpen] = useState(false);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    localStorage.setItem('activeTabId', tab.id);
  };

  const handleRefresh = async () => {
    try {
      await fetch('/api/cache/clear');
      window.location.reload();
    } catch (err) {
      console.error('Failed to clear cache:', err);
      window.location.reload();
    }
  };

  return (
    <div className="dashboard-container relative">
      <button 
        onClick={handleRefresh}
        className="absolute top-4 right-4 px-3 py-1.5 z-100 flex items-center gap-2 rounded-md shadow-lg transition-all"
        style={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.05)', 
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          color: 'rgba(255, 255, 255, 0.7)', 
          border: '1px solid rgba(255, 255, 255, 0.1)',
          fontSize: '11px',
          fontWeight: '500',
          cursor: 'pointer'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
          e.currentTarget.style.color = 'white';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
          e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
        }}
        title="Clear Cache & Refresh Data"
      >
        <RefreshCw size={12} />
        Refresh All
      </button>

      <header className="header flex justify-between items-center p-6 border-b border-glass shadow-lg">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold tracking-tight">LG Sales Dashboard</h1>
          <p className="text-xs text-muted">Powered by BigQuery</p>
        </div>

        <nav className="flex space-x-1 bg-glass-darker p-1 rounded-xl">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab.id === tab.id
                  ? 'bg-red-700 text-white shadow-md'
                  : 'text-muted hover:bg-glass hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="p-6">
        {activeTab.type === 'group' ? (
          <GroupDashboard />
        ) : (
          <EntityDashboard 
            key={activeTab.id} 
            entityName={activeTab.entityName} 
            displayName={activeTab.label} 
          />
        )}
      </main>

      <button 
        className="chat-button"
        onClick={() => setIsChatOpen(!isChatOpen)}
        title="Chat with AI"
      >
        <MessageSquare size={24} />
      </button>

      {isChatOpen && <ChatPopup onClose={() => setIsChatOpen(false)} />}
    </div>
  );
};

export default App;
