import React, { useEffect, useMemo, useRef } from 'react'
import { useColorScheme, View, StyleSheet } from 'react-native'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'
import {
  GRAPH_APPEARANCE_DEFAULTS,
  GRAPH_CANVAS_THEME,
  GRAPH_FORCE_DEFAULTS,
  type GraphAppearanceSettings,
  type GraphForceSettings
} from '@baishou/shared'
import { buildGraphForceHtml } from './graph-force-webview-html'
import type { GraphForceEdge, GraphForceNode } from './graph-force-webview.types'
import { injectJson, setToArray, topologyFingerprint } from './graph-force-webview.util'

export type { GraphForceEdge, GraphForceNode } from './graph-force-webview.types'

export const GraphForceWebView: React.FC<{
  nodes: GraphForceNode[]
  edges: GraphForceEdge[]
  forceSettings?: GraphForceSettings
  appearanceSettings?: GraphAppearanceSettings
  selectedId?: string | null
  focusIds?: Set<string> | null
  highlightIds?: Set<string> | null
  highlightEdgeIds?: Set<string> | null
  locateIds?: string[] | null
  locateSeq?: number
  animationTick?: number
  onSelectNode?: (node: {
    id: string
    name: string
    nodeType: string
    reviewStatus?: string
  }) => void
  onClearSelection?: () => void
}> = ({
  nodes,
  edges,
  forceSettings = GRAPH_FORCE_DEFAULTS,
  appearanceSettings = GRAPH_APPEARANCE_DEFAULTS,
  selectedId = null,
  focusIds = null,
  highlightIds = null,
  highlightEdgeIds = null,
  locateIds = null,
  locateSeq = 0,
  animationTick = 0,
  onSelectNode,
  onClearSelection
}) => {
  const colorScheme = useColorScheme() === 'light' ? 'light' : 'dark'
  const canvasBg = GRAPH_CANVAS_THEME[colorScheme].background
  const fp = useMemo(() => topologyFingerprint(nodes, edges), [nodes, edges])
  const html = useMemo(
    () => buildGraphForceHtml(nodes, edges, forceSettings, appearanceSettings, colorScheme),
    // Rebuild only when graph topology or appearance scheme changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fp, colorScheme]
  )

  const webRef = useRef<WebView>(null)
  const forceRef = useRef(forceSettings)
  const appearanceRef = useRef(appearanceSettings)
  const selectedIdRef = useRef(selectedId)
  const focusIdsRef = useRef(focusIds)
  const highlightIdsRef = useRef(highlightIds)
  const highlightEdgeIdsRef = useRef(highlightEdgeIds)
  const locateIdsRef = useRef(locateIds)
  const locateSeqRef = useRef(locateSeq)
  const animationTickRef = useRef(animationTick)
  const nodesRef = useRef(nodes)
  const onSelectRef = useRef(onSelectNode)
  const onClearRef = useRef(onClearSelection)
  const loadedRef = useRef(false)
  /** Skip first locateSeq/animationTick effect so initial load doesn't false-trigger. */
  const locateReadyRef = useRef(false)
  const animReadyRef = useRef(false)
  const prevSelectedIdRef = useRef(selectedId)

  forceRef.current = forceSettings
  appearanceRef.current = appearanceSettings
  selectedIdRef.current = selectedId
  focusIdsRef.current = focusIds
  highlightIdsRef.current = highlightIds
  highlightEdgeIdsRef.current = highlightEdgeIds
  locateIdsRef.current = locateIds
  nodesRef.current = nodes
  onSelectRef.current = onSelectNode
  onClearRef.current = onClearSelection

  const selectionPayload = () => ({
    selectedId: selectedIdRef.current ?? null,
    focusIds: setToArray(focusIdsRef.current),
    highlightIds: setToArray(highlightIdsRef.current),
    highlightEdgeIds: setToArray(highlightEdgeIdsRef.current),
    locateIds: locateIdsRef.current ?? []
  })

  const reinjectAll = (opts?: { locate?: boolean; locateZoom?: boolean }) => {
    injectJson(webRef, 'window.__setGraphForce && window.__setGraphForce', forceRef.current)
    injectJson(
      webRef,
      'window.__setGraphAppearance && window.__setGraphAppearance',
      appearanceRef.current
    )
    injectJson(
      webRef,
      'window.__setGraphSelection && window.__setGraphSelection',
      selectionPayload()
    )
    if (opts?.locate && (selectedIdRef.current || (locateIdsRef.current?.length ?? 0) > 0)) {
      const zoom = opts.locateZoom !== false
      webRef.current?.injectJavaScript(
        `window.__locateSelected && window.__locateSelected(${JSON.stringify({ zoom })}); true;`
      )
    }
  }

  useEffect(() => {
    if (!loadedRef.current) return
    injectJson(webRef, 'window.__patchGraphMeta && window.__patchGraphMeta', { nodes, edges })
  }, [nodes, edges])

  useEffect(() => {
    if (!loadedRef.current) return
    injectJson(webRef, 'window.__setGraphForce && window.__setGraphForce', forceSettings)
  }, [forceSettings])

  useEffect(() => {
    if (!loadedRef.current) return
    injectJson(
      webRef,
      'window.__setGraphAppearance && window.__setGraphAppearance',
      appearanceSettings
    )
  }, [appearanceSettings])

  useEffect(() => {
    if (!loadedRef.current) return
    injectJson(webRef, 'window.__setGraphSelection && window.__setGraphSelection', {
      selectedId: selectedId ?? null,
      focusIds: setToArray(focusIds),
      highlightIds: setToArray(highlightIds),
      highlightEdgeIds: setToArray(highlightEdgeIds),
      locateIds: locateIds ?? []
    })
  }, [selectedId, focusIds, highlightIds, highlightEdgeIds, locateIds])

  useEffect(() => {
    if (!loadedRef.current) {
      locateSeqRef.current = locateSeq
      prevSelectedIdRef.current = selectedId
      return
    }
    const locateBumped = locateSeq !== locateSeqRef.current
    locateSeqRef.current = locateSeq

    if (!locateReadyRef.current) {
      locateReadyRef.current = true
      prevSelectedIdRef.current = selectedId
      return
    }

    if (locateBumped) {
      if (selectedId || (locateIds && locateIds.length > 0)) {
        webRef.current?.injectJavaScript(
          `window.__locateSelected && window.__locateSelected(${JSON.stringify({ zoom: true })}); true;`
        )
      }
      prevSelectedIdRef.current = selectedId
      return
    }

    if (selectedId !== prevSelectedIdRef.current) {
      prevSelectedIdRef.current = selectedId
      if (selectedId) {
        webRef.current?.injectJavaScript(
          `window.__locateSelected && window.__locateSelected(${JSON.stringify({ zoom: false })}); true;`
        )
      }
    }
  }, [selectedId, locateSeq, locateIds])

  useEffect(() => {
    if (!loadedRef.current) {
      animationTickRef.current = animationTick
      return
    }
    if (!animReadyRef.current) {
      animReadyRef.current = true
      animationTickRef.current = animationTick
      return
    }
    if (animationTick === animationTickRef.current) return
    animationTickRef.current = animationTick
    if (animationTick <= 0) return
    webRef.current?.injectJavaScript(`window.__relayout && window.__relayout(); true;`)
  }, [animationTick])

  // Topology rebuild resets WebView — reinject after load.
  useEffect(() => {
    loadedRef.current = false
    locateReadyRef.current = false
    animReadyRef.current = false
  }, [fp])

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as {
        type?: string
        id?: string
        name?: string
        nodeType?: string
        reviewStatus?: string
      }
      if (data.type === 'clear') {
        onClearRef.current?.()
        return
      }
      if (
        data.type === 'select' &&
        typeof data.id === 'string' &&
        typeof data.name === 'string' &&
        typeof data.nodeType === 'string' &&
        data.id.length > 0 &&
        data.id.length < 128 &&
        nodesRef.current.some((n) => n.id === data.id)
      ) {
        onSelectRef.current?.({
          id: data.id,
          name: data.name.slice(0, 200),
          nodeType: data.nodeType.slice(0, 64),
          reviewStatus: data.reviewStatus
        })
      }
    } catch {
      // ignore
    }
  }

  return (
    <View style={styles.wrap}>
      <WebView
        ref={webRef}
        originWhitelist={['about:blank']}
        source={{ html }}
        onMessage={onMessage}
        onLoadEnd={() => {
          loadedRef.current = true
          const hasLocateTarget =
            Boolean(selectedIdRef.current) || (locateIdsRef.current?.length ?? 0) > 0
          const shouldLocate = hasLocateTarget && locateSeqRef.current > 0
          reinjectAll({
            locate: hasLocateTarget,
            locateZoom: shouldLocate
          })
          locateReadyRef.current = true
          animReadyRef.current = true
          prevSelectedIdRef.current = selectedIdRef.current
        }}
        style={[styles.web, { backgroundColor: canvasBg }]}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        setSupportMultipleWindows={false}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 280 },
  web: { flex: 1 }
})
