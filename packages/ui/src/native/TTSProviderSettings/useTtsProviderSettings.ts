import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TtsProviderConfig, TTSProviderSettingsProps } from './tts-provider-settings.types'
import { DEFAULT_TTS_CONFIG } from './tts-provider-settings.constants'

export function useTtsProviderSettings({
  initialConfig,
  onSaveConfig,
  onTestTts
}: Pick<TTSProviderSettingsProps, 'initialConfig' | 'onSaveConfig' | 'onTestTts'>) {
  const { t } = useTranslation()
  const [config, setConfig] = useState<TtsProviderConfig>({
    ...DEFAULT_TTS_CONFIG,
    ...initialConfig
  })
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testText, setTestText] = useState('你好，这是 TTS 测试文本。')
  const [testResult, setTestResult] = useState<string | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)

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

  return {
    config,
    update,
    handleProviderChange,
    saving,
    testing,
    testText,
    setTestText,
    testResult,
    showApiKey,
    setShowApiKey,
    handleSave,
    handleTest,
    speedPercent: Math.round(config.speed * 100),
    isGptSovits: config.id === 'gpt-sovits'
  }
}
