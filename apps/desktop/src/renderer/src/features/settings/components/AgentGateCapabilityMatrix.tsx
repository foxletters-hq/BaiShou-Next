import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  AgentGateEffect,
  capabilityStateFromConfig,
  getGateCapabilitiesForScene,
  type AgentGateCapabilityEffect,
  type AgentGateCapabilityId,
  type AgentToolScene,
  type BaishouAgentGateConfig
} from '@baishou/shared'
import { HelpTooltip, SegmentedControl, Switch } from '@baishou/ui'
import '@baishou/ui/desktop/shared/SettingsListTile.css'
import {
  capabilityEffectOptions,
  capabilityHint,
  capabilityTitle,
  effectLabel
} from './agent-gate-settings.util'
import pane from './GeneralSettingsPane.module.css'
import styles from './AgentGateSettings.module.css'

export interface AgentGateCapabilityMatrixProps {
  scene: AgentToolScene
  config: BaishouAgentGateConfig
  saving: boolean
  onSaveCapability: (
    effects: Partial<Record<AgentGateCapabilityId, AgentGateCapabilityEffect>>
  ) => void | Promise<void>
  onPatchConfig: (patch: Partial<BaishouAgentGateConfig>) => void | Promise<void>
}

export const AgentGateCapabilityMatrix: React.FC<AgentGateCapabilityMatrixProps> = ({
  scene,
  config,
  saving,
  onSaveCapability,
  onPatchConfig
}) => {
  const { t } = useTranslation()
  const capabilities = getGateCapabilitiesForScene(scene)
  const capabilityState = capabilityStateFromConfig(config, scene)

  return (
    <div className={pane.stackGroup}>
      <div className={pane.sectionLabelRow}>
        <h3 className={pane.sectionLabel}>{t('settings.agent_gate_title', '伙伴操作门控')}</h3>
        <HelpTooltip
          size={14}
          content={t(
            'settings.agent_gate_desc',
            '控制伙伴执行写入、修改等敏感操作前是否需要你确认。'
          )}
        />
      </div>
      <section className={pane.cardSection}>
        <div className={`${pane.cardBody} ${styles.paddedBody}`}>
          {capabilities.map((cap, index) => {
            const current = capabilityState.effects[cap.id] ?? AgentGateEffect.Ask
            const title = capabilityTitle(cap.id, t)
            const hint = capabilityHint(cap.id, t)
            const options = capabilityEffectOptions(cap)

            return (
              <React.Fragment key={cap.id}>
                {index > 0 ? <div className={pane.divider} /> : null}
                <div className={styles.matrixRow}>
                  <div className={styles.matrixText}>
                    <div className={styles.matrixTitle}>{title}</div>
                    <div className={styles.matrixHint}>{hint}</div>
                  </div>
                  <SegmentedControl
                    aria-label={title}
                    value={current}
                    options={options.map((effect) => ({
                      value: effect,
                      label: effectLabel(effect, t),
                      disabled: cap.lockedToAsk && effect !== AgentGateEffect.Ask
                    }))}
                    onChange={(effect) => void onSaveCapability({ [cap.id]: effect })}
                  />
                </div>
              </React.Fragment>
            )
          })}

          <div className={pane.divider} />

          <div className="settings-list-tile settings-list-tile-noclick">
            <div className="settings-list-tile-content">
              <span className="settings-list-tile-title">
                {t('settings.agent_gate_hide_denied', '隐藏被拒绝的工具')}
              </span>
              <span className="settings-list-tile-subtitle">
                {t(
                  'settings.agent_gate_hide_denied_hint',
                  '开启后，当前场景下被默认拒绝的工具不会出现在可选列表中。'
                )}
              </span>
            </div>
            <Switch
              disabled={saving}
              checked={config.hideDeniedTools !== false}
              aria-label={t('settings.agent_gate_hide_denied', '隐藏被拒绝的工具')}
              onChange={(e) => void onPatchConfig({ hideDeniedTools: e.target.checked })}
            />
          </div>
        </div>
      </section>
    </div>
  )
}
