import { useTranslation } from 'react-i18next'
import React from 'react'
import { AgentGateEffect, companionToolEffectOptions } from '@baishou/shared'
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native'
import { ListOrdered, Minus, Plus } from 'lucide-react-native'
import { useNativeTheme } from '../theme'
import { Switch } from '../Switch'
import { SegmentedControl } from '../SegmentedControl'
import { HelpTooltip } from '../Tooltip/HelpTooltip'
import { AgentToolIcon } from '../icons/agent-tools-icons'
import { AGENT_TOOL_ICON_SIZE, DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import type { AgentToolDef, ToolConfigParam, ToolManagementConfig } from './agent-tools.types'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

export function AgentToolCard({
  tool,
  isLastInGroup,
  config,
  usePermissionMatrix,
  resolveToolEffect,
  onToolEffectChange,
  onToggleTool,
  onSetToolParam,
  getToolParam
}: {
  tool: AgentToolDef
  isLastInGroup: boolean
  config: ToolManagementConfig
  usePermissionMatrix: boolean
  resolveToolEffect?: (toolId: string) => AgentGateEffect
  onToolEffectChange?: (toolId: string, effect: AgentGateEffect) => void
  onToggleTool: (toolId: string) => void
  onSetToolParam: (toolId: string, key: string, value: unknown) => void
  getToolParam: (toolId: string, param: ToolConfigParam) => unknown
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const toggleable = tool.canBeDisabled !== false
  const currentEffect = resolveToolEffect?.(tool.id)
  const isEnabled = usePermissionMatrix
    ? currentEffect !== AgentGateEffect.Deny
    : toggleable
      ? !(config.disabledToolIds || []).includes(tool.id)
      : true
  const hasParams = tool.configurableParams && tool.configurableParams.length > 0
  const effectOptions = companionToolEffectOptions(tool.id)

  const effectLabel = (effect: AgentGateEffect) => {
    if (effect === AgentGateEffect.Allow) return t('settings.agent_gate_effect_allow', '允许')
    if (effect === AgentGateEffect.Deny) return t('settings.agent_gate_effect_deny', '拒绝')
    return t('settings.agent_gate_effect_ask', '询问')
  }

  return (
    <View
      style={
        !isLastInGroup
          ? {
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.borderSubtle
            }
          : undefined
      }
    >
      <View style={styles.cardMain}>
        <View style={styles.cardMainLeading}>
          <View style={[styles.toolIconWrapper, { backgroundColor: colors.primaryLight }]}>
            <AgentToolIcon toolId={tool.id} size={AGENT_TOOL_ICON_SIZE} color={colors.primary} />
          </View>
          <View style={styles.toolInfo}>
            <View style={styles.toolNameRow}>
              <Text style={[styles.toolName, { color: colors.textPrimary }]} numberOfLines={1}>
                {tool.name}
              </Text>
              <HelpTooltip
                content={t(tool.tooltipKey, t(`agent.tools.${tool.id}_desc`, ''))}
                size={16}
              />
            </View>
          </View>
        </View>
        {usePermissionMatrix && currentEffect && onToolEffectChange ? (
          <View style={styles.effectSlot}>
            <SegmentedControl
              size="small"
              stretch={false}
              value={currentEffect}
              accessibilityLabel={tool.name}
              options={effectOptions.map((effect) => ({
                value: effect,
                label: effectLabel(effect)
              }))}
              onChange={(effect) => onToolEffectChange(tool.id, effect)}
            />
          </View>
        ) : usePermissionMatrix ? null : (
          <View style={styles.switchSlot}>
            <Switch
              value={isEnabled}
              disabled={!toggleable}
              onValueChange={() => onToggleTool(tool.id)}
            />
          </View>
        )}
      </View>

      {hasParams && isEnabled && (
        <>
          <View style={[styles.paramsDivider, { backgroundColor: colors.borderSubtle }]} />
          {tool.configurableParams?.map((param) => {
            const val = getToolParam(tool.id, param) as number
            return (
              <View key={param.key} style={[styles.cardMain, styles.paramRow]}>
                <View style={[styles.toolIconWrapper, { backgroundColor: colors.primaryLight }]}>
                  {param.icon === 'ListOrdered' ? (
                    <ListOrdered
                      size={16}
                      color={colors.primary}
                      strokeWidth={DEFAULT_STROKE_WIDTH}
                    />
                  ) : null}
                </View>
                <View style={[styles.toolInfo, styles.paramInfoRow]}>
                  <Text style={[styles.paramLabel, { color: colors.textPrimary }]}>
                    {param.label}
                  </Text>
                  <HelpTooltip
                    content={t(
                      'agent.tools.param_max_results_tooltip',
                      t('agent.tools.param_max_results_desc', '')
                    )}
                    size={14}
                  />
                </View>
                <View style={[styles.stepperContainer, { borderColor: colors.borderMuted }]}>
                  <TouchableOpacity
                    style={[
                      styles.stepperBtn,
                      val <= (param.min ?? 1) && styles.stepperBtnDisabled
                    ]}
                    disabled={val <= (param.min ?? 1)}
                    onPress={() => onSetToolParam(tool.id, param.key, val - 1)}
                  >
                    <Minus
                      size={16}
                      color={colors.textSecondary}
                      strokeWidth={DEFAULT_STROKE_WIDTH}
                    />
                  </TouchableOpacity>
                  <TextInput
                    style={[
                      styles.stepperInput,
                      {
                        color: colors.textPrimary,
                        borderLeftColor: colors.borderMuted,
                        borderRightColor: colors.borderMuted
                      }
                    ]}
                    keyboardType="number-pad"
                    value={String(val)}
                    selectTextOnFocus
                    onChangeText={(text) => {
                      const parsed = parseInt(text, 10)
                      if (!isNaN(parsed)) {
                        const clamped = Math.min(Math.max(parsed, param.min ?? 1), param.max ?? 50)
                        onSetToolParam(tool.id, param.key, clamped)
                      }
                    }}
                  />
                  <TouchableOpacity
                    style={[
                      styles.stepperBtn,
                      val >= (param.max ?? 50) && styles.stepperBtnDisabled
                    ]}
                    disabled={val >= (param.max ?? 50)}
                    onPress={() => onSetToolParam(tool.id, param.key, val + 1)}
                  >
                    <Plus
                      size={16}
                      color={colors.textSecondary}
                      strokeWidth={DEFAULT_STROKE_WIDTH}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            )
          })}
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  cardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sharedTokens.spacing.xs,
    paddingVertical: sharedTokens.spacing.smPlus,
    gap: sharedTokens.spacing.mdTight
  },
  cardMainLeading: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.mdTight,
    minWidth: 0
  },
  switchSlot: {
    flexShrink: 0
  },
  effectSlot: {
    flexShrink: 0
  },
  toolIconWrapper: {
    padding: sharedTokens.spacing.xsPlus,
    borderRadius: sharedTokens.radius.sm,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center'
  },
  toolInfo: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center'
  },
  toolNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm,
    minWidth: 0
  },
  toolName: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600',
    flexShrink: 1
  },
  paramsDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: sharedTokens.spacing.xs
  },
  paramRow: {
    paddingTop: sharedTokens.spacing.sm,
    paddingBottom: sharedTokens.spacing.mdTight
  },
  paramInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xsPlus
  },
  paramLabel: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '500',
    flexShrink: 1
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    borderRadius: sharedTokens.radius.sm,
    borderWidth: 1,
    overflow: 'hidden'
  },
  stepperBtn: {
    width: 32,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepperBtnDisabled: {
    opacity: 0.2
  },
  stepperInput: {
    width: 40,
    height: 32,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 0,
    paddingHorizontal: 0,
    includeFontPadding: false
  }
})
