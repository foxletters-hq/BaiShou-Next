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
  createAgentGateRequestId,
  DEFAULT_BAISHOU_AGENT_GATE_CONFIG,
  type AgentGateAssertInput,
  type AgentGateReplyInput,
  type AgentGateRequest,
  type AgentGateResolution,
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

export interface IBaishouAgentGate {
  assert(input: AgentGateAssertInput): Promise<void>
  assertWithResolution(input: AgentGateAssertInput): Promise<AgentGateResolution>
  ask(input: AgentGateAssertInput): Promise<AgentGateRequest>
  reply(input: AgentGateReplyInput): Promise<void>
  get(requestId: string): AgentGateRequest | undefined
  listPending(sessionId?: string): AgentGateRequest[]
  cancelSession(sessionId: string, reason?: string): void
}

interface PendingEntry {
  request: AgentGateRequest
  resolve: (resolution: AgentGateResolution) => void
  reject: (error: Error) => void
}

export class BaishouAgentGateService implements IBaishouAgentGate {
  private readonly pending = new Map<string, PendingEntry>()

  constructor(
    private readonly policy: IAgentGatePolicy,
    private readonly allowlistStore: IAgentGateAllowlistStore,
    private readonly eventBus: BaishouAgentGateEventBus
  ) {}

  async assert(input: AgentGateAssertInput): Promise<void> {
    await this.assertWithResolution(input)
  }

  async assertWithResolution(input: AgentGateAssertInput): Promise<AgentGateResolution> {
    const effect = this.policy.evaluate({
      action: input.action,
      toolDisabled: false
    })

    if (effect === AgentGateEffect.Allow) {
      return {
        requestId: '',
        reply: AgentGateReply.Once,
        resolvedAt: Date.now()
      }
    }

    if (effect === AgentGateEffect.Deny) {
      throw new AgentGateDeniedError(input.action)
    }

    const request = this.createRequest(input)
    return this.waitForResolution(request)
  }

  async ask(input: AgentGateAssertInput): Promise<AgentGateRequest> {
    const effect = this.policy.evaluate({
      action: input.action,
      toolDisabled: false
    })
    const request = this.createRequest(input)
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

    if (input.reply === AgentGateReply.Always && this.policy.isExcluded(request.action)) {
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
      this.rejectEntry(entry, resolution)
      this.cascadeRejectSession(request.sessionId, request.id, resolution)
      return
    }

    if (input.reply === AgentGateReply.Always) {
      this.allowlistStore.add({
        action: request.action,
        sourceSessionId: request.sessionId,
        sourceRequestId: request.id
      })
      await this.allowlistStore.persist()
      this.eventBus.publish({
        type: 'agent_gate.allowlist_changed',
        allowlist: this.allowlistStore.list()
      })
    }

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
    for (const [id, entry] of this.pending.entries()) {
      if (entry.request.sessionId !== sessionId) continue
      entry.request.status = AgentGateRequestStatus.Cancelled
      entry.reject(new AgentGateCancelledError(reason))
      this.pending.delete(id)
    }
  }

  private createRequest(input: AgentGateAssertInput): AgentGateRequest {
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
      messageId: input.messageId,
      toolCallId: input.toolCallId,
      createdAt: Date.now()
    }
  }

  private waitForResolution(request: AgentGateRequest): Promise<AgentGateResolution> {
    return new Promise<AgentGateResolution>((resolve, reject) => {
      this.pending.set(request.id, { request, resolve, reject })
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
      item.reject(new AgentGateRejectedError())
    }
  }
}

export interface CreateBaishouAgentGateOptions {
  config: BaishouAgentGateConfig
  persistConfig?: () => Promise<void>
  eventBus?: BaishouAgentGateEventBus
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
} {
  const config =
    options && 'trustMode' in options ? options : (options?.config ?? cloneDefaultConfig())

  const persistConfig = options && 'trustMode' in options ? undefined : options?.persistConfig
  const eventBus = (options && 'trustMode' in options ? undefined : options?.eventBus) ??
    new BaishouAgentGateEventBus()

  const getConfig = () => config
  const allowlistStore = new BaishouAgentGateAllowlistStore(getConfig, persistConfig)
  const policy = new BaishouAgentGatePolicyService(getConfig, allowlistStore)
  const gate = new BaishouAgentGateService(policy, allowlistStore, eventBus)

  return { gate, eventBus, policy, allowlistStore, getConfig }
}
