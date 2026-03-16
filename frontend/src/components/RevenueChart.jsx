import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

const COLORS = [
  '#A50034', '#5e5ce6', '#32d74b', '#ff9f0a',
  '#ff453a', '#007aff', '#ff375f', '#bf5af2',
  '#64d2ff', '#ffd60a'
];

const CustomTooltip = ({ active, payload, label, unit = 'M' }) => {
  if (active && payload && payload.length) {
    const factor = unit === 'K' ? 1000 : 1000000;
    return (
      <div style={{
        backgroundColor: '#1f2937',
        border: '1px solid var(--glass-border)',
        borderRadius: '12px',
        padding: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        pointerEvents: 'none'
      }}>
        <p style={{ 
          color: 'var(--text-muted)', 
          marginBottom: '8px', 
          borderBottom: '1px solid var(--border)', 
          paddingBottom: '4px', 
          fontSize: '11px',
          fontWeight: 500
        }}>{label}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {payload.sort((a, b) => b.value - a.value).slice(0, 15).map((entry, index) => (
            <div key={index} style={{ 
              color: entry.color, 
              fontSize: '12px', 
              fontWeight: 600, 
              display: 'flex', 
              justifyContent: 'space-between', 
              gap: '16px',
              alignItems: 'center'
            }}>
              <span>{entry.name}:</span>
              <span>{new Intl.NumberFormat('en-US', { 
                style: 'currency', 
                currency: 'USD',
                minimumFractionDigits: unit === 'K' ? 0 : 2,
                maximumFractionDigits: unit === 'K' ? 1 : 2
              }).format(entry.value / factor)}{unit}</span>
            </div>
          ))}
          {payload.length > 15 && (
            <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '4px' }}>
              + {payload.length - 15} more entities
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

const RevenueChart = ({ data, title, dataKeys, height = 350, unit = 'M' }) => {
  const [hiddenKeys, setHiddenKeys] = React.useState(new Set());
  const factor = unit === 'K' ? 1000 : 1000000;

  const handleLegendClick = (e) => {
    const { dataKey } = e;
    setHiddenKeys(prev => {
      const next = new Set(prev);
      if (next.has(dataKey)) {
        next.delete(dataKey);
      } else {
        next.add(dataKey);
      }
      return next;
    });
  };

  const legendFormatter = (value, entry) => {
    const isHidden = hiddenKeys.has(entry.dataKey);
    return (
      <span style={{ 
        color: isHidden ? 'var(--text-muted)' : 'var(--text-main)',
        opacity: isHidden ? 0.4 : 1,
        textDecoration: isHidden ? 'line-through' : 'none'
      }}>
        {value}
      </span>
    );
  };

  return (
    <div className="chart-card">
      <div className="chart-header">
        <h3 className="chart-title">{title}</h3>
      </div>
      <div style={{ width: '100%', height: height }}>
        <ResponsiveContainer>
          <BarChart
            data={data}
            margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              tickFormatter={(value) => `$${new Intl.NumberFormat('en-US').format((value / factor).toFixed(0))}${unit}`}
            />
            <Tooltip content={<CustomTooltip unit={unit} />} />
            <Legend
              iconType="circle"
              onClick={handleLegendClick}
              formatter={legendFormatter}
              wrapperStyle={{ paddingTop: '20px', fontSize: '12px', cursor: 'pointer' }}
            />
            {dataKeys.map((key, index) => (
              <Bar
                key={key}
                dataKey={key}
                stackId="a"
                hide={hiddenKeys.has(key)}
                fill={COLORS[index % COLORS.length]}
                radius={index === dataKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default RevenueChart;
