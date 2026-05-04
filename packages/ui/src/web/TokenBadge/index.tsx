import React from 'react';
import styles from './TokenBadge.module.css';
import { Activity } from 'lucide-react';

export interface TokenBadgeProps {
  inputTokens?: number;
  outputTokens?: number;
  costMicros?: number;
  durationMs?: number; // legacy prop alias
  onClick?: () => void;
}

export const TokenBadge: React.FC<TokenBadgeProps> = ({
  inputTokens = 0,
  outputTokens = 0,
  costMicros = 0,
  durationMs = 0,
  onClick
}) => {
  const formatTokens = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return `${n}`;
  };

  const actualCostMicros = costMicros || durationMs || 0;
  const costText = (actualCostMicros / 1000000).toFixed(4);
  const total = inputTokens + outputTokens;

  return (
    <div className={`${styles.container}`} onClick={onClick}>
      <span className={styles.iconWrap}>
         <Activity size={12} strokeWidth={2.5} />
      </span>
      <span className={styles.tokenText}>
        {formatTokens(total)}
      </span>
      {costText && (
        <>
          <span className={styles.divider} />
          <span className={styles.costText}>
            ${costText}
          </span>
        </>
      )}
    </div>
  );
};
