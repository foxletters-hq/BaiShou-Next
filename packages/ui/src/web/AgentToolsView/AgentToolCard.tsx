import React from 'react'
import { useTranslation } from 'react-i18next'
import { ListOrdered, Minus, Plus } from 'lucide-react'
import { Switch } from '../Switch/Switch'
import { HelpTooltip } from '../HelpTooltip'
import type { AgentToolDef, ToolConfigParam, ToolManagementConfig } from './agent-tools.types'
import styles from './AgentToolsView.module.css'

interface AgentToolCardProps {
  tool: AgentToolDef
  config: ToolManagementConfig
  onToggle: (toolId: string) => void
  getToolParam: (toolId: string, param: ToolConfigParam) => unknown
  setToolParam: (toolId: string, key: string, value: unknown) => void
}

export const AgentToolCard: React.FC<AgentToolCardProps> = ({
  tool,
  config,
  onToggle,
  getToolParam,
  setToolParam
}) => {
  const { t } = useTranslation()
  const isEnabled = !(config.disabledToolIds || []).includes(tool.id)
  const hasParams = tool.configurableParams && tool.configurableParams.length > 0

  return (
    <div className={`${styles.toolCard} ${isEnabled ? styles.enabled : styles.disabled}`}>
      <div className={styles.cardMain}>
        <div className={styles.toolIconWrapper}>
          <span className={styles.toolEmoji}>{tool.icon}</span>
        </div>
        <div className={styles.toolInfo}>
          <div className={styles.toolNameRow}>
            <span className={styles.toolName}>{tool.name}</span>
            <HelpTooltip content={t(tool.tooltipKey, t(`agent.tools.${tool.id}_desc`, ''))} />
            <span className={styles.toolIdTag}>{tool.id}</span>
          </div>
        </div>
        <Switch checked={isEnabled} onChange={() => onToggle(tool.id)} />
      </div>

      {hasParams && isEnabled && (
        <div className={styles.paramsWrapper}>
          <div className={styles.paramsDivider} />
          <div className={styles.paramsConfigArea}>
            {tool.configurableParams?.map((param) => {
              const val = getToolParam(tool.id, param) as number

              if (param.type === 'integer') {
                return (
                  <div key={param.key} className={styles.paramItem}>
                    <div className={styles.paramLabelGroup}>
                      {param.icon === 'ListOrdered' && (
                        <ListOrdered size={16} className={styles.paramIcon} />
                      )}
                      <span className={styles.paramLabel}>{param.label}</span>
                      <HelpTooltip
                        content={t(
                          'agent.tools.param_max_results_tooltip',
                          t('agent.tools.param_max_results_desc', '')
                        )}
                      />
                    </div>
                    <div className={styles.stepperContainer}>
                      <button
                        className={styles.stepperBtn}
                        disabled={val <= (param.min ?? 1)}
                        onClick={() => setToolParam(tool.id, param.key, val - 1)}
                      >
                        <Minus size={14} />
                      </button>
                      <input
                        className={styles.stepperInput}
                        type="number"
                        value={val}
                        onChange={(e) => {
                          const parsed = parseInt(e.target.value)
                          if (!isNaN(parsed)) {
                            const clamped = Math.min(
                              Math.max(parsed, param.min ?? 1),
                              param.max ?? 50
                            )
                            setToolParam(tool.id, param.key, clamped)
                          }
                        }}
                      />
                      <button
                        className={styles.stepperBtn}
                        disabled={val >= (param.max ?? 50)}
                        onClick={() => setToolParam(tool.id, param.key, val + 1)}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                )
              }
              return null
            })}
          </div>
        </div>
      )}
    </div>
  )
}
