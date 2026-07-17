import {
  AgentGateDeniedError,
  AgentGateRejectedError,
  AgentGateCorrectedError,
  AgentGateNotFoundError,
  AgentGateCancelledError,
  AgentGateAlwaysNotAllowedError,
  AgentGateEffect,
  AgentGateReply,
  AgentGateRequestStatus,
  DEFAULT_AGENT_GATE_REPEAT_ASSERT_ASK_THRESHOLD,
  DEFAULT_BAISHOU_AGENT_GATE_CONFIG,
  buildAgentGateAssertFingerprint,
  canPermanentlyAllowAgentGateAction,
  createAgentGateRequestId,
  extractAgentGateResourcesFromMetadata,
  mergeAgentGateResources,
  resolveCommandPrefixPatternFromCommand,
  type AgentGateAssertInput,
  type AgentGateEvaluateInput,
  type AgentGateProfileId,
  type AgentGateReplyInput,
  type AgentGateRequest,
  type AgentGateResolution,
  type AgentGateResourceRef,
  type BaishouAgentGateConfig
} from '@baishou/shared'
import { BaishouAgentGateEventBus } from './baishou-agent-gate-event-bus'
import {
  BaishouAgentGatePolicyService,
  type IAgentGatePolicy
} from './baishou-agent-gate-policy.service'
import {
  BaishouAgentGateAllowlistStore,
  type IAgentGateAllowlistStore
} from './baishou-agent-gate-allowlist.store'
import { AgentGateRepeatTracker } from './baishou-agent-gate-repeat.tracker'

export interface IBaishouAgentGate {
  assert(input: AgentGateAssertInput): Promise<void>
  assertWithResolution(input: AgentGateAssertInput): Promise<AgentGateResolution>
  ask(input: AgentGateAssertInput): Promise<AgentGateRequest>
  reply(input: AgentGateReplyInput): Promise<void>
  get(requestId: string): AgentGateRequest | undefined
  listPending(sessionId?: string): AgentGateRequest[]
  cancelSession(sessionId: string, reason?: string): void
  /** Non-blocking policy probe (e.g. hideDeniedTools). */
  probeEffect(input: AgentGateEvaluateInput): AgentGateEffect
}

interface PendingEntry {
  request: AgentGateRequest
  fingerprint: string
  resources?: AgentGateResourceRef[]
  profileId?: AgentGateProfileId
  resolve: (resolution: AgentGateResolution) => void
  reject: (error: Error) => void
}

export class BaishouAgentGateService implements IBaishouAgentGate {
  private readonly pending = new Map<string, PendingEntry>()
  private readonly repeatTracker: AgentGateRepeatTracker

  constructor(
    private readonly policy: IAgentGatePolicy,
    private readonly allowlistStore: IAgentGateAllowlistStore,
    private readonly eventBus: BaishouAgentGateEventBus,
    repeatTracker?: AgentGateRepeatTracker
  ) {
    this.repeatTracker = repeatTracker ?? new AgentGateRepeatTracker()
  }

  probeEffect(input: AgentGateEvaluateInput): AgentGateEffect {
    return this.policy.evaluate(input)
  }

  async assert(input: AgentGateAssertInput): Promise<void> {
    await this.assertWithResolution(input)
  }

  async assertWithResolution(input: AgentGateAssertInput): Promise<AgentGateResolution> {
    const fingerprint = buildAgentGateAssertFingerprint(input)
    const threshold =
      this.policy.getConfig().repeatAssertAskThreshold ??
      DEFAULT_AGENT_GATE_REPEAT_ASSERT_ASK_THRESHOLD
    const forceRepeatAsk = this.repeatTracker.shouldForceAsk(
      input.sessionId,
      fingerprint,
      threshold
    )

    let effect = this.policy.evaluate({
      action: input.action,
      toolDisabled: false,
      resources: input.resources,
      metadata: input.metadata,
      profileId: input.profileId
    })

    if (forceRepeatAsk && effect === AgentGateEffect.Allow) {
      effect = AgentGateEffect.Ask
    }

    if (effect === AgentGateEffect.Deny) {
      throw new AgentGateDeniedError(input.action)
    }

    // Count only non-deny asserts (Allow / Ask) toward repeat protection.
    this.repeatTracker.record(input.sessionId, fingerprint)

    if (effect === AgentGateEffect.Allow) {
      return {
        requestId: '',
        reply: AgentGateReply.Once,
        resolvedAt: Date.now()
      }
    }

    const request = this.createRequest(input, fingerprint)
    request.repeatCount = this.repeatTracker.getCount(input.sessionId, fingerprint)
    return this.waitForResolution(request, fingerprint, input.resources, input.profileId)
  }

  async ask(input: AgentGateAssertInput): Promise<AgentGateRequest> {
    const fingerprint = buildAgentGateAssertFingerprint(input)
    const effect = this.policy.evaluate({
      action: input.action,
      toolDisabled: false,
      resources: input.resources,
      metadata: input.metadata,
      profileId: input.profileId
    })
    const request = this.createRequest(input, fingerprint)
    request.repeatCount = this.repeatTracker.getCount(input.sessionId, fingerprint)
    if (effect === AgentGateEffect.Ask) {
      request.description =
        request.description ??
        '该操作需要用户确认；调用 assert() 后将阻塞直至用户回复。'
    }
    return request
  }

  async reply(input: AgentGateReplyInput): Promise<void> {
    const entry = this.pending.get(input.requestId)
    if (!entry) {
      throw new AgentGateNotFoundError(input.requestId)
    }

    const { request } = entry

    if (
      input.reply === AgentGateReply.Always &&
      !canPermanentlyAllowAgentGateAction(request.action, {
        exclusionList: this.policy.getConfig().exclusionList,
        metadata: request.metadata
      })
    ) {
      throw new AgentGateAlwaysNotAllowedError(request.action)
    }

    this.pending.delete(input.requestId)

    const resolvedAt = Date.now()
    const resolution: AgentGateResolution = {
      requestId: request.id,
      reply: input.reply,
      message: input.message,
      selectedOptionIds: input.selectedOptionIds,
      resolvedAt
    }

    this.eventBus.publish({
      type: 'agent_gate.replied',
      sessionId: request.sessionId,
      requestId: request.id,
      reply: input.reply,
      message: input.message,
      selectedOptionIds: input.selectedOptionIds
    })

    if (input.reply === AgentGateReply.Reject) {
      this.repeatTracker.clearSession(request.sessionId)
      this.rejectEntry(entry, resolution)
      this.cascadeRejectSession(request.sessionId, request.id, resolution)
      return
    }

    if (input.reply === AgentGateReply.Always) {
      const resources = mergeAgentGateResources(
        entry.resources,
        extractAgentGateResourcesFromMetadata(request.metadata)
      )
      const shellResource = resources.find((r) => r.kind === 'shell_command')
      const shellPattern = shellResource
        ? resolveCommandPrefixPatternFromCommand(shellResource.value)
        : null
      this.allowlistStore.add({
        action: request.action,
        sourceSessionId: request.sessionId,
        sourceRequestId: request.id,
        ...(shellPattern
          ? { pattern: shellPattern, resourceKind: 'shell_command' as const }
          : {})
      })
      // Resolve first so tool asserts never hang if persist fails.
      this.repeatTracker.clearFingerprint(request.sessionId, entry.fingerprint)
      this.resolveEntry(entry, resolution)
      this.cascadeAllowSession(request.sessionId, request.id, request.action, resolution)
      try {
        await this.allowlistStore.persist()
        this.eventBus.publish({
          type: 'agent_gate.allowlist_changed',
          allowlist: this.allowlistStore.list()
        })
      } catch (error) {
        // In-memory allowlist already updated for this process; surface persist error to caller.
        throw error
      }
      return
    }

    // Once
    this.repeatTracker.clearFingerprint(request.sessionId, entry.fingerprint)
    this.resolveEntry(entry, resolution)
  }

  get(requestId: string): AgentGateRequest | undefined {
    return this.pending.get(requestId)?.request
  }

  listPending(sessionId?: string): AgentGateRequest[] {
    const all = [...this.pending.values()].map((entry) => entry.request)
    if (!sessionId) return all
    return all.filter((request) => request.sessionId === sessionId)
  }

  cancelSession(sessionId: string, reason?: string): void {
    this.repeatTracker.clearSession(sessionId)
    for (const [id, entry] of this.pending.entries()) {
      if (entry.request.sessionId !== sessionId) continue
      entry.request.status = AgentGateRequestStatus.Cancelled
      entry.reject(new AgentGateCancelledError(reason))
      this.pending.delete(id)
    }
  }

  private createRequest(input: AgentGateAssertInput, fingerprint?: string): AgentGateRequest {
    return {
      id: createAgentGateRequestId(),
      sessionId: input.sessionId,
      vaultName: input.vaultName,
      status: AgentGateRequestStatus.Pending,
      kind: input.kind,
      action: input.action,
      title: input.title,
      description: input.description,
      options: input.options ?? [],
      allowCustomInput: input.allowCustomInput ?? false,
      metadata: input.metadata ?? {},
      fingerprint,
      messageId: input.messageId,
      toolCallId: input.toolCallId,
      createdAt: Date.now()
    }
  }

  private waitForResolution(
    request: AgentGateRequest,
    fingerprint: string,
    resources?: AgentGateResourceRef[],
    profileId?: AgentGateProfileId
  ): Promise<AgentGateResolution> {
    return new Promise<AgentGateResolution>((resolve, reject) => {
      this.pending.set(request.id, {
        request,
        fingerprint,
        resources,
        profileId,
        resolve,
        reject
      })
      this.eventBus.publish({ type: 'agent_gate.asked', request })
    })
  }

  private resolveEntry(entry: PendingEntry, resolution: AgentGateResolution): void {
    entry.request.status = AgentGateRequestStatus.Resolved
    entry.request.resolvedAt = resolution.resolvedAt
    entry.resolve(resolution)
  }

  private rejectEntry(entry: PendingEntry, resolution: AgentGateResolution): void {
    entry.request.status = AgentGateRequestStatus.Resolved
    entry.request.resolvedAt = resolution.resolvedAt
    if (resolution.message?.trim()) {
      entry.reject(new AgentGateCorrectedError(resolution.message.trim()))
      return
    }
    entry.reject(new AgentGateRejectedError())
  }

  private cascadeRejectSession(
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
        item.reject(new AgentGateCorrectedError(resolution.message.trim()))
      } else {
        item.reject(new AgentGateRejectedError())
      }
    }
  }

  /**
   * After Always: auto-resolve same-session pending with the same action,
   * only when re-evaluation yields Allow (external_path / Deny must not cascade).
   */
  private cascadeAllowSession(
    sessionId: string,
    skipRequestId: string,
    action: string,
    resolution: AgentGateResolution
  ): void {
    for (const [id, item] of this.pending.entries()) {
      if (item.request.sessionId !== sessionId || id === skipRequestId) continue
      if (item.request.action !== action) continue

      const effect = this.policy.evaluate({
        action: item.request.action,
        resources: item.resources,
        metadata: item.request.metadata,
        profileId: item.profileId
      })
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
      item.resolve(cascaded)
    }
  }
}

export interface CreateBaishouAgentGateOptions {
  config: BaishouAgentGateConfig
  persistConfig?: () => Promise<void>
  eventBus?: BaishouAgentGateEventBus
  repeatTracker?: AgentGateRepeatTracker
}

function cloneDefaultConfig(): BaishouAgentGateConfig {
  return {
    ...DEFAULT_BAISHOU_AGENT_GATE_CONFIG,
    exclusionList: [...DEFAULT_BAISHOU_AGENT_GATE_CONFIG.exclusionList],
    allowlist: []
  }
}

/** 创建可复用的门控实例（测试与运行时 DI） */
export function createBaishouAgentGate(
  options?: CreateBaishouAgentGateOptions | BaishouAgentGateConfig
): {
  gate: BaishouAgentGateService
  eventBus: BaishouAgentGateEventBus
  policy: BaishouAgentGatePolicyService
  allowlistStore: BaishouAgentGateAllowlistStore
  getConfig: () => BaishouAgentGateConfig
  repeatTracker: AgentGateRepeatTracker
} {
  const config =
    options && 'trustMode' in options ? options : (options?.config ?? cloneDefaultConfig())

  const persistConfig = options && 'trustMode' in options ? undefined : options?.persistConfig
  const eventBus =
    (options && 'trustMode' in options ? undefined : options?.eventBus) ??
    new BaishouAgentGateEventBus()
  const repeatTracker =
    (options && 'trustMode' in options ? undefined : options?.repeatTracker) ??
    new AgentGateRepeatTracker()

  const getConfig = () => config
  const allowlistStore = new BaishouAgentGateAllowlistStore(getConfig, persistConfig)
  const policy = new BaishouAgentGatePolicyService(getConfig, allowlistStore)
  const gate = new BaishouAgentGateService(policy, allowlistStore, eventBus, repeatTracker)

  return { gate, eventBus, policy, allowlistStore, getConfig, repeatTracker }
}
