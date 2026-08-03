import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { KnowledgeShell } from './KnowledgeShell'
import styles from './KnowledgePage.module.css'

interface WorkspaceOutletContext {
  setFolderRoot: (path: string | null) => void
}

type SourceRow = {
  id: string
  title: string
  sourceKind: string
  status: string
  errorMessage?: string | null
  pageCount?: number | null
  textPageCount?: number | null
  originUrl?: string | null
  extractEngine?: string | null
}

type Citation = {
  sourceId: string
  title: string
  chunkId: string
  chunkIndex: number
  excerpt: string
  offset?: number
  len?: number
  page?: number
}

type ImportMode = 'file' | 'text' | 'url' | null
type AskMode = 'ask' | 'chat'

function statusLabel(
  t: (key: string, fallback: string) => string,
  status: string
): string {
  const map: Record<string, [string, string]> = {
    pending: ['knowledge.status_pending', '等待中'],
    extracting: ['knowledge.status_extracting', '提取中'],
    needs_ocr: ['knowledge.status_needs_ocr', '需 OCR'],
    partial: ['knowledge.status_partial', '部分文本'],
    embedding: ['knowledge.status_embedding', '索引中'],
    ready: ['knowledge.status_ready', '就绪'],
    failed: ['knowledge.status_failed', '失败']
  }
  const entry = map[status]
  return entry ? t(entry[0], entry[1]) : status
}

export const KnowledgeDetailPage: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { notebookId = '' } = useParams<{ notebookId: string }>()
  const { setFolderRoot } = useOutletContext<WorkspaceOutletContext>()

  const [notebookName, setNotebookName] = useState('')
  const [storageLine, setStorageLine] = useState('')
  const [sources, setSources] = useState<SourceRow[]>([])
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [citations, setCitations] = useState<Citation[]>([])
  const [subQueries, setSubQueries] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [importMode, setImportMode] = useState<ImportMode>(null)
  const [pasteTitle, setPasteTitle] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [urlValue, setUrlValue] = useState('')
  const [preview, setPreview] = useState<{ title: string; text: string; truncated: boolean } | null>(
    null
  )
  const [askMode, setAskMode] = useState<AskMode>('ask')
  const [multiQuery, setMultiQuery] = useState(false)
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([])
  const [showSettings, setShowSettings] = useState(false)
  const [engine, setEngine] = useState<'simple' | 'ocr' | 'vision'>('simple')
  const [ocrLanguage, setOcrLanguage] = useState('chi_sim+eng')
  const [capLine, setCapLine] = useState('')

  const notes = useMemo(() => sources.filter((s) => s.sourceKind === 'note'), [sources])
  const materials = useMemo(() => sources.filter((s) => s.sourceKind !== 'note'), [sources])
  const readyForChat = useMemo(
    () =>
      materials.filter(
        (s) => s.status === 'ready' || s.status === 'partial' || s.status === 'embedding'
      ),
    [materials]
  )

  const refresh = useCallback(async () => {
    if (!notebookId) return
    const notebooks = (await window.api.knowledge.listNotebooks()) as Array<{
      id: string
      name: string
    }>
    const nb = notebooks.find((n) => n.id === notebookId)
    setNotebookName(nb?.name || notebookId)
    const list = (await window.api.knowledge.listSources(notebookId)) as SourceRow[]
    setSources(list || [])
    try {
      const stats = await window.api.knowledge.getStats(notebookId)
      const total = ((stats.totalBytes ?? 0) / (1024 * 1024)).toFixed(2)
      const original = ((stats.originalBytes ?? 0) / (1024 * 1024)).toFixed(2)
      setStorageLine(
        t('knowledge.storage_usage', '本笔记本 {{total}} MB，其中原文 {{original}} MB', {
          total,
          original
        })
      )
    } catch {
      setStorageLine('')
    }
  }, [notebookId, t])

  const refreshCaps = useCallback(async () => {
    try {
      const [caps, cfg] = await Promise.all([
        window.api.knowledge.getCapabilities(),
        window.api.knowledge.getConfig()
      ])
      if (cfg.defaultExtractEngine) setEngine(cfg.defaultExtractEngine)
      if (cfg.ocrLanguage) setOcrLanguage(cfg.ocrLanguage)
      if (typeof cfg.multiQueryAsk === 'boolean') setMultiQuery(cfg.multiQueryAsk)
      const parts = [
        caps.simple.available ? 'simple✓' : 'simple✗',
        caps.ocr.available
          ? `ocr✓${caps.ocr.detail ? `（${caps.ocr.detail}）` : ''}`
          : `ocr✗ ${caps.ocr.reason || ''}`,
        caps.vision.available
          ? `vision✓${caps.vision.detail ? `（${caps.vision.detail}）` : ''}`
          : `vision✗ ${caps.vision.reason || ''}`
      ]
      setCapLine(parts.join(' · '))
    } catch {
      setCapLine('')
    }
  }, [])

  useEffect(() => {
    void refresh().catch((e) => setError(String(e?.message || e)))
    void refreshCaps()
    const timer = window.setInterval(() => {
      void refresh().catch(() => undefined)
    }, 4000)
    return () => window.clearInterval(timer)
  }, [refresh, refreshCaps])

  const onAsk = async () => {
    const q = question.trim()
    if (!q || !notebookId) return
    setBusy(true)
    setError('')
    setSubQueries([])
    setStatus(
      askMode === 'chat'
        ? t('knowledge.chatting', '正在精读所选材料…')
        : t('knowledge.asking', '正在检索并生成回答…')
    )
    try {
      const mismatch = askMode === 'ask' ? await window.api.knowledge.hasModelMismatch?.() : false
      if (mismatch) throw new Error('knowledge-model-mismatch')

      if (askMode === 'chat') {
        if (!selectedChatIds.length) {
          throw new Error(t('knowledge.chat_need_sources', '请先勾选要精读的资料'))
        }
        const result = await window.api.knowledge.chat({
          notebookId,
          question: q,
          sourceIds: selectedChatIds
        })
        setAnswer(
          result.truncated
            ? `${result.answer}\n\n（${t('knowledge.chat_truncated', '材料已按 token 预算裁剪')}）`
            : result.answer
        )
        setCitations(result.citations || [])
      } else {
        const result = await window.api.knowledge.ask({
          notebookId,
          question: q,
          multiQuery
        })
        setAnswer(result.answer)
        setCitations(result.citations || [])
        setSubQueries(result.subQueries || [])
      }
      setStatus('')
    } catch (e: any) {
      const msg = String(e?.message || e)
      if (msg === 'knowledge-model-mismatch') {
        setError(
          t(
            'knowledge.model_mismatch_hard_block',
            '嵌入模型与知识库向量不一致，提问已拦截。请先「重建索引」。'
          )
        )
      } else {
        setError(msg)
      }
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  const onSaveNote = async () => {
    if (!notebookId || !answer.trim() || !question.trim()) return
    setBusy(true)
    try {
      await window.api.knowledge.saveNote({
        notebookId,
        question: question.trim(),
        answer: answer.trim(),
        citations: citations.map((c) => ({
          title: c.title,
          page: c.page,
          excerpt: c.excerpt
        }))
      })
      await refresh()
      setStatus(t('knowledge.note_saved', '已保存为 Note，并加入索引队列'))
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const onOcrMissing = async (sourceId: string) => {
    setBusy(true)
    setError('')
    try {
      const result = await window.api.knowledge.ocrMissingPages({
        sourceId,
        engine: engine === 'simple' ? 'ocr' : engine
      })
      if (result.degradationMessage) setStatus(result.degradationMessage)
      else setStatus(t('knowledge.ocr_queued', '已对缺失页执行 OCR'))
      await refresh()
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const onSaveSettings = async () => {
    setBusy(true)
    try {
      await window.api.knowledge.setConfig({
        defaultExtractEngine: engine,
        ocrLanguage,
        multiQueryAsk: multiQuery
      })
      await refreshCaps()
      setShowSettings(false)
      setStatus(t('knowledge.settings_saved', '知识库设置已保存'))
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const onImportFile = async () => {
    if (!notebookId) return
    setBusy(true)
    setError('')
    try {
      const files = await window.api.pickFiles({
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Documents', extensions: ['pdf', 'md', 'txt', 'markdown'] }]
      })
      for (const file of files || []) {
        await window.api.knowledge.importSource({
          notebookId,
          title: file.fileName || 'file',
          kind: 'file',
          absolutePath: file.filePath,
          fileName: file.fileName,
          extractEngine: engine
        })
      }
      setImportMode(null)
      await refresh()
      setStatus(t('knowledge.import_queued', '已加入摄入队列'))
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const onImportText = async () => {
    if (!notebookId || !pasteText.trim()) return
    setBusy(true)
    setError('')
    try {
      await window.api.knowledge.importSource({
        notebookId,
        title: pasteTitle.trim() || t('knowledge.pasted_text', '粘贴文本'),
        kind: 'text',
        textContent: pasteText
      })
      setImportMode(null)
      setPasteTitle('')
      setPasteText('')
      await refresh()
      setStatus(t('knowledge.import_queued', '已加入摄入队列'))
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const onImportUrl = async () => {
    const originUrl = urlValue.trim()
    if (!notebookId || !originUrl) return
    setBusy(true)
    setError('')
    try {
      await window.api.knowledge.importSource({
        notebookId,
        title: '',
        kind: 'url',
        originUrl
      })
      setImportMode(null)
      setUrlValue('')
      await refresh()
      setStatus(t('knowledge.import_queued', '已加入摄入队列'))
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const onRetry = async (sourceId: string) => {
    setBusy(true)
    try {
      await window.api.knowledge.retrySource(sourceId)
      await refresh()
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const onRebuild = async () => {
    if (!notebookId) return
    setBusy(true)
    setError('')
    try {
      await window.api.knowledge.rebuildIndex(notebookId)
      await refresh()
      setStatus(t('knowledge.rebuild_queued', '已开始重建本机索引（不产生同步流量）'))
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const onPreview = async (source: SourceRow) => {
    if (!notebookId) return
    try {
      const result = await window.api.knowledge.getExtractedPreview({
        notebookId,
        sourceId: source.id,
        maxChars: 6000
      })
      setPreview({
        title: source.title,
        text: result.text || t('knowledge.preview_empty', '暂无提取正文'),
        truncated: result.truncated
      })
    } catch (e: any) {
      setError(String(e?.message || e))
    }
  }

  const toggleChatSource = (id: string) => {
    setSelectedChatIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const renderSourceItem = (source: SourceRow) => {
    const missingPages =
      source.pageCount != null &&
      source.textPageCount != null &&
      source.pageCount > source.textPageCount
        ? source.pageCount - source.textPageCount
        : null
    const needsOcrBtn = source.status === 'needs_ocr' || source.status === 'partial'
    return (
      <li key={source.id} className={styles.sourceItem}>
        <div className={styles.sourceTop}>
          {askMode === 'chat' && source.sourceKind !== 'note' ? (
            <label className={styles.chatCheck}>
              <input
                type="checkbox"
                checked={selectedChatIds.includes(source.id)}
                onChange={() => toggleChatSource(source.id)}
                disabled={!readyForChat.some((s) => s.id === source.id)}
              />
            </label>
          ) : null}
          <span className={styles.sourceTitle}>
            {source.sourceKind === 'note' ? '📝 ' : ''}
            {source.title}
          </span>
          <span className={styles.sourceStatus}>{statusLabel(t, source.status)}</span>
        </div>
        {missingPages != null && missingPages > 0 ? (
          <div className={styles.sourceEvidence}>
            {t('knowledge.scan_evidence', '{{total}} 页中 {{missing}} 页无文本层', {
              total: source.pageCount,
              missing: missingPages
            })}
          </div>
        ) : null}
        {source.errorMessage ? (
          <div className={styles.sourceEvidence}>{source.errorMessage}</div>
        ) : null}
        {source.originUrl ? (
          <div className={styles.sourceEvidence}>{source.originUrl}</div>
        ) : null}
        <div className={styles.sourceActions}>
          <button type="button" className={styles.btnGhost} onClick={() => void onPreview(source)}>
            {t('knowledge.preview_extracted', '预览正文')}
          </button>
          {needsOcrBtn ? (
            <button
              type="button"
              className={styles.btn}
              disabled={busy}
              onClick={() => void onOcrMissing(source.id)}
            >
              {t('knowledge.ocr_missing_pages', '只 OCR 缺失页')}
            </button>
          ) : null}
          {source.status === 'failed' || source.status === 'needs_ocr' ? (
            <button
              type="button"
              className={styles.btn}
              disabled={busy}
              onClick={() => void onRetry(source.id)}
            >
              {t('knowledge.retry', '重试')}
            </button>
          ) : null}
        </div>
      </li>
    )
  }

  return (
    <KnowledgeShell setFolderRoot={setFolderRoot}>
      <div className={styles.mainInner}>
        <div className={styles.header}>
          <div className={styles.titleBlock}>
            <button
              type="button"
              className={styles.backBtn}
              onClick={() => navigate('/agent-workspace/knowledge')}
            >
              ← {t('knowledge.back_to_list', '返回知识库')}
            </button>
            <h1 className={styles.title}>{notebookName || t('knowledge.title', '知识库')}</h1>
            <p className={styles.subtitle}>
              {t('knowledge.detail_subtitle', '左侧管理资料，右侧提问并查看带页码/偏移的引用。')}
            </p>
            {storageLine ? <p className={styles.subtitle}>{storageLine}</p> : null}
            {capLine ? (
              <p className={styles.subtitle}>
                {t('knowledge.engine_caps', '引擎状态')}：{capLine}
              </p>
            ) : null}
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.btn} onClick={() => setImportMode('file')} disabled={busy}>
              {t('knowledge.import_file', '导入文件')}
            </button>
            <button type="button" className={styles.btn} onClick={() => setImportMode('text')} disabled={busy}>
              {t('knowledge.import_text', '粘贴文本')}
            </button>
            <button type="button" className={styles.btn} onClick={() => setImportMode('url')} disabled={busy}>
              {t('knowledge.import_url', '导入 URL')}
            </button>
            <button
              type="button"
              className={styles.btnGhost}
              onClick={() => setShowSettings(true)}
              disabled={busy}
            >
              {t('knowledge.settings', '知识库设置')}
            </button>
            <button type="button" className={styles.btnGhost} onClick={() => void onRebuild()} disabled={busy}>
              {t('knowledge.rebuild_index', '重建索引')}
            </button>
          </div>
        </div>

        {status ? <p className={styles.statusLine}>{status}</p> : null}
        {error ? <p className={styles.errorLine}>{error}</p> : null}

        <div className={styles.detailLayout}>
          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>{t('knowledge.sources_panel', '资料')}</h2>
            {materials.length === 0 ? (
              <div className={styles.empty}>
                {t('knowledge.empty_sources', '还没有资料，先导入 PDF / Markdown / URL。')}
              </div>
            ) : (
              <ul className={styles.sourceList}>{materials.map(renderSourceItem)}</ul>
            )}
            {notes.length > 0 ? (
              <>
                <h2 className={styles.panelTitle}>{t('knowledge.notes_panel', 'Notes')}</h2>
                <ul className={styles.sourceList}>{notes.map(renderSourceItem)}</ul>
              </>
            ) : null}
          </section>

          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>{t('knowledge.ask_panel', '提问')}</h2>
            <div className={styles.modeRow}>
              <button
                type="button"
                className={askMode === 'ask' ? styles.btnPrimary : styles.btnGhost}
                onClick={() => setAskMode('ask')}
              >
                Ask
              </button>
              <button
                type="button"
                className={askMode === 'chat' ? styles.btnPrimary : styles.btnGhost}
                onClick={() => setAskMode('chat')}
              >
                {t('knowledge.chat_mode', 'Chat 精读')}
              </button>
              {askMode === 'ask' ? (
                <label className={styles.chatCheck}>
                  <input
                    type="checkbox"
                    checked={multiQuery}
                    onChange={(e) => setMultiQuery(e.target.checked)}
                  />
                  {t('knowledge.multi_query', '多子查询（最多 2）')}
                </label>
              ) : (
                <span className={styles.subtitle}>
                  {t('knowledge.chat_hint', '勾选左侧资料，全文进上下文（有预算裁剪）')}
                </span>
              )}
            </div>
            <div className={styles.askBox}>
              <textarea
                className={styles.askInput}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={t(
                  'knowledge.ask_placeholder',
                  '例如：这几篇里对齐的主要分歧是什么？'
                )}
              />
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  disabled={busy || !question.trim()}
                  onClick={() => void onAsk()}
                >
                  {askMode === 'chat'
                    ? t('knowledge.chat_submit', '精读提问')
                    : t('knowledge.ask_submit', '提问')}
                </button>
                {answer ? (
                  <button
                    type="button"
                    className={styles.btn}
                    disabled={busy}
                    onClick={() => void onSaveNote()}
                  >
                    {t('knowledge.save_note', '保存为 Note')}
                  </button>
                ) : null}
              </div>
              {subQueries.length > 0 ? (
                <p className={styles.subtitle}>
                  {t('knowledge.sub_queries', '子查询')}：{subQueries.join(' · ')}
                </p>
              ) : null}
              <div className={styles.answer}>
                {answer || t('knowledge.ask_empty', '回答会出现在这里，并附带资料引用。')}
              </div>
              {citations.length > 0 ? (
                <div className={styles.citations}>
                  <h2 className={styles.panelTitle}>{t('knowledge.citations', '引用')}</h2>
                  {citations.map((c, i) => (
                    <div key={c.chunkId || `${c.sourceId}-${i}`} className={styles.citation}>
                      <div className={styles.citationTitle}>
                        [{i + 1}] {c.title}
                      </div>
                      <div className={styles.citationMeta}>
                        {c.page != null
                          ? t('knowledge.citation_page', '第 {{page}} 页', { page: c.page })
                          : c.offset != null
                            ? t('knowledge.citation_offset', '偏移 {{offset}}', {
                                offset: c.offset
                              })
                            : t('knowledge.citation_chunk', '片段 #{{index}}', {
                                index: c.chunkIndex
                              })}
                      </div>
                      <div className={styles.citationExcerpt}>{c.excerpt}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>

      {showSettings ? (
        <div
          className={styles.dialogBackdrop}
          role="presentation"
          onClick={() => !busy && setShowSettings(false)}
        >
          <div className={styles.dialog} role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.dialogTitle}>{t('knowledge.settings', '知识库设置')}</h2>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t('knowledge.default_engine', '默认提取引擎')}</span>
              <select
                className={styles.fieldInput}
                value={engine}
                onChange={(e) => setEngine(e.target.value as 'simple' | 'ocr' | 'vision')}
              >
                <option value="simple">simple（文本层）</option>
                <option value="ocr">ocr（tesseract.js）</option>
                <option value="vision">vision（多模态）</option>
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t('knowledge.ocr_language', 'OCR 语言')}</span>
              <input
                className={styles.fieldInput}
                value={ocrLanguage}
                onChange={(e) => setOcrLanguage(e.target.value)}
                placeholder="chi_sim+eng"
              />
            </label>
            <p className={styles.subtitle}>{capLine}</p>
            <div className={styles.dialogActions}>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => setShowSettings(false)}
                disabled={busy}
              >
                {t('common.cancel', '取消')}
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => void onSaveSettings()}
                disabled={busy}
              >
                {t('common.save', '保存')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {importMode === 'file' ? (
        <div className={styles.dialogBackdrop} role="presentation" onClick={() => !busy && setImportMode(null)}>
          <div className={styles.dialog} role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.dialogTitle}>{t('knowledge.import_file', '导入文件')}</h2>
            <p className={styles.subtitle}>
              {t('knowledge.import_file_hint', '支持 PDF（文本层）、Markdown、纯文本。')}
            </p>
            <p className={styles.subtitle}>
              {t('knowledge.import_engine_hint', '将使用当前默认引擎')}：{engine}
            </p>
            <div className={styles.dialogActions}>
              <button type="button" className={styles.btnGhost} onClick={() => setImportMode(null)} disabled={busy}>
                {t('common.cancel', '取消')}
              </button>
              <button type="button" className={styles.btnPrimary} onClick={() => void onImportFile()} disabled={busy}>
                {t('knowledge.choose_files', '选择文件')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {importMode === 'text' ? (
        <div className={styles.dialogBackdrop} role="presentation" onClick={() => !busy && setImportMode(null)}>
          <div className={styles.dialog} role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.dialogTitle}>{t('knowledge.import_text', '粘贴文本')}</h2>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t('knowledge.source_title', '标题')}</span>
              <input
                className={styles.fieldInput}
                value={pasteTitle}
                onChange={(e) => setPasteTitle(e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t('knowledge.source_body', '正文')}</span>
              <textarea
                className={styles.fieldTextarea}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
              />
            </label>
            <div className={styles.dialogActions}>
              <button type="button" className={styles.btnGhost} onClick={() => setImportMode(null)} disabled={busy}>
                {t('common.cancel', '取消')}
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => void onImportText()}
                disabled={busy || !pasteText.trim()}
              >
                {t('knowledge.import_submit', '导入')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {importMode === 'url' ? (
        <div className={styles.dialogBackdrop} role="presentation" onClick={() => !busy && setImportMode(null)}>
          <div className={styles.dialog} role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.dialogTitle}>{t('knowledge.import_url', '导入 URL')}</h2>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>URL</span>
              <input
                className={styles.fieldInput}
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                placeholder="https://"
                autoFocus
              />
            </label>
            <div className={styles.dialogActions}>
              <button type="button" className={styles.btnGhost} onClick={() => setImportMode(null)} disabled={busy}>
                {t('common.cancel', '取消')}
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => void onImportUrl()}
                disabled={busy || !urlValue.trim()}
              >
                {t('knowledge.import_submit', '导入')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {preview ? (
        <div className={styles.dialogBackdrop} role="presentation" onClick={() => setPreview(null)}>
          <div className={styles.dialog} role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.dialogTitle}>
              {t('knowledge.preview_title', '提取正文预览')} · {preview.title}
            </h2>
            {preview.truncated ? (
              <p className={styles.subtitle}>{t('knowledge.preview_truncated', '内容已截断显示')}</p>
            ) : null}
            <div className={styles.previewBox}>{preview.text}</div>
            <div className={styles.dialogActions}>
              <button type="button" className={styles.btnPrimary} onClick={() => setPreview(null)}>
                {t('common.close', '关闭')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </KnowledgeShell>
  )
}
