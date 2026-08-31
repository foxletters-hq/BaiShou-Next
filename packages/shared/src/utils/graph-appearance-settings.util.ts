/** Shared appearance settings for graph canvas (desktop). */

export const GRAPH_APPEARANCE_DEFAULTS = {
  showArrows: false,
  textOpacity: 1,
  nodeSize: 1,
  lineThickness: 1,
  /** Show name when connected edges reach this count. */
  hubLabelMinDegree: 3,
  /** Show name when mentionCount reaches this (visually large nodes). */
  hubLabelMinMentions: 5
} as const

export const GRAPH_APPEARANCE_RANGES = {
  textOpacity: { min: 0, max: 1, step: 0.01 },
  nodeSize: { min: 0.4, max: 2.5, step: 0.05 },
  lineThickness: { min: 0.4, max: 3, step: 0.05 },
  hubLabelMinDegree: { min: 1, max: 30, step: 1 },
  hubLabelMinMentions: { min: 1, max: 50, step: 1 }
} as const

const STORAGE_KEY = 'baishou.graph.appearance.v1'

export const GRAPH_APPEARANCE_STORAGE_KEY = STORAGE_KEY

export type GraphAppearanceSettings = {
  showArrows: boolean
  textOpacity: number
  nodeSize: number
  lineThickness: number
  hubLabelMinDegree: number
  hubLabelMinMentions: number
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

/** Global-view default name: degree or mentionCount reaches the matching threshold. */
export function isGraphHubLabelVisible(input: {
  degree: number
  mentionCount: number
  hubLabelMinDegree: number
  hubLabelMinMentions: number
}): boolean {
  return (
    input.degree >= input.hubLabelMinDegree ||
    input.mentionCount >= input.hubLabelMinMentions
  )
}

export function clampGraphAppearanceSettings(
  partial: Partial<GraphAppearanceSettings> | null | undefined
): GraphAppearanceSettings {
  const textOpacity = Number(partial?.textOpacity)
  const nodeSize = Number(partial?.nodeSize)
  const lineThickness = Number(partial?.lineThickness)
  const hubLabelMinDegree = Number(partial?.hubLabelMinDegree)
  const hubLabelMinMentions = Number(partial?.hubLabelMinMentions)
  return {
    showArrows: Boolean(partial?.showArrows),
    textOpacity: clamp(
      Number.isFinite(textOpacity) ? textOpacity : GRAPH_APPEARANCE_DEFAULTS.textOpacity,
      GRAPH_APPEARANCE_RANGES.textOpacity.min,
      GRAPH_APPEARANCE_RANGES.textOpacity.max
    ),
    nodeSize: clamp(
      Number.isFinite(nodeSize) ? nodeSize : GRAPH_APPEARANCE_DEFAULTS.nodeSize,
      GRAPH_APPEARANCE_RANGES.nodeSize.min,
      GRAPH_APPEARANCE_RANGES.nodeSize.max
    ),
    lineThickness: clamp(
      Number.isFinite(lineThickness)
        ? lineThickness
        : GRAPH_APPEARANCE_DEFAULTS.lineThickness,
      GRAPH_APPEARANCE_RANGES.lineThickness.min,
      GRAPH_APPEARANCE_RANGES.lineThickness.max
    ),
    hubLabelMinDegree: clamp(
      Number.isFinite(hubLabelMinDegree)
        ? Math.round(hubLabelMinDegree)
        : GRAPH_APPEARANCE_DEFAULTS.hubLabelMinDegree,
      GRAPH_APPEARANCE_RANGES.hubLabelMinDegree.min,
      GRAPH_APPEARANCE_RANGES.hubLabelMinDegree.max
    ),
    hubLabelMinMentions: clamp(
      Number.isFinite(hubLabelMinMentions)
        ? Math.round(hubLabelMinMentions)
        : GRAPH_APPEARANCE_DEFAULTS.hubLabelMinMentions,
      GRAPH_APPEARANCE_RANGES.hubLabelMinMentions.min,
      GRAPH_APPEARANCE_RANGES.hubLabelMinMentions.max
    )
  }
}

export function loadGraphAppearanceSettings(): GraphAppearanceSettings {
  try {
    if (typeof localStorage === 'undefined') return { ...GRAPH_APPEARANCE_DEFAULTS }
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...GRAPH_APPEARANCE_DEFAULTS }
    return clampGraphAppearanceSettings(JSON.parse(raw) as Partial<GraphAppearanceSettings>)
  } catch {
    return { ...GRAPH_APPEARANCE_DEFAULTS }
  }
}

export function saveGraphAppearanceSettings(settings: GraphAppearanceSettings) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clampGraphAppearanceSettings(settings)))
  } catch {
    // ignore quota / private mode
  }
}
