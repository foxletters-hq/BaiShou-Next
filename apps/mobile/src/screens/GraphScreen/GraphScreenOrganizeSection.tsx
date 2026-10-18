import React, { useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  formatLocalDate,
  GRAPH_EXTRACT_CONCURRENCY_MAX,
  GRAPH_EXTRACT_CONCURRENCY_MIN,
  USER_GENDER_OPTIONS,
  type UserGender
} from '@baishou/shared'
import {
  Button,
  Card,
  DatePickerFloatingModal,
  HelpTooltip,
  Input,
  Select,
  SettingsSliderRow,
  useNativeTheme
} from '@baishou/ui/native'
import { sharedTokens } from '@baishou/ui/theme/tokens'
import { GraphExtractHelpButton } from './GraphExtractHelpButton'
import { graphScreenSectionStyles as styles } from './graph-screen-section.styles'

export function GraphScreenOrganizeSection(props: {
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
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [profileOpen, setProfileOpen] = useState(false)
  const [dataOpen, setDataOpen] = useState(false)
  const [birthdayPickerOpen, setBirthdayPickerOpen] = useState(false)
  const [extractPickerOpen, setExtractPickerOpen] = useState(false)

  const birthdayDate = useMemo(
    () => parseYmd(props.profileForm.birthday),
    [props.profileForm.birthday]
  )
  const extractDateValue = useMemo(() => parseYmd(props.extractDate), [props.extractDate])
  const fieldChrome = {
    borderColor: colors.borderControl,
    backgroundColor: colors.bgSurface,
    paddingVertical: 0
  }

  return (
    <Card
      style={[
        styles.card,
        {
          marginBottom: sharedTokens.spacing.sm
        }
      ]}
    >
      <Text style={[styles.title, { color: colors.textPrimary }]}>
        {t('graph.side_organize', '整理')}
      </Text>

      <Pressable onPress={() => setProfileOpen((open) => !open)}>
        <Text style={[styles.row, { color: colors.textPrimary }]}>
          {profileOpen ? '▾ ' : '▸ '}
          {t('graph.profile_section', '身份资料')}
        </Text>
      </Pressable>
      {profileOpen ? (
        <View style={{ gap: sharedTokens.spacing.sm }}>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            {t(
              'graph.profile_hint',
              '用于识别日记中的「我」。修改昵称会同步更新图谱中的自称节点，旧昵称保留为别名，无需重建整图。'
            )}
          </Text>
          <Text style={[styles.hint, { color: colors.textPrimary }]}>
            {t('graph.awaken_nickname_label', '昵称')}
          </Text>
          <View style={[styles.fieldControl, fieldChrome]}>
            <Input
              bare
              value={props.profileForm.nickname}
              onChangeText={(nickname) => props.onProfileFormChange({ nickname })}
              placeholder={t('graph.awaken_nickname_placeholder', '怎么称呼你？')}
              style={styles.fieldText}
              textAlignVertical="center"
            />
          </View>
          {props.profileErrors.nickname ? (
            <Text style={[styles.error, { color: colors.error }]}>
              {t('graph.awaken_nickname_required', '请填写昵称')}
            </Text>
          ) : null}
          <Text style={[styles.hint, { color: colors.textPrimary }]}>
            {t('graph.awaken_birthday_label', '生日')}
          </Text>
          <Pressable
            onPress={() => setBirthdayPickerOpen(true)}
            style={[styles.fieldRow, styles.fieldControl, fieldChrome]}
          >
            <Text
              style={[
                styles.fieldText,
                {
                  color: props.profileForm.birthday ? colors.textPrimary : colors.textSecondary
                }
              ]}
              numberOfLines={1}
            >
              {props.profileForm.birthday || t('graph.awaken_birthday_placeholder', '选择你的生日')}
            </Text>
          </Pressable>
          <DatePickerFloatingModal
            visible={birthdayPickerOpen}
            value={birthdayDate}
            minDate={new Date(1900, 0, 1)}
            maxDate={new Date()}
            onClose={() => setBirthdayPickerOpen(false)}
            onConfirm={(date) => {
              props.onProfileFormChange({ birthday: formatLocalDate(date) })
              setBirthdayPickerOpen(false)
            }}
          />
          {props.profileErrors.birthday ? (
            <Text style={[styles.error, { color: colors.error }]}>
              {t('graph.awaken_birthday_required', '请选择生日')}
            </Text>
          ) : null}
          <Text style={[styles.hint, { color: colors.textPrimary }]}>
            {t('graph.awaken_gender_label', '性别')}
          </Text>
          <Select
            variant="settings"
            value={props.profileForm.gender || undefined}
            onValueChange={(value) => props.onProfileFormChange({ gender: value as UserGender })}
            placeholder={t('graph.awaken_gender_placeholder', '选择性别')}
            options={USER_GENDER_OPTIONS.map((g) => ({
              value: g,
              label: genderLabel(t, g)
            }))}
            triggerStyle={[styles.fieldControl, fieldChrome]}
          />
          {props.profileForm.gender === 'other' ? (
            <View style={[styles.fieldControl, fieldChrome]}>
              <Input
                bare
                value={props.profileForm.customGender || ''}
                onChangeText={(customGender) => props.onProfileFormChange({ customGender })}
                placeholder={t(
                  'graph.awaken_gender_custom_placeholder',
                  '请输入自定义性别（如：沃尔玛购物袋、流体等）'
                )}
                style={styles.fieldText}
                textAlignVertical="center"
              />
            </View>
          ) : null}
          {props.profileErrors.gender ? (
            <Text style={[styles.error, { color: colors.error }]}>
              {t('graph.awaken_gender_required', '请选择性别')}
            </Text>
          ) : null}
          <View style={styles.actions}>
            <Button
              variant="outlined"
              size="sm"
              isDisabled={props.profileBusy}
              onPress={props.onSaveProfile}
            >
              {t('graph.profile_save', '保存身份资料')}
            </Button>
          </View>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button
          variant="outlined"
          size="sm"
          isDisabled={props.busy || props.pendingCount === 0}
          onPress={props.onRunExtract}
        >
          {t('graph.process_pending_reextract', '梳理待重抽 ({{count}})', {
            count: props.pendingCount
          })}
        </Button>
        {props.extractRunning ? (
          <Button variant="outlined" size="sm" onPress={props.onOpenQueue}>
            {t('graph.queue_view_progress', '查看进度')}
          </Button>
        ) : null}
      </View>

      <SettingsSliderRow
        title={t('graph.extract_concurrency', '同时抽取')}
        titleAddon={<GraphExtractHelpButton />}
        value={props.extractConcurrency}
        min={GRAPH_EXTRACT_CONCURRENCY_MIN}
        max={GRAPH_EXTRACT_CONCURRENCY_MAX}
        step={1}
        onChange={props.onChangeConcurrency}
      />

      <View style={{ gap: sharedTokens.spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: sharedTokens.spacing.xs }}>
          <Text style={[styles.hint, { color: colors.textPrimary }]}>
            {t('graph.extract_one_date', '日记日期')}
          </Text>
          <HelpTooltip
            content={t(
              'graph.extract_one_hint',
              '选一篇已有日记，强制加入整理队列。系统写出的关系会被这次结果替换；你手改过的边会留下。'
            )}
          />
        </View>
        <View style={styles.fieldActionRow}>
          <Pressable
            onPress={() => setExtractPickerOpen(true)}
            style={[styles.fieldRow, styles.fieldControl, styles.fieldControlGrow, fieldChrome]}
          >
            <Text
              style={[
                styles.fieldText,
                {
                  color: props.extractDate ? colors.textPrimary : colors.textSecondary
                }
              ]}
              numberOfLines={1}
            >
              {props.extractDate || t('graph.select_diary_date', '选择日记日期')}
            </Text>
          </Pressable>
          <Button
            variant="outlined"
            size="sm"
            isDisabled={props.busy}
            onPress={props.onRunExtractOne}
          >
            {t('graph.extract_one_action', '重新梳理这篇')}
          </Button>
        </View>
        <DatePickerFloatingModal
          visible={extractPickerOpen}
          value={extractDateValue}
          onClose={() => setExtractPickerOpen(false)}
          onConfirm={(date) => {
            props.onExtractDateChange(formatLocalDate(date))
            setExtractPickerOpen(false)
          }}
        />
      </View>

      <Text style={[styles.hint, { color: colors.textPrimary }]}>
        {t('graph.ops_nodes', '节点')}
      </Text>
      <View style={styles.actions}>
        <Button variant="outlined" size="sm" isDisabled={props.busy} onPress={props.onOpenCreate}>
          {t('graph.create_node', '新建节点')}
        </Button>
        <View accessibilityState={{ selected: props.mergeSearchOpen }}>
          <Button variant="outlined" size="sm" isDisabled={props.busy} onPress={props.onOpenMerge}>
            {t('graph.merge_nodes', '合并节点')}
          </Button>
        </View>
      </View>

      <Pressable onPress={() => setDataOpen((open) => !open)}>
        <Text style={[styles.row, { color: colors.textPrimary }]}>
          {dataOpen ? '▾ ' : '▸ '}
          {t('graph.data_ops', '数据操作')}
        </Text>
      </Pressable>
      {dataOpen ? (
        <View style={{ gap: sharedTokens.spacing.sm }}>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: sharedTokens.spacing.xs }}
          >
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              {t('graph.clear_life_title', '清空人生关系图')}
            </Text>
            <HelpTooltip
              content={t(
                'graph.clear_life_hint',
                '删除本工作区人生关系图的全部节点、连线和抽取记录。笔记本关系图不会被改动。'
              )}
            />
          </View>
          <View style={styles.actions}>
            <Button
              variant="outlined"
              size="sm"
              isDisabled={props.busy}
              onPress={props.onClearLifeGraph}
            >
              {t('graph.clear_life_action', '清空人生关系图')}
            </Button>
          </View>
        </View>
      ) : null}
    </Card>
  )
}

function parseYmd(raw: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return new Date()
  const [y, m, d] = raw.trim().split('-').map(Number)
  return new Date(y, m - 1, d)
}

function genderLabel(t: (key: string, fallback: string) => string, gender: UserGender): string {
  if (gender === 'male') return t('graph.awaken_gender_male', '男')
  if (gender === 'female') return t('graph.awaken_gender_female', '女')
  if (gender === 'other') return t('graph.awaken_gender_other', '自定义')
  return t('graph.awaken_gender_unspecified', '暂不设置')
}
