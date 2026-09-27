import React from 'react'
import { AlertTriangle } from 'lucide-react'
import type { GitManagementViewModel } from './useGitManagementPage'

export interface GitConflictSectionProps {
  vm: GitManagementViewModel
  style?: React.CSSProperties
}

export const GitConflictSection: React.FC<GitConflictSectionProps> = ({ vm, style }) => {
  const { t, conflicts } = vm
  if (conflicts.length === 0) return null

  return (
    <div className="gmp-conflict-strip" style={style}>
      <div className="gmp-conflict-title-row">
        <AlertTriangle size={13} className="gmp-conflict-icon" />
        <span className="gmp-conflict-title">
          {t('version_control.conflict_detected', '检测到冲突')} ({conflicts.length})
        </span>
      </div>
      <div className="gmp-conflict-list">
        {conflicts.map((f) => (
          <div key={f} className="gmp-conflict-item">
            <span className="gmp-conflict-file" title={f}>
              {f}
            </span>
            <div className="gmp-conflict-actions">
              <button
                className="gmp-btn-tiny"
                onClick={() => void vm.handleResolveConflict(f, 'ours')}
              >
                {t('version_control.resolve_ours', '保留本地')}
              </button>
              <button
                className="gmp-btn-tiny"
                onClick={() => void vm.handleResolveConflict(f, 'theirs')}
              >
                {t('version_control.resolve_theirs', '保留远程')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

