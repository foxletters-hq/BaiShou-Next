import React, { useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  type GraphAppearanceSettings,
  type GraphFocusDepth,
  type GraphForceSettings,
  type UserGender
} from '@baishou/shared'
import { FloatingModal, SegmentedControl, useNativeTheme } from '@baishou/ui/native'
import { GraphScreenSettingsCanvas } from './GraphScreenSettingsCanvas'
import { GraphScreenSettingsOrganize } from './GraphScreenSettingsOrganize'
import { styles } from './GraphScreen.styles'
import type { GraphScreenSettingsSection } from './graph-screen.types'
import { sharedTokens } from '@baishou/ui/theme/tokens'

export function GraphScreenSettingsSheet(props: {
  visible: boolean
  onClose: () => void
  mode: 'organize' | 'canvas'
  settingsSection: GraphScreenSettingsSection
  onToggleSection: (key: keyof GraphScreenSettingsSection) => void
  organize?: {
    profileForm: {
      nickname: string
      birthday: string
      gender: UserGender | ''
      customGender?: string
    }
    onProfileFormChange: (
      patch: Partial<{
        nickname: string
        birthday: string
        gender: UserGender | ''
        customGender?: string
      }>
    ) => void
    profileErrors: { nickname?: boolean; birthday?: boolean; gender?: boolean }
    profileBusy: boolean
    onSaveProfile: () => void
    pendingCount: number
    busy: boolean
    extractRunning: boolean
    extractConcurrency: number
    extractDate: string
    onExtractDateChange: (value: string) => void
    onRunExtract: () => void
    onOpenQueue: () => void
    onChangeConcurrency: (n: number) => void
    onRunExtractOne: () => void
    mergeSearchOpen: boolean
    onOpenCreate: () => void
    onOpenMerge: () => void
    onClearLifeGraph: () => void
  }
  canvas?: {
    filterActive: boolean
    typeFilterActive: boolean
    hideEntry: boolean
    approvedOnly: boolean
    enabledNodeTypes: Set<string>
    filterNodeTypes: string[]
    onHideEntryChange: (value: boolean) => void
    onApprovedOnlyChange: (value: boolean) => void
    onResetFilters: () => void
    onToggleTypeFilter: (nodeType: string) => void
    onToggleAllTypes: () => void
    focusDepth: GraphFocusDepth
    onFocusDepthChange: (depth: GraphFocusDepth) => void
    appearanceSettings: GraphAppearanceSettings
    onAppearanceChange: (patch: Partial<GraphAppearanceSettings>) => void
    viewMaxNodes: number
    onViewMaxNodesChange: (value: number) => void
    forceSettings: GraphForceSettings
    onForceChange: (patch: Partial<GraphForceSettings>) => void
    onReplayLayout: () => void
    onResetGraphSettings: () => void
  }
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const { width: screenWidth } = useWindowDimensions()
  const [activeTab, setActiveTab] = useState<'canvas' | 'organize'>(
    props.mode === 'canvas' ? 'canvas' : 'organize'
  )

  useEffect(() => {
    if (props.visible) {
      setActiveTab(props.mode === 'canvas' ? 'canvas' : 'organize')
    }
  }, [props.visible, props.mode])

  const showTabs = Boolean(props.canvas && props.organize)
  const currentTab = showTabs ? activeTab : props.canvas ? 'canvas' : 'organize'

  return (
    <FloatingModal
      visible={props.visible}
      onClose={props.onClose}
      maxWidth={Math.min(screenWidth - 32, 440)}
    >
      <ScrollView
        style={{ maxHeight: 560 }}
        contentContainerStyle={styles.modalPad}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
          {t('graph.settings', '设置')}
        </Text>

        {showTabs ? (
          <View style={{ marginBottom: sharedTokens.spacing.md }}>
            <SegmentedControl
              size="small"
              value={currentTab}
              onChange={(tab) => setActiveTab(tab as 'canvas' | 'organize')}
              options={[
                { value: 'canvas', label: t('graph.side_canvas', '画布') },
                { value: 'organize', label: t('graph.side_organize', '整理') }
              ]}
            />
          </View>
        ) : null}

        {currentTab === 'canvas' && props.canvas ? (
          <GraphScreenSettingsCanvas
            settingsSection={props.settingsSection}
            onToggleAppearance={() => props.onToggleSection('appearance')}
            onToggleForces={() => props.onToggleSection('forces')}
            {...props.canvas}
          />
        ) : null}

        {currentTab === 'organize' && props.organize ? (
          <GraphScreenSettingsOrganize
            settingsSection={props.settingsSection}
            onToggleProfile={() => props.onToggleSection('profile')}
            onToggleData={() => props.onToggleSection('data')}
            {...props.organize}
          />
        ) : null}

        <Pressable
          onPress={props.onClose}
          style={{ alignSelf: 'flex-end', marginTop: sharedTokens.spacing.sm }}
        >
          <Text style={{ color: colors.primary, fontWeight: '600' }}>
            {t('common.close', '关闭')}
          </Text>
        </Pressable>
      </ScrollView>
    </FloatingModal>
  )
}
