export function resolveWorkspaceRoundUserMessageId(
  messages: ReadonlyArray<{ id: string; role: string }>,
  hoveredMessageId: string | null | undefined
): string | null {
  if (!hoveredMessageId) return null
  const index = messages.findIndex((msg) => msg.id === hoveredMessageId)
  if (index < 0) return null
  for (let i = index; i >= 0; i--) {
    if (messages[i]?.role === 'user') return messages[i]!.id
  }
  return null
}

export function resolveLastWorkspaceUserMessageId(
  messages: ReadonlyArray<{ id: string; role: string }>
): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === 'user') return messages[i]!.id
  }
  return null
}

export function shouldStartWorkspaceBubbleEdit(input: {
  defaultPrevented: boolean
  target: EventTarget | null
  hasNonCollapsedSelection: boolean
}): boolean {
  if (input.defaultPrevented || input.hasNonCollapsedSelection) return false
  if (input.target instanceof Element) {
    if (input.target.closest('button, a, textarea, input, [data-no-bubble-edit]')) {
      return false
    }
  }
  return true
}
