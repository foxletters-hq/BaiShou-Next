import React from 'react'
import type { GitManagementViewModel } from './useGitManagementPage'

export interface GitRecentPullsSectionProps {
  vm: GitManagementViewModel
}

export const GitRecentPullsSection: React.FC<GitRecentPullsSectionProps> = ({ vm }) => {
  const { t, expandedSections, toggleSection, recentPulls } = vm

  return (
    <div className="gmp-collapsible-section">
      <div className="gmp-collapsible-header" onClick={() => toggleSection('pulls')}>
        <span className="gmp-collapsible-arrow">{expandedSections.pulls ? '▾' : '▸'}</span>
        <span className="gmp-collapsible-title">
          {t('version_control.recent_pulls', 'Recent Pulls')}
        </span>
        {recentPulls.length > 0 && (
          <span className="gmp-collapsible-badge">{recentPulls.length}</span>
        )}
      </div>
      {expandedSections.pulls && (
        <div className="gmp-collapsible-body">
          {recentPulls.length === 0 ? (
            <div className="gmp-section-empty">
              {t('version_control.no_recent_pulls', '暂无拉取记录')}
            </div>
          ) : (
            recentPulls.map((entry) => (
              <div key={entry.commit.hash} className="gmp-file-row">
                <span className="gmp-tl-hash" style={{ marginRight: 8 }}>
                  {entry.commit.hash}
                </span>
                <span className="gmp-file-path" style={{ flex: 1 }}>
                  {entry.commit.message}
                </span>
                <span className="gmp-tl-date">{new Date(entry.commit.date).toLocaleString()}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
