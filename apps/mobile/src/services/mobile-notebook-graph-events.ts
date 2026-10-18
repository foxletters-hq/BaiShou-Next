type Listener = () => void

const listenersByNotebook = new Map<string, Set<Listener>>()

export function subscribeNotebookGraphChanged(notebookId: string, listener: Listener): () => void {
  const id = notebookId.trim()
  if (!id) return () => undefined
  let set = listenersByNotebook.get(id)
  if (!set) {
    set = new Set()
    listenersByNotebook.set(id, set)
  }
  set.add(listener)
  return () => {
    set.delete(listener)
    if (set.size === 0) {
      listenersByNotebook.delete(id)
    }
  }
}

export function notifyNotebookGraphChanged(notebookId: string): void {
  const id = notebookId.trim()
  if (!id) return
  const set = listenersByNotebook.get(id)
  if (!set) return
  for (const listener of [...set]) {
    try {
      listener()
    } catch {
      // 容错单个监听器异常
    }
  }
}
