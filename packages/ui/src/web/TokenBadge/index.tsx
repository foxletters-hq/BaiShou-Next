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

  const actualCostMicros = costMicros || durationMs;
  const costText = actualCostMicros > 0 ? (actualCostMicros / 1000000).toFixed(4) : null;
  const total = inputTokens + outputTokens;

  // Determine stress level of the token consumption
  let levelClass = styles.levelLow; // < 1k
  if (total >= 10000) {
    levelClass = styles.levelHigh;
  } else if (total >= 5000) {
    levelClass = styles.levelMed;
  }

  return (
    <div className={`${styles.container} ${levelClass}`} onClick={onClick}>
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
