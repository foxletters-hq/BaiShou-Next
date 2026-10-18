type Listener = () => void

const listeners = new Set<Listener>()

export function subscribeMobileSkillsChanged(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function notifyMobileSkillsChanged(): void {
  for (const listener of listeners) listener()
}
