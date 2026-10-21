import {
  AgentGateDeniedError,
  AgentGateAlwaysNotAllowedError,
  AgentGateNotFoundError,
  AgentGateEffect,
  AgentGateKind,
  AgentGateReply,
  AgentGateRequestStatus,
  applyCompanionAlwaysAllow,
  assignBaishouAgentGateConfig,
  canPermanentlyAllowAgentGateAction,
  createAgentGateRequestId,
  extractAgentGateResourcesFromMetadata,
  mergeAgentGateResources,
  matchesCommandBlacklist,
  canPermanentlyAllowShellCommand,
  resolveAgentGateToolCoalesceKey,
  resolveCommandPrefixPatternFromCommand,
  resolveCommandPrefixPatternsFromCommand,
  shouldDisableAlwaysForRequest,
  type AgentGateAssertInput,
  type AgentGateConfigScope,
  type AgentGateEvaluateInput,
  type AgentGateReplyInput,
  type AgentGateRequest,
  type AgentGateResolution,
  DEFAULT_BAISHOU_AGENT_GATE_CONFIG,
  type BaishouAgentGateConfig
} from '@baishou/shared'
import { BaishouAgentGatePolicyService } from './baishou-agent-gate-policy.service'
import { BaishouAgentGateAllowlistStore } from './baishou-agent-gate-allowlist.store'
import type { CreateBaishouAgentGateOptions } from './baishou-agent-gate.types'
import { BaishouAgentGateEventBus } from './baishou-agent-gate-event-bus'
import type { IAgentGatePolicy } from './baishou-agent-gate-policy.service'
import type { IAgentGateAllowlistStore } from './baishou-agent-gate-allowlist.store'
import { AgentGateTurnAllowStore } from './baishou-agent-gate-turn-allow'
import type { AgentGateRiskClassifier } from './agent-gate-risk-classifier.types'
import type { EvaluatePolicyInput, IBaishouAgentGate } from './baishou-agent-gate.types'
import { AgentGatePendingRegistry } from './baishou-agent-gate-pending'
import { buildTurnAllowRules, isSafeGateRisk } from './baishou-agent-gate-turn-rule'
import {
  applyAutoReviewClassification,
  applyAutoReviewClassifierFailed,
  shouldApplyAutoReview
} from './baishou-agent-gate-auto-review'

function shellCommandsForBlacklist(input: AgentGateAssertInput): string[] {
  const commands: string[] = []
  for (const resource of input.resources ?? []) {
    if (resource.kind === 'shell_command' && resource.value.trim()) commands.push(resource.value)
  }
  const fromMeta = input.metadata?.shellCommand
  if (typeof fromMeta === 'string' && fromMeta.trim()) commands.push(fromMeta)
  if (input.preview?.type === 'command' && input.preview.command.trim()) {
    commands.push(input.preview.command)
  }
  return commands
}

export type { IBaishouAgentGate, CreateBaishouAgentGateOptions } from './baishou-agent-gate.types'

export class BaishouAgentGateService implements IBaishouAgentGate {
  private readonly pending: AgentGatePendingRegistry
  private readonly turnAllow = new AgentGateTurnAllowStore()
  private readonly configScope?: AgentGateConfigScope
  private readonly isAutoAccept?: () => boolean
  private readonly riskClassifier?: AgentGateRiskClassifier

  constructor(
    private readonly policy: IAgentGatePolicy,
    private readonly allowlistStore: IAgentGateAllowlistStore,
    private readonly eventBus: BaishouAgentGateEventBus,
    configScope?: AgentGateConfigScope,
    isAutoAccept?: () => boolean,
    riskClassifier?: AgentGateRiskClassifier
  ) {
    this.configScope = configScope
    this.isAutoAccept = isAutoAccept
    this.riskClassifier = riskClassifier
    this.pending = new AgentGatePendingRegistry(eventBus, (input) => this.evaluatePolicy(input))
  }

  probeEffect(input: AgentGateEvaluateInput): AgentGateEffect {
    return this.policy.evaluate(input)
  }

  async assert(input: AgentGateAssertInput): Promise<void> {
    await this.assertWithResolution(input)
  }

  async assertWithResolution(input: AgentGateAssertInput): Promise<AgentGateResolution> {
    let assertInput = input

    const assertResources = mergeAgentGateResources(
      assertInput.resources,
      extractAgentGateResourcesFromMetadata(assertInput.metadata)
    )
    let detailed = this.evaluatePolicy({ ...assertInput, resources: assertResources })
    let effect = detailed.effect
    const turnAllowed = this.turnAllow.matches(
      assertInput.sessionId,
      assertInput.action,
      assertResources
    )

    const safeRisk = isSafeGateRisk(assertInput.metadata)

    // 向用户提问必须等答复，不能被策略 Allow / Deny、自动接受或 auto_review 跳过
    if (assertInput.kind === AgentGateKind.Proactive) {
      effect = AgentGateEffect.Ask
    }

    if (effect === AgentGateEffect.Deny) {
      throw new AgentGateDeniedError(assertInput.action)
    }

    // 仅在确实要调分类器时才 await，避免普通 Ask 在登记挂起前让出事件循环
    if (
      this.riskClassifier &&
      shouldApplyAutoReview({
        assertInput,
        effect,
        turnAllowed,
        safeRisk,
        securityMode: this.policy.getConfig().securityMode,
        isAutoAccept: this.isAutoAccept,
        riskClassifier: this.riskClassifier
      })
    ) {
      let reviewed
      try {
        const classified = await this.riskClassifier({
          action: assertInput.action,
          title: assertInput.title,
          description: assertInput.description,
          preview: assertInput.preview,
          resources: assertInput.resources,
          sessionId: assertInput.sessionId
        })
        reviewed = applyAutoReviewClassification(assertInput, effect, classified)
      } catch {
        reviewed = applyAutoReviewClassifierFailed(assertInput)
      }
      assertInput = reviewed.assertInput
      effect = reviewed.effect
      if (reviewed.detailedOverride) {
        detailed = {
          ...detailed,
          effect: reviewed.detailedOverride.effect,
          decisionSource: reviewed.detailedOverride.decisionSource
        }
      }
    }

    const blacklistedCommand =
      assertInput.action === 'workspace_run' &&
      shellCommandsForBlacklist(assertInput).some((command) =>
        matchesCommandBlacklist(command, this.policy.getConfig().commandBlacklist)
      )
    // 本轮「本次允许」不能把黑名单命令带回放行
    if (
      turnAllowed &&
      assertInput.kind === AgentGateKind.Tool &&
      effect === AgentGateEffect.Ask &&
      !blacklistedCommand
    ) {
      effect = AgentGateEffect.Allow
    }
    if (blacklistedCommand && effect === AgentGateEffect.Allow) {
      effect = AgentGateEffect.Ask
    }
    if (blacklistedCommand && assertInput.preview?.type === 'command') {
      assertInput = {
        ...assertInput,
        preview: {
          ...assertInput.preview,
          dangerous: true,
          dangerReason: assertInput.preview.dangerReason ?? '命中命令黑名单，需手动确认'
        }
      }
    }

    const coalesceKey = blacklistedCommand
      ? null
      : resolveAgentGateToolCoalesceKey({
          kind: assertInput.kind,
          action: assertInput.action,
          resources: assertResources,
          preview: assertInput.preview,
          metadata: assertInput.metadata
        })
    if (effect === AgentGateEffect.Ask && coalesceKey) {
      const existing = this.pending.findCoalesciblePending(assertInput.sessionId, coalesceKey)
      if (existing) {
        return this.pending.attachCoalescedWaiter(existing, {
          preview: assertInput.preview
        })
      }
    }

    if (effect === AgentGateEffect.Allow) {
      if (safeRisk && assertInput.kind === AgentGateKind.Tool) {
        for (const turnRule of buildTurnAllowRules({
          action: assertInput.action,
          resources: assertResources,
          alwaysPatterns: Array.isArray(assertInput.metadata?.alwaysPatterns)
            ? (assertInput.metadata.alwaysPatterns as unknown[]).filter(
                (item): item is string => typeof item === 'string' && item.trim().length > 0
              )
            : undefined,
          preview: assertInput.preview
        })) {
          this.turnAllow.add(assertInput.sessionId, turnRule)
        }
      }
      return {
        requestId: '',
        reply: AgentGateReply.Once,
        resolvedAt: Date.now()
      }
    }

    const request = this.createRequest(assertInput, detailed.decisionSource)
    request.coalescedCount = 1
    return this.pending.waitForResolution(
      request,
      assertInput.resources,
      assertInput.profileId,
      coalesceKey
    )
  }

  async ask(input: AgentGateAssertInput): Promise<AgentGateRequest> {
    const detailed = this.evaluatePolicy(input)
    const request = this.createRequest(input, detailed.decisionSource)
    if (detailed.effect === AgentGateEffect.Ask) {
      request.description =
        request.description ?? '该操作需要用户确认；调用 assert() 后将阻塞直至用户回复。'
    }
    return request
  }

  async reply(input: AgentGateReplyInput): Promise<void> {
    const entry = this.pending.get(input.requestId)
    if (!entry) {
      throw new AgentGateNotFoundError(input.requestId)
    }

    const { request } = entry

    const replyResources = mergeAgentGateResources(
      entry.resources,
      extractAgentGateResourcesFromMetadata(request.metadata)
    )

    let alwaysShellPatterns: string[] = []
    const alwaysPatternsFromMeta = Array.isArray(request.metadata?.alwaysPatterns)
      ? (request.metadata.alwaysPatterns as unknown[]).filter(
          (item): item is string => typeof item === 'string' && item.trim().length > 0
        )
      : undefined
    if (input.reply === AgentGateReply.Always) {
      if (
        shouldDisableAlwaysForRequest(request) ||
        !canPermanentlyAllowAgentGateAction(request.action, {
          exclusionList: this.policy.getConfig().exclusionList,
          metadata: request.metadata,
          resources: replyResources,
          alwaysPatterns: alwaysPatternsFromMeta
        })
      ) {
        throw new AgentGateAlwaysNotAllowedError(request.action)
      }
      const shellResource = replyResources.find((r) => r.kind === 'shell_command')
      if (shellResource && !canPermanentlyAllowShellCommand(shellResource.value)) {
        throw new AgentGateAlwaysNotAllowedError(request.action)
      }
      if (
        request.action === 'workspace_run' &&
        shellCommandsForBlacklist(request).some((command) =>
          matchesCommandBlacklist(command, this.policy.getConfig().commandBlacklist)
        )
      ) {
        throw new AgentGateAlwaysNotAllowedError(request.action)
      }
      alwaysShellPatterns =
        alwaysPatternsFromMeta && alwaysPatternsFromMeta.length > 0
          ? alwaysPatternsFromMeta
          : shellResource
            ? resolveCommandPrefixPatternsFromCommand(shellResource.value)
            : []
      if (alwaysShellPatterns.length === 0 && shellResource) {
        const single = resolveCommandPrefixPatternFromCommand(shellResource.value)
        if (single) alwaysShellPatterns = [single]
      }
      if (request.action === 'workspace_run' && alwaysShellPatterns.length === 0) {
        throw new AgentGateAlwaysNotAllowedError(request.action)
      }
    }

    this.pending.delete(input.requestId)

    const resolvedAt = Date.now()
    const resolution: AgentGateResolution = {
      requestId: request.id,
      reply: input.reply,
      message: input.message,
      selectedOptionIds: input.selectedOptionIds,
      questionAnswers: input.questionAnswers,
      resolvedAt
    }

    this.eventBus.publish({
      type: 'agent_gate.replied',
      sessionId: request.sessionId,
      requestId: request.id,
      reply: input.reply,
      message: input.message,
      selectedOptionIds: input.selectedOptionIds,
      questionAnswers: input.questionAnswers
    })

    if (input.reply === AgentGateReply.Reject) {
      this.pending.rejectEntry(entry, resolution)
      this.pending.cascadeRejectSession(request.sessionId, request.id, resolution)
      return
    }

    if (input.reply === AgentGateReply.Always) {
      const liveConfig = this.policy.getConfig()
      const companionNext = applyCompanionAlwaysAllow(liveConfig, request.action)
      if (companionNext) {
        assignBaishouAgentGateConfig(liveConfig as BaishouAgentGateConfig, companionNext)
      } else if (alwaysShellPatterns.length > 0) {
        for (const pattern of alwaysShellPatterns) {
          this.allowlistStore.add({
            action: request.action,
            sourceSessionId: request.sessionId,
            sourceRequestId: request.id,
            pattern,
            resourceKind: 'shell_command' as const
          })
        }
      } else {
        const pathResource = replyResources.find(
          (r) => r.kind === 'workspace_path' || r.kind === 'file_path'
        )
        const pathPattern = pathResource ? pathResource.value.replace(/\\/g, '/') : null
        const explicitExternalPattern =
          alwaysPatternsFromMeta?.[0] && alwaysPatternsFromMeta[0] !== '*'
            ? alwaysPatternsFromMeta[0]
            : null
        const workspaceFileAction = request.action.startsWith('workspace_')
        this.allowlistStore.add({
          action: request.action,
          sourceSessionId: request.sessionId,
          sourceRequestId: request.id,
          ...(request.action === 'external_directory'
            ? explicitExternalPattern
              ? { pattern: explicitExternalPattern, resourceKind: 'external_path' as const }
              : {}
            : workspaceFileAction && pathPattern && pathResource
              ? { pattern: pathPattern, resourceKind: pathResource.kind }
              : alwaysPatternsFromMeta?.[0]
                ? { pattern: alwaysPatternsFromMeta[0] }
                : {})
        })
      }
      // 先放行工具，落盘放到后台，避免伙伴页卡住等写入
      this.pending.resolveEntry(entry, resolution)
      this.pending.cascadeAllowSession(request.sessionId, request.id, request.action, resolution)
      this.eventBus.publish({
        type: 'agent_gate.allowlist_changed',
        allowlist: this.allowlistStore.list(),
        ...(this.configScope ? { scope: this.configScope } : {})
      })
      void this.allowlistStore.persist().catch(() => {
        // 内存配置已生效；落盘失败不挡本轮继续
      })
      return
    }

    if (request.kind === AgentGateKind.Tool) {
      for (const turnRule of buildTurnAllowRules({
        action: request.action,
        resources: replyResources,
        alwaysPatterns: alwaysPatternsFromMeta,
        preview: request.preview
      })) {
        this.turnAllow.add(request.sessionId, turnRule)
      }
    }
    this.pending.resolveEntry(entry, resolution)
    this.pending.cascadeAllowSession(request.sessionId, request.id, request.action, resolution)
  }

  get(requestId: string): AgentGateRequest | undefined {
    return this.pending.get(requestId)?.request
  }

  listPending(sessionId?: string): AgentGateRequest[] {
    return this.pending.list(sessionId)
  }

  cancelSession(
    sessionId: string,
    reason?: string,
    options?: import('./baishou-agent-gate.types').CancelAgentGateSessionOptions
  ): void {
    this.turnAllow.clearSession(sessionId)
    const requestIds = this.pending.cancelSession(sessionId, reason, options?.keepRequest)
    if (requestIds.length === 0) return
    this.eventBus.publish({
      type: 'agent_gate.cancelled',
      sessionId,
      requestIds,
      reason
    })
  }

  private createRequest(
    input: AgentGateAssertInput,
    decisionSource?: import('@baishou/shared').AgentGateDecisionSource
  ): AgentGateRequest {
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
      ...(input.multiple ? { multiple: true } : {}),
      questions: input.questions,
      metadata: {
        ...(input.metadata ?? {}),
        ...(decisionSource ? { decisionSource } : {})
      },
      preview: input.preview,
      previews: input.preview ? [input.preview] : undefined,
      scope: input.scope ?? this.configScope,
      coalescedCount: 1,
      messageId: input.messageId,
      toolCallId: input.toolCallId,
      createdAt: Date.now()
    }
  }

  private evaluatePolicy(input: EvaluatePolicyInput) {
    return this.policy.evaluateDetailed({
      action: input.action,
      toolDisabled: false,
      resources: input.resources,
      metadata: input.metadata,
      profileId: input.profileId,
      preview: input.preview,
      autoAccept: this.isAutoAccept?.() === true,
      sessionRules: this.turnAllow.list(input.sessionId)
    })
  }
}

function cloneDefaultConfig(): BaishouAgentGateConfig {
  return {
    ...DEFAULT_BAISHOU_AGENT_GATE_CONFIG,
    exclusionList: [...DEFAULT_BAISHOU_AGENT_GATE_CONFIG.exclusionList],
    allowlist: []
  }
}

function isBaishouAgentGateConfig(
  value: CreateBaishouAgentGateOptions | BaishouAgentGateConfig | undefined
): value is BaishouAgentGateConfig {
  return !!value && 'exclusionList' in value && !('config' in value) && !('persistConfig' in value)
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
  const config = isBaishouAgentGateConfig(options)
    ? options
    : (options?.config ?? cloneDefaultConfig())

  const persistConfig = isBaishouAgentGateConfig(options) ? undefined : options?.persistConfig
  const eventBus =
    (isBaishouAgentGateConfig(options) ? undefined : options?.eventBus) ??
    new BaishouAgentGateEventBus()
  const configScope = isBaishouAgentGateConfig(options) ? undefined : options?.configScope
  const isAutoAccept = isBaishouAgentGateConfig(options) ? undefined : options?.isAutoAccept
  const riskClassifier = isBaishouAgentGateConfig(options) ? undefined : options?.riskClassifier

  const getConfig = () => config
  const allowlistStore = new BaishouAgentGateAllowlistStore(getConfig, persistConfig)
  const policy = new BaishouAgentGatePolicyService(getConfig, allowlistStore)
  const gate = new BaishouAgentGateService(
    policy,
    allowlistStore,
    eventBus,
    configScope,
    isAutoAccept,
    riskClassifier
  )

  return { gate, eventBus, policy, allowlistStore, getConfig }
}
