import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { motion } from 'framer-motion'
import { clampOcrConcurrency, normalizeKnowledgeDefaultExtractEngine } from '@baishou/shared'
import { Button } from '@baishou/ui'
import { KnowledgeShell } from './KnowledgeShell'
import { KnowledgeNotebookTabBar } from './KnowledgeNotebookTabBar'
import { KnowledgeVectorPane } from './KnowledgeVectorPane'
import { NotebookStatusPanel } from './NotebookStatusPanel'
import { NotebookGraphPane } from './NotebookGraphPane'
import { KnowledgeSourcesColumn } from './KnowledgeSourceCards'
import { KnowledgeDetailJobBanner } from './KnowledgeDetailJobBanner'
import { KnowledgeDetailSettingsDialog } from './KnowledgeDetailSettingsDialog'
import { KnowledgeDetailImportDialogs } from './KnowledgeDetailImportDialogs'
import { KnowledgeDetailHostDialogs } from './KnowledgeDetailHostDialogs'
import { KnowledgeDeleteNotebookDialog } from './KnowledgeDeleteNotebookDialog'
import { useKnowledgeDetailRefresh } from './useKnowledgeDetailRefresh'
import { useKnowledgeDetailImport } from './useKnowledgeDetailImport'
import { useKnowledgeDetailActions } from './useKnowledgeDetailActions'
import { useNotebookStatusModels } from './useNotebookStatusModels'
import type { KnowledgeNotebookTab } from './knowledge-notebook-tab.util'
import styles from './KnowledgePage.module.css'

interface WorkspaceOutletContext {
  setFolderRoot: (path: string | null) => void
}

export const KnowledgeDetailPage: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { notebookId = '' } = useParams<{ notebookId: string }>()
  const outlet = useOutletContext<WorkspaceOutletContext | undefined>()
  const setFolderRoot = outlet?.setFolderRoot ?? (() => undefined)

  const [activeTab, setActiveTab] = useState<KnowledgeNotebookTab>('sources')
  const [organizeOpen, setOrganizeOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [dataManageOpen, setDataManageOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const settingsWasOpenRef = useRef(false)
  const visionModelTriggerRef = useRef<HTMLButtonElement>(null)

  const detail = useKnowledgeDetailRefresh(notebookId, t, setError, setStatus)
  const {
    picker,
    closePicker,
    pickStatusRow,
    openVisionPicker,
    selectModel,
    persistReasoningSlot
  } = useNotebookStatusModels({
    engine: detail.engine,
    ocrLanguage: detail.ocrLanguage,
    ocrConcurrency: detail.ocrConcurrency,
    setVisionProviderId: detail.setVisionProviderId,
    setVisionModelId: detail.setVisionModelId,
    setShowSettings,
    onError: setError
  })
  const importing = useKnowledgeDetailImport({
    notebookId,
    engine: detail.engine,
    globalModels: detail.globalModels,
    t,
    refresh: detail.refresh,
    setError,
    setStatus,
    setBusy
  })
  const actions = useKnowledgeDetailActions({
    notebookId,
    engine: detail.engine,
    sources: detail.sources,
    ocrProgressBySource: detail.ocrProgressBySource,
    t,
    refresh: detail.refresh,
    refreshGraphJobs: detail.refreshGraphJobs,
    askExtractHint: importing.askExtractHint,
    setError,
    setStatus,
    setBusy,
    setActiveTab,
    setOcrProgressBySource: detail.setOcrProgressBySource,
    setGraphBusy: detail.setGraphBusy,
    setGraphKnownTotal: detail.setGraphKnownTotal,
    setGraphWindowProgress: detail.setGraphWindowProgress,
    setGraphJobs: detail.setGraphJobs,
    setPendingJobs: detail.setPendingJobs,
    setVectorKnownTotal: detail.setVectorKnownTotal,
    setQueuedSourceIds: detail.setQueuedSourceIds,
    setReprocessWatching: detail.setReprocessWatching,
    reprocessSawWorkRef: detail.reprocessSawWorkRef,
    setDataManageOpen
  })

  const closeSettings = useCallback(() => {
    closePicker()
    setShowSettings(false)
  }, [closePicker])

  const goBackToList = useCallback(() => {
    navigate('/agent-workspace/knowledge')
  }, [navigate])

  useEffect(() => {
    if (settingsWasOpenRef.current && !showSettings) closePicker()
    settingsWasOpenRef.current = showSettings
  }, [closePicker, showSettings])

  const onSaveSettings = async () => {
    setBusy(true)
    try {
      await window.api.knowledge.setConfig({
        defaultExtractEngine: normalizeKnowledgeDefaultExtractEngine(detail.engine),
        ocrLanguage: detail.ocrLanguage,
        ocrConcurrency: clampOcrConcurrency(detail.ocrConcurrency),
        visionProviderId: detail.visionProviderId,
        visionModelId: detail.visionModelId
      })
      await detail.refreshCaps()
      setShowSettings(false)
      setStatus(t('knowledge.settings_saved', '知识库设置已保存'))
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <KnowledgeShell setFolderRoot={setFolderRoot} mainClassName={styles.mainFill}>
      <motion.div
        className={styles.detailWorkspace}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <header className={styles.detailTopBar}>
          <div className={styles.detailTopLeft}>
            <button
              type="button"
              className={styles.iconGhostBtn}
              onClick={goBackToList}
              title={t('knowledge.back_to_list', '返回知识库')}
              aria-label={t('knowledge.back_to_list', '返回知识库')}
            >
              <ArrowLeft size={18} />
            </button>
            <h1 className={styles.detailTitle}>
              {detail.notebookName || t('knowledge.title', '知识库')}
            </h1>
          </div>
          <KnowledgeNotebookTabBar activeTab={activeTab} onTabChange={setActiveTab} />
          <div className={styles.detailTopRight}>
            <Button type="button" disabled={busy} onClick={() => setDeleteOpen(true)}>
              {t('knowledge.delete_notebook', '删除笔记本')}
            </Button>
          </div>
        </header>

        <KnowledgeDetailJobBanner
          jobProgress={detail.jobProgress}
          status={status}
          error={error}
          open={organizeOpen}
          onOpenChange={setOrganizeOpen}
        />

        {detail.modelMismatch ? (
          <div className={styles.bannerError} data-testid="knowledge-model-mismatch">
            <strong>{t('knowledge.model_mismatch_title', '嵌入模型不一致')}</strong>
            <p>
              {t(
                'knowledge.model_mismatch_hard_block',
                '提问已硬拦截。请重建索引后再问，否则答案会错得很像样。'
              )}
            </p>
            <Button type="button" disabled={busy} onClick={() => void actions.onRebuild()}>
              {t('knowledge.rebuild_index', '重建索引')}
            </Button>
          </div>
        ) : null}

        {activeTab === 'sources' ? (
          <div className={styles.sourcesStage}>
            <NotebookStatusPanel
              rows={detail.statusRows}
              busy={busy}
              onOpenSettings={() => {
                closePicker()
                setShowSettings(true)
              }}
              onOpenDataManage={() => setDataManageOpen(true)}
              onPickRow={pickStatusRow}
            />
            <KnowledgeSourcesColumn
              busy={busy}
              sourcesLoaded={detail.sourcesLoaded}
              sources={detail.sources}
              uploadingSources={importing.uploadingSources}
              ocrProgressBySource={detail.ocrProgressBySource}
              graphJobStatusBySource={detail.graphJobs.statusBySourceId}
              onAddSource={importing.openAddSource}
              onPreview={actions.onPreview}
              onOpenMenu={(source, x, y) => actions.setSourceMenu({ sourceId: source.id, x, y })}
              onDismissUpload={importing.dismissUploadError}
            />
          </div>
        ) : null}

        {activeTab === 'graph' ? (
          <NotebookGraphPane
            notebookId={notebookId}
            sourceCount={detail.sources.length}
            progress={detail.graphProgress}
            extracting={
              detail.graphBusy || detail.graphJobs.pending > 0 || detail.graphJobs.running > 0
            }
            reloadKey={`${detail.graphJobs.pending}:${detail.graphJobs.running}:${detail.graphJobs.failed}:${detail.graphJobs.currentSourceTitle ?? ''}:${detail.sources.length}:${detail.graphWindowProgress?.done ?? 0}:${detail.graphWindowProgress?.total ?? 0}`}
            onStartExtract={() => {
              void window.api.knowledge.organizeNotebook(notebookId)
            }}
            onRebuildGraph={() => {
              actions.setHeavyConfirmSource(null)
              actions.setHeavyConfirmKind('rebuild-graph')
            }}
            onOpenQueue={() => setOrganizeOpen(true)}
            onPreviewFragments={(edges) => void actions.onPreviewGraphFragments(edges)}
          />
        ) : null}

        {activeTab === 'vectors' ? (
          <KnowledgeVectorPane
            notebookId={notebookId}
            sourceCount={detail.sources.length}
            chunkCount={detail.chunkCount}
            storageLine={detail.storageLine}
            busy={busy}
            onPreviewFragment={actions.onPreviewVectorFragment}
          />
        ) : null}
      </motion.div>

      <KnowledgeDetailSettingsDialog
        open={showSettings}
        busy={busy}
        notebookId={notebookId}
        sources={detail.sources}
        engine={detail.engine}
        engineCaps={detail.engineCaps}
        ocrLanguage={detail.ocrLanguage}
        ocrConcurrency={detail.ocrConcurrency}
        ocrPresetValue={detail.ocrPresetValue}
        visionDisplay={detail.visionDisplay}
        visionProviderId={detail.visionProviderId}
        visionModelId={detail.visionModelId}
        globalDialogueProviderId={detail.globalModels?.globalDialogueProviderId}
        globalDialogueModelId={detail.globalModels?.globalDialogueModelId}
        visionModelTriggerRef={visionModelTriggerRef}
        onClose={closeSettings}
        onEngineChange={detail.setEngine}
        onOcrPresetChange={(next) => {
          if (next === '__custom__') {
            detail.setOcrUseCustom(true)
            return
          }
          detail.setOcrUseCustom(false)
          detail.setOcrLanguage(next)
        }}
        onOcrLanguageChange={(value) => {
          detail.setOcrUseCustom(true)
          detail.setOcrLanguage(value)
        }}
        onOcrConcurrencyChange={detail.setOcrConcurrency}
        onOpenVisionPicker={openVisionPicker}
        onClearVisionModel={() => {
          detail.setVisionProviderId(null)
          detail.setVisionModelId(null)
        }}
        onSave={() => void onSaveSettings()}
      />

      <KnowledgeDetailImportDialogs
        busy={busy}
        importMode={importing.importMode}
        engine={detail.engine}
        pasteTitle={importing.pasteTitle}
        pasteText={importing.pasteText}
        urlValue={importing.urlValue}
        extractHintPrompt={importing.extractHintPrompt}
        importProcessPrompt={importing.importProcessPrompt}
        onCloseImport={() => importing.setImportMode(null)}
        onPickImportMode={importing.setImportMode}
        onPasteTitleChange={importing.setPasteTitle}
        onPasteTextChange={importing.setPasteText}
        onUrlChange={importing.setUrlValue}
        onImportFile={() => void importing.onImportFile()}
        onImportText={() => void importing.onImportText()}
        onImportUrl={() => void importing.onImportUrl()}
        onSettleExtractHint={importing.settleExtractHint}
        onOpenVisionSettings={() => {
          importing.settleExtractHint('cancel')
          setShowSettings(true)
        }}
        onSettleImportProcess={importing.settleImportProcess}
      />

      <KnowledgeDeleteNotebookDialog
        open={deleteOpen}
        notebookName={detail.notebookName || t('knowledge.title', '知识库')}
        busy={busy}
        onCancel={() => {
          if (busy) return
          setDeleteOpen(false)
        }}
        onConfirm={() => {
          void (async () => {
            setBusy(true)
            setError('')
            try {
              await window.api.knowledge.deleteNotebook(notebookId)
              setDeleteOpen(false)
              goBackToList()
            } catch (e: unknown) {
              setError(e instanceof Error ? e.message : String(e))
            } finally {
              setBusy(false)
            }
          })()
        }}
      />

      <KnowledgeDetailHostDialogs
        busy={busy}
        dataManageOpen={dataManageOpen}
        onCloseDataManage={() => setDataManageOpen(false)}
        onManageNotebookData={actions.onManageNotebookData}
        deleteTarget={actions.deleteTarget}
        onCloseDelete={() => actions.setDeleteTarget(null)}
        onDeleteSource={actions.onDeleteSource}
        heavyConfirmKind={actions.heavyConfirmKind}
        heavyConfirmSource={actions.heavyConfirmSource}
        onCancelHeavy={() => {
          actions.setHeavyConfirmKind(null)
          actions.setHeavyConfirmSource(null)
        }}
        onConfirmHeavy={actions.confirmHeavy}
        sourceMenu={actions.sourceMenu}
        sourceMenuItems={actions.sourceMenuItems}
        onCloseSourceMenu={() => actions.setSourceMenu(null)}
        picker={picker}
        providers={detail.providers}
        globalEmbeddingProviderId={detail.globalModels?.globalEmbeddingProviderId}
        globalEmbeddingModelId={detail.globalModels?.globalEmbeddingModelId}
        globalGraphProviderId={detail.globalModels?.globalGraphProviderId}
        globalGraphModelId={detail.globalModels?.globalGraphModelId}
        visionProviderId={detail.visionProviderId}
        visionModelId={detail.visionModelId}
        reasoningEffortBySlot={detail.globalModels?.reasoningEffortBySlot}
        onSelectModel={selectModel}
        persistReasoningSlot={persistReasoningSlot}
        closePicker={closePicker}
        closeSettings={closeSettings}
        previewOpen={actions.previewOpen}
        previewTitle={actions.previewTitle}
        previewLoading={actions.previewLoading}
        previewError={actions.previewError}
        previewPayload={actions.previewPayload}
        onClosePreview={actions.closePreview}
        fragmentOpen={actions.fragmentOpen}
        fragmentLoading={actions.fragmentLoading}
        fragmentError={actions.fragmentError}
        fragments={actions.fragments}
        onCloseFragments={actions.closeFragments}
      />
    </KnowledgeShell>
  )
}
