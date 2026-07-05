import React from 'react'
import type { ComponentProps as XMarkdownComponentProps } from '@ant-design/x-markdown'
import { getAgentMarkdownDataRaw } from './agent-markdown.util'
import styles from './AgentMarkdownRenderer.module.css'

const LoadingLink = (props: XMarkdownComponentProps) => {
  const raw = getAgentMarkdownDataRaw(props)
  return <span className={styles.incompleteLink}>{raw || '…'}</span>
}

const LoadingImage = (_props: XMarkdownComponentProps) => (
  <span className={styles.incompletePlaceholder}>Loading image…</span>
)

const LoadingTable = (_props: XMarkdownComponentProps) => (
  <span className={styles.incompletePlaceholder}>Loading table…</span>
)

const LoadingHtml = (props: XMarkdownComponentProps) => {
  const raw = getAgentMarkdownDataRaw(props)
  return <span className={styles.incompletePlaceholder}>{raw || '<html />'}</span>
}

/** 流式进行中、语法未闭合时的占位组件 */
export const agentIncompleteMarkdownComponents = {
  'loading-link': LoadingLink,
  'loading-image': LoadingImage,
  'loading-table': LoadingTable,
  'loading-html': LoadingHtml
} as const
