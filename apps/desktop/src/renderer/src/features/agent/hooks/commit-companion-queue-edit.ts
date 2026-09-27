export async function commitCompanionQueueEdit(input: {
  inputId: string
  text: string
}): Promise<boolean> {
  const updated = await window.api.updatePendingInput({
    inputId: input.inputId,
    text: input.text.trim()
  })
  if (!updated) return false
  window.dispatchEvent(
    new CustomEvent('baishou:companion-pending-inputs-changed', {
      detail: { sessionId: updated.sessionId }
    })
  )
  return true
}
