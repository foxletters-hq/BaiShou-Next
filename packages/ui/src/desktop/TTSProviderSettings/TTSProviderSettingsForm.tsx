import React from 'react'
import { HelpTooltip } from '../HelpTooltip'
import styles from './TTSProviderSettings.module.css'
import type { TTSProviderSettingsViewModel } from './useTTSProviderSettings'
import { TTSProviderSettingsFormConnectionFields } from './TTSProviderSettingsFormConnectionFields'
import { TTSProviderSettingsFormModelFields } from './TTSProviderSettingsFormModelFields'
import { TTSProviderSettingsFormVoiceFields } from './TTSProviderSettingsFormVoiceFields'
import { TTSProviderSettingsFormTestSection } from './TTSProviderSettingsFormTestSection'

export function TTSProviderSettingsForm({ vm }: { vm: TTSProviderSettingsViewModel }) {
  const { t } = vm

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div className={styles.headerTitleGroup}>
          <h2 className={styles.title}>{t('tts.settings.title', 'TTS 语音合成设置')}</h2>
          <HelpTooltip
            content={t(
              'tts.settings.page_tooltip',
              '配置全局语音合成供应商、模型与发音人。OpenAI 兼容网关可只填 Base URL，无需 API Key 时留空即可获取模型并试听。'
            )}
          />
        </div>
      </div>

      <div className={styles.scrollArea}>
        <div className={styles.cardSection}>
          <div className={styles.form}>
            <TTSProviderSettingsFormConnectionFields vm={vm} />
            <TTSProviderSettingsFormModelFields vm={vm} />
            <TTSProviderSettingsFormVoiceFields vm={vm} />
            <TTSProviderSettingsFormTestSection vm={vm} />
          </div>
        </div>
      </div>
    </div>
  )
}
