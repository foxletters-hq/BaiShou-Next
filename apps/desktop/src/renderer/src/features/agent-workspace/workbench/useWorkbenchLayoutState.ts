import { useCallback, useEffect, useMemo, useState } from 'react'

export type WorkbenchSideView = 'files' | 'search' | 'git'

export interface WorkbenchLayoutState {
  sidePaneWidth: number
  agentPanelWidth: number
  agentPanelCollapsed: boolean
  sidePaneVisible: boolean
  activeSideView: WorkbenchSideView
}

const DEFAULT_LAYOUT: WorkbenchLayoutState = {
  sidePaneWidth: 260,
  agentPanelWidth: 380,
  agentPanelCollapsed: false,
  sidePaneVisible: true,
  activeSideView: 'files'
}

const MIN_SIDE_WIDTH = 200
const MAX_SIDE_WIDTH = 480
const MIN_AGENT_WIDTH = 380
const MAX_AGENT_WIDTH = 560

function storageKey(scopeKey: string): string {
  return `baishou:workbench-layout:${scopeKey}`
}

function loadLayout(scopeKey: string): WorkbenchLayoutState {
  try {
    const raw = localStorage.getItem(storageKey(scopeKey))
    if (!raw) return { ...DEFAULT_LAYOUT }
    const parsed = JSON.parse(raw) as Partial<WorkbenchLayoutState>
    return {
      sidePaneWidth: clamp(parsed.sidePaneWidth ?? DEFAULT_LAYOUT.sidePaneWidth, MIN_SIDE_WIDTH, MAX_SIDE_WIDTH),
      agentPanelWidth: clamp(
        parsed.agentPanelWidth ?? DEFAULT_LAYOUT.agentPanelWidth,
        MIN_AGENT_WIDTH,
        MAX_AGENT_WIDTH
      ),
      agentPanelCollapsed: parsed.agentPanelCollapsed ?? DEFAULT_LAYOUT.agentPanelCollapsed,
      sidePaneVisible: parsed.sidePaneVisible ?? DEFAULT_LAYOUT.sidePaneVisible,
      activeSideView: normalizeSideView(parsed.activeSideView),
    }
  } catch {
    return { ...DEFAULT_LAYOUT }
  }
}

function normalizeSideView(view: unknown): WorkbenchSideView {
  if (view === 'files' || view === 'search' || view === 'git') return view
  return DEFAULT_LAYOUT.activeSideView
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function persistLayout(scopeKey: string, state: WorkbenchLayoutState): void {
  localStorage.setItem(storageKey(scopeKey), JSON.stringify(state))
}

export function useWorkbenchLayoutState(scopeKey: string | null) {
  const key = scopeKey || '__default__'
  const [layout, setLayout] = useState<WorkbenchLayoutState>(() => loadLayout(key))

  useEffect(() => {
    setLayout(loadLayout(key))
  }, [key])

  const update = useCallback(
    (patch: Partial<WorkbenchLayoutState>) => {
      setLayout((prev) => {
        const next = { ...prev, ...patch }
        persistLayout(key, next)
        return next
      })
    },
    [key]
  )

  const toggleAgentPanel = useCallback(() => {
    update({ agentPanelCollapsed: !layout.agentPanelCollapsed })
  }, [layout.agentPanelCollapsed, update])

  const toggleSidePane = useCallback(() => {
    update({ sidePaneVisible: !layout.sidePaneVisible })
  }, [layout.sidePaneVisible, update])

  const setActiveSideView = useCallback(
    (view: WorkbenchSideView) => {
      update({ activeSideView: view, sidePaneVisible: true })
    },
    [update]
  )

  const setSidePaneWidth = useCallback(
    (width: number) => {
      update({ sidePaneWidth: clamp(width, MIN_SIDE_WIDTH, MAX_SIDE_WIDTH) })
    },
    [update]
  )

  const setAgentPanelWidth = useCallback(
    (width: number) => {
      update({ agentPanelWidth: clamp(width, MIN_AGENT_WIDTH, MAX_AGENT_WIDTH) })
    },
    [update]
  )

  return useMemo(
    () => ({
      layout,
      toggleAgentPanel,
      toggleSidePane,
      setActiveSideView,
      setSidePaneWidth,
      setAgentPanelWidth,
      updateLayout: update
    }),
    [layout, setActiveSideView, setAgentPanelWidth, setSidePaneWidth, toggleAgentPanel, toggleSidePane, update]
  )
}
