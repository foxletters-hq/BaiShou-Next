import React from 'react'
import { Input } from '../Input/Input'
import { Select } from '../Select/Select'
import styles from './TTSProviderSettings.module.css'
import type { TTSProviderSettingsViewModel } from './useTTSProviderSettings'
import {
  isMimoPresetModel,
  isMimoVoiceCloneModel,
  isMimoVoiceDesignModel,
  normalizeRefAudioPath,
  parseRefAudioPick
} from '@baishou/shared'
import { FolderOpen } from 'lucide-react'

export function TTSProviderSettingsFormVoiceFields({ vm }: { vm: TTSProviderSettingsViewModel }) {
  const {
    t,
    providerType,
    currentConfig,
    updateCurrentConfig,
    langOptions,
    defaultMimoVoice,
    formatOptions,
    showSpeedControl,
    onPickRefAudio
  } = vm

  const mimoModelId = currentConfig.modelId || ''
  const showMimoVoiceCloneRef = providerType === 'mimo-tts' && isMimoVoiceCloneModel(mimoModelId)
  const showMimoVoiceDesignPrompt =
    providerType === 'mimo-tts' && isMimoVoiceDesignModel(mimoModelId)
  const showMimoStylePrompt =
    providerType === 'mimo-tts' &&
    (isMimoPresetModel(mimoModelId) || isMimoVoiceCloneModel(mimoModelId) || !mimoModelId.trim())
  const showPresetVoice =
    providerType !== 'mimo-tts' || !mimoModelId.trim() || isMimoPresetModel(mimoModelId)

  const handlePickRefAudio = async () => {
    if (!onPickRefAudio) return
    const picked = await onPickRefAudio()
    const parsed = parseRefAudioPick(picked)
    if (!parsed || providerType === 'mimo-tts') return
    updateCurrentConfig({ refAudioPath: parsed.path })
  }

  const renderRefAudioField = (label: string, placeholder: string, hint?: string) => (
    <div className={styles.section}>
      <label className={styles.label}>{label}</label>
      <div className={styles.refAudioInputRow}>
        <div className={styles.refAudioInputWrap}>
          <Input
            placeholder={placeholder}
            value={currentConfig.refAudioPath || ''}
            onChange={(e) =>
              updateCurrentConfig({ refAudioPath: normalizeRefAudioPath(e.target.value) })
            }
          />
        </div>
        {onPickRefAudio ? (
          <button
            type="button"
            className={styles.refAudioPickBtn}
            onClick={() => void handlePickRefAudio()}
            title={t('tts.settings.pick_ref_audio_button', '选择文件')}
            aria-label={t('tts.settings.pick_ref_audio_button', '选择文件')}
          >
            <FolderOpen size={16} />
          </button>
        ) : null}
      </div>
      {hint ? <span className={styles.hint}>{hint}</span> : null}
    </div>
  )

  return (
    <>
      {showPresetVoice && (
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
      )}

      {showMimoVoiceCloneRef &&
        renderRefAudioField(
          t('tts.settings.mimo_ref_audio_path_label', '参考音频绝对路径 (音色复刻)'),
          t(
            'tts.settings.mimo_ref_audio_path_placeholder',
            '必填，支持 wav/mp3，例如：D:\\audio\\prompt.wav'
          ),
          t(
            'tts.settings.mimo_ref_audio_hint',
            'MiMo 音色复刻将读取该音频样本并复刻音色，无需填写发音人 ID'
          )
        )}

      {showMimoVoiceDesignPrompt && (
        <div className={styles.section}>
          <Input
            label={t('tts.settings.mimo_voice_design_label', '音色描述 (Voice Design)')}
            placeholder={t(
              'tts.settings.mimo_voice_design_placeholder',
              '必填，例如：温柔知性的年轻女声，语速适中，略带磁性'
            )}
            value={currentConfig.promptText || ''}
            onChange={(e) => updateCurrentConfig({ promptText: e.target.value })}
          />
          <span className={styles.hint}>
            {t('tts.settings.mimo_voice_design_hint', '描述越具体，生成的定制音色越贴近预期')}
          </span>
        </div>
      )}

      {showMimoStylePrompt && (
        <div className={styles.section}>
          <Input
            label={t('tts.settings.mimo_style_prompt_label', '风格指令 (可选)')}
            placeholder={t(
              'tts.settings.mimo_style_prompt_placeholder',
              '例如：用轻快自然的语调，语速稍快'
            )}
            value={currentConfig.promptText || ''}
            onChange={(e) => updateCurrentConfig({ promptText: e.target.value })}
          />
          <span className={styles.hint}>
            {t(
              'tts.settings.mimo_style_prompt_hint',
              '通过自然语言控制语气、情绪与节奏；留空则使用默认风格'
            )}
          </span>
        </div>
      )}

      {providerType === 'gpt-sovits' && (
        <>
          {renderRefAudioField(
            t('tts.settings.ref_audio_path_label', '参考音频绝对路径 (refAudioPath)'),
            t('tts.settings.ref_audio_path_placeholder', '必填，例如：D:\\audio\\prompt.wav')
          )}
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
