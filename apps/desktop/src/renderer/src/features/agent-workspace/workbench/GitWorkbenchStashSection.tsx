import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GitManagementViewModel } from '@baishou/ui'
import styles from './GitWorkbenchPanel.module.css'

export const GitWorkbenchStashSection: React.FC<{ vm: GitManagementViewModel }> = ({ vm }) => {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const [stashMessage, setStashMessage] = useState('')

  if (!vm.isInitialized || !vm.handleStashPush) return null

  return (
    <div className="gmp-collapsible-section">
      <div className="gmp-collapsible-header" onClick={() => setExpanded((open) => !open)}>
        <span className="gmp-collapsible-arrow">{expanded ? '▾' : '▸'}</span>
        <span className="gmp-collapsible-title">{t('workbench.git_stash', 'Stash')}</span>
        {vm.stashList.length > 0 ? (
          <span className="gmp-collapsible-badge">{vm.stashList.length}</span>
        ) : null}
        <button
          type="button"
          className="gmp-btn-tiny"
          onClick={(event) => {
            event.stopPropagation()
            void vm.handleStashPush(stashMessage || undefined).then(() => setStashMessage(''))
          }}
        >
          {t('workbench.git_stash_push', '贮藏')}
        </button>
      </div>
      {expanded ? (
        <div className="gmp-collapsible-body">
          <div className={styles.stashInputRow}>
            <input
              className={styles.menuInput}
              value={stashMessage}
              onChange={(event) => setStashMessage(event.target.value)}
              placeholder={t('workbench.git_stash_message', '贮藏说明（可选）')}
            />
          </div>
          {vm.stashList.length === 0 ? (
            <div className="gmp-section-empty">{t('workbench.git_stash_empty', '暂无贮藏')}</div>
          ) : (
            vm.stashList.map((entry) => (
              <div key={entry.index} className="gmp-file-row">
                <span className="gmp-file-path">{entry.message}</span>
                <div className="gmp-file-actions">
                  <button
                    type="button"
                    className="gmp-btn-tiny"
                    onClick={() => void vm.handleStashApply(entry.index)}
                  >
                    {t('workbench.git_stash_apply', '应用')}
                  </button>
                  <button
                    type="button"
                    className="gmp-btn-tiny"
                    onClick={() => void vm.handleStashPop(entry.index)}
                  >
                    {t('workbench.git_stash_pop', '弹出')}
                  </button>
                  <button
                    type="button"
                    className="gmp-btn-tiny"
                    onClick={() => void vm.handleStashDrop(entry.index)}
                  >
                    {t('common.delete', '删除')}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
