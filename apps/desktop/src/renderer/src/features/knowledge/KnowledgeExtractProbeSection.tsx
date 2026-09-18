import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, HelpTooltip, Select } from '@baishou/ui'
import { callKnowledgeApi } from './call-knowledge-api'
import {
  formatExtractProbePagesList,
  listExtractProbeSources,
  type KnowledgeExtractProbeSourceOption
} from './knowledge-extract-probe.util'
import styles from './KnowledgePage.module.css'

export type KnowledgeExtractProbePageResult = {
  page: number
  text: string
}

export type KnowledgeExtractProbeSectionProps = {
  notebookId: string
  sources: KnowledgeExtractProbeSourceOption[]
  engine: 'ocr' | 'vision'
  engineAvailable: boolean
  engineUnavailableReason?: string
  disabled?: boolean
  ocrLanguage: string
  ocrConcurrency: number
  visionProviderId: string | null
  visionModelId: string | null
}

export const KnowledgeExtractProbeSection: React.FC<KnowledgeExtractProbeSectionProps> = ({
  notebookId,
  sources,
  engine,
  engineAvailable,
  engineUnavailableReason,
  disabled,
  ocrLanguage,
  ocrConcurrency,
  visionProviderId,
  visionModelId
}) => {
  const { t } = useTranslation()
  const pdfSources = useMemo(() => listExtractProbeSources(sources), [sources])
  const [sourceId, setSourceId] = useState('')
  const [probing, setProbing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pages, setPages] = useState<KnowledgeExtractProbePageResult[] | null>(null)

  const selected = pdfSources.find((row) => row.id === sourceId) ?? null
  const pageList = formatExtractProbePagesList(selected?.pageCount)
  const canRun = Boolean(sourceId) && engineAvailable && !disabled && !probing

  const onRun = async () => {
    if (!sourceId || !canRun) return
    setError(null)
    setPages(null)
    setProbing(true)
    try {
      const result = await callKnowledgeApi<{
        pages: KnowledgeExtractProbePageResult[]
      }>('probeExtractSample', 'knowledge:probe-extract-sample', {
        notebookId,
        sourceId,
        engine,
        ocrLanguage,
        ocrConcurrency,
        visionProviderId,
        visionModelId
      })
      setPages(result.pages || [])
    } catch (e) {
      setError(String((e as Error)?.message || e))
    } finally {
      setProbing(false)
    }
  }

  return (
    <div className={styles.settingsGroup}>
      <div className={styles.sectionLabelRow}>
        <h3 className={styles.sectionLabel}>
          {t('knowledge.extract_probe', '抽取测试')}
        </h3>
        <HelpTooltip
          size={14}
          content={t(
            'knowledge.extract_probe_help',
            '选一份已导入的 PDF，用上方当前抽取方式试抽第 1 页、中间页和最后一页。只展示文字，不会写入资料或嵌入。'
          )}
        />
      </div>
      <section className={styles.settingsCard}>
        <div className={styles.settingsProbeBody}>
          {pdfSources.length === 0 ? (
            <p className={`${styles.settingsRowHint} ${styles.settingsRowHintWrap}`}>
              {t(
                'knowledge.extract_probe_empty',
                '这个笔记本还没有可试抽的 PDF，先导入一份。'
              )}
            </p>
          ) : (
            <>
              <div className={styles.settingsProbeToolbar}>
                <Select
                  className={styles.settingsProbeSelect}
                  size="small"
                  value={sourceId}
                  options={[
                    {
                      value: '',
                      label: t('knowledge.extract_probe_pick', '选择 PDF')
                    },
                    ...pdfSources.map((row) => ({
                      value: row.id,
                      label: row.title
                    }))
                  ]}
                  onChange={(e) => {
                    setSourceId(e.target.value)
                    setPages(null)
                    setError(null)
                  }}
                  disabled={disabled || probing}
                  aria-label={t('knowledge.extract_probe_file', '试抽文件')}
                />
                <Button
                  type="button"
                  disabled={!canRun}
                  onClick={() => void onRun()}
                >
                  {probing
                    ? t('knowledge.extract_probe_running', '正在试抽…')
                    : t('knowledge.extract_probe_run', '开始试抽')}
                </Button>
              </div>
              {selected ? (
                <p className={`${styles.settingsRowHint} ${styles.settingsRowHintWrap}`}>
                  {pageList
                    ? t('knowledge.extract_probe_pages', '将抽取第 {{pages}} 页', {
                        pages: pageList
                      })
                    : t(
                        'knowledge.extract_probe_pages_unknown',
                        '将抽取首页、中间页和末页'
                      )}
                </p>
              ) : null}
              {!engineAvailable ? (
                <p className={`${styles.settingsRowHint} ${styles.settingsRowHintWarn}`}>
                  {engineUnavailableReason ||
                    t('knowledge.extract_probe_unavailable', '当前抽取方式不可用')}
                </p>
              ) : null}
            </>
          )}
          {error ? (
            <p className={`${styles.settingsRowHint} ${styles.settingsRowHintWarn}`}>{error}</p>
          ) : null}
          {pages ? (
            <div className={styles.settingsProbeResults}>
              {pages.map((item) => (
                <article key={item.page} className={styles.settingsProbePage}>
                  <div className={styles.settingsProbePageTitle}>
                    {t('knowledge.extract_probe_page', '第 {{page}} 页', {
                      page: item.page
                    })}
                  </div>
                  <div className={styles.settingsProbeText}>
                    {item.text.trim()
                      ? item.text
                      : t(
                          'knowledge.extract_probe_page_empty',
                          '这一页几乎没有识别出文字'
                        )}
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
