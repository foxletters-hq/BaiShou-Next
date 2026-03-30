import React from 'react';
import styles from './TokenBadge.module.css';

export interface TokenBadgeProps {
  inputTokens?: number;
  outputTokens?: number;
  costMicros?: number;
  durationMs?: number; // legacy prop alias
}

export const TokenBadge: React.FC<TokenBadgeProps> = ({
  inputTokens = 0,
  outputTokens = 0,
  costMicros = 0,
  durationMs = 0
}) => {
  const formatTokens = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return `${n}`;
  };

  const actualCostMicros = costMicros || durationMs;
  const costText = actualCostMicros > 0 ? (actualCostMicros / 1000000).toFixed(4) : null;

  return (
    <div className={styles.container}>
      <span className={styles.tokenText}>
        ↑{formatTokens(inputTokens)}  ↓{formatTokens(outputTokens)}
      </span>
      {costText && (
        <span className={styles.costText}>
          ${costText}
        </span>
      )}
    </div>
  );
};
