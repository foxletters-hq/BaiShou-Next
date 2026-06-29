import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { ComponentProps as XMarkdownComponentProps } from '@ant-design/x-markdown'
import markdownStyles from '../MarkdownRenderer/MarkdownRenderer.module.css'
import { agentIncompleteMarkdownComponents } from './agent-markdown-incomplete'

/** 桌面 Agent 气泡内保留的 Markdown 定制：代码复制 + 流式占位 */
export function useAgentMarkdownComponents() {
  const { t } = useTranslation()

  return useMemo(() => {
    const Link = ({ domNode: _domNode, streamStatus: _streamStatus, ...props }: XMarkdownComponentProps) => (
      <a {...props} className={markdownStyles.link} target="_blank" rel="noopener noreferrer" />
    )

    const Code = ({
      domNode: _domNode,
      streamStatus: _streamStatus,
      block,
      lang,
      className,
      children,
      ...props
    }: XMarkdownComponentProps) => {
      const language = lang || /language-(\w+)/.exec(className || '')?.[1]
      if (block) {
        if (language) {
          return (
            <pre className={markdownStyles.codeWrapper}>
              <div className={markdownStyles.codeHeader}>
                <span>{language}</span>
                <button type="button" onClick={() => navigator.clipboard.writeText(String(children))}>
                  {t('markdown.copy', '复制')}
                </button>
              </div>
              <div className={markdownStyles.codeBlock}>
                <code className={className || `language-${language}`} {...props}>
                  {children}
                </code>
              </div>
            </pre>
          )
        }
        return (
          <pre className={markdownStyles.codeWrapper}>
            <div className={markdownStyles.codeBlock}>
              <code className={className} {...props}>
                {children}
              </code>
            </div>
          </pre>
        )
      }
      return (
        <code className={markdownStyles.inlineCode} {...props}>
          {children}
        </code>
      )
    }

    return {
      ...agentIncompleteMarkdownComponents,
      a: Link,
      code: Code
    }
  }, [t])
}
