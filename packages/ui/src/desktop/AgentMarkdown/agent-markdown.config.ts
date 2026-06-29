import Latex from '@ant-design/x-markdown/plugins/Latex'
import type { StreamingOption } from '@ant-design/x-markdown'

export const agentMarkedConfig = {
  gfm: true,
  extensions: Latex()
}

/** 流式未完成语法 → 自定义占位组件名（与 Playground 一致） */
export const agentIncompleteMarkdownComponentMap = {
  link: 'loading-link',
  image: 'loading-image',
  table: 'loading-table',
  html: 'loading-html'
} as const

/** 与 Playground 默认一致的流式淡入动画 */
export const agentStreamingAnimationConfig = {
  fadeDuration: 200,
  easing: 'ease-in-out'
} as const

export function buildAgentStreamingOptions(isStreaming: boolean): StreamingOption {
  return {
    hasNextChunk: isStreaming,
    /** 新文本块 opacity 渐显（官网 Playground 效果） */
    enableAnimation: isStreaming,
    animationConfig: agentStreamingAnimationConfig,
    tail: false,
    incompleteMarkdownComponentMap: agentIncompleteMarkdownComponentMap
  }
}
