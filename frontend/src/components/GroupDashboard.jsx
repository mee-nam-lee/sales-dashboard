import React, { useState, useEffect } from 'react';
import Scorecard from './Scorecard';
import RevenueChart from './RevenueChart';
import { AlertCircle } from 'lucide-react';

const GroupDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/revenue/group?t=${Date.now()}`);
        if (!response.ok) throw new Error('Failed to fetch group data');
        const json = await response.json();
        if (json.error) {
          setError(json.error);
        } else {
          setData(json);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [refreshKey]);

  if (loading) return <div className="loading-container"><div className="spinner"></div><p>Loading LG Group Insights...</p></div>;
  if (error) return <div className="chart-card error-box"><AlertCircle size={40} /><p>{error}</p></div>;
  if (!data) return null;

  return (
    <div className="tab-content transition-all duration-300">
      <div className="scorecards-grid">
        <Scorecard label="LG Group ARR (2025)" value={63.3} subValue="Baseline" />
        <Scorecard label="LG Group ARR (2026)" value={data.arr2026 / 1000000} />
      </div>

      <div className="charts-grid">
        <RevenueChart 
          title="LG Group MRR by Entity" 
          data={data.entityChart.chartData} 
          dataKeys={data.entityChart.keys} 
        />
        {data.sbaChart.keys.length > 0 && (
          <RevenueChart 
            title="LG Group MRR (CNS SBA vs others)" 
            data={data.sbaChart.chartData} 
            dataKeys={data.sbaChart.keys} 
            height={230}
          />
        )}
      </div>
    </div>
  );
};

export default GroupDashboard;
