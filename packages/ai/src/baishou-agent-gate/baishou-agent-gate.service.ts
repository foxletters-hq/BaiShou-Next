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
  canPermanentlyAllowShellCommand,
  resolveCommandPrefixPatternFromCommand,
  shouldDisableAlwaysForPreview,
  type AgentGateAssertInput,
  type AgentGateConfigScope,
  type AgentGateEvaluateInput,
  type AgentGateProfileId,
  type AgentGateReplyInput,
  type AgentGateRequest,
  type AgentGateResolution,
  type AgentGateResourceRef,
  type BaishouAgentGateConfig,
  i18n
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
import type { AgentGateRiskClassifier } from './agent-gate-risk-classifier.types'

/** 常规读写跳过二次审核；命令等 Allow 项才调模型 */
const AUTO_REVIEW_SKIP_ACTIONS = new Set([
  'workspace_list',
  'workspace_read',
  'workspace_write',
  'workspace_patch',
  'workspace_rename'
])

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
  private readonly configScope?: AgentGateConfigScope
  private readonly isAutoAccept?: () => boolean
  private readonly riskClassifier?: AgentGateRiskClassifier

  constructor(
    private readonly policy: IAgentGatePolicy,
    private readonly allowlistStore: IAgentGateAllowlistStore,
    private readonly eventBus: BaishouAgentGateEventBus,
    repeatTracker?: AgentGateRepeatTracker,
    configScope?: AgentGateConfigScope,
    isAutoAccept?: () => boolean,
    riskClassifier?: AgentGateRiskClassifier
  ) {
    this.repeatTracker = repeatTracker ?? new AgentGateRepeatTracker()
    this.configScope = configScope
    this.isAutoAccept = isAutoAccept
    this.riskClassifier = riskClassifier
  }

  probeEffect(input: AgentGateEvaluateInput): AgentGateEffect {
    return this.policy.evaluate(input)
  }

  async assert(input: AgentGateAssertInput): Promise<void> {
    await this.assertWithResolution(input)
  }

  async assertWithResolution(input: AgentGateAssertInput): Promise<AgentGateResolution> {
    let assertInput = input
    const fingerprint = buildAgentGateAssertFingerprint(assertInput)
    const threshold =
      this.policy.getConfig().repeatAssertAskThreshold ??
      DEFAULT_AGENT_GATE_REPEAT_ASSERT_ASK_THRESHOLD
    const forceRepeatAsk = this.repeatTracker.shouldForceAsk(
      assertInput.sessionId,
      fingerprint,
      threshold
    )

    let detailed = this.policy.evaluateDetailed({
      action: assertInput.action,
      toolDisabled: false,
      resources: assertInput.resources,
      metadata: assertInput.metadata,
      profileId: assertInput.profileId,
      preview: assertInput.preview,
      autoAccept: this.isAutoAccept?.() === true
    })
    let effect = detailed.effect

    if (forceRepeatAsk && effect === AgentGateEffect.Allow) {
      effect = AgentGateEffect.Ask
      detailed = {
        ...detailed,
        effect,
        decisionSource: {
          ...detailed.decisionSource,
          effect,
          clampedFrom: detailed.decisionSource.clampedFrom ?? AgentGateEffect.Allow
        }
      }
    }

    if (effect === AgentGateEffect.Deny) {
      throw new AgentGateDeniedError(assertInput.action)
    }

    // Count only non-deny asserts (Allow / Ask) toward repeat protection.
    this.repeatTracker.record(assertInput.sessionId, fingerprint)

    // auto_review：规则已 Allow 且非黑名单时，再交给模型判断是否仍需人工确认
    if (
      effect === AgentGateEffect.Allow &&
      this.policy.getConfig().securityMode === 'auto_review' &&
      this.isAutoAccept?.() !== true &&
      this.riskClassifier &&
      !AUTO_REVIEW_SKIP_ACTIONS.has(assertInput.action)
    ) {
      try {
        const classified = await this.riskClassifier({
          action: assertInput.action,
          title: assertInput.title,
          description: assertInput.description,
          preview: assertInput.preview,
          resources: assertInput.resources,
          sessionId: assertInput.sessionId
        })
        if (classified.verdict === 'ask') {
          effect = AgentGateEffect.Ask
          detailed = {
            ...detailed,
            effect,
            decisionSource: {
              layer: 'session',
              action: 'auto_review',
              effect: AgentGateEffect.Ask,
              clampedFrom: AgentGateEffect.Allow
            }
          }
          if (classified.reason?.trim()) {
            assertInput = {
              ...assertInput,
              description: classified.reason.trim(),
              metadata: {
                ...(assertInput.metadata ?? {}),
                autoReviewReason: classified.reason.trim()
              }
            }
          }
        }
      } catch {
        // fail-closed：分类失败一律升为 Ask
        effect = AgentGateEffect.Ask
        detailed = {
          ...detailed,
          effect,
          decisionSource: {
            layer: 'session',
            action: 'auto_review',
            effect: AgentGateEffect.Ask,
            clampedFrom: AgentGateEffect.Allow
          }
        }
        assertInput = {
          ...assertInput,
          description:
            assertInput.description ??
            i18n.t(
              'settings.agent_gate_auto_review_incomplete',
              '自动审核未能完成，已改为需要你确认。'
            ),
          metadata: {
            ...(assertInput.metadata ?? {}),
            autoReviewReason: 'classifier_failed'
          }
        }
      }
    }

    if (effect === AgentGateEffect.Allow) {
      return {
        requestId: '',
        reply: AgentGateReply.Once,
        resolvedAt: Date.now()
      }
    }

    const request = this.createRequest(assertInput, fingerprint, detailed.decisionSource)
    request.repeatCount = this.repeatTracker.getCount(assertInput.sessionId, fingerprint)
    return this.waitForResolution(
      request,
      fingerprint,
      assertInput.resources,
      assertInput.profileId
    )
  }

  async ask(input: AgentGateAssertInput): Promise<AgentGateRequest> {
    const fingerprint = buildAgentGateAssertFingerprint(input)
    const detailed = this.policy.evaluateDetailed({
      action: input.action,
      toolDisabled: false,
      resources: input.resources,
      metadata: input.metadata,
      profileId: input.profileId,
      preview: input.preview,
      autoAccept: this.isAutoAccept?.() === true
    })
    const request = this.createRequest(input, fingerprint, detailed.decisionSource)
    request.repeatCount = this.repeatTracker.getCount(input.sessionId, fingerprint)
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

    let alwaysShellPattern: string | null = null
    const alwaysPatternsFromMeta = Array.isArray(request.metadata?.alwaysPatterns)
      ? (request.metadata.alwaysPatterns as unknown[]).filter(
          (item): item is string => typeof item === 'string' && item.trim().length > 0
        )
      : undefined
    if (input.reply === AgentGateReply.Always) {
      if (
        shouldDisableAlwaysForPreview(request.preview) ||
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
      alwaysShellPattern =
        alwaysPatternsFromMeta?.[0] ??
        (shellResource ? resolveCommandPrefixPatternFromCommand(shellResource.value) : null)
      if (request.action === 'workspace_run' && !alwaysShellPattern) {
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
      const pathResource = replyResources.find(
        (r) => r.kind === 'workspace_path' || r.kind === 'file_path'
      )
      const externalResource = replyResources.find((r) => r.kind === 'external_path')
      const pathPattern = pathResource ? pathResource.value.replace(/\\/g, '/') : null
      const externalPattern =
        alwaysPatternsFromMeta?.[0] ??
        (externalResource ? externalResource.value.replace(/\\/g, '/') : null)
      const workspaceFileAction = request.action.startsWith('workspace_')
      this.allowlistStore.add({
        action: request.action,
        sourceSessionId: request.sessionId,
        sourceRequestId: request.id,
        ...(alwaysShellPattern
          ? { pattern: alwaysShellPattern, resourceKind: 'shell_command' as const }
          : request.action === 'external_directory' && externalPattern
            ? { pattern: externalPattern, resourceKind: 'external_path' as const }
            : workspaceFileAction && pathPattern && pathResource
              ? { pattern: pathPattern, resourceKind: pathResource.kind }
              : alwaysPatternsFromMeta?.[0]
                ? { pattern: alwaysPatternsFromMeta[0] }
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
          allowlist: this.allowlistStore.list(),
          ...(this.configScope ? { scope: this.configScope } : {})
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

  private createRequest(
    input: AgentGateAssertInput,
    fingerprint?: string,
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
      metadata: {
        ...(input.metadata ?? {}),
        ...(decisionSource ? { decisionSource } : {})
      },
      preview: input.preview,
      scope: input.scope ?? this.configScope,
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

      // 截断/危险预览必须显式确认，不可被 Always 级联盲放行
      if (shouldDisableAlwaysForPreview(item.request.preview)) {
        continue
      }

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
  /** 写入 allowlist_changed 事件，便于 UI 按场景刷新 */
  configScope?: AgentGateConfigScope
  /** G4：工作区自动接受（运行时查询，不进配置） */
  isAutoAccept?: () => boolean
  /** G5：auto_review 模式下的模型风险分类（可选） */
  riskClassifier?: AgentGateRiskClassifier
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
  repeatTracker: AgentGateRepeatTracker
} {
  const config = isBaishouAgentGateConfig(options)
    ? options
    : (options?.config ?? cloneDefaultConfig())

  const persistConfig = isBaishouAgentGateConfig(options) ? undefined : options?.persistConfig
  const eventBus =
    (isBaishouAgentGateConfig(options) ? undefined : options?.eventBus) ??
    new BaishouAgentGateEventBus()
  const repeatTracker =
    (isBaishouAgentGateConfig(options) ? undefined : options?.repeatTracker) ??
    new AgentGateRepeatTracker()
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
    repeatTracker,
    configScope,
    isAutoAccept,
    riskClassifier
  )

  return { gate, eventBus, policy, allowlistStore, getConfig, repeatTracker }
}
