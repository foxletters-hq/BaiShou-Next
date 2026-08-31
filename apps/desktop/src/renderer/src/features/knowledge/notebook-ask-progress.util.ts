import type {
  NotebookAskProgress,
  NotebookAskProgressPhase,
  NotebookAskToolState
} from '@baishou/shared'

export type NotebookAskStreamState = {
  phase: NotebookAskProgressPhase
  text: string
  reasoning: string
  tools: NotebookAskToolState[]
}

export const EMPTY_NOTEBOOK_ASK_STREAM: NotebookAskStreamState = {
  phase: 'thinking',
  text: '',
  reasoning: '',
  tools: []
}

export function applyNotebookAskProgress(
  current: NotebookAskStreamState,
  incoming: Pick<NotebookAskProgress, 'phase' | 'text' | 'reasoning' | 'tools'>
): NotebookAskStreamState {
  return {
    phase: incoming.phase,
    text: incoming.text ?? current.text,
    reasoning: incoming.reasoning ?? current.reasoning,
    tools: incoming.tools ?? current.tools
  }
}

export function isNotebookAskAbortError(error: unknown): boolean {
  if (!error) return false
  const name = typeof error === 'object' && 'name' in error ? String(error.name) : ''
  const message = String((error as Error)?.message || error)
  return name === 'AbortError' || /aborted|cancelled|已取消/i.test(message)
}

export function subscribeNotebookAskProgress(
  onProgress: (progress: NotebookAskProgress) => void
): () => void {
  const kn = window.api?.knowledge
  if (typeof kn?.onAskProgress === 'function') {
    return kn.onAskProgress(onProgress)
  }
  const ipc = window.electron?.ipcRenderer
  if (!ipc?.on || !ipc.removeListener) return () => undefined
  const handler = (_event: unknown, progress: NotebookAskProgress) => {
    onProgress(progress)
  }
  ipc.on('knowledge:ask-progress', handler)
  return () => {
    ipc.removeListener('knowledge:ask-progress', handler)
  }
}
