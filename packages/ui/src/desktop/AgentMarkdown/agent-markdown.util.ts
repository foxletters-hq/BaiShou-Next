import type { ComponentProps as XMarkdownComponentProps } from '@ant-design/x-markdown'

/** 从流式占位组件的 data-raw 属性解码未完成 Markdown 片段 */
export function getAgentMarkdownDataRaw(props: XMarkdownComponentProps): string {
  const raw = (props as Record<string, unknown>)['data-raw']
  if (typeof raw !== 'string' || !raw) return ''
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}
