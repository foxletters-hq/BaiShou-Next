import React from 'react'
import { Pressable, ScrollView, Text, useWindowDimensions } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  type GraphAppearanceSettings,
  type GraphFocusDepth,
  type GraphForceSettings,
  type UserGender
} from '@baishou/shared'
import { FloatingModal, useNativeTheme } from '@baishou/ui/native'
import { GraphScreenSettingsCanvas } from './GraphScreenSettingsCanvas'
import { GraphScreenSettingsOrganize } from './GraphScreenSettingsOrganize'
import { styles } from './GraphScreen.styles'
import type { GraphScreenSettingsSection } from './graph-screen.types'

export function GraphScreenSettingsSheet(props: {
  visible: boolean
  onClose: () => void
  settingsSection: GraphScreenSettingsSection
  onToggleSection: (key: keyof GraphScreenSettingsSection) => void
  organize: {
    profileForm: { nickname: string; birthday: string; gender: UserGender | '' }
    onProfileFormChange: (
      patch: Partial<{ nickname: string; birthday: string; gender: UserGender | '' }>
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
  canvas: {
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
    forceSettings: GraphForceSettings
    onForceChange: (patch: Partial<GraphForceSettings>) => void
    onReplayLayout: () => void
    onResetGraphSettings: () => void
  }
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const { width: screenWidth } = useWindowDimensions()

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

        <Pressable onPress={() => props.onToggleSection('organize')} style={styles.settingsHead}>
          <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>
            {props.settingsSection.organize ? '▾ ' : '▸ '}
            {t('graph.side_organize', '整理')}
          </Text>
        </Pressable>
        {props.settingsSection.organize ? (
          <GraphScreenSettingsOrganize
            settingsSection={props.settingsSection}
            onToggleProfile={() => props.onToggleSection('profile')}
            onToggleData={() => props.onToggleSection('data')}
            {...props.organize}
          />
        ) : null}

        <Pressable onPress={() => props.onToggleSection('canvas')} style={styles.settingsHead}>
          <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>
            {props.settingsSection.canvas ? '▾ ' : '▸ '}
            {t('graph.side_canvas', '画布')}
          </Text>
        </Pressable>
        {props.settingsSection.canvas ? (
          <GraphScreenSettingsCanvas
            settingsSection={props.settingsSection}
            onToggleAppearance={() => props.onToggleSection('appearance')}
            onToggleForces={() => props.onToggleSection('forces')}
            {...props.canvas}
          />
        ) : null}

        <Pressable onPress={props.onClose} style={{ alignSelf: 'flex-end', marginTop: 8 }}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>
            {t('common.close', '关闭')}
          </Text>
        </Pressable>
      </ScrollView>
    </FloatingModal>
  )
}
