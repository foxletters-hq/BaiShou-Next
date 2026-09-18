import React from 'react'
import { AgentGateTrustCard } from './AgentGateTrustCard'
import { AgentGateProfileCard } from './AgentGateProfileCard'
import { AgentGateListsCard } from './AgentGateListsCard'
import { useAgentGateSettings } from './useAgentGateSettings'

export const AgentGateSettingsSection: React.FC = () => {
  const gate = useAgentGateSettings()

  return (
    <>
      <AgentGateTrustCard
        isFullTrust={gate.isFullTrust}
        hideDeniedTools={gate.config.hideDeniedTools !== false}
        threshold={gate.threshold}
        onTrustToggle={gate.handleTrustToggle}
        onHideDeniedToggle={(v) => gate.handleBoolToggle('hideDeniedTools', v)}
        onThresholdChange={gate.persistThreshold}
      />
      <AgentGateProfileCard
        config={gate.config}
        permissionRules={gate.permissionRules}
        ruleAction={gate.ruleAction}
        rulePattern={gate.rulePattern}
        ruleEffect={gate.ruleEffect}
        onWorkspaceMode={gate.persistWorkspaceMode}
        onRuleAction={gate.setRuleAction}
        onRulePattern={gate.setRulePattern}
        onRuleEffect={gate.setRuleEffect}
        onAddRule={gate.addPermissionRule}
        onRemoveRule={gate.removePermissionRule}
      />
      <AgentGateListsCard
        allowlist={gate.config.allowlist}
        exclusionList={gate.exclusionList}
        exclusionDraft={gate.exclusionDraft}
        notificationPrefs={gate.notificationPrefs}
        onRemoveAllowlist={gate.handleRemoveAllowlist}
        onExclusionDraft={gate.setExclusionDraft}
        onAddExclusion={gate.addExclusion}
        onRemoveExclusion={gate.removeExclusion}
        onNotificationPrefs={gate.updateNotificationPrefs}
      />
    </>
  )
}
