import React, { useState, useEffect } from 'react';
import Scorecard from './Scorecard';
import RevenueChart from './RevenueChart';
import { AlertCircle } from 'lucide-react';

const BASELINES = {
  'LG전자': 9.0,
  'LG유플러스': 9.8,
  'LG에너지솔루션': 4.5,
  'LG화학': 0.1,
  'LGCNS': 6.7,
  'LG경영개발원AI연구원': 28.8,
  'LX판토스': 3.6,
  '서브원': 0.0,
  'LG생활건강': 0.0
};

const formatK = (val) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(val / 1000);
};

const EntityDashboard = ({ entityName, displayName }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/revenue/entity?name=${encodeURIComponent(entityName)}&t=${Date.now()}`);
        if (!response.ok) throw new Error('Failed to fetch entity data');
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
  }, [entityName, refreshKey]);

  if (loading) return <div className="loading-container"><div className="spinner"></div><p>Loading {displayName} Insights...</p></div>;
  if (error) return <div className="chart-card error-box p-6 flex flex-col items-center"><AlertCircle size={40} className="text-danger mb-4" /><p className="font-bold">Error loading {displayName}</p><p className="text-sm text-muted">{error}</p><button onClick={() => setRefreshKey(k => k + 1)} className="run-btn mt-6">Retry</button></div>;
  if (!data) return null;

  const baseline = BASELINES[entityName] || 0.0;

  return (
    <div className="tab-content transition-all duration-300">
      <div className="scorecards-grid">
        <Scorecard label="LG Group ARR (2025)" value={63.3} subValue="Baseline" />
        <Scorecard label={`${displayName} ARR (2025)`} value={baseline} subValue="Baseline" />
        <Scorecard label="LG Group ARR (2026)" value={(data?.groupArr2026 || 0) / 1000000} />
        <Scorecard label={`${displayName} ARR (2026)`} value={(data.arr2026 || 0) / 1000000} />
      </div>

      <div className="charts-grid">
        <div className="flex flex-col gap-6">
          <RevenueChart
            title={`${displayName} MRR by Sub-Account`}
            data={data.subChart.chartData}
            dataKeys={data.subChart.keys}
          />
          <RevenueChart
            title={`${displayName} MRR by Product`}
            data={data.serviceChart.chartData}
            dataKeys={data.serviceChart.keys}
            unit="K"
          />
          {data.aiChart.keys.length > 0 && (
            <RevenueChart
              title={`${displayName} AI MRR (GCP AI)`}
              data={data.aiChart.chartData}
              dataKeys={data.aiChart.keys}
              unit="K"
            />
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div className="chart-card">
            <h3 className="chart-title">Top 10 Growth (Last 3 Months)</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Project ID</th>
                  <th>Customer</th>
                  <th className="text-right nowrap">Prev (3M)</th>
                  <th className="text-right nowrap">Recent (3M)</th>
                  <th className="text-right nowrap">Incr</th>
                </tr>
              </thead>
              <tbody>
                {data.growth3m.map(p => (
                  <tr key={p.project_id}>
                    <td><div className="text-xs font-semibold">{p.project_id}</div></td>
                    <td><div className="text-xs text-muted truncate" style={{ maxWidth: '120px' }}>{p.customer_name_2}</div></td>
                    <td className="text-right text-xs">${formatK(p.prev)}K</td>
                    <td className="text-right font-bold text-xs">${formatK(p.recent)}K</td>
                    <td className="text-right growth-positive text-xs font-bold">+${formatK(p.increase)}K</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="chart-card">
            <h3 className="chart-title">Top 10 Growth (Last 2 Months)</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Project ID</th>
                  <th>Customer</th>
                  <th className="text-right nowrap">Prev (2M)</th>
                  <th className="text-right nowrap">Recent (2M)</th>
                  <th className="text-right nowrap">Incr</th>
                </tr>
              </thead>
              <tbody>
                {data.growth2m.map(p => (
                  <tr key={p.project_id}>
                    <td><div className="text-xs font-semibold">{p.project_id}</div></td>
                    <td><div className="text-xs text-muted truncate" style={{ maxWidth: '120px' }}>{p.customer_name_2}</div></td>
                    <td className="text-right text-xs">${formatK(p.prev)}K</td>
                    <td className="text-right font-bold text-xs">${formatK(p.recent)}K</td>
                    <td className="text-right growth-positive text-xs font-bold">+${formatK(p.increase)}K</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <div className="chart-card">
            <h3 className="chart-title">Top 10 Projects (Last 12M)</h3>
            <table className="data-table">
              <thead><tr><th>Project ID</th><th>Customer</th><th className="text-right nowrap">MRR (K)</th></tr></thead>
              <tbody>
                {data.topProjects.map(p => (
                  <tr key={p.id}>
                    <td><div className="text-xs font-semibold">{p.id}</div></td>
                    <td><div className="text-xs text-muted truncate" style={{ maxWidth: '120px' }}>{p.customer_name_2}</div></td>
                    <td className="text-right font-bold text-xs">${formatK(p.mrr)}K</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="chart-card">
            <h3 className="chart-title">Top 10 AI Projects (Last 12M)</h3>
            <table className="data-table">
              <thead><tr><th>Project ID</th><th>Customer</th><th className="text-right nowrap">MRR (K)</th></tr></thead>
              <tbody>
                {data.topAIProjects12m?.map(p => (
                  <tr key={p.id}>
                     <td><div className="text-xs font-semibold">{p.id}</div></td>
                     <td><div className="text-xs text-muted truncate" style={{ maxWidth: '120px' }}>{p.customer_name_2}</div></td>
                    <td className="text-right font-bold text-xs">${formatK(p.mrr)}K</td>
                  </tr>
                ))}
                {(!data.topAIProjects12m || data.topAIProjects12m.length === 0) && (
                  <tr><td colSpan="3" className="text-center text-xs text-muted py-4">No AI projects found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="chart-card">
            <h3 className="chart-title">Top 10 AI Projects (Last 3M)</h3>
            <table className="data-table">
              <thead><tr><th>Project ID</th><th>Customer</th><th className="text-right nowrap">MRR (K)</th></tr></thead>
              <tbody>
                {data.topAIProjects3m?.map(p => (
                  <tr key={p.id}>
                    <td><div className="text-xs font-semibold">{p.id}</div></td>
                    <td><div className="text-xs text-muted truncate" style={{ maxWidth: '120px' }}>{p.customer_name_2}</div></td>
                    <td className="text-right font-bold text-xs">${formatK(p.mrr)}K</td>
                  </tr>
                ))}
                {(!data.topAIProjects3m || data.topAIProjects3m.length === 0) && (
                  <tr><td colSpan="3" className="text-center text-xs text-muted py-4">No AI projects found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EntityDashboard;
