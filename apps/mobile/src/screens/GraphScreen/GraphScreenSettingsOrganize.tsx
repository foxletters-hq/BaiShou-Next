import React from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import {
  GRAPH_EXTRACT_CONCURRENCY_MAX,
  GRAPH_EXTRACT_CONCURRENCY_MIN,
  type UserGender
} from '@baishou/shared'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'
import { Select, useNativeTheme } from '@baishou/ui/native'
import { GraphExtractHelpButton } from './GraphExtractHelpButton'
import { styles } from './GraphScreen.styles'
import type { GraphScreenSettingsSection } from './graph-screen.types'

export function GraphScreenSettingsOrganize(props: {
  settingsSection: GraphScreenSettingsSection
  onToggleProfile?: () => void
  onToggleData: () => void
  profileForm: {
    nickname: string
    birthday: string
    gender: UserGender | ''
    customGender?: string
  }
  onProfileFormChange?: (
    patch: Partial<{
      nickname: string
      birthday: string
      gender: UserGender | ''
      customGender?: string
    }>
  ) => void
  profileErrors?: { nickname?: boolean; birthday?: boolean; gender?: boolean }
  profileBusy?: boolean
  onSaveProfile?: () => void
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
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const router = useRouter()

  return (
    <View style={styles.settingsBody}>
      {/* 身份资料入口：引导前往系统设置统一管理 */}
      <Pressable
        onPress={() => router.push('/settings')}
        style={{
          borderWidth: 1,
          borderColor: colors.borderControl,
          borderRadius: sharedTokens.radius.md,
          backgroundColor: colors.bgSurface,
          paddingHorizontal: sharedTokens.spacing.md,
          paddingVertical: sharedTokens.spacing.smPlus,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
        accessibilityRole="button"
        accessibilityLabel={t('graph.profile_section', '身份资料')}
      >
        <View style={{ gap: sharedTokens.spacing.xxs }}>
          <Text
            style={{
              color: colors.textPrimary,
              fontWeight: '600',
              fontSize: mobileTypography.secondary.fontSize
            }}
          >
            {t('graph.profile_section', '身份资料')}
          </Text>
          <Text
            style={{ color: colors.textSecondary, fontSize: mobileTypography.caption.fontSize }}
          >
            {props.profileForm.nickname
              ? `${props.profileForm.nickname}${props.profileForm.birthday ? ` · ${props.profileForm.birthday}` : ''}`
              : t('graph.profile_goto_settings', '前往系统设置管理身份资料')}
          </Text>
        </View>
        <Text style={{ color: colors.textTertiary, fontSize: 16 }}>›</Text>
      </Pressable>

      {props.extractRunning ? (
        <Pressable onPress={props.onOpenQueue}>
          <Text
            style={{
              color: colors.primary,
              fontSize: mobileTypography.secondary.fontSize,
              fontWeight: '600'
            }}
          >
            {t('graph.queue_view_progress', '查看进度')}
          </Text>
        </Pressable>
      ) : null}

      {/* 同时抽取设置（篇数选择框精致紧凑） */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: sharedTokens.spacing.xsPlus
        }}
      >
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: sharedTokens.spacing.xsPlus }}
        >
          <Text
            style={{ color: colors.textSecondary, fontSize: mobileTypography.secondary.fontSize }}
          >
            {t('graph.extract_concurrency', '同时抽取')}
          </Text>
          <GraphExtractHelpButton size={14} />
        </View>
        <View style={{ width: 78 }}>
          <Select
            variant="settings"
            value={String(props.extractConcurrency)}
            onValueChange={(val) => props.onChangeConcurrency(Number(val))}
            options={Array.from(
              { length: GRAPH_EXTRACT_CONCURRENCY_MAX - GRAPH_EXTRACT_CONCURRENCY_MIN + 1 },
              (_, i) => {
                const n = GRAPH_EXTRACT_CONCURRENCY_MIN + i
                return {
                  value: String(n),
                  label: t('graph.extract_concurrency_option', '{{count}} 篇', { count: n })
                }
              }
            )}
            triggerStyle={{
              minHeight: 30,
              paddingVertical: 2,
              paddingHorizontal: sharedTokens.spacing.xsPlus,
              borderRadius: sharedTokens.radius.md,
              borderWidth: 1,
              borderColor: colors.borderControl,
              backgroundColor: colors.bgSurface
            }}
          />
        </View>
      </View>

      {/* 单篇重梳理（统一 38px 高度与 borderControl / radius.md 边框） */}
      <View style={{ gap: sharedTokens.spacing.xs, marginTop: sharedTokens.spacing.xs }}>
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: mobileTypography.caption.fontSize
          }}
        >
          {t('graph.extract_one_date', '日记日期')}
        </Text>
        <View style={{ flexDirection: 'row', gap: sharedTokens.spacing.sm, alignItems: 'center' }}>
          <TextInput
            value={props.extractDate}
            onChangeText={props.onExtractDateChange}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textSecondary}
            style={{
              flex: 1,
              color: colors.textPrimary,
              borderWidth: 1,
              borderColor: colors.borderControl,
              borderRadius: sharedTokens.radius.md,
              backgroundColor: colors.bgSurface,
              height: 38,
              paddingHorizontal: sharedTokens.spacing.md,
              fontSize: mobileTypography.secondary.fontSize
            }}
          />
          <Pressable
            onPress={props.onRunExtractOne}
            disabled={props.busy}
            style={{
              height: 38,
              borderWidth: 1,
              borderColor: colors.borderControl,
              borderRadius: sharedTokens.radius.md,
              backgroundColor: colors.bgSurface,
              opacity: props.busy ? 0.5 : 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: sharedTokens.spacing.md
            }}
          >
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: mobileTypography.secondary.fontSize,
                fontWeight: '600',
                textAlign: 'center'
              }}
            >
              {t('graph.extract_one_action', '重新梳理这篇')}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* 新建节点 & 合并节点（统一高度 38px，边框与圆角完全对齐） */}
      <View style={{ flexDirection: 'row', gap: sharedTokens.spacing.sm }}>
        <Pressable
          onPress={props.onOpenCreate}
          style={{
            flex: 1,
            height: 38,
            borderWidth: 1,
            borderColor: colors.borderControl,
            borderRadius: sharedTokens.radius.md,
            backgroundColor: colors.bgSurface,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: sharedTokens.spacing.smPlus
          }}
        >
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: mobileTypography.secondary.fontSize,
              fontWeight: '600',
              textAlign: 'center'
            }}
          >
            {t('graph.create_node', '新建节点')}
          </Text>
        </Pressable>
        <Pressable
          onPress={props.onOpenMerge}
          style={{
            flex: 1,
            height: 38,
            borderWidth: 1,
            borderColor: props.mergeSearchOpen ? colors.primary : colors.borderControl,
            borderRadius: sharedTokens.radius.md,
            backgroundColor: props.mergeSearchOpen ? colors.primaryLight : colors.bgSurface,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: sharedTokens.spacing.smPlus
          }}
        >
          <Text
            style={{
              color: props.mergeSearchOpen ? colors.primary : colors.textPrimary,
              fontSize: mobileTypography.secondary.fontSize,
              fontWeight: '600',
              textAlign: 'center'
            }}
          >
            {t('graph.merge_nodes', '合并节点')}
          </Text>
        </Pressable>
      </View>

      {/* 数据操作折叠项 */}
      <View
        style={{
          borderWidth: 1,
          borderColor: colors.borderControl,
          borderRadius: sharedTokens.radius.md,
          backgroundColor: colors.bgSurface,
          overflow: 'hidden',
          marginTop: sharedTokens.spacing.xxs
        }}
      >
        <Pressable
          onPress={props.onToggleData}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: sharedTokens.spacing.md,
            paddingVertical: sharedTokens.spacing.smPlus,
            backgroundColor: props.settingsSection.data
              ? (colors.bgSurfaceRaised ?? colors.bgSurface)
              : colors.bgSurface
          }}
        >
          <Text
            style={{
              color: colors.textPrimary,
              fontWeight: '600',
              fontSize: mobileTypography.secondary.fontSize
            }}
          >
            {t('graph.data_ops', '数据操作')}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            {props.settingsSection.data ? '▲' : '▼'}
          </Text>
        </Pressable>
        {props.settingsSection.data ? (
          <View
            style={{
              paddingHorizontal: sharedTokens.spacing.md,
              paddingTop: sharedTokens.spacing.sm,
              paddingBottom: sharedTokens.spacing.md,
              borderTopWidth: 1,
              borderTopColor: colors.borderSubtle,
              gap: sharedTokens.spacing.sm
            }}
          >
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: mobileTypography.caption.fontSize,
                lineHeight: 18
              }}
            >
              {t(
                'graph.clear_life_hint',
                '删除本工作区人生关系图的全部节点、连线和抽取记录。笔记本关系图不会被改动。'
              )}
            </Text>
            <Pressable
              onPress={props.onClearLifeGraph}
              disabled={props.busy}
              style={{
                height: 38,
                borderWidth: 1,
                borderColor: colors.borderControl,
                borderRadius: sharedTokens.radius.md,
                backgroundColor: colors.bgSurface,
                opacity: props.busy ? 0.5 : 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: sharedTokens.spacing.md
              }}
            >
              <Text
                style={{
                  color: colors.error,
                  fontSize: mobileTypography.secondary.fontSize,
                  fontWeight: '600',
                  textAlign: 'center'
                }}
              >
                {t('graph.clear_life_action', '清空人生关系图')}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  )
}
