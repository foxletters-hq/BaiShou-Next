import { useTranslation } from 'react-i18next'
import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator
} from 'react-native'
import Slider from '@react-native-community/slider'
import { useNativeTheme } from '../theme'
import { SettingsSection } from '../SettingsSection'
import { Button } from '../Button'

export interface TtsProviderConfig {
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

export interface TTSProviderSettingsProps {
  initialConfig?: Partial<TtsProviderConfig>
  onSaveConfig?: (config: TtsProviderConfig) => Promise<void>
  onTestTts?: (
    config: TtsProviderConfig,
    text: string
  ) => Promise<{ success: boolean; message?: string }>
}

const PROVIDERS = [
  { id: 'openai-tts', label: 'OpenAI TTS' },
  { id: 'mimo-tts', label: 'MiMo TTS' },
  { id: 'clone-tts', label: 'Clone TTS' },
  { id: 'gpt-sovits', label: 'GPT-SoVITS' }
]

const FORMATS = [
  { id: 'mp3', label: 'MP3' },
  { id: 'wav', label: 'WAV' },
  { id: 'aac', label: 'AAC' }
]

const DEFAULT_CONFIG: TtsProviderConfig = {
  id: 'openai-tts',
  name: '',
  baseUrl: '',
  apiKey: '',
  modelId: '',
  voice: '',
  speed: 1.0,
  responseFormat: 'mp3'
}

export const TTSProviderSettings: React.FC<TTSProviderSettingsProps> = ({
  initialConfig,
  onSaveConfig,
  onTestTts
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [config, setConfig] = useState<TtsProviderConfig>({
    ...DEFAULT_CONFIG,
    ...initialConfig
  })
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testText, setTestText] = useState('你好，这是 TTS 测试文本。')
  const [testResult, setTestResult] = useState<string | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)

  const isGptSovits = config.id === 'gpt-sovits'

  const update = (patch: Partial<TtsProviderConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }))
    setTestResult(null)
  }

  const handleProviderChange = (id: string) => {
    update({ id, name: '' })
  }

  const handleSave = async () => {
    if (!onSaveConfig) return
    setSaving(true)
    try {
      await onSaveConfig(config)
      setTestResult(t('common.save_success', '保存成功'))
    } catch {
      setTestResult(t('common.save_failed', '保存失败'))
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!onTestTts || !testText.trim()) return
    setTesting(true)
    setTestResult(null)
    try {
      const result = await onTestTts(config, testText)
      setTestResult(
        result.success
          ? result.message ?? t('tts.test_success', 'TTS 测试成功')
          : result.message ?? t('tts.test_failed', 'TTS 测试失败')
      )
    } catch {
      setTestResult(t('tts.test_failed', 'TTS 测试失败'))
    } finally {
      setTesting(false)
    }
  }

  const speedPercent = Math.round(config.speed * 100)

  return (
    <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
      <SettingsSection title={t('tts.title', 'TTS 语音合成设置')}>
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>
            {t('tts.provider', 'TTS 供应商')}
          </Text>
          <View style={styles.chipRow}>
            {PROVIDERS.map((p) => (
              <TouchableOpacity
                key={p.id}
                activeOpacity={0.7}
                style={[
                  styles.chip,
                  {
                    borderColor: config.id === p.id ? colors.primary : colors.borderMuted,
                    backgroundColor:
                      config.id === p.id ? colors.primaryLight : 'transparent'
                  }
                ]}
                onPress={() => handleProviderChange(p.id)}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: config.id === p.id ? colors.primary : colors.textSecondary
                    }
                  ]}
                >
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.fieldGroup, { borderTopColor: colors.borderSubtle }]}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>
            {t('tts.base_url', 'Base URL')}
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.bgSurfaceNormal,
                color: colors.textPrimary,
                borderColor: colors.borderMuted
              }
            ]}
            value={config.baseUrl}
            onChangeText={(v) => update({ baseUrl: v })}
            placeholder="https://api.openai.com/v1"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={[styles.fieldGroup, { borderTopColor: colors.borderSubtle }]}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>
            {t('tts.api_key', 'API Key')}
          </Text>
          <View style={styles.apiKeyRow}>
            <TextInput
              style={[
                styles.input,
                styles.inputFlex,
                {
                  backgroundColor: colors.bgSurfaceNormal,
                  color: colors.textPrimary,
                  borderColor: colors.borderMuted
                }
              ]}
              value={config.apiKey}
              onChangeText={(v) => update({ apiKey: v })}
              placeholder="sk-..."
              placeholderTextColor={colors.textTertiary}
              secureTextEntry={!showApiKey}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.toggleBtn, { borderColor: colors.borderMuted }]}
              onPress={() => setShowApiKey(!showApiKey)}
            >
              <Text style={[styles.toggleBtnText, { color: colors.textSecondary }]}>
                {showApiKey
                  ? t('common.hide', '隐藏')
                  : t('common.show', '显示')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.fieldGroup, { borderTopColor: colors.borderSubtle }]}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>
            {t('tts.model_id', '模型 ID')}
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.bgSurfaceNormal,
                color: colors.textPrimary,
                borderColor: colors.borderMuted
              }
            ]}
            value={config.modelId}
            onChangeText={(v) => update({ modelId: v })}
            placeholder="tts-1"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={[styles.fieldGroup, { borderTopColor: colors.borderSubtle }]}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>
            {t('tts.voice', '发音人 / Voice ID')}
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.bgSurfaceNormal,
                color: colors.textPrimary,
                borderColor: colors.borderMuted
              }
            ]}
            value={config.voice}
            onChangeText={(v) => update({ voice: v })}
            placeholder="alloy"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={[styles.fieldGroup, { borderTopColor: colors.borderSubtle }]}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>
            {t('tts.speed', '语速')} ({speedPercent}%)
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={0.5}
            maximumValue={2.0}
            step={0.1}
            value={config.speed}
            onValueChange={(v) => update({ speed: v })}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.borderMuted}
            thumbTintColor={colors.primary}
          />
          <View style={styles.rangeRow}>
            <Text style={[styles.rangeLabel, { color: colors.textTertiary }]}>0.5x</Text>
            <Text style={[styles.rangeLabel, { color: colors.textTertiary }]}>2.0x</Text>
          </View>
        </View>

        <View style={[styles.fieldGroup, { borderTopColor: colors.borderSubtle }]}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>
            {t('tts.response_format', '音频格式')}
          </Text>
          <View style={styles.chipRow}>
            {FORMATS.map((fmt) => (
              <TouchableOpacity
                key={fmt.id}
                activeOpacity={0.7}
                style={[
                  styles.chip,
                  {
                    borderColor:
                      config.responseFormat === fmt.id ? colors.primary : colors.borderMuted,
                    backgroundColor:
                      config.responseFormat === fmt.id ? colors.primaryLight : 'transparent'
                  }
                ]}
                onPress={() => update({ responseFormat: fmt.id })}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color:
                        config.responseFormat === fmt.id
                          ? colors.primary
                          : colors.textSecondary
                    }
                  ]}
                >
                  {fmt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {isGptSovits && (
          <>
            <View style={[styles.fieldGroup, { borderTopColor: colors.borderSubtle }]}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>
                {t('tts.ref_audio_path', '参考音频路径')}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.bgSurfaceNormal,
                    color: colors.textPrimary,
                    borderColor: colors.borderMuted
                  }
                ]}
                value={config.refAudioPath ?? ''}
                onChangeText={(v) => update({ refAudioPath: v })}
                placeholder="/path/to/ref.wav"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={[styles.fieldGroup, { borderTopColor: colors.borderSubtle }]}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>
                {t('tts.prompt_text', '提示文本')}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.bgSurfaceNormal,
                    color: colors.textPrimary,
                    borderColor: colors.borderMuted
                  }
                ]}
                value={config.promptText ?? ''}
                onChangeText={(v) => update({ promptText: v })}
                placeholder="..."
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            <View style={[styles.fieldGroup, { borderTopColor: colors.borderSubtle }]}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>
                {t('tts.prompt_lang', '提示语言')}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.bgSurfaceNormal,
                    color: colors.textPrimary,
                    borderColor: colors.borderMuted
                  }
                ]}
                value={config.promptLang ?? ''}
                onChangeText={(v) => update({ promptLang: v })}
                placeholder="zh"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={[styles.fieldGroup, { borderTopColor: colors.borderSubtle }]}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>
                {t('tts.text_lang', '文本语言')}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.bgSurfaceNormal,
                    color: colors.textPrimary,
                    borderColor: colors.borderMuted
                  }
                ]}
                value={config.textLang ?? ''}
                onChangeText={(v) => update({ textLang: v })}
                placeholder="zh"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </>
        )}

        <View style={[styles.fieldGroup, { borderTopColor: colors.borderSubtle }]}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>
            {t('tts.test_text', '测试文本')}
          </Text>
          <TextInput
            style={[
              styles.input,
              styles.multilineInput,
              {
                backgroundColor: colors.bgSurfaceNormal,
                color: colors.textPrimary,
                borderColor: colors.borderMuted
              }
            ]}
            value={testText}
            onChangeText={setTestText}
            multiline
            numberOfLines={3}
            placeholderTextColor={colors.textTertiary}
          />

          {testResult && (
            <Text
              style={[
                styles.resultText,
                {
                  color: testResult.includes('成功') ? colors.success : colors.error
                }
              ]}
            >
              {testResult}
            </Text>
          )}
        </View>
      </SettingsSection>

      <View style={styles.actionRow}>
        <Button
          variant="outlined"
          onPress={handleTest}
          isLoading={testing}
          disabled={!onTestTts}
          style={styles.actionBtn}
        >
          {t('tts.test', '测试 TTS')}
        </Button>
        <Button
          onPress={handleSave}
          isLoading={saving}
          disabled={!onSaveConfig}
          style={styles.actionBtn}
        >
          {t('common.save', '保存')}
        </Button>
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  fieldGroup: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14
  },
  inputFlex: { flex: 1 },
  multilineInput: {
    minHeight: 72,
    textAlignVertical: 'top'
  },
  apiKeyRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center'
  },
  toggleBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  toggleBtnText: { fontSize: 14 },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1
  },
  chipText: { fontSize: 13, fontWeight: '500' },
  slider: { width: '100%', height: 40 },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -4
  },
  rangeLabel: { fontSize: 11 },
  resultText: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '500'
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 8
  },
  actionBtn: { flex: 1 },
  bottomSpacer: { height: 40 }
})
