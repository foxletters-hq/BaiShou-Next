import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'
import { Cloud, Eye, EyeOff, Globe } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import type { S3SyncConfig } from '@baishou/shared'
import { SYNC_DIVERGENCE_THRESHOLD_OPTIONS } from '@baishou/shared'
import { Input, Switch, Button, Select, HelpTooltip } from '@baishou/ui/native'
import type { useNativeTheme } from '@baishou/ui/native'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'

type ThemeColors = ReturnType<typeof useNativeTheme>['colors']
type ThemeTokens = ReturnType<typeof useNativeTheme>['tokens']

export interface IncrementalSyncConfigSheetProps {
  config: S3SyncConfig
  showAccessKey: boolean
  showSecretKey: boolean
  colors: ThemeColors
  tokens: ThemeTokens
  testing?: boolean
  saving?: boolean
  onChange: (next: S3SyncConfig, immediate?: boolean) => void
  onToggleAccessKey: () => void
  onToggleSecretKey: () => void
  onTestConnection: () => void
  onSave?: () => void
}

const FILE_CONCURRENCY_OPTIONS = [1, 2, 3, 5, 10, 15, 20]

export const IncrementalSyncConfigSheet: React.FC<IncrementalSyncConfigSheetProps> = ({
  config,
  showAccessKey,
  showSecretKey,
  colors,
  tokens: _tokens,
  testing = false,
  saving = false,
  onChange,
  onToggleAccessKey,
  onToggleSecretKey,
  onTestConnection,
  onSave
}) => {
  const { t } = useTranslation()
  const target = config.target === 'webdav' ? 'webdav' : 's3'

  const setTarget = (next: 's3' | 'webdav') => onChange({ ...config, target: next }, true)

  const renderSecretField = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    visible: boolean,
    onToggle: () => void
  ) => (
    <>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <View style={styles.passwordRow}>
        <View style={styles.passwordInputWrapper}>
          <Input
            value={value}
            onChangeText={onChangeText}
            secureTextEntry={!visible}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <TouchableOpacity onPress={onToggle} style={styles.eyeBtn} accessibilityRole="button">
          {visible ? (
            <Eye size={22} color={colors.textSecondary} strokeWidth={2} />
          ) : (
            <EyeOff size={22} color={colors.textSecondary} strokeWidth={2} />
          )}
        </TouchableOpacity>
      </View>
    </>
  )

  const renderTargetCard = (value: 's3' | 'webdav', icon: LucideIcon, title: string) => {
    const selected = target === value
    const Icon = icon
    return (
      <TouchableOpacity
        key={value}
        style={[
          styles.targetCard,
          {
            borderColor: selected ? colors.primary : colors.borderSubtle,
            backgroundColor: selected ? colors.primaryLight : colors.bgSurfaceNormal
          }
        ]}
        onPress={() => setTarget(value)}
        activeOpacity={0.8}
      >
        <View style={[styles.targetIcon, { backgroundColor: colors.bgSurface }]}>
          <Icon
            size={24}
            color={selected ? colors.primary : colors.textSecondary}
            strokeWidth={2}
          />
        </View>
        <Text style={[styles.targetTitle, { color: colors.textPrimary }]}>{title}</Text>
      </TouchableOpacity>
    )
  }

  const fileConcurrencyOptions = FILE_CONCURRENCY_OPTIONS.map((v) => ({
    value: String(v),
    label: t('data_sync.file_concurrency_option', { count: v })
  }))

  const divergenceOptions = SYNC_DIVERGENCE_THRESHOLD_OPTIONS.map((percent) => ({
    value: String(percent),
    label:
      percent === 100
        ? t('data_sync.max_divergence_remove_protection', '100（去除此保护）')
        : t('data_sync.max_divergence_option', { percent })
  }))

  const currentDivergence =
    config.maxDivergencePercent === null || config.maxDivergencePercent === undefined
      ? 100
      : config.maxDivergencePercent

  return (
    <View style={styles.container}>
      <View style={styles.enableRow}>
        <View style={styles.enableTitleRow}>
          <Text style={[styles.enableTitle, { color: colors.textPrimary }]}>
            {t('data_sync.incremental_sync')}
          </Text>
          <HelpTooltip content={t('data_sync.incremental_sync_tooltip')} />
        </View>
        <Switch
          value={config.enabled}
          onValueChange={(enabled) => onChange({ ...config, enabled }, true)}
        />
      </View>

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
        {t('data_sync.select_target_title')}
      </Text>

      {renderTargetCard('s3', Cloud, t('data_sync.target_s3'))}
      {renderTargetCard('webdav', Globe, t('data_sync.target_webdav'))}

      <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

      {target === 'webdav' ? (
        <View style={styles.form}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            {t('data_sync.webdav_url')}
          </Text>
          <Input
            value={config.webdavUrl || ''}
            onChangeText={(webdavUrl) => onChange({ ...config, webdavUrl })}
            autoCapitalize="none"
            keyboardType="url"
          />
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            {t('data_sync.path_prefix')}
          </Text>
          <Input
            value={config.webdavPath || ''}
            onChangeText={(webdavPath) => onChange({ ...config, webdavPath })}
            autoCapitalize="none"
          />
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            {t('data_sync.webdav_user')}
          </Text>
          <Input
            value={config.webdavUsername || ''}
            onChangeText={(webdavUsername) => onChange({ ...config, webdavUsername })}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {renderSecretField(
            t('data_sync.webdav_password'),
            config.webdavPassword || '',
            (webdavPassword) => onChange({ ...config, webdavPassword }),
            showSecretKey,
            onToggleSecretKey
          )}
        </View>
      ) : (
        <View style={styles.form}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            {t('data_sync.s3_endpoint')}
          </Text>
          <Input
            value={config.endpoint || ''}
            onChangeText={(endpoint) => onChange({ ...config, endpoint })}
            autoCapitalize="none"
            keyboardType="url"
          />
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            {t('data_sync.s3_region')}
          </Text>
          <Input
            value={config.region || ''}
            onChangeText={(region) => onChange({ ...config, region })}
            autoCapitalize="none"
          />
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            {t('data_sync.s3_bucket')}
          </Text>
          <Input
            value={config.bucket || ''}
            onChangeText={(bucket) => onChange({ ...config, bucket })}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            {t('data_sync.path_prefix')}
          </Text>
          <Input
            value={config.s3Path || ''}
            onChangeText={(s3Path) => onChange({ ...config, s3Path })}
            autoCapitalize="none"
          />
          {renderSecretField(
            t('data_sync.s3_access_key'),
            config.s3AccessKey || '',
            (s3AccessKey) => onChange({ ...config, s3AccessKey }),
            showAccessKey,
            onToggleAccessKey
          )}
          {renderSecretField(
            t('data_sync.s3_secret_key'),
            config.s3SecretKey || '',
            (s3SecretKey) => onChange({ ...config, s3SecretKey }),
            showSecretKey,
            onToggleSecretKey
          )}
        </View>
      )}

      <View style={styles.inlineFieldRow}>
        <Text style={[styles.inlineFieldLabel, { color: colors.textSecondary }]}>
          {t('data_sync.file_concurrency', '并发数')}
        </Text>
        <Select
          variant="settings"
          compact
          value={String(config.fileConcurrency ?? 5)}
          options={fileConcurrencyOptions}
          onValueChange={(value) =>
            onChange({ ...config, fileConcurrency: parseInt(value, 10) }, true)
          }
          triggerStyle={styles.compactSelectTrigger}
        />
      </View>

      <View style={styles.inlineFieldRow}>
        <Text style={[styles.inlineFieldLabel, { color: colors.textSecondary }]}>
          {t('data_sync.max_divergence_label')}
        </Text>
        <Select
          variant="settings"
          compact
          value={String(currentDivergence)}
          options={divergenceOptions}
          onValueChange={(value) =>
            onChange({ ...config, maxDivergencePercent: parseInt(value, 10) }, true)
          }
          triggerStyle={styles.compactSelectTrigger}
        />
      </View>
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        {t('data_sync.max_divergence_hint')}
      </Text>

      <View style={styles.buttonRow}>
        <Button
          variant="outline"
          onPress={onTestConnection}
          isDisabled={testing || saving}
          isLoading={testing}
          style={styles.actionBtn}
        >
          {testing ? t('data_sync.testing_connection') : t('data_sync.test_connection')}
        </Button>
        <Button
          variant="primary"
          onPress={onSave}
          isDisabled={testing || saving}
          isLoading={saving}
          style={styles.actionBtn}
        >
          {t('common.save_changes', '保存修改')}
        </Button>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: sharedTokens.spacing.xs
  },
  enableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.mdTight,
    marginBottom: sharedTokens.spacing.mdTight
  },
  enableTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xs
  },
  enableTitle: { fontSize: mobileTypography.primary.fontSize, fontWeight: '600' },
  sectionLabel: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600',
    marginBottom: sharedTokens.spacing.mdTight,
    textTransform: 'uppercase'
  },
  targetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: sharedTokens.spacing.mdSnug,
    borderRadius: sharedTokens.radius.md,
    borderWidth: 1.5,
    marginBottom: sharedTokens.spacing.smPlus,
    gap: sharedTokens.spacing.mdTight
  },
  targetIcon: {
    width: 44,
    height: 44,
    borderRadius: sharedTokens.radius.control,
    alignItems: 'center',
    justifyContent: 'center'
  },
  targetTitle: { fontSize: mobileTypography.body.fontSize, fontWeight: '600', flex: 1 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: sharedTokens.spacing.mdTight },
  form: { gap: sharedTokens.spacing.xs },
  fieldLabel: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600',
    marginTop: sharedTokens.spacing.smPlus,
    marginBottom: sharedTokens.spacing.xsPlus
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm
  },
  passwordInputWrapper: { flex: 1 },
  eyeBtn: { padding: sharedTokens.spacing.sm },
  hint: {
    fontSize: mobileTypography.caption.fontSize,
    lineHeight: 18,
    marginTop: sharedTokens.spacing.xsPlus,
    marginBottom: sharedTokens.spacing.xs
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.smPlus,
    marginTop: sharedTokens.spacing.mdPlus
  },
  actionBtn: {
    flex: 1
  },
  inlineFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
    marginTop: sharedTokens.spacing.smPlus,
    marginBottom: sharedTokens.spacing.xs,
    gap: sharedTokens.spacing.sm
  },
  inlineFieldLabel: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600',
    flex: 1
  },
  compactSelectTrigger: {
    minHeight: 32,
    paddingHorizontal: sharedTokens.spacing.smPlus,
    paddingVertical: sharedTokens.spacing.xxs,
    borderRadius: sharedTokens.radius.md
  }
})
