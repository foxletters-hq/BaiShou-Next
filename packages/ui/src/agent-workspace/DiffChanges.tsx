import React from 'react'
import { formatFileChangeStats } from './file-change.utils'
import styles from './DiffChanges.module.css'

export interface DiffChangesProps {
  additions?: number
  deletions?: number
  entries?: Array<{ additions: number; deletions: number }>
  className?: string
}

function aggregateStats(
  additions: number,
  deletions: number,
  entries?: Array<{ additions: number; deletions: number }>
): { additions: number; deletions: number } {
  if (!entries?.length) return { additions, deletions }
  return entries.reduce(
    (acc, entry) => ({
      additions: acc.additions + entry.additions,
      deletions: acc.deletions + entry.deletions
    }),
    { additions: 0, deletions: 0 }
  )
}

export const DiffChanges: React.FC<DiffChangesProps> = ({
  additions = 0,
  deletions = 0,
  entries,
  className
}) => {
  const stats = aggregateStats(additions, deletions, entries)
  const label = formatFileChangeStats(stats.additions, stats.deletions)

  return (
    <span className={`${styles.root} ${className ?? ''}`} aria-label={label}>
      {stats.additions > 0 ? <span className={styles.add}>+{stats.additions}</span> : null}
      {stats.deletions > 0 ? <span className={styles.del}>-{stats.deletions}</span> : null}
      {stats.additions === 0 && stats.deletions === 0 ? (
        <span className={styles.neutral}>0</span>
      ) : null}
    </span>
  )
}
