import React, { useCallback, useEffect, useState } from 'react'
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
  const [sources, setSources] = useState<SourceRow[]>([])
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [citations, setCitations] = useState<Citation[]>([])
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
  }, [notebookId])

  useEffect(() => {
    void refresh().catch((e) => setError(String(e?.message || e)))
    const timer = window.setInterval(() => {
      void refresh().catch(() => undefined)
    }, 4000)
    return () => window.clearInterval(timer)
  }, [refresh])

  const onAsk = async () => {
    const q = question.trim()
    if (!q || !notebookId) return
    setBusy(true)
    setError('')
    setStatus(t('knowledge.asking', '正在检索并生成回答…'))
    try {
      const result = await window.api.knowledge.ask({ notebookId, question: q })
      setAnswer(result.answer)
      setCitations(result.citations || [])
      setStatus('')
    } catch (e: any) {
      setError(String(e?.message || e))
      setStatus('')
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
        filters: [
          { name: 'Documents', extensions: ['pdf', 'md', 'txt', 'markdown'] }
        ]
      })
      for (const file of files || []) {
        await window.api.knowledge.importSource({
          notebookId,
          title: file.fileName || 'file',
          kind: 'file',
          absolutePath: file.filePath,
          fileName: file.fileName
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
            {sources.length === 0 ? (
              <div className={styles.empty}>{t('knowledge.empty_sources', '还没有资料，先导入 PDF / Markdown / URL。')}</div>
            ) : (
              <ul className={styles.sourceList}>
                {sources.map((source) => {
                  const missingPages =
                    source.pageCount != null &&
                    source.textPageCount != null &&
                    source.pageCount > source.textPageCount
                      ? source.pageCount - source.textPageCount
                      : null
                  return (
                    <li key={source.id} className={styles.sourceItem}>
                      <div className={styles.sourceTop}>
                        <span className={styles.sourceTitle}>{source.title}</span>
                        <span className={styles.sourceStatus}>
                          {statusLabel(t, source.status)}
                        </span>
                      </div>
                      {missingPages != null && missingPages > 0 ? (
                        <div className={styles.sourceEvidence}>
                          {t(
                            'knowledge.scan_evidence',
                            '{{total}} 页中 {{missing}} 页无文本层',
                            { total: source.pageCount, missing: missingPages }
                          )}
                        </div>
                      ) : null}
                      {source.errorMessage ? (
                        <div className={styles.sourceEvidence}>{source.errorMessage}</div>
                      ) : null}
                      {source.originUrl ? (
                        <div className={styles.sourceEvidence}>{source.originUrl}</div>
                      ) : null}
                      <div className={styles.sourceActions}>
                        <button
                          type="button"
                          className={styles.btnGhost}
                          onClick={() => void onPreview(source)}
                        >
                          {t('knowledge.preview_extracted', '预览正文')}
                        </button>
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
                })}
              </ul>
            )}
          </section>

          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>{t('knowledge.ask_panel', '提问')}</h2>
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
                  {t('knowledge.ask_submit', '提问')}
                </button>
              </div>
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

      {importMode === 'file' ? (
        <div className={styles.dialogBackdrop} role="presentation" onClick={() => !busy && setImportMode(null)}>
          <div className={styles.dialog} role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.dialogTitle}>{t('knowledge.import_file', '导入文件')}</h2>
            <p className={styles.subtitle}>
              {t('knowledge.import_file_hint', '支持 PDF（文本层）、Markdown、纯文本。')}
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
