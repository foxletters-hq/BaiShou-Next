import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  SafeAreaView
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import type { S3SyncConfig } from '@baishou/shared'
import { Input, Switch } from '@baishou/ui/native'
import type { useNativeTheme } from '@baishou/ui/native'

type ThemeColors = ReturnType<typeof useNativeTheme>['colors']
type ThemeTokens = ReturnType<typeof useNativeTheme>['tokens']

export interface IncrementalSyncConfigSheetProps {
  visible: boolean
  config: S3SyncConfig
  showPassword: boolean
  colors: ThemeColors
  tokens: ThemeTokens
  testing?: boolean
  onChange: (next: S3SyncConfig) => void
  onTogglePassword: () => void
  onTestConnection: () => void
  onSave: () => void
  onClose: () => void
}

export const IncrementalSyncConfigSheet: React.FC<IncrementalSyncConfigSheetProps> = ({
  visible,
  config,
  showPassword,
  colors,
  tokens,
  testing = false,
  onChange,
  onTogglePassword,
  onTestConnection,
  onSave,
  onClose
}) => {
  const { t } = useTranslation()
  const target = config.target === 'webdav' ? 'webdav' : 's3'

  const setTarget = (next: 's3' | 'webdav') => onChange({ ...config, target: next })

  const renderTargetCard = (
    value: 's3' | 'webdav',
    icon: keyof typeof MaterialIcons.glyphMap,
    title: string,
    desc: string
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
        <View style={{ flex: 1 }}>
          <Text style={[styles.targetTitle, { color: colors.textPrimary }]}>{title}</Text>
          <Text style={[styles.targetDesc, { color: colors.textSecondary }]}>{desc}</Text>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bgApp }]}>
        <View style={[styles.appBar, { borderBottomColor: colors.borderSubtle }]}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn} hitSlop={12}>
            <MaterialIcons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.appTitle, { color: colors.textPrimary }]}>
            {t('data_sync.config_section')}
          </Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.enableRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.enableTitle, { color: colors.textPrimary }]}>
                {t('data_sync.incremental_sync')}
              </Text>
              <Text style={[styles.enableDesc, { color: colors.textSecondary }]}>
                {t('data_sync.incremental_sync_desc')}
              </Text>
            </View>
            <Switch
              value={config.enabled}
              onValueChange={(enabled) => onChange({ ...config, enabled })}
            />
          </View>

          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            {t('data_sync.select_target_title')}
          </Text>

          {renderTargetCard('s3', 'cloud', t('data_sync.target_s3'), t('data_sync.target_s3_desc'))}
          {renderTargetCard(
            'webdav',
            'language',
            t('data_sync.target_webdav'),
            t('data_sync.target_webdav_desc')
          )}

          <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

          {target === 'webdav' ? (
            <View style={styles.form}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {t('data_sync.webdav_url_label')}
              </Text>
              <Input
                value={config.webdavUrl || ''}
                onChangeText={(webdavUrl) => onChange({ ...config, webdavUrl })}
                autoCapitalize="none"
                keyboardType="url"
              />
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {t('data_sync.webdav_path_label')}
              </Text>
              <Input
                value={config.path || ''}
                onChangeText={(path) => onChange({ ...config, path })}
                autoCapitalize="none"
              />
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {t('data_sync.webdav_user_label')}
              </Text>
              <Input
                value={config.accessKey || ''}
                onChangeText={(accessKey) => onChange({ ...config, accessKey })}
                autoCapitalize="none"
              />
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {t('data_sync.webdav_password_label')}
              </Text>
              <View style={styles.passwordRow}>
                <Input
                  value={config.secretKey || ''}
                  onChangeText={(secretKey) => onChange({ ...config, secretKey })}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  style={{ flex: 1 }}
                />
                <TouchableOpacity onPress={onTogglePassword} style={styles.eyeBtn}>
                  <MaterialIcons
                    name={showPassword ? 'visibility' : 'visibility-off'}
                    size={22}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {t('data_sync.s3_endpoint_label')}
              </Text>
              <Input
                value={config.endpoint || ''}
                onChangeText={(endpoint) => onChange({ ...config, endpoint })}
                autoCapitalize="none"
                keyboardType="url"
              />
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {t('data_sync.s3_region_label')}
              </Text>
              <Input
                value={config.region || ''}
                onChangeText={(region) => onChange({ ...config, region })}
                autoCapitalize="none"
              />
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {t('data_sync.s3_bucket_label')}
              </Text>
              <Input
                value={config.bucket || ''}
                onChangeText={(bucket) => onChange({ ...config, bucket })}
                autoCapitalize="none"
              />
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {t('data_sync.s3_path_label')}
              </Text>
              <Input
                value={config.path || ''}
                onChangeText={(path) => onChange({ ...config, path })}
                autoCapitalize="none"
              />
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {t('data_sync.s3_ak_label')}
              </Text>
              <Input
                value={config.accessKey || ''}
                onChangeText={(accessKey) => onChange({ ...config, accessKey })}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {t('data_sync.s3_sk_label')}
              </Text>
              <View style={styles.passwordRow}>
                <Input
                  value={config.secretKey || ''}
                  onChangeText={(secretKey) => onChange({ ...config, secretKey })}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  style={{ flex: 1 }}
                />
                <TouchableOpacity onPress={onTogglePassword} style={styles.eyeBtn}>
                  <MaterialIcons
                    name={showPassword ? 'visibility' : 'visibility-off'}
                    size={22}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.secondaryBtn,
              { borderColor: colors.borderMuted, backgroundColor: colors.bgSurfaceHighest }
            ]}
            onPress={onTestConnection}
            disabled={testing}
          >
            <Text style={{ color: colors.textPrimary }}>
              {testing ? t('data_sync.testing_connection') : t('data_sync.test_connection')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.saveBtn,
              { backgroundColor: colors.primary, borderRadius: tokens.radius.md }
            ]}
            onPress={onSave}
          >
            <Text style={{ color: colors.textOnPrimary, fontWeight: '700', fontSize: 16 }}>
              {t('data_sync.save_config_button')}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  backBtn: { width: 40, alignItems: 'center' },
  appTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  enableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20
  },
  enableTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  enableDesc: { fontSize: 13, lineHeight: 18 },
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
  targetTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  targetDesc: { fontSize: 12, lineHeight: 17 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 16 },
  form: { gap: 4 },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginTop: 10, marginBottom: 6 },
  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn: { padding: 8 },
  secondaryBtn: {
    marginTop: 20,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1
  },
  saveBtn: {
    marginTop: 12,
    paddingVertical: 14,
    alignItems: 'center'
  }
})
