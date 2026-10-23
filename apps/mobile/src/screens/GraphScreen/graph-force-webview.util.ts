import type { RefObject } from 'react'
import type { WebView } from 'react-native-webview'
import type { GraphForceEdge, GraphForceNode } from './graph-force-webview.types'

/** 远看小点；枢纽略大，但比桌面默认圆点更克制。 */
export const GRAPH_MOBILE_NODE_RADIUS_BASE = 3
export const GRAPH_MOBILE_NODE_RADIUS_MENTION_SCALE = 0.55
export const GRAPH_MOBILE_NODE_RADIUS_MENTION_CAP = 4.5
export const GRAPH_MOBILE_LABEL_ZOOM_HUB = 0.6
export const GRAPH_MOBILE_LABEL_ZOOM_ISOLATED = 1
export const GRAPH_MOBILE_SETTLE_CENTER_SCALE = 0.12
export const GRAPH_MOBILE_HIT_MIN_PX = 14
export const GRAPH_MOBILE_CAMERA_FIT_PADDING = 72
/** 电荷计算的最小距离，近重合时不再让 1/dist² 无限放大。 */
export const GRAPH_MOBILE_CHARGE_MIN_DIST = 8
/** 单步最大位移（世界坐标），防止个别节点被斥力弹到图外。 */
export const GRAPH_MOBILE_MAX_STEP = 24

export function graphMobileNodeRadius(mentionCount: number | undefined, nodeScale: number): number {
  return (
    (GRAPH_MOBILE_NODE_RADIUS_BASE +
      Math.min(
        GRAPH_MOBILE_NODE_RADIUS_MENTION_CAP,
        (mentionCount ?? 1) * GRAPH_MOBILE_NODE_RADIUS_MENTION_SCALE
      )) *
    nodeScale
  )
}

export function graphMobileHitRadius(
  mentionCount: number | undefined,
  nodeScale: number,
  zoomK: number
): number {
  const draw = graphMobileNodeRadius(mentionCount, nodeScale)
  return Math.max(draw, GRAPH_MOBILE_HIT_MIN_PX / Math.max(zoomK, 0.01))
}

export function graphMobileSettleSteps(nodeCount: number): number {
  if (nodeCount > 1200) return 60
  if (nodeCount > 400) return 120
  return 200
}

export function shouldShowMobileGraphLabel(opts: {
  textAlpha: number
  dim: boolean
  nodeId: string
  selectedId?: string | null
  highlighted: boolean
  focusing: boolean
  inFocus: boolean
  isHub: boolean
  isolated?: boolean
  zoomK?: number
}): boolean {
  if (opts.textAlpha <= 0.01 || opts.dim) return false
  const important =
    opts.nodeId === opts.selectedId || opts.highlighted || (opts.focusing && opts.inFocus)
  if (important) return true
  if (!opts.isHub) return false
  const zoomK = opts.zoomK
  if (zoomK != null && zoomK < GRAPH_MOBILE_LABEL_ZOOM_HUB) return false
  if (opts.isolated === true && zoomK != null && zoomK < GRAPH_MOBILE_LABEL_ZOOM_ISOLATED) {
    return false
  }
  return true
}

export function graphMetaFingerprint(nodes: GraphForceNode[], edges: GraphForceEdge[]): string {
  const nids = nodes
    .map(
      (n) =>
        `${n.id}\t${n.name}\t${n.discriminator ?? ''}\t${n.mentionCount ?? 0}\t${n.reviewStatus ?? ''}`
    )
    .slice()
    .sort()
    .join('\n')
  const eids = edges
    .map((e) => `${e.id}\t${e.reviewStatus ?? ''}\t${e.edgeType ?? ''}`)
    .slice()
    .sort()
    .join('\n')
  return `${nids}|${eids}`
}

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
