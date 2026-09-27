export type EditorNavHistory = {
  back: string[]
  current: string | null
  forward: string[]
}

export const EMPTY_EDITOR_NAV: EditorNavHistory = { back: [], current: null, forward: [] }

export function recordEditorFileVisit(history: EditorNavHistory, path: string): EditorNavHistory {
  if (!path || path === history.current) return history
  return {
    back: history.current ? [...history.back, history.current] : history.back,
    current: path,
    forward: []
  }
}

export function stepEditorFileHistory(
  history: EditorNavHistory,
  direction: 'back' | 'forward'
): { history: EditorNavHistory; target: string | null } {
  if (direction === 'back') {
    const target = history.back[history.back.length - 1]
    if (!target) return { history, target: null }
    return {
      target,
      history: {
        back: history.back.slice(0, -1),
        current: target,
        forward: history.current ? [history.current, ...history.forward] : history.forward
      }
    }
  }
  const target = history.forward[0]
  if (!target) return { history, target: null }
  return {
    target,
    history: {
      back: history.current ? [...history.back, history.current] : history.back,
      current: target,
      forward: history.forward.slice(1)
    }
  }
}
