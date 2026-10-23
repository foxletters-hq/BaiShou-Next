import { useEffect, useState } from 'react'
import {
  GRAPH_VIEW_MAX_NODES_DEFAULT,
  GRAPH_VIEW_MAX_NODES_STORAGE_KEY,
  parseGraphViewMaxNodes
} from '@baishou/shared'
import AsyncStorage from '@react-native-async-storage/async-storage'

/** 图数据视图的最大节点数偏好，按用户维度持久化到本地。 */
export function useKnowledgeDetailViewMaxNodes() {
  const [viewMaxNodes, setViewMaxNodes] = useState(GRAPH_VIEW_MAX_NODES_DEFAULT)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(GRAPH_VIEW_MAX_NODES_STORAGE_KEY)
        if (cancelled) return
        setViewMaxNodes(parseGraphViewMaxNodes(raw))
      } catch {
        // ignore
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const persistViewMaxNodes = async (value: number) => {
    const next = parseGraphViewMaxNodes(JSON.stringify(value))
    setViewMaxNodes(next)
    await AsyncStorage.setItem(GRAPH_VIEW_MAX_NODES_STORAGE_KEY, JSON.stringify(next))
  }

  return { viewMaxNodes, persistViewMaxNodes }
}
