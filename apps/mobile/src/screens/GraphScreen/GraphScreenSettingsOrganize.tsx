import React from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  GRAPH_EXTRACT_CONCURRENCY_MAX,
  GRAPH_EXTRACT_CONCURRENCY_MIN,
  USER_GENDER_OPTIONS,
  type UserGender
} from '@baishou/shared'
import { settingsTypography } from '@baishou/ui/theme/tokens'
import { useNativeTheme } from '@baishou/ui/native'
import { GraphExtractHelpButton } from './GraphExtractHelpButton'
import { styles } from './GraphScreen.styles'
import type { GraphScreenSettingsSection } from './graph-screen.types'

export function GraphScreenSettingsOrganize(props: {
  settingsSection: GraphScreenSettingsSection
  onToggleProfile: () => void
  onToggleData: () => void
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
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  return (
    <View style={styles.settingsBody}>
      <Pressable onPress={props.onToggleProfile} style={styles.settingsHead}>
        <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>
          {props.settingsSection.profile ? '▾ ' : '▸ '}
          {t('graph.profile_section', '身份资料')}
        </Text>
      </Pressable>
      {props.settingsSection.profile ? (
        <View style={styles.settingsBody}>
          <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18 }}>
            {t(
              'graph.profile_hint',
              '用于识别日记中的「我」。修改昵称会同步更新图谱中的自称节点，旧昵称保留为别名，无需重建整图。'
            )}
          </Text>
          <TextInput
            value={props.profileForm.nickname}
            onChangeText={(v) => props.onProfileFormChange({ nickname: v })}
            placeholder={t('graph.awaken_nickname_label', '昵称')}
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.renameInput,
              {
                color: colors.textPrimary,
                borderColor: props.profileErrors.nickname ? colors.error : colors.borderSubtle
              }
            ]}
          />
          <TextInput
            value={props.profileForm.birthday}
            onChangeText={(v) => props.onProfileFormChange({ birthday: v })}
            placeholder={t('graph.awaken_birthday_label', '生日 YYYY-MM-DD')}
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.renameInput,
              {
                color: colors.textPrimary,
                borderColor: props.profileErrors.birthday ? colors.error : colors.borderSubtle
              }
            ]}
          />
          <View style={styles.typeChipRow}>
            {USER_GENDER_OPTIONS.map((g) => {
              const active = props.profileForm.gender === g
              return (
                <Pressable
                  key={g}
                  onPress={() => props.onProfileFormChange({ gender: g })}
                  style={[
                    styles.edgeTypeChip,
                    {
                      backgroundColor: active ? colors.primary : colors.bgSurfaceNormal,
                      borderColor: active
                        ? colors.primary
                        : props.profileErrors.gender
                          ? colors.error
                          : colors.borderSubtle
                    }
                  ]}
                >
                  <Text
                    style={{
                      color: active ? colors.textOnPrimary : colors.textSecondary,
                      fontSize: 12,
                      fontWeight: active ? '700' : '500'
                    }}
                  >
                    {t(`graph.awaken_gender_${g}`, g)}
                  </Text>
                </Pressable>
              )
            })}
          </View>
          <Pressable disabled={props.profileBusy} onPress={props.onSaveProfile}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>
              {t('graph.profile_save', '保存身份资料')}
            </Text>
          </Pressable>
        </View>
      ) : null}
      <Pressable
        onPress={props.onRunExtract}
        disabled={props.busy || props.pendingCount === 0}
        style={[
          styles.opsPrimaryBtn,
          {
            backgroundColor: colors.primary,
            opacity: props.busy || props.pendingCount === 0 ? 0.5 : 1
          }
        ]}
      >
        <Text
          style={{
            color: colors.textOnPrimary,
            fontSize: settingsTypography.label.fontSize,
            fontWeight: settingsTypography.label.fontWeight
          }}
        >
          {t('graph.process_pending_reextract', '梳理待重抽 ({{count}})', {
            count: props.pendingCount
          })}
        </Text>
      </Pressable>
      {props.extractRunning ? (
        <Pressable onPress={props.onOpenQueue}>
          <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>
            {t('graph.queue_view_progress', '查看进度')}
          </Text>
        </Pressable>
      ) : null}
      <View style={styles.opsLabelRow}>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
          {t('graph.extract_concurrency', '同时抽取')}
        </Text>
        <GraphExtractHelpButton size={14} />
      </View>
      <View style={styles.concurrencyRow}>
        {Array.from(
          { length: GRAPH_EXTRACT_CONCURRENCY_MAX - GRAPH_EXTRACT_CONCURRENCY_MIN + 1 },
          (_, i) => GRAPH_EXTRACT_CONCURRENCY_MIN + i
        ).map((n) => (
          <Pressable
            key={n}
            onPress={() => props.onChangeConcurrency(n)}
            style={[
              styles.concurrencyChip,
              {
                borderColor: n === props.extractConcurrency ? colors.primary : colors.borderSubtle,
                backgroundColor: n === props.extractConcurrency ? colors.primary : 'transparent'
              }
            ]}
          >
            <Text
              style={{
                color: n === props.extractConcurrency ? colors.textOnPrimary : colors.textSecondary,
                fontSize: 12,
                fontWeight: '600'
              }}
            >
              {n}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 12 }}>
        {t('graph.extract_one_date', '日记日期')}
      </Text>
      <TextInput
        value={props.extractDate}
        onChangeText={props.onExtractDateChange}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.textSecondary}
        style={[
          styles.renameInput,
          {
            color: colors.textPrimary,
            borderColor: colors.borderSubtle
          }
        ]}
      />
      <Pressable
        onPress={props.onRunExtractOne}
        disabled={props.busy}
        style={[
          styles.toolBtn,
          {
            borderColor: colors.borderSubtle,
            backgroundColor: colors.bgSurfaceNormal,
            opacity: props.busy ? 0.5 : 1,
            marginTop: 8
          }
        ]}
      >
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: 13,
            fontWeight: '600',
            textAlign: 'center'
          }}
        >
          {t('graph.extract_one_action', '重新梳理这篇')}
        </Text>
      </Pressable>
      <View style={styles.opsBtnRow}>
        <Pressable
          onPress={props.onOpenCreate}
          style={[
            styles.toolBtn,
            {
              borderColor: colors.borderSubtle,
              backgroundColor: colors.bgSurfaceNormal,
              flex: 1
            }
          ]}
        >
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 12,
              fontWeight: '600',
              textAlign: 'center'
            }}
          >
            {t('graph.create_node', '新建节点')}
          </Text>
        </Pressable>
        <Pressable
          onPress={props.onOpenMerge}
          style={[
            styles.toolBtn,
            {
              borderColor: props.mergeSearchOpen ? colors.primary : colors.borderSubtle,
              backgroundColor: colors.bgSurfaceNormal,
              flex: 1
            }
          ]}
        >
          <Text
            style={{
              color: props.mergeSearchOpen ? colors.primary : colors.textSecondary,
              fontSize: 12,
              fontWeight: '600',
              textAlign: 'center'
            }}
          >
            {t('graph.merge_nodes', '合并节点')}
          </Text>
        </Pressable>
      </View>
      <Pressable onPress={props.onToggleData} style={styles.settingsHead}>
        <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>
          {props.settingsSection.data ? '▾ ' : '▸ '}
          {t('graph.data_ops', '数据操作')}
        </Text>
      </Pressable>
      {props.settingsSection.data ? (
        <View style={styles.settingsBody}>
          <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18 }}>
            {t(
              'graph.clear_life_hint',
              '删除本工作区人生关系图的全部节点、连线和抽取记录。笔记本关系图不会被改动。'
            )}
          </Text>
          <Pressable
            onPress={props.onClearLifeGraph}
            disabled={props.busy}
            style={[
              styles.toolBtn,
              {
                borderColor: colors.borderSubtle,
                backgroundColor: colors.bgSurfaceNormal,
                opacity: props.busy ? 0.5 : 1
              }
            ]}
          >
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 13,
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
  )
}
