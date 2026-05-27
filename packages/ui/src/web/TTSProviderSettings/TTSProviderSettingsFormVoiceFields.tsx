import React from 'react'
import { Input } from '../Input/Input'
import { Select } from '../Select/Select'
import styles from './TTSProviderSettings.module.css'
import type { TTSProviderSettingsViewModel } from './useTTSProviderSettings'

export function TTSProviderSettingsFormVoiceFields({ vm }: { vm: TTSProviderSettingsViewModel }) {
  const {
    t,
    providerType,
    currentConfig,
    updateCurrentConfig,
    langOptions,
    defaultMimoVoice,
    formatOptions,
    showSpeedControl
  } = vm

  return (
    <>
      <div className={styles.section}>
        <Input
          label={t('tts.settings.voice_label', '发音人 (Voice ID)')}
          placeholder={
            providerType === 'clone-tts' || providerType === 'gpt-sovits'
              ? 'default'
              : providerType === 'mimo-tts'
                ? defaultMimoVoice
                : 'alloy'
          }
          value={currentConfig.voice}
          onChange={(e) => updateCurrentConfig({ voice: e.target.value })}
        />
        <span className={styles.hint}>
          {t('tts.settings.voice_hint', '请输入当前模型支持的具体发音人/音色 ID')}
        </span>
      </div>

      {providerType === 'gpt-sovits' && (
        <>
          <div className={styles.section}>
            <Input
              label={t('tts.settings.ref_audio_path_label', '参考音频绝对路径 (refAudioPath)')}
              placeholder={t(
                'tts.settings.ref_audio_path_placeholder',
                '必填，例如：D:\\audio\\prompt.wav'
              )}
              value={currentConfig.refAudioPath || ''}
              onChange={(e) => updateCurrentConfig({ refAudioPath: e.target.value })}
            />
          </div>
          <div className={styles.section}>
            <Input
              label={t('tts.settings.prompt_text_label', '参考音频文本 (promptText)')}
              placeholder={t(
                'tts.settings.prompt_text_placeholder',
                '必填，参考音频内说话的文字内容'
              )}
              value={currentConfig.promptText || ''}
              onChange={(e) => updateCurrentConfig({ promptText: e.target.value })}
            />
          </div>
          <div className={styles.section}>
            <label className={styles.label}>
              {t('tts.settings.prompt_lang_label', '参考音频语言 (promptLang)')}
            </label>
            <Select
              options={langOptions}
              value={currentConfig.promptLang || 'zh'}
              onChange={(e) => updateCurrentConfig({ promptLang: e.target.value })}
            />
          </div>
          <div className={styles.section}>
            <label className={styles.label}>
              {t('tts.settings.text_lang_label', '合成文本语言 (textLang)')}
            </label>
            <Select
              options={langOptions}
              value={currentConfig.textLang || 'zh'}
              onChange={(e) => updateCurrentConfig({ textLang: e.target.value })}
            />
          </div>
        </>
      )}

      {showSpeedControl && (
        <div className={styles.section}>
          <div className={styles.sliderHeader}>
            <label className={styles.label}>
              {t('tts.settings.speed_label', '语速比例 (Speed)')}
            </label>
            <span className={styles.sliderValue}>{currentConfig.speed.toFixed(1)}x</span>
          </div>
          <div className={styles.sliderWrapper}>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={currentConfig.speed}
              onChange={(e) => updateCurrentConfig({ speed: parseFloat(e.target.value) })}
              className={styles.rangeInput}
            />
          </div>
        </div>
      )}

      <div className={styles.section}>
        <label className={styles.label}>{t('tts.settings.format_label', '音频格式')}</label>
        <Select
          options={formatOptions}
          value={currentConfig.responseFormat}
          onChange={(e) => updateCurrentConfig({ responseFormat: e.target.value })}
        />
      </div>
    </>
  )
}
