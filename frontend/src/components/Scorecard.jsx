import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

const Scorecard = ({ label, value, subValue, trend, isCurrency = true }) => {
  const formattedValue = isCurrency && typeof value === 'number'
    ? `$${value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`
    : value;

  return (
    <div className="scorecard">
      <div className="scorecard-label">{label}</div>
      <div className="scorecard-value">{formattedValue}</div>
      {(subValue || trend) && (
        <div className="scorecard-meta">
          {trend && (
            <span className={trend > 0 ? 'growth-positive' : 'growth-negative'}>
              {trend > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {Math.abs(trend)}%
            </span>
          )}
          <span style={{ color: 'var(--text-muted)' }}>{subValue}</span>
        </div>
      )}
    </div>
  );
};

export default Scorecard;
