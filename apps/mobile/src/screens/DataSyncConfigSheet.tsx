import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import type { SyncConfig } from '@baishou/core-mobile'
import type { useNativeTheme } from '@baishou/ui/native'

type ThemeColors = ReturnType<typeof useNativeTheme>['colors']
type ThemeTokens = ReturnType<typeof useNativeTheme>['tokens']

export interface DataSyncConfigSheetProps {
  visible: boolean
  config: SyncConfig
  showPassword: boolean
  colors: ThemeColors
  tokens: ThemeTokens
  onChange: (next: SyncConfig) => void
  onTogglePassword: () => void
  onSave: () => void
  onClose: () => void
}

export const DataSyncConfigSheet: React.FC<DataSyncConfigSheetProps> = ({
  visible,
  config,
  showPassword,
  colors,
  tokens,
  onChange,
  onTogglePassword,
  onSave,
  onClose
}) => {
  const { t } = useTranslation()

  const setTarget = (target: SyncConfig['target']) => onChange({ ...config, target })

  const renderTargetCard = (
    target: SyncConfig['target'],
    icon: keyof typeof MaterialIcons.glyphMap,
    title: string,
    desc: string
  ) => {
    const selected = config.target === target
    return (
      <TouchableOpacity
        key={target}
        style={[
          styles.targetCard,
          {
            borderColor: selected ? colors.primary : colors.borderSubtle,
            backgroundColor: selected ? colors.primaryLight : colors.bgSurfaceNormal
          }
        ]}
        onPress={() => setTarget(target)}
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

  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.bgSurfaceNormal,
      color: colors.textPrimary,
      borderColor: colors.borderSubtle,
      borderRadius: tokens.radius.sm
    }
  ]

  const sectionTitle =
    config.target === 'local'
      ? t('data_sync.s3_config_title', 'S3 存储配置').replace(
          'S3',
          t('data_sync.local_storage', '本地存储')
        )
      : config.target === 's3'
        ? t('data_sync.s3_config_title', 'S3 存储配置')
        : t('data_sync.webdav_config_title', 'WebDAV 存储配置')

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bgApp }]}>
        <View style={[styles.appBar, { borderBottomColor: colors.borderSubtle }]}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn} hitSlop={12}>
            <MaterialIcons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.appTitle, { color: colors.textPrimary }]}>
            {t('data_sync.config_title', '数据备份配置')}
          </Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            {t('data_sync.select_target_title', '选择备份目标')}
          </Text>

          {renderTargetCard(
            'local',
            'folder',
            t('data_sync.target_local', '本地存储'),
            t('data_sync.local_storage_desc', '直接将备份转储保存在应用所运行设备的本地磁盘中。')
          )}
          {renderTargetCard(
            's3',
            'cloud',
            t('data_sync.target_s3', 'S3 兼容存储'),
            t('data_sync.s3_storage_desc', '兼容 S3 协议的对象存储服务')
          )}
          {renderTargetCard(
            'webdav',
            'language',
            t('data_sync.target_webdav', 'WebDAV'),
            t('data_sync.webdav_storage_desc', '通用网络文件存储协议')
          )}

          <Text style={[styles.configSectionTitle, { color: colors.textPrimary }]}>
            {sectionTitle}
          </Text>
          <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

          {config.target === 'local' && (
            <Text style={[styles.localHint, { color: colors.textSecondary }]}>
              {t(
                'data_sync.local_no_config',
                '当前模式下产生的数据仅会存放于本地应用目录中，无需输入远程凭据。'
              )}
            </Text>
          )}

          {config.target === 'webdav' && (
            <View style={styles.form}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {t('data_sync.webdav_url_label', 'WebDAV URL 地址')}
              </Text>
              <TextInput
                style={inputStyle}
                value={config.webdavUrl}
                onChangeText={(v) => onChange({ ...config, webdavUrl: v })}
                autoCapitalize="none"
                keyboardType="url"
              />
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {t('data_sync.webdav_path_label', 'Base Path 子路径')}
              </Text>
              <TextInput
                style={inputStyle}
                value={config.webdavPath}
                onChangeText={(v) => onChange({ ...config, webdavPath: v })}
                autoCapitalize="none"
              />
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {t('data_sync.webdav_user_label', 'Username 用户名')}
              </Text>
              <TextInput
                style={inputStyle}
                value={config.webdavUsername}
                onChangeText={(v) => onChange({ ...config, webdavUsername: v })}
                autoCapitalize="none"
              />
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {t('data_sync.webdav_password_label', 'Password 密码')}
              </Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[inputStyle, { flex: 1 }]}
                  value={config.webdavPassword}
                  onChangeText={(v) => onChange({ ...config, webdavPassword: v })}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
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

          {config.target === 's3' && (
            <View style={styles.form}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {t('data_sync.s3_endpoint_label', 'Endpoint 服务地址')}
              </Text>
              <TextInput
                style={inputStyle}
                value={config.s3Endpoint}
                onChangeText={(v) => onChange({ ...config, s3Endpoint: v })}
                autoCapitalize="none"
                keyboardType="url"
              />
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {t('data_sync.s3_region_label', 'Region 区域名')}
              </Text>
              <TextInput
                style={inputStyle}
                value={config.s3Region}
                onChangeText={(v) => onChange({ ...config, s3Region: v })}
                autoCapitalize="none"
              />
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {t('data_sync.s3_bucket_label', 'Bucket 存储桶')}
              </Text>
              <TextInput
                style={inputStyle}
                value={config.s3Bucket}
                onChangeText={(v) => onChange({ ...config, s3Bucket: v })}
                autoCapitalize="none"
              />
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {t('data_sync.s3_path_label', 'Path 子路径')}
              </Text>
              <TextInput
                style={inputStyle}
                value={config.s3Path}
                onChangeText={(v) => onChange({ ...config, s3Path: v })}
                autoCapitalize="none"
              />
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {t('data_sync.s3_ak_label', 'Access Key (AK)')}
              </Text>
              <TextInput
                style={inputStyle}
                value={config.s3AccessKey}
                onChangeText={(v) => onChange({ ...config, s3AccessKey: v })}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {t('data_sync.s3_sk_label', 'Secret Key (SK)')}
              </Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[inputStyle, { flex: 1 }]}
                  value={config.s3SecretKey}
                  onChangeText={(v) => onChange({ ...config, s3SecretKey: v })}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
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
              styles.saveBtn,
              { backgroundColor: colors.primary, borderRadius: tokens.radius.md }
            ]}
            onPress={onSave}
          >
            <Text style={{ color: colors.textOnPrimary, fontWeight: '700', fontSize: 16 }}>
              {t('data_sync.save_config_button', '保存配置')}
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
  configSectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 20, marginBottom: 8 },
  divider: { height: StyleSheet.hairlineWidth, marginBottom: 16 },
  localHint: { fontSize: 14, lineHeight: 22, textAlign: 'center', paddingVertical: 24 },
  form: { gap: 4 },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginTop: 10, marginBottom: 6 },
  input: {
    height: 48,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn: { padding: 8 },
  saveBtn: {
    marginTop: 28,
    paddingVertical: 14,
    alignItems: 'center'
  }
})
