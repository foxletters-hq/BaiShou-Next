import React, { useMemo } from 'react'
import { fileChangeFromMutateInvocation, type MockToolInvocation } from '@baishou/shared'
import { useTranslation } from 'react-i18next'
import { FileChangeDiff } from '../../agent-workspace/FileChangeDiff'
import {
  localizeToolResultText,
  resolveToolResultPresentation
} from '../../shared/tool-result.util'
import { AgentMarkdownRenderer } from '../AgentMarkdown/AgentMarkdownRenderer'
import { CompanionAskResultCard } from './CompanionAskResultCard'
import styles from './ToolResultContent.module.css'

export const ToolResultContent = React.memo(function ToolResultContent({
  invocation
}: {
  invocation: MockToolInvocation
}) {
  const { t } = useTranslation()
  const fileChange = useMemo(() => fileChangeFromMutateInvocation(invocation), [invocation])
  const presentation = useMemo(() => resolveToolResultPresentation(invocation), [invocation])
  const displayText = useMemo(
    () =>
      presentation.mode === 'structured' || presentation.mode === 'companion_ask'
        ? ''
        : localizeToolResultText(presentation.text, t),
    [presentation, t]
  )

  if (fileChange && (fileChange.diff?.trim() || fileChange.kind === 'rename' || fileChange.kind === 'delete')) {
    return <FileChangeDiff data={fileChange} />
  }

  if (presentation.mode === 'companion_ask') {
    return <CompanionAskResultCard data={presentation} />
  }

  return (
    <div className={styles.resultViewport}>
      {presentation.mode === 'plain' && presentation.sourceUrl ? (
        <a
          href={presentation.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className={styles.sourceUrl}
        >
          {presentation.sourceUrl}
        </a>
      ) : null}

      {presentation.mode === 'structured' ? (
        <StructuredToolResult data={presentation.data} />
      ) : presentation.mode === 'plain' && presentation.renderAsMarkdown ? (
        <AgentMarkdownRenderer
          content={displayText}
          variant="ancillary"
          className={styles.markdownBody}
        />
      ) : presentation.mode === 'error' ? (
        <p className={`${styles.resultStatus} ${styles.errorText}`}>{displayText}</p>
      ) : (
        <pre className={styles.resultTextLog}>{displayText}</pre>
      )}
    </div>
  )
})

function StructuredToolResult({ data }: { data: unknown }) {
  if (Array.isArray(data)) {
    return (
      <div className={styles.structDataGrid}>
        {data.map((item, i) => (
          <div key={i} className={styles.structItem}>
            {item?.title && <div className={styles.structTitle}>{item.title}</div>}
            {item?.url && (
              <a href={item.url} target="_blank" rel="noreferrer" className={styles.structLink}>
                {item.url}
              </a>
            )}
            {item?.snippet && <div className={styles.structSnippet}>{item.snippet}</div>}
            {item?.summary && <div className={styles.structSnippet}>{item.summary}</div>}
            {!item?.title &&
              !item?.snippet &&
              typeof item === 'object' &&
              item !== null &&
              Object.keys(item).map((k) => (
                <div className={styles.structValueRow} key={k}>
                  <span className={styles.structKey}>{k}</span>
                  <span className={styles.structVal}>
                    {String((item as Record<string, unknown>)[k])}
                  </span>
                </div>
              ))}
          </div>
        ))}
      </div>
    )
  }

  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>
    return (
      <div className={styles.structDataGrid}>
        {obj.title ? <div className={styles.structTitle}>{String(obj.title)}</div> : null}
        {obj.snippet ? <div className={styles.structSnippet}>{String(obj.snippet)}</div> : null}
        <div className={styles.structItem}>
          {Object.keys(obj)
            .filter((k) => k !== 'title' && k !== 'snippet')
            .map((k) => (
              <div className={styles.structValueRow} key={k}>
                <span className={styles.structKey}>{k}</span>
                <span className={styles.structVal}>{String(obj[k])}</span>
              </div>
            ))}
        </div>
      </div>
    )
  }

  return <pre className={styles.resultTextLog}>{JSON.stringify(data, null, 2)}</pre>
}
