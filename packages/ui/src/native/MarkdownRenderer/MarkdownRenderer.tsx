import React, { useMemo } from 'react'
import { LegacyMarkdownRenderer } from './LegacyMarkdownRenderer'
import {
  prepareNativeStreamdownMarkdown,
  preserveChatDisplayNewlines
} from './streamdown-markdown.util'

export type MarkdownRendererVariant = 'default' | 'chat' | 'ancillary' | 'preview'

export interface MarkdownRendererProps {
  content: string
  style?: object
  /** 流式进行中：commonmark + 稳定 selectable，减轻块级重排闪烁 */
  isStreaming?: boolean
  /** Gemini 风格流式尾部渐显字符窗口长度 */
  streamingTailFadeChars?: number
  /** chat：气泡正文；ancillary：思考块等附属内容 */
  variant?: MarkdownRendererVariant
  /** 主线程同步 remend，避免首帧高度与点击后布局突变 */
  preferSyncRemend?: boolean
  /** 覆盖默认可选行为；阅读页可关闭以减轻点击时原生选区抖动 */
  selectable?: boolean
  /** 将 attachment/xxx 转为可加载的 file:// URI */
  resolveImageUri?: (src: string) => string | null | undefined
  /** 异步解析 attachment/xxx（Android 外部存储需 data: URI） */
  loadImageUri?: (src: string) => Promise<string | null>
  onImagePress?: (src: string, resolvedUri: string) => void
}

/**
 * 移动端 Markdown 全程走 Legacy。
 * 日记卡片预览若走另一套原生渲染，会在卡片挂载时抛 Property 'Platform' doesn't exist，
 * 并少报高度裁切正文。
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = (props) => {
  const { content, variant = 'default', resolveImageUri } = props
  const useTrailingMargin = variant === 'chat' || variant === 'ancillary'

  const displayContent = useMemo(() => {
    const isChatLike = variant === 'chat' || variant === 'ancillary'
    const prepared = prepareNativeStreamdownMarkdown(content, resolveImageUri, {
      chat: isChatLike
    })
    return useTrailingMargin ? preserveChatDisplayNewlines(prepared) : prepared
  }, [content, resolveImageUri, useTrailingMargin, variant])

  if (!displayContent) return null

  return <LegacyMarkdownRenderer {...props} content={displayContent} />
}
