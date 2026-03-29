import React from 'react';
import styles from './TokenBadge.module.css';

interface TokenBadgeProps {
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
}

export const TokenBadge: React.FC<TokenBadgeProps> = ({
  inputTokens = 0,
  outputTokens = 0,
  durationMs = 0
}) => {
  const totalTokens = inputTokens + outputTokens;
  const durationSec = (durationMs / 1000).toFixed(1);

  return (
    <div className={styles.badgeContainer}>
      <div className={styles.iconBox}>
        <span className={styles.icon}>⚡</span>
      </div>
      <div className={styles.stats}>
        <span className={styles.tokens}>{totalTokens} Tokens</span>
        <span className={styles.duration}> {durationSec}s</span>
      </div>
    </div>
  );
};
