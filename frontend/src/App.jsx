import React, { useState, useEffect } from 'react';
import GroupDashboard from './components/GroupDashboard';
import EntityDashboard from './components/EntityDashboard';
import ChatPopup from './components/ChatPopup';
import { RefreshCw, MessageSquare, Loader2 } from 'lucide-react';
import './App.css';

const App = () => {
  const [tabs, setTabs] = useState([]);
  const [baselines, setBaselines] = useState({});
  const [activeTab, setActiveTab] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/config');
        if (!response.ok) throw new Error('Failed to fetch config');
        const data = await response.json();
        
        setTabs(data.tabs || []);
        setBaselines(data.baselines || {});
        
        // Handle initial active tab
        const savedId = localStorage.getItem('activeTabId');
        const initialTab = (data.tabs && data.tabs.find(t => t.id === savedId)) || (data.tabs && data.tabs[0]);
        setActiveTab(initialTab);
      } catch (err) {
        console.error('Failed to load dashboard configuration:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-glass-darker">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-red-700" size={48} />
          <p className="text-muted font-medium text-lg">Initializing Dashboard...</p>
        </div>
      </div>
    );
  }

  if (!tabs || tabs.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-glass-darker">
        <p className="text-danger font-bold text-xl">Configuration Error: No tabs found.</p>
      </div>
    );
  }

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
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab?.id === tab.id
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
        {activeTab?.type === 'group' ? (
          <GroupDashboard baselines={baselines} />
        ) : (
          <EntityDashboard 
            key={activeTab?.id} 
            entityName={activeTab?.entityName} 
            displayName={activeTab?.label} 
            baselines={baselines}
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
