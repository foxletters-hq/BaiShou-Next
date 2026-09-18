import type { RefObject } from 'react'
import type { WebView } from 'react-native-webview'
import type { GraphForceEdge, GraphForceNode } from './graph-force-webview.types'

export function topologyFingerprint(nodes: GraphForceNode[], edges: GraphForceEdge[]): string {
  const nids = nodes
    .map((n) => n.id)
    .slice()
    .sort()
    .join(',')
  const eids = edges
    .map((e) => e.id)
    .slice()
    .sort()
    .join(',')
  return `${nids}|${eids}`
}

export function setToArray(ids?: Set<string> | null): string[] {
  if (!ids || ids.size === 0) return []
  return Array.from(ids)
}

export function injectJson(webRef: RefObject<WebView | null>, expr: string, value: unknown): void {
  const payload = JSON.stringify(value).replace(/</g, '\\u003c')
  webRef.current?.injectJavaScript(`${expr}(${payload}); true;`)
}
