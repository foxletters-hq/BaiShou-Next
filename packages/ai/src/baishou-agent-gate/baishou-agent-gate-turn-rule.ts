import {
  AgentGateEffect,
  AgentGateRiskLevel,
  resolveCommandPrefixPatternFromCommand,
  type AgentGatePermissionRule,
  type AgentGatePreview,
  type AgentGateResourceRef
} from '@baishou/shared'

export function buildTurnAllowRule(input: {
  action: string
  resources: AgentGateResourceRef[]
  alwaysPatterns?: string[]
  preview?: AgentGatePreview
}): AgentGatePermissionRule | null {
  const declared = input.alwaysPatterns?.find((item) => item.trim().length > 0)?.trim()
  const shellResource = input.resources.find((item) => item.kind === 'shell_command')
  const commandFromPreview =
    input.preview?.type === 'command' ? input.preview.prefixPattern || input.preview.command : null
  const commandPattern =
    declared ||
    (shellResource ? resolveCommandPrefixPatternFromCommand(shellResource.value) : null) ||
    (typeof commandFromPreview === 'string' && commandFromPreview.trim()
      ? (resolveCommandPrefixPatternFromCommand(commandFromPreview) ?? commandFromPreview.trim())
      : null)

  if (input.action === 'workspace_run') {
    if (!commandPattern) return null
    return { action: input.action, effect: AgentGateEffect.Allow, pattern: commandPattern }
  }

  if (input.action === 'external_directory') {
    const external = input.resources.find((item) => item.kind === 'external_path')
    const pattern = declared || (external ? external.value.replace(/\\/g, '/') : null)
    if (!pattern) return null
    return { action: input.action, effect: AgentGateEffect.Allow, pattern }
  }

  return { action: input.action, effect: AgentGateEffect.Allow }
}

export function isSafeGateRisk(metadata?: Record<string, unknown>): boolean {
  return metadata?.riskLevel === AgentGateRiskLevel.Safe
}
