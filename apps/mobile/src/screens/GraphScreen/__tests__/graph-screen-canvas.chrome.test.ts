import { describe, expect, it } from 'vitest'

import {
  settingsSrc,
  canvasSettingsSrc,
  webviewSrc,
  pageChrome,
  readSrc,
  sliceBetween,
  embedPane
} from './graph-screen-chrome.test-helpers'

describe('GraphScreen chrome - canvas', () => {
  it('keeps isolated nodes on the canvas and uses the switch only for names', () => {
    expect(pageChrome).not.toContain('filterGraphIsolatedDisplayNodes')
    expect(pageChrome).toContain("t('graph.show_isolated_nodes'")
    expect(pageChrome).toContain('showIsolatedNodes')
    expect(webviewSrc).toContain('appearance.showIsolatedNodes !== false')
    expect(webviewSrc).toContain('ISOLATED_CHARGE_SCALE')
    expect(webviewSrc).toContain('MIXED_CHARGE_SCALE')
    expect(webviewSrc).toContain('ISOLATED_CENTER_SCALE')
    expect(webviewSrc).toContain('ISOLATED_SEED')
    expect(webviewSrc).toContain('VELOCITY_DECAY')
    expect(webviewSrc).toContain('CHARGE_DISTANCE_MAX_MIN')
    expect(webviewSrc).toContain("getContext('webgl'")
    expect(webviewSrc).toContain('fillChargeGrid')
    expect(webviewSrc).toContain('GRAPH_FORCE_ISOLATED_PAIRWISE_MAX')
    expect(webviewSrc).toContain('GRAPH_FORCE_ISOLATED_GRID_CELL')
    expect(webviewSrc).toContain('gl_PointSize')
    expect(webviewSrc).toContain('id="labels"')
    expect(canvasSettingsSrc).toContain("t('graph.max_nodes'")
    expect(canvasSettingsSrc).toContain("t('graph.max_nodes_unlimited'")
    expect(canvasSettingsSrc).toContain('graphViewMaxNodesSliderValue')
  })

  it('should keep canvas pan from scrolling the host page', () => {
    const touchStart = webviewSrc.slice(
      webviewSrc.indexOf("canvas.addEventListener('touchstart'"),
      webviewSrc.indexOf("canvas.addEventListener('touchmove'")
    )
    const touchMove = webviewSrc.slice(
      webviewSrc.indexOf("canvas.addEventListener('touchmove'"),
      webviewSrc.indexOf("canvas.addEventListener('touchend'")
    )
    expect(touchStart).toContain('ev.preventDefault()')
    expect(touchStart).not.toContain("type:'interact'")
    const pinchBranch = touchMove.slice(0, touchMove.indexOf('const t=ev.touches[0]'))
    expect(pinchBranch).toContain('requestDraw()')
    expect(touchMove).toContain('ev.preventDefault()')
    expect(touchMove).toContain('{passive:false}')
    expect(webviewSrc).toContain("document.addEventListener('touchstart'")
    expect(webviewSrc).toContain('capture:true')
    expect(webviewSrc).not.toContain('{passive:true}')
    expect(readSrc('GraphForceWebView.tsx')).toContain('nestedScrollEnabled={true}')
    expect(readSrc('GraphForceWebView.tsx')).toContain('scalesPageToFit={false}')
    expect(readSrc('GraphForceWebView.tsx')).not.toContain('onInteract')
  })

  it('should cap near-overlap charge and per-tick movement so no node is flung away', () => {
    expect(webviewSrc).toContain('GRAPH_MOBILE_CHARGE_MIN_DIST')
    expect(webviewSrc).toContain('CHARGE_MIN_DIST2')
    expect(webviewSrc).toContain('GRAPH_MOBILE_MAX_STEP')
    expect(webviewSrc).toContain('MAX_STEP')
    expect(webviewSrc).toContain('speed2 > MAX_STEP*MAX_STEP')
  })

  it('should freeze the mobile canvas after one static settle when animation is off', () => {
    expect(webviewSrc).toContain('function settleLayout()')
    expect(webviewSrc).toContain('settleLayout();')
    expect(webviewSrc).not.toContain('let simRunning = true')
    expect(webviewSrc).not.toContain('\nloop();\n')
    expect(webviewSrc).not.toContain('if(simRunning){')
    expect(webviewSrc).not.toContain('wakeSim();')
    expect(webviewSrc).toContain('easeCameraTowardSelected({ k: targetK, alpha: 1 })')
  })

  it('should draw small dots, hide most names until zoom, and fit the camera after settle', () => {
    expect(webviewSrc).toContain('GRAPH_MOBILE_NODE_RADIUS_BASE = 3')
    expect(webviewSrc).toContain('NODE_RADIUS_BASE = ${GRAPH_MOBILE_NODE_RADIUS_BASE}')
    expect(webviewSrc).toContain('function shouldShowLabel(')
    expect(webviewSrc).toContain('function fitAllNodes()')
    expect(webviewSrc).toContain('fitAllNodes();')
    expect(webviewSrc).toContain('SETTLE_CENTER_SCALE')
    expect(webviewSrc).toContain('graphMetaFingerprint')
  })

  it('keeps month range out of the canvas settings section', () => {
    const canvas = sliceBetween(
      embedPane(settingsSrc, '<GraphScreenSettingsCanvas', canvasSettingsSrc),
      "t('graph.side_canvas', '画布')",
      "t('graph.appearance', '外观')"
    )
    expect(canvasSettingsSrc).toContain('renderDepthChips()')
    expect(canvas).toContain("t('graph.filter'")
    expect(canvas).not.toContain('GraphMonthRangeSheet')
    expect(pageChrome).not.toContain("t('graph.view_section'")
  })
})
