import React from 'react'
import type { GitManagementViewModel } from './useGitManagementPage'

export interface GitConflictSectionProps {
  vm: GitManagementViewModel
  style?: React.CSSProperties
}

export const GitConflictSection: React.FC<GitConflictSectionProps> = ({ vm, style }) => {
  const { t, conflicts, onResolveConflict } = vm
  if (conflicts.length === 0) return null

  return (
    <div className="gmp-section gmp-conflict" style={style}>
      <div className="gmp-label">{t('version_control.conflict_detected', '检测到冲突')}</div>
      {conflicts.map((f) => (
        <div key={f} className="gmp-conflict-row">
          <span className="gmp-conflict-file">{f}</span>
          <button className="gmp-btn-small" onClick={() => onResolveConflict(f, 'ours')}>
            {t('version_control.resolve_ours', '保留本地')}
          </button>
          <button className="gmp-btn-small" onClick={() => onResolveConflict(f, 'theirs')}>
            {t('version_control.resolve_theirs', '保留远程')}
          </button>
        </div>
      ))}
    </div>
  )
}
