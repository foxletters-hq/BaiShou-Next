import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from 'vitest'

export const dir = dirname(fileURLToPath(import.meta.url))

/** 读取 GraphScreen 目录下的源码 */
export function readSrc(name: string): string {
  return readFileSync(join(dir, '..', name), 'utf8')
}

/** 拆分后的同一职责源码按顺序拼接，便于继续做源码级回归断言 */
export function readSrcGroup(...names: string[]): string {
  return names.map(readSrc).join('\n')
}

export const src = readSrc('GraphScreen.tsx')
export const embeddedSrc = readSrc('GraphScreenEmbeddedPane.tsx')
export const canvasPaneSrc = readSrc('GraphScreenCanvasPane.tsx')
export const monthSheetSrc = readSrc('GraphMonthRangeSheet.tsx')
export const canvasSrc = readSrc('GraphCanvasScreen.tsx')
export const noticeSrc = readSrc('GraphDesktopOnlyNotice.tsx')
export const canvasModelSrc = readSrc('useGraphCanvasModel.ts')
export const emptyGuideSrc = readSrc('GraphScreenEmptyGuide.tsx')
export const awakenSrc = readSrc('GraphAwakenWelcome.tsx')
export const peekSrc = readSrc('GraphCanvasNodePeek.tsx')
export const detailSrc = readSrcGroup(
  'GraphScreenDetailPane.tsx',
  'GraphScreenDetailNodeSection.tsx',
  'GraphScreenDetailEdgeSection.tsx',
  'GraphScreenDetailAddEdgeModal.tsx',
  'graph-screen-detail.types.ts'
)
export const graphStylesSrc = readSrcGroup(
  'GraphScreen.styles.ts',
  'graph-screen-detail.styles.ts',
  'graph-screen-list.styles.ts',
  'graph-screen-overlay.styles.ts',
  'graph-screen-canvas.styles.ts'
)
export const nodeScreenSrc = readSrc('GraphNodeScreen.tsx')
export const searchTabSrc = readSrc('GraphScreenSearchTab.tsx')
export const reextractTabSrc = readSrc('GraphScreenReextractTab.tsx')
export const pendingTabSrc = readSrc('GraphScreenPendingTab.tsx')
export const similarTabSrc = readSrc('GraphScreenSimilarTab.tsx')
export const settingsSrc = readSrc('GraphScreenSettingsSheet.tsx')
export const organizeSrc = readSrc('GraphScreenSettingsOrganize.tsx')
export const canvasSettingsSrc = readSrc('GraphScreenSettingsCanvas.tsx')
export const overlaysSrc = readSrc('GraphScreenOverlays.tsx')
export const extractSrc = readSrc('useGraphScreenExtract.ts')
export const searchSrc = readSrc('useGraphScreenSearch.ts')
export const modelSrc = readSrc('useGraphScreenModel.ts')
export const detailHookSrc = [
  readSrc('useGraphScreenDetail.ts'),
  readSrc('useGraphScreenDetailDelete.ts')
].join('\n')
export const settingsHookSrc = readSrc('useGraphScreenSettings.ts')
export const webviewSrc = [
  readSrc('GraphForceWebView.tsx'),
  readSrc('graph-force-webview-html.ts'),
  readSrc('graph-force-webview.util.ts'),
  readSrc('graph-force-webview-runtime-setup.ts'),
  readSrc('graph-force-webview-runtime-physics.ts'),
  readSrc('graph-force-webview-runtime-gl.ts'),
  readSrc('graph-force-webview-runtime-draw.ts'),
  readSrc('graph-force-webview-runtime-camera.ts'),
  readSrc('graph-force-webview-runtime-input.ts')
].join('\n')
export const sameNameListSrc = readSrc('GraphNodeSameNameList.tsx')
export const createSheetSrc = readSrc('GraphCreateNodeSheet.tsx')
export const splitSheetSrc = readSrc('GraphSplitNodeSheet.tsx')
export const candidatesUtilSrc = readFileSync(
  join(dir, '../../../services/graph-name-candidates.util.ts'),
  'utf8'
)
export const splitServiceSrc = readFileSync(
  join(dir, '../../../services/mobile-graph-split.ts'),
  'utf8'
)

export const pageChrome = [
  src,
  embeddedSrc,
  canvasPaneSrc,
  monthSheetSrc,
  canvasSrc,
  canvasModelSrc,
  emptyGuideSrc,
  peekSrc,
  detailSrc,
  searchTabSrc,
  reextractTabSrc,
  pendingTabSrc,
  similarTabSrc,
  settingsSrc,
  organizeSrc,
  canvasSettingsSrc,
  overlaysSrc,
  extractSrc,
  searchSrc,
  modelSrc,
  detailHookSrc,
  settingsHookSrc
].join('\n')

export function sliceBetween(source: string, start: string, end: string): string {
  const from = source.indexOf(start)
  const to = source.indexOf(end, from + start.length)
  expect(from).toBeGreaterThanOrEqual(0)
  expect(to).toBeGreaterThan(from)
  return source.slice(from, to)
}

export function embedPane(host: string, tag: string, pane: string): string {
  expect(host).toContain(tag)
  return host.replace(tag, `${pane}\n${tag}`)
}
