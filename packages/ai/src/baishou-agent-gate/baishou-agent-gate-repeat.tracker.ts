/**
 * In-memory consecutive assert fingerprint counter (per session, not persisted).
 * Used to force Ask when the model retries the same mutating call.
 */
export class AgentGateRepeatTracker {
  private readonly state = new Map<string, { fingerprint: string; count: number }>()

  /**
   * Whether the upcoming assert (count + 1) should force Ask.
   * Threshold 0 disables.
   */
  shouldForceAsk(sessionId: string, fingerprint: string, threshold: number): boolean {
    if (threshold <= 0) return false
    const current = this.state.get(sessionId)
    if (!current || current.fingerprint !== fingerprint) return false
    return current.count + 1 >= threshold
  }

  /** Record that an assert was entered for this fingerprint. */
  record(sessionId: string, fingerprint: string): void {
    const current = this.state.get(sessionId)
    if (!current || current.fingerprint !== fingerprint) {
      this.state.set(sessionId, { fingerprint, count: 1 })
      return
    }
    current.count += 1
  }

  clearFingerprint(sessionId: string, fingerprint: string): void {
    const current = this.state.get(sessionId)
    if (current?.fingerprint === fingerprint) {
      this.state.delete(sessionId)
    }
  }

  clearSession(sessionId: string): void {
    this.state.delete(sessionId)
  }
}
