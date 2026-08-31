import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Select } from '@baishou/ui'
import {
  knowledgeImportProcessSelectOptions,
  normalizeKnowledgeImportProcessMode,
  type KnowledgeImportProcessMode
} from '@baishou/shared'
import { KnowledgeDialog } from './KnowledgeDialog'
import styles from './KnowledgePage.module.css'

export type KnowledgeImportProcessPrompt = {
  fileNames: string[]
  extractEngineLabel: string
  embeddingModelLabel: string
  graphModelLabel: string
  defaultMode: KnowledgeImportProcessMode
}

export function KnowledgeImportProcessDialog({
  open,
  prompt,
  onCancel,
  onConfirm
}: {
  open: boolean
  prompt: KnowledgeImportProcessPrompt | null
  onCancel: () => void
  onConfirm: (mode: KnowledgeImportProcessMode) => void
}) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<KnowledgeImportProcessMode>('both')

  useEffect(() => {
    if (open && prompt) {
      setMode(normalizeKnowledgeImportProcessMode(prompt.defaultMode))
    }
  }, [open, prompt])

  const title = t('knowledge.import_process_title', '导入后如何处理')

  return (
    <KnowledgeDialog
      open={open}
      onClose={onCancel}
      title={title}
      aria-label={title}
      className={styles.dialogSettings}
    >
      <p className={styles.guideHint}>
        {t(
          'knowledge.import_process_hint',
          '会先提取正文，再按选择写入向量、图关系或两者。'
        )}
      </p>
      {prompt && prompt.fileNames.length > 0 ? (
        <ul className={styles.extractHintFiles}>
          {prompt.fileNames.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      ) : null}
      <div className={styles.importProcessRow}>
        <span className={styles.importProcessLabel}>
          {t('knowledge.import_process_mode', '本次处理')}
        </span>
        <Select
          className={styles.settingsControl}
          size="small"
          value={mode}
          options={knowledgeImportProcessSelectOptions()}
          onChange={(e) =>
            setMode(normalizeKnowledgeImportProcessMode(e.target.value))
          }
          aria-label={t('knowledge.import_process_mode', '本次处理')}
        />
      </div>
      <div className={styles.importProcessMeta}>
        <div className={styles.importProcessMetaRow}>
          <span className={styles.importProcessMetaLabel}>
            {t('knowledge.import_process_extract', '提取方式')}
          </span>
          <span className={styles.importProcessMetaValue}>
            {prompt?.extractEngineLabel || '—'}
          </span>
        </div>
        <div className={styles.importProcessMetaRow}>
          <span className={styles.importProcessMetaLabel}>
            {t('knowledge.import_process_embedding', '嵌入模型')}
          </span>
          <span className={styles.importProcessMetaValue}>
            {prompt?.embeddingModelLabel || '—'}
          </span>
        </div>
        <div className={styles.importProcessMetaRow}>
          <span className={styles.importProcessMetaLabel}>
            {t('knowledge.import_process_graph', '关系抽取模型')}
          </span>
          <span className={styles.importProcessMetaValue}>
            {prompt?.graphModelLabel || '—'}
          </span>
        </div>
      </div>
      <div className={styles.extractHintActions}>
        <button type="button" className={styles.dialogCancelBtn} onClick={onCancel}>
          {t('common.cancel', '取消')}
        </button>
        <button
          type="button"
          className={styles.dialogConfirmBtn}
          onClick={() => onConfirm(mode)}
        >
          {t('knowledge.import_process_confirm', '确认导入')}
        </button>
      </div>
    </KnowledgeDialog>
  )
}
