import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GRAPH_ALIGN_MIN_SIMILARITY_PERCENT, GRAPH_EXTRACT_ALIGN_POOL_SIZE } from '@baishou/shared'
import { Modal, SettingsHelpIconButton } from '@baishou/ui'
import styles from './GraphExtractHelpButton.module.css'

export const GraphExtractHelpButton: React.FC<{ size?: number }> = ({ size = 14 }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <>
      <SettingsHelpIconButton
        aria-label={t('graph.extract_help_aria', '抽取与抽取池说明')}
        size={size}
        onActivate={() => setOpen(true)}
      />
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={t('graph.extract_help_modal_title', '抽取与抽取池')}
        closeOnOverlayClick
        className={styles.helpModal}
        zIndex={10050}
      >
        <div className={styles.helpContent}>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>{t('graph.extract_help_extract_title', '抽取')}</h3>
            <p className={styles.sectionBody}>
              {t(
                'graph.extract_help_extract',
                '由 AI 分析日记正文，提取人物、地点、事件及相互关系。此数值为同时处理的日记篇数：调高可加快整理进度，但会占用更多 API 并发额度。'
              )}
            </p>
          </section>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>{t('graph.extract_help_pool_title', '抽取池')}</h3>
            <p className={styles.sectionBody}>
              {t(
                'graph.extract_help_pool',
                '抽取出的关系草稿不会立即写入图谱，而是先暂存抽取池中：\n\n每当池中攒满 {{pool}} 篇或当前批次完成时，系统会自动与已有节点比对，由 AI 智能合并相似的人物或地点，防止同一实体被重复拆分为多个节点。',
                {
                  pool: GRAPH_EXTRACT_ALIGN_POOL_SIZE,
                  similarity: GRAPH_ALIGN_MIN_SIMILARITY_PERCENT
                }
              )}
            </p>
          </section>
        </div>
      </Modal>
    </>
  )
}
