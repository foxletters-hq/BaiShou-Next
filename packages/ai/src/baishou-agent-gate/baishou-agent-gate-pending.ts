import {
  AgentGateCancelledError,
  AgentGateCorrectedError,
  AgentGateEffect,
  AgentGateKind,
  AgentGateRejectedError,
  AgentGateReply,
  AgentGateRequestStatus,
  isWorkspaceEditGateAction,
  mergeAgentGatePreviews,
  shouldDisableAlwaysForRequest,
  type AgentGatePreview,
  type AgentGateResolution
} from '@baishou/shared'
import type { BaishouAgentGateEventBus } from './baishou-agent-gate-event-bus'
import type { AgentGateRepeatTracker } from './baishou-agent-gate-repeat.tracker'
import type { EvaluatePolicyInput, PendingEntry } from './baishou-agent-gate.types'

export class AgentGatePendingRegistry {
  private readonly pending = new Map<string, PendingEntry>()

  constructor(
    private readonly eventBus: BaishouAgentGateEventBus,
    private readonly repeatTracker: AgentGateRepeatTracker,
    private readonly evaluatePolicy: (input: EvaluatePolicyInput) => { effect: AgentGateEffect }
  ) {}

  get(requestId: string) {
    return this.pending.get(requestId)
  }

  list(sessionId?: string) {
    const all = [...this.pending.values()].map((entry) => entry.request)
    if (!sessionId) return all
    return all.filter((request) => request.sessionId === sessionId)
  }

  waitForResolution(
    request: import('@baishou/shared').AgentGateRequest,
    fingerprint: string,
    resources?: import('@baishou/shared').AgentGateResourceRef[],
    profileId?: import('@baishou/shared').AgentGateProfileId,
    coalesceKey?: string | null
  ): Promise<AgentGateResolution> {
    return new Promise<AgentGateResolution>((resolve, reject) => {
      this.pending.set(request.id, {
        request,
        fingerprint,
        coalesceKey,
        resources,
        profileId,
        waiters: [{ resolve, reject }]
      })
      this.eventBus.publish({ type: 'agent_gate.asked', request })
    })
  }

  findCoalesciblePending(sessionId: string, coalesceKey: string): PendingEntry | undefined {
    for (const entry of this.pending.values()) {
      if (entry.request.sessionId !== sessionId) continue
      if (entry.request.kind !== AgentGateKind.Tool) continue
      if (entry.coalesceKey === coalesceKey) return entry
    }
    return undefined
  }

  attachCoalescedWaiter(
    entry: PendingEntry,
    incoming?: { preview?: AgentGatePreview; previews?: AgentGatePreview[] }
  ): Promise<AgentGateResolution> {
    return new Promise<AgentGateResolution>((resolve, reject) => {
      entry.waiters.push({ resolve, reject })
      entry.request.coalescedCount = entry.waiters.length
      const previews = mergeAgentGatePreviews(entry.request, incoming)
      if (previews.length > 0) {
        entry.request.previews = previews
        if (!entry.request.preview) entry.request.preview = previews[0]
      }
      this.eventBus.publish({ type: 'agent_gate.asked', request: entry.request })
    })
  }

  resolveEntry(entry: PendingEntry, resolution: AgentGateResolution): void {
    entry.request.status = AgentGateRequestStatus.Resolved
    entry.request.resolvedAt = resolution.resolvedAt
    for (const waiter of entry.waiters) {
      waiter.resolve(resolution)
    }
  }

  rejectEntry(entry: PendingEntry, resolution: AgentGateResolution): void {
    entry.request.status = AgentGateRequestStatus.Resolved
    entry.request.resolvedAt = resolution.resolvedAt
    if (resolution.message?.trim()) {
      const error = new AgentGateCorrectedError(resolution.message.trim())
      for (const waiter of entry.waiters) {
        waiter.reject(error)
      }
      return
    }
    const error = new AgentGateRejectedError()
    for (const waiter of entry.waiters) {
      waiter.reject(error)
    }
  }

  delete(requestId: string): void {
    this.pending.delete(requestId)
  }

  cascadeRejectSession(
    sessionId: string,
    skipRequestId: string,
    resolution: AgentGateResolution
  ): void {
    for (const [id, item] of this.pending.entries()) {
      if (item.request.sessionId !== sessionId || id === skipRequestId) continue
      item.request.status = AgentGateRequestStatus.Resolved
      item.request.resolvedAt = resolution.resolvedAt
      this.pending.delete(id)
      this.eventBus.publish({
        type: 'agent_gate.replied',
        sessionId: item.request.sessionId,
        requestId: item.request.id,
        reply: AgentGateReply.Reject,
        message: resolution.message,
        selectedOptionIds: resolution.selectedOptionIds
      })
      if (resolution.message?.trim()) {
        const error = new AgentGateCorrectedError(resolution.message.trim())
        for (const waiter of item.waiters) {
          waiter.reject(error)
        }
      } else {
        const error = new AgentGateRejectedError()
        for (const waiter of item.waiters) {
          waiter.reject(error)
        }
      }
    }
  }

  /**
   * After Always / Once: auto-resolve same-session pending with the same action,
   * only when re-evaluation yields Allow (external_path / Deny must not cascade).
   */
  cascadeAllowSession(
    sessionId: string,
    skipRequestId: string,
    action: string,
    resolution: AgentGateResolution
  ): void {
    for (const [id, item] of this.pending.entries()) {
      if (item.request.sessionId !== sessionId || id === skipRequestId) continue
      if (item.request.action !== action && !sameWorkspaceEditFamily(item.request.action, action)) {
        continue
      }

      // 区外路径必须单独确认，不能被区内写入的本次允许带走
      if (item.resources?.some((resource) => resource.kind === 'external_path')) {
        continue
      }

      // Always 不级联截断/危险预览；本次允许覆盖本轮已挂起的同类编辑
      if (
        resolution.reply === AgentGateReply.Always &&
        shouldDisableAlwaysForRequest(item.request)
      ) {
        continue
      }

      const effect = this.evaluatePolicy({
        sessionId,
        action: item.request.action,
        resources: item.resources,
        metadata: item.request.metadata,
        profileId: item.profileId,
        preview: item.request.preview
      }).effect
      if (effect !== AgentGateEffect.Allow) {
        continue
      }

      item.request.status = AgentGateRequestStatus.Resolved
      item.request.resolvedAt = resolution.resolvedAt
      this.pending.delete(id)
      this.repeatTracker.clearFingerprint(sessionId, item.fingerprint)

      const cascaded: AgentGateResolution = {
        requestId: item.request.id,
        reply: AgentGateReply.Once,
        resolvedAt: resolution.resolvedAt
      }

      this.eventBus.publish({
        type: 'agent_gate.replied',
        sessionId: item.request.sessionId,
        requestId: item.request.id,
        reply: AgentGateReply.Once
      })
      for (const waiter of item.waiters) {
        waiter.resolve(cascaded)
      }
    }
  }

  cancelSession(sessionId: string, reason?: string): string[] {
    const requestIds: string[] = []
    for (const [id, entry] of this.pending.entries()) {
      if (entry.request.sessionId !== sessionId) continue
      entry.request.status = AgentGateRequestStatus.Cancelled
      for (const waiter of entry.waiters) {
        waiter.reject(new AgentGateCancelledError(reason))
      }
      this.pending.delete(id)
      requestIds.push(id)
    }
    return requestIds
  }
}

function sameWorkspaceEditFamily(left: string, right: string): boolean {
  return isWorkspaceEditGateAction(left) && isWorkspaceEditGateAction(right)
}
