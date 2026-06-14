import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import type { S3SyncConfig } from '@baishou/shared'
import { SYNC_DIVERGENCE_THRESHOLD_OPTIONS } from '@baishou/shared'
import { Input, Switch, Button, Select } from '@baishou/ui/native'
import type { useNativeTheme } from '@baishou/ui/native'

type ThemeColors = ReturnType<typeof useNativeTheme>['colors']
type ThemeTokens = ReturnType<typeof useNativeTheme>['tokens']

export interface IncrementalSyncConfigSheetProps {
  config: S3SyncConfig
  showAccessKey: boolean
  showSecretKey: boolean
  colors: ThemeColors
  tokens: ThemeTokens
  testing?: boolean
  onChange: (next: S3SyncConfig, immediate?: boolean) => void
  onToggleAccessKey: () => void
  onToggleSecretKey: () => void
  onTestConnection: () => void
}

const FILE_CONCURRENCY_OPTIONS = [1, 2, 3, 5, 10, 15, 20]

export const IncrementalSyncConfigSheet: React.FC<IncrementalSyncConfigSheetProps> = ({
  config,
  showAccessKey,
  showSecretKey,
  colors,
  tokens,
  testing = false,
  onChange,
  onToggleAccessKey,
  onToggleSecretKey,
  onTestConnection
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
          <MaterialIcons
            name={visible ? 'visibility' : 'visibility-off'}
            size={22}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </View>
    </>
  )

  const renderTargetCard = (
    value: 's3' | 'webdav',
    icon: keyof typeof MaterialIcons.glyphMap,
    title: string
  ) => {
    const selected = target === value
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
          <MaterialIcons
            name={icon}
            size={24}
            color={selected ? colors.primary : colors.textSecondary}
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

  return (
    <View style={styles.container}>
      <View style={styles.enableRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.enableTitle, { color: colors.textPrimary }]}>
            {t('data_sync.incremental_sync')}
          </Text>
        </View>
        <Switch
          value={config.enabled}
          onValueChange={(enabled) => onChange({ ...config, enabled }, true)}
        />
      </View>

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
        {t('data_sync.select_target_title')}
      </Text>

      {renderTargetCard('s3', 'cloud', t('data_sync.target_s3'))}
      {renderTargetCard('webdav', 'language', t('data_sync.target_webdav'))}

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
            value={config.path || ''}
            onChangeText={(path) => onChange({ ...config, path })}
            autoCapitalize="none"
          />
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            {t('data_sync.webdav_user')}
          </Text>
          <Input
            value={config.accessKey || ''}
            onChangeText={(accessKey) => onChange({ ...config, accessKey })}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {renderSecretField(
            t('data_sync.webdav_password'),
            config.secretKey || '',
            (secretKey) => onChange({ ...config, secretKey }),
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
            value={config.path || ''}
            onChangeText={(path) => onChange({ ...config, path })}
            autoCapitalize="none"
          />
          {renderSecretField(
            t('data_sync.s3_access_key'),
            config.accessKey || '',
            (accessKey) => onChange({ ...config, accessKey }),
            showAccessKey,
            onToggleAccessKey
          )}
          {renderSecretField(
            t('data_sync.s3_secret_key'),
            config.secretKey || '',
            (secretKey) => onChange({ ...config, secretKey }),
            showSecretKey,
            onToggleSecretKey
          )}
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            {t('data_sync.file_concurrency')}
          </Text>
          <Select
            variant="settings"
            value={String(config.fileConcurrency ?? 5)}
            options={fileConcurrencyOptions}
            onValueChange={(value) =>
              onChange({ ...config, fileConcurrency: parseInt(value, 10) }, true)
            }
          />
        </View>
      )}

      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
        {t('data_sync.max_divergence_label')}
      </Text>
      <Select
        variant="settings"
        value={String(
          config.maxDivergencePercent === null || config.maxDivergencePercent === undefined
            ? 100
            : config.maxDivergencePercent
        )}
        options={divergenceOptions}
        onValueChange={(value) =>
          onChange({ ...config, maxDivergencePercent: parseInt(value, 10) }, true)
        }
      />
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        {t('data_sync.max_divergence_hint')}
      </Text>

      <Button
        variant="outline"
        onPress={onTestConnection}
        isDisabled={testing}
        style={styles.testBtn}
      >
        {testing ? t('data_sync.testing_connection') : t('data_sync.test_connection')}
      </Button>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 4
  },
  enableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12
  },
  enableTitle: { fontSize: 16, fontWeight: '700' },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase'
  },
  targetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 10,
    gap: 12
  },
  targetIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  targetTitle: { fontSize: 15, fontWeight: '600', flex: 1 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 12 },
  form: { gap: 4 },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginTop: 10, marginBottom: 6 },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  passwordInputWrapper: { flex: 1 },
  eyeBtn: { padding: 8 },
  hint: { fontSize: 12, lineHeight: 18, marginTop: 6, marginBottom: 4 },
  testBtn: {
    marginTop: 20
  }
})
