import React from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, Link2, NotebookPen } from 'lucide-react'
import { Button, Input } from '@baishou/ui'
import type {
  KnowledgeExtractHint,
  KnowledgeExtractHintChoice,
  KnowledgeImportProcessMode
} from '@baishou/shared'
import { KnowledgeDialog } from './KnowledgeDialog'
import { KnowledgeExtractHintDialog } from './KnowledgeExtractHintDialog'
import { KnowledgeImportProcessDialog } from './KnowledgeImportProcessDialog'
import { extractEngineShortLabel } from './knowledge-detail-labels.util'
import type { KnowledgeImportMode } from './knowledge-detail.types'
import styles from './KnowledgePage.module.css'

export function KnowledgeDetailImportDialogs(props: {
  busy: boolean
  importMode: KnowledgeImportMode
  engine: 'simple' | 'ocr' | 'vision'
  pasteTitle: string
  pasteText: string
  urlValue: string
  extractHintPrompt: {
    fileNames: string[]
    reason: KnowledgeExtractHint['reason']
    currentEngine: 'simple' | 'ocr' | 'vision'
    visionConfigured: boolean
    visionModelId?: string | null
  } | null
  importProcessPrompt: {
    fileNames: string[]
    extractEngineLabel: string
    embeddingModelLabel: string
    graphModelLabel: string
    defaultMode: KnowledgeImportProcessMode
  } | null
  onCloseImport: () => void
  onPickImportMode: (mode: Exclude<KnowledgeImportMode, 'chooser' | null>) => void
  onPasteTitleChange: (value: string) => void
  onPasteTextChange: (value: string) => void
  onUrlChange: (value: string) => void
  onImportFile: () => void
  onImportText: () => void
  onImportUrl: () => void
  onSettleExtractHint: (choice: KnowledgeExtractHintChoice) => void
  onOpenVisionSettings: () => void
  onSettleImportProcess: (mode: KnowledgeImportProcessMode | null) => void
}) {
  const { t } = useTranslation()
  return (
    <>
      <KnowledgeExtractHintDialog
        open={props.extractHintPrompt != null}
        fileNames={props.extractHintPrompt?.fileNames || []}
        reason={props.extractHintPrompt?.reason ?? null}
        currentEngine={props.extractHintPrompt?.currentEngine || props.engine}
        visionConfigured={Boolean(props.extractHintPrompt?.visionConfigured)}
        visionModelId={props.extractHintPrompt?.visionModelId}
        onCancel={() => props.onSettleExtractHint('cancel')}
        onChoose={props.onSettleExtractHint}
        onOpenVisionSettings={props.onOpenVisionSettings}
      />

      <KnowledgeImportProcessDialog
        open={props.importProcessPrompt != null}
        prompt={props.importProcessPrompt}
        onCancel={() => props.onSettleImportProcess(null)}
        onConfirm={(mode) => props.onSettleImportProcess(mode)}
      />

      <KnowledgeDialog
        open={props.importMode === 'chooser'}
        onClose={props.onCloseImport}
        closeDisabled={props.busy}
        title={t('knowledge.add_source', '添加来源')}
        aria-label={t('knowledge.add_source', '添加来源')}
      >
        <div className={styles.chooserGrid}>
          <button
            type="button"
            className={styles.chooserItem}
            disabled={props.busy}
            onClick={() => props.onPickImportMode('file')}
          >
            <FileText size={20} />
            <span>{t('knowledge.import_file', '导入文件')}</span>
          </button>
          <button
            type="button"
            className={styles.chooserItem}
            disabled={props.busy}
            onClick={() => props.onPickImportMode('text')}
          >
            <NotebookPen size={20} />
            <span>{t('knowledge.import_text', '粘贴文本')}</span>
          </button>
          <button
            type="button"
            className={styles.chooserItem}
            disabled={props.busy}
            onClick={() => props.onPickImportMode('url')}
          >
            <Link2 size={20} />
            <span>{t('knowledge.import_url', '导入 URL')}</span>
          </button>
        </div>
        <div className={styles.dialogActions}>
          <Button type="button" onClick={props.onCloseImport} disabled={props.busy}>
            {t('common.cancel', '取消')}
          </Button>
        </div>
      </KnowledgeDialog>

      <KnowledgeDialog
        open={props.importMode === 'file'}
        onClose={props.onCloseImport}
        closeDisabled={props.busy}
        title={t('knowledge.import_file', '导入文件')}
        aria-label={t('knowledge.import_file', '导入文件')}
      >
        <p className={styles.metaLine}>
          {t(
            'knowledge.import_file_hint',
            '支持 PDF、EPUB、Markdown、纯文本。扫描件或没有文字层的 PDF 可以用本地 OCR。'
          )}
        </p>
        <p className={styles.metaLine}>
          {t('knowledge.import_engine_hint', '提取方式按知识库设置：{{engine}}', {
            engine: extractEngineShortLabel(t, props.engine)
          })}
        </p>
        <div className={styles.dialogActions}>
          <Button type="button" onClick={props.onCloseImport} disabled={props.busy}>
            {t('common.cancel', '取消')}
          </Button>
          <Button type="button" onClick={props.onImportFile} disabled={props.busy}>
            {t('knowledge.choose_files', '选择文件')}
          </Button>
        </div>
      </KnowledgeDialog>

      <KnowledgeDialog
        open={props.importMode === 'text'}
        onClose={props.onCloseImport}
        closeDisabled={props.busy}
        title={t('knowledge.import_text', '粘贴文本')}
        aria-label={t('knowledge.import_text', '粘贴文本')}
      >
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t('knowledge.source_title', '标题')}</span>
          <Input
            fieldSize="small"
            value={props.pasteTitle}
            onChange={(e) => props.onPasteTitleChange(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t('knowledge.source_body', '正文')}</span>
          <textarea
            className={styles.fieldTextarea}
            value={props.pasteText}
            onChange={(e) => props.onPasteTextChange(e.target.value)}
          />
        </label>
        <div className={styles.dialogActions}>
          <Button type="button" onClick={props.onCloseImport} disabled={props.busy}>
            {t('common.cancel', '取消')}
          </Button>
          <Button
            type="button"
            onClick={props.onImportText}
            disabled={props.busy || !props.pasteText.trim()}
          >
            {t('knowledge.import_submit', '导入')}
          </Button>
        </div>
      </KnowledgeDialog>

      <KnowledgeDialog
        open={props.importMode === 'url'}
        onClose={props.onCloseImport}
        closeDisabled={props.busy}
        title={t('knowledge.import_url', '导入 URL')}
        aria-label={t('knowledge.import_url', '导入 URL')}
      >
        <label className={styles.field}>
          <span className={styles.fieldLabel}>URL</span>
          <Input
            fieldSize="small"
            value={props.urlValue}
            onChange={(e) => props.onUrlChange(e.target.value)}
            placeholder="https://"
            autoFocus
          />
        </label>
        <div className={styles.dialogActions}>
          <Button type="button" onClick={props.onCloseImport} disabled={props.busy}>
            {t('common.cancel', '取消')}
          </Button>
          <Button
            type="button"
            onClick={props.onImportUrl}
            disabled={props.busy || !props.urlValue.trim()}
          >
            {t('knowledge.import_submit', '导入')}
          </Button>
        </div>
      </KnowledgeDialog>
    </>
  )
}
