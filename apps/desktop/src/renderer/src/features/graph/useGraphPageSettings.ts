import { useState } from 'react'
import {
  GRAPH_APPEARANCE_DEFAULTS,
  GRAPH_FORCE_DEFAULTS,
  GRAPH_VIEW_MAX_NODES_DEFAULT,
  clampGraphAppearanceSettings,
  clampGraphForceSettings,
  clampGraphViewMaxNodes,
  loadGraphAppearanceSettings,
  loadGraphForceSettings,
  loadGraphViewMaxNodes,
  saveGraphAppearanceSettings,
  saveGraphForceSettings,
  saveGraphViewMaxNodes,
  type GraphAppearanceSettings,
  type GraphForceSettings
} from '@baishou/shared'
import { GRAPH_FILTER_NODE_TYPES, toggleGraphNodeTypeFilter } from './graph-page-display.util'

export function useGraphPageSettings() {
  const [hideEntry, setHideEntry] = useState(true)
  const [approvedOnly, setApprovedOnly] = useState(false)
  const [enabledNodeTypes, setEnabledNodeTypes] = useState<Set<string>>(
    () => new Set(GRAPH_FILTER_NODE_TYPES)
  )
  const [forceSettings, setForceSettings] = useState<GraphForceSettings>(() =>
    loadGraphForceSettings()
  )
  const [appearanceSettings, setAppearanceSettings] = useState<GraphAppearanceSettings>(() =>
    loadGraphAppearanceSettings()
  )
  const [viewMaxNodes, setViewMaxNodes] = useState(() => loadGraphViewMaxNodes())
  const [animationTick, setAnimationTick] = useState(0)

  const toggleNodeTypeFilter = (nodeType: string) => {
    setEnabledNodeTypes((prev) => toggleGraphNodeTypeFilter(prev, nodeType))
  }

  const updateForce = (patch: Partial<GraphForceSettings>) => {
    setForceSettings((prev) => {
      const next = clampGraphForceSettings({ ...prev, ...patch })
      saveGraphForceSettings(next)
      return next
    })
  }

  const updateAppearance = (patch: Partial<GraphAppearanceSettings>) => {
    setAppearanceSettings((prev) => {
      const next = clampGraphAppearanceSettings({ ...prev, ...patch })
      saveGraphAppearanceSettings(next)
      return next
    })
  }

  const updateViewMaxNodes = (value: number) => {
    const next = clampGraphViewMaxNodes(value)
    setViewMaxNodes(next)
    saveGraphViewMaxNodes(next)
  }

  const resetGraphSettings = () => {
    setForceSettings({ ...GRAPH_FORCE_DEFAULTS })
    saveGraphForceSettings({ ...GRAPH_FORCE_DEFAULTS })
    setAppearanceSettings({ ...GRAPH_APPEARANCE_DEFAULTS })
    saveGraphAppearanceSettings({ ...GRAPH_APPEARANCE_DEFAULTS })
    setViewMaxNodes(GRAPH_VIEW_MAX_NODES_DEFAULT)
    saveGraphViewMaxNodes(GRAPH_VIEW_MAX_NODES_DEFAULT)
  }

  const resetFilters = () => {
    setHideEntry(true)
    setApprovedOnly(false)
    setEnabledNodeTypes(new Set(GRAPH_FILTER_NODE_TYPES))
  }

  return {
    hideEntry,
    setHideEntry,
    approvedOnly,
    setApprovedOnly,
    enabledNodeTypes,
    setEnabledNodeTypes,
    toggleNodeTypeFilter,
    forceSettings,
    appearanceSettings,
    viewMaxNodes,
    animationTick,
    updateForce,
    updateAppearance,
    updateViewMaxNodes,
    resetGraphSettings,
    resetFilters,
    setAnimationTick
  }
}
