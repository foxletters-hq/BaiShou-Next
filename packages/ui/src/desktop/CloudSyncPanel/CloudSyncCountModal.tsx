import React from 'react'
import { Archive } from 'lucide-react'
import styles from './CloudSyncPanel.module.css'
import type { CloudSyncPanelViewModel } from './useCloudSyncPanel'

export interface CloudSyncCountModalProps {
  vm: CloudSyncPanelViewModel
}

export const CloudSyncCountModal: React.FC<CloudSyncCountModalProps> = ({ vm }) => {
  const {
    t,
    noLimitLabel,
    activeTab,
    tempCount,
    setTempCount,
    setShowCountModal,
    confirmCountModal
  } = vm

  return (
    <div className={styles.modalOverlay} onClick={() => setShowCountModal(false)}>
      <div className={styles.countModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.countModalHeader}>
          <div
            className={styles.countModalTitleRow}
            style={{
              display: 'flex',
              width: '100%',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div
              className={styles.countModalTitleBlock}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Archive size={20} color="var(--color-primary, #0ea5e9)" />
              <span className={styles.countModalTitle} style={{ fontWeight: 'bold', fontSize: 16 }}>
                {activeTab === 'snapshot'
                  ? t('data_sync.max_snapshot_title', '快照上限设置')
                  : t('data_sync.max_backup_title', '备份上限设置')}
              </span>
            </div>
            <input
              type="text"
              className={styles.smNumberInput}
              style={{
                width: 72,
                padding: '4px 8px',
                border: '1px solid rgba(var(--color-outline-variant-rgb, 200, 200, 200), 0.5)',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--text-primary)',
                textAlign: 'center',
                background: 'var(--bg-surface-lowest, #f8fafc)',
                outline: 'none'
              }}
              value={tempCount === -1 ? noLimitLabel : tempCount}
              onChange={(e) => {
                const val = e.target.value.trim()
                if (
                  val === '' ||
                  val === noLimitLabel ||
                  val === t('data_sync.no_limit', 'No Limit') ||
                  val === '不限制' ||
                  val === '不限制数量' ||
                  val === '∞' ||
                  val === '-1'
                ) {
                  setTempCount(-1)
                } else {
                  const num = parseInt(val)
                  if (!isNaN(num)) {
                    setTempCount(Math.min(100, Math.max(1, num)))
                  }
                }
              }}
              onBlur={() => {
                if (tempCount !== -1) {
                  setTempCount(Math.min(100, Math.max(1, tempCount)))
                }
              }}
            />
          </div>
        </div>

        <div
          className={styles.countModalBody}
          style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          <div
            className={styles.countModalDesc}
            style={{ fontSize: 13, color: 'var(--color-on-surface-variant)', lineHeight: 1.5 }}
          >
            {activeTab === 'snapshot'
              ? t(
                  'data_sync.max_snapshot_desc',
                  '超过上限后，自动生成新快照时将清理最早的历史快照。'
                )
              : t('data_sync.max_backup_desc', '超过上限后，同步备份时将自动删除最早的备份文件。')}
          </div>

          <div className={styles.smSliderContainer}>
            <input
              type="range"
              min="1"
              max="50"
              value={tempCount === -1 ? 50 : tempCount}
              onChange={(e) => setTempCount(parseInt(e.target.value))}
              className={styles.smSlider}
              style={{
                backgroundSize: `${tempCount === -1 ? 100 : ((tempCount - 1) * 100) / 49}% 100%`
              }}
            />
          </div>

          <div
            className={styles.chipsContainer}
            style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}
          >
            {[1, 2, 3, 5, 10, 15, -1].map((val) => (
              <button
                key={val}
                type="button"
                className={`${styles.chipItem} ${tempCount === val ? styles.chipItemActive : ''}`}
                onClick={() => setTempCount(val)}
                style={{
                  background:
                    tempCount === val
                      ? 'var(--color-primary, #0ea5e9)'
                      : 'var(--bg-surface-normal, #f1f5f9)',
                  color:
                    tempCount === val
                      ? 'var(--text-on-primary, #fff)'
                      : 'var(--text-secondary, #64748b)',
                  border:
                    tempCount === val
                      ? '1px solid var(--color-primary, #0ea5e9)'
                      : '1px solid var(--border-subtle, #e2e8f0)',
                  padding: '6px 12px',
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {val === -1
                  ? t('data_sync.no_limit', '不限制数量')
                  : t('data_sync.count_unit_value', '$count 个').replace('$count', val.toString())}
              </button>
            ))}
          </div>
        </div>

        <div
          className={styles.countModalFooter}
          style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}
        >
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.btnOutlined}`}
            onClick={() => setShowCountModal(false)}
          >
            {t('common.cancel', '取消')}
          </button>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.btnFilled}`}
            onClick={confirmCountModal}
          >
            {t('common.confirm', '确定')}
          </button>
        </div>
      </div>
    </div>
  )
}
