import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '@baishou/ui/native'
import { useBaishou } from '../../../providers/BaishouProvider'

interface TtsProviderConfig {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  modelId: string
  voice: string
  speed: number
  responseFormat: string
  refAudioPath?: string
  promptText?: string
  promptLang?: string
  textLang?: string
}

const PROVIDER_OPTIONS = [
  { id: 'openai-tts', label: 'OpenAI 兼容 TTS' },
  { id: 'mimo-tts', label: '小米 MiMo TTS' },
  { id: 'clone-tts', label: 'CloneTTS 本地服务' },
  { id: 'gpt-sovits', label: 'GPT-SoVITS 本地服务' }
]

const FORMAT_OPTIONS = ['mp3', 'wav', 'aac']

const DEFAULT_CONFIGS: Record<string, TtsProviderConfig> = {
  'openai-tts': {
    id: 'openai-tts',
    name: 'OpenAI 兼容 TTS',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    modelId: 'tts-1',
    voice: 'alloy',
    speed: 1.0,
    responseFormat: 'mp3'
  },
  'mimo-tts': {
    id: 'mimo-tts',
    name: '小米 MiMo TTS',
    baseUrl: '',
    apiKey: '',
    modelId: 'mimo-v2.5-tts',
    voice: '冰糖',
    speed: 1.0,
    responseFormat: 'wav'
  },
  'clone-tts': {
    id: 'clone-tts',
    name: 'CloneTTS 本地服务',
    baseUrl: 'http://127.0.0.1:8080',
    apiKey: '',
    modelId: 'default',
    voice: 'default',
    speed: 1.0,
    responseFormat: 'mp3'
  },
  'gpt-sovits': {
    id: 'gpt-sovits',
    name: 'GPT-SoVITS 本地服务',
    baseUrl: 'http://127.0.0.1:9880',
    apiKey: '',
    modelId: 'default',
    voice: 'default',
    speed: 1.0,
    responseFormat: 'wav',
    refAudioPath: '',
    promptText: '',
    promptLang: 'zh',
    textLang: 'zh'
  }
}

export const TTSSettingsSection: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const { services, dbReady } = useBaishou()

  const [providerType, setProviderType] = useState('openai-tts')
  const [configs, setConfigs] = useState<Record<string, TtsProviderConfig>>(DEFAULT_CONFIGS)
  const [testText, setTestText] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [isTesting, setIsTesting] = useState(false)

  useEffect(() => {
    if (!dbReady || !services) return
    const load = async () => {
      try {
        const saved = await services.settingsManager.get<any>('tts_config')
        if (saved) {
          setConfigs((prev) => {
            const next = { ...prev }
            for (const key of Object.keys(saved)) {
              if (next[key]) {
                next[key] = { ...next[key], ...saved[key] }
              }
            }
            return next
          })
          if (saved.activeProvider) {
            setProviderType(saved.activeProvider)
          }
        }
      } catch (e) {
        console.warn('Load TTS config failed', e)
      }
    }
    load()
  }, [dbReady, services])

  const current = configs[providerType] || DEFAULT_CONFIGS['openai-tts']

  const updateCurrent = (updates: Partial<TtsProviderConfig>) => {
    setConfigs((prev) => ({
      ...prev,
      [providerType]: { ...prev[providerType], ...updates }
    }))
  }

  const handleSave = async () => {
    if (!services) return
    setIsSaving(true)
    try {
      await services.settingsManager.set('tts_config', {
        ...configs,
        activeProvider: providerType
      })
      Alert.alert(t('common.success', '成功'), t('tts.settings.save_success', 'TTS 配置已保存'))
    } catch (e: any) {
      Alert.alert(t('common.error', '错误'), e.message || '保存失败')
    } finally {
      setIsSaving(false)
    }
  }

  const handleTest = async () => {
    if (!testText.trim()) {
      Alert.alert(
        t('common.notice', '提示'),
        t('tts.settings.test_text_required', '请输入测试文本')
      )
      return
    }
    if (!services) return
    setIsTesting(true)
    try {
      Alert.alert(
        t('common.notice', '提示'),
        t(
          'tts.settings.test_mobile_hint',
          'TTS 语音测试功能将在后续版本中开放，请先保存配置后在对话中使用'
        )
      )
    } finally {
      setIsTesting(false)
    }
  }

  const sectionStyle = {
    backgroundColor: colors.bgSurfaceHighest,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12
  }

  const labelStyle = {
    fontSize: 13,
    fontWeight: '500' as const,
    color: colors.textSecondary,
    marginBottom: 6
  }

  const inputStyle = {
    backgroundColor: colors.bgSurfaceNormal,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    marginBottom: 4
  }

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        {t('tts.settings.title', 'TTS 语音合成设置')}
      </Text>

      <View style={sectionStyle}>
        <Text style={labelStyle}>{t('tts.settings.provider_label', 'TTS 供应商')}</Text>
        <View style={styles.chipRow}>
          {PROVIDER_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              style={[
                styles.chip,
                { borderColor: colors.borderSubtle },
                providerType === opt.id && {
                  backgroundColor: colors.primary,
                  borderColor: colors.primary
                }
              ]}
              onPress={() => setProviderType(opt.id)}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: colors.textSecondary },
                  providerType === opt.id && { color: colors.textOnPrimary }
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={sectionStyle}>
        <Text style={labelStyle}>{t('tts.settings.base_url_label', 'API Base URL')}</Text>
        <TextInput
          style={inputStyle}
          value={current.baseUrl}
          onChangeText={(v) => updateCurrent({ baseUrl: v })}
          placeholder="https://api.openai.com/v1"
          placeholderTextColor={colors.textTertiary}
        />
      </View>

      {providerType !== 'clone-tts' && providerType !== 'gpt-sovits' && (
        <View style={sectionStyle}>
          <Text style={labelStyle}>{t('tts.settings.api_key_label', 'API Key')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TextInput
              style={[inputStyle, { flex: 1 }]}
              value={current.apiKey}
              onChangeText={(v) => updateCurrent({ apiKey: v })}
              placeholder="sk-..."
              placeholderTextColor={colors.textTertiary}
              secureTextEntry={!showApiKey}
            />
            <TouchableOpacity
              style={[styles.showBtn, { backgroundColor: colors.bgSurfaceNormal }]}
              onPress={() => setShowApiKey(!showApiKey)}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                {showApiKey ? t('common.hide', '隐藏') : t('common.show', '显示')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={sectionStyle}>
        <Text style={labelStyle}>{t('tts.settings.model_id_label', '模型 ID')}</Text>
        <TextInput
          style={inputStyle}
          value={current.modelId}
          onChangeText={(v) => updateCurrent({ modelId: v })}
          placeholder="tts-1"
          placeholderTextColor={colors.textTertiary}
        />
      </View>

      <View style={sectionStyle}>
        <Text style={labelStyle}>{t('tts.settings.voice_label', '发音人')}</Text>
        <TextInput
          style={inputStyle}
          value={current.voice}
          onChangeText={(v) => updateCurrent({ voice: v })}
          placeholder="alloy"
          placeholderTextColor={colors.textTertiary}
        />
      </View>

      {providerType === 'gpt-sovits' && (
        <>
          <View style={sectionStyle}>
            <Text style={labelStyle}>{t('tts.settings.ref_audio_path_label', '参考音频路径')}</Text>
            <TextInput
              style={inputStyle}
              value={current.refAudioPath || ''}
              onChangeText={(v) => updateCurrent({ refAudioPath: v })}
              placeholder="/path/to/audio.wav"
              placeholderTextColor={colors.textTertiary}
            />
          </View>
          <View style={sectionStyle}>
            <Text style={labelStyle}>{t('tts.settings.prompt_text_label', '参考音频文本')}</Text>
            <TextInput
              style={inputStyle}
              value={current.promptText || ''}
              onChangeText={(v) => updateCurrent({ promptText: v })}
              placeholder={t('tts.settings.prompt_text_placeholder', '音频中的文字内容')}
              placeholderTextColor={colors.textTertiary}
            />
          </View>
          <View style={sectionStyle}>
            <Text style={labelStyle}>{t('tts.settings.prompt_lang_label', '参考音频语言')}</Text>
            <View style={styles.chipRow}>
              {['zh', 'en', 'ja', 'ko', 'yue'].map((lang) => (
                <TouchableOpacity
                  key={lang}
                  style={[
                    styles.chip,
                    { borderColor: colors.borderSubtle },
                    current.promptLang === lang && {
                      backgroundColor: colors.primary,
                      borderColor: colors.primary
                    }
                  ]}
                  onPress={() => updateCurrent({ promptLang: lang })}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: colors.textSecondary },
                      current.promptLang === lang && { color: colors.textOnPrimary }
                    ]}
                  >
                    {lang}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={sectionStyle}>
            <Text style={labelStyle}>{t('tts.settings.text_lang_label', '合成文本语言')}</Text>
            <View style={styles.chipRow}>
              {['zh', 'en', 'ja', 'ko', 'yue'].map((lang) => (
                <TouchableOpacity
                  key={lang}
                  style={[
                    styles.chip,
                    { borderColor: colors.borderSubtle },
                    current.textLang === lang && {
                      backgroundColor: colors.primary,
                      borderColor: colors.primary
                    }
                  ]}
                  onPress={() => updateCurrent({ textLang: lang })}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: colors.textSecondary },
                      current.textLang === lang && { color: colors.textOnPrimary }
                    ]}
                  >
                    {lang}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </>
      )}

      <View style={sectionStyle}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 6
          }}
        >
          <Text style={labelStyle}>{t('tts.settings.speed_label', '语速')}</Text>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>
            {current.speed.toFixed(1)}x
          </Text>
        </View>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Text style={{ fontSize: 11, color: colors.textTertiary }}>0.5x</Text>
          {/* Speed stepper buttons */}
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {[0.5, 0.7, 1.0, 1.3, 1.5, 1.8, 2.0].map((val) => (
              <TouchableOpacity
                key={val}
                style={[
                  styles.speedChip,
                  { borderColor: colors.borderSubtle },
                  current.speed === val && {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary
                  }
                ]}
                onPress={() => updateCurrent({ speed: val })}
              >
                <Text
                  style={[
                    { fontSize: 11, color: colors.textSecondary },
                    current.speed === val && { color: colors.textOnPrimary }
                  ]}
                >
                  {val}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={{ fontSize: 11, color: colors.textTertiary }}>2.0x</Text>
        </View>
      </View>

      <View style={sectionStyle}>
        <Text style={labelStyle}>{t('tts.settings.format_label', '音频格式')}</Text>
        <View style={styles.chipRow}>
          {FORMAT_OPTIONS.map((fmt) => (
            <TouchableOpacity
              key={fmt}
              style={[
                styles.chip,
                { borderColor: colors.borderSubtle },
                current.responseFormat === fmt && {
                  backgroundColor: colors.primary,
                  borderColor: colors.primary
                }
              ]}
              onPress={() => updateCurrent({ responseFormat: fmt })}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: colors.textSecondary },
                  current.responseFormat === fmt && { color: colors.textOnPrimary }
                ]}
              >
                {fmt.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={sectionStyle}>
        <Text style={labelStyle}>{t('tts.settings.test_label', '测试 TTS')}</Text>
        <TextInput
          style={[inputStyle, { minHeight: 60 }]}
          value={testText}
          onChangeText={setTestText}
          placeholder={t('tts.settings.test_placeholder', '输入一段文本测试语音合成效果')}
          placeholderTextColor={colors.textTertiary}
          multiline
        />
        <TouchableOpacity
          style={[
            styles.actionButton,
            { backgroundColor: colors.primary, marginTop: 8 },
            isTesting && { opacity: 0.6 }
          ]}
          onPress={handleTest}
          disabled={isTesting}
        >
          <Text style={[styles.actionButtonText, { color: colors.textOnPrimary }]}>
            {isTesting
              ? t('tts.settings.testing', '测试中...')
              : t('tts.settings.test_button', '测试')}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[
          styles.saveButton,
          { backgroundColor: colors.primary },
          isSaving && { opacity: 0.6 }
        ]}
        onPress={handleSave}
        disabled={isSaving}
      >
        <Text style={[styles.saveButtonText, { color: colors.textOnPrimary }]}>
          {isSaving ? t('common.saving', '保存中...') : t('common.save', '保存配置')}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1
  },
  chipText: { fontSize: 12, fontWeight: '500' },
  showBtn: {
    marginLeft: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center'
  },
  speedChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1
  },
  actionButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center'
  },
  actionButtonText: { fontSize: 14, fontWeight: '600' },
  saveButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8
  },
  saveButtonText: { fontSize: 16, fontWeight: '700' }
})
