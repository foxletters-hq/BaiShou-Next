import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GRAPH_EXTRACT_ALIGN_POOL_SIZE } from '@baishou/shared'
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
            <h3 className={styles.sectionTitle}>
              {t('graph.extract_help_extract_title', '抽取')}
            </h3>
            <p className={styles.sectionBody}>
              {t(
                'graph.extract_help_extract',
                '把日记交给模型，从文字里整理出人物、地点、事件和关系。这里的数字是同时有几篇日记在抽取。数字越大通常越快，也会同时占用更多模型调用。'
              )}
            </p>
          </section>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>
              {t('graph.extract_help_pool_title', '抽取池')}
            </h3>
            <p className={styles.sectionBody}>
              {t(
                'graph.extract_help_pool',
                '单篇抽完不会立刻写入图谱。草稿先进入抽取池；攒满 {{pool}} 篇，或这一批都抽完了，再召回相似度大于 {{similarity}}% 的已有节点，由模型判断要不要合并，然后一起写入。这样相近的实体不容易拆成多个节点。',
                {
                  pool: GRAPH_EXTRACT_ALIGN_POOL_SIZE,
                  similarity: 50
                }
              )}
            </p>
          </section>
        </div>
      </Modal>
    </>
  )
}
