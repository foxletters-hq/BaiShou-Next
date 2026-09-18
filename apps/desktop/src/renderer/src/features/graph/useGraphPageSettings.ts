import { useState } from 'react'
import {
  GRAPH_APPEARANCE_DEFAULTS,
  GRAPH_FORCE_DEFAULTS,
  clampGraphAppearanceSettings,
  clampGraphForceSettings,
  loadGraphAppearanceSettings,
  loadGraphForceSettings,
  saveGraphAppearanceSettings,
  saveGraphForceSettings,
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

  const resetGraphSettings = () => {
    setForceSettings({ ...GRAPH_FORCE_DEFAULTS })
    saveGraphForceSettings({ ...GRAPH_FORCE_DEFAULTS })
    setAppearanceSettings({ ...GRAPH_APPEARANCE_DEFAULTS })
    saveGraphAppearanceSettings({ ...GRAPH_APPEARANCE_DEFAULTS })
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
    animationTick,
    updateForce,
    updateAppearance,
    resetGraphSettings,
    resetFilters,
    setAnimationTick
  }
}
