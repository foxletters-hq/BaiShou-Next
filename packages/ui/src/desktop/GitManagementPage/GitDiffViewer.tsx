import React from 'react'
import { useTranslation } from 'react-i18next'
import type { FileDiff } from '@baishou/shared'

export interface GitDiffViewerProps {
  diff: FileDiff
}

export const GitDiffViewer: React.FC<GitDiffViewerProps> = ({ diff }) => {
  const { t } = useTranslation()
  return (
    <div className="gmp-diff-viewer">
      <pre className="gmp-diff-content">
        {diff.hunks.length === 0 ? (
          <div className="gmp-diff-normal" style={{ opacity: 0.5 }}>
            {t('version_control.no_diff', 'No diff')}
          </div>
        ) : (
          diff.hunks.map((hunk, i) => (
            <div key={i} className="gmp-diff-hunk">
              <div className="gmp-diff-hunk-header">
                @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
              </div>
              {hunk.content.split('\n').map((line, j) => (
                <div
                  key={j}
                  className={
                    line.startsWith('+')
                      ? 'gmp-diff-add'
                      : line.startsWith('-')
                        ? 'gmp-diff-remove'
                        : 'gmp-diff-normal'
                  }
                >
                  {line}
                </div>
              ))}
            </div>
          ))
        )}
      </pre>
    </div>
  )
}
