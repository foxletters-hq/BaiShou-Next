import React from 'react'
import { HelpTooltip } from '../HelpTooltip'
import { SettingsPageChrome } from '../shared/SettingsPageChrome'
import stack from '../shared/SettingsStack.module.css'
import styles from './TTSProviderSettings.module.css'
import type { TTSProviderSettingsViewModel } from './useTTSProviderSettings'
import { TTSProviderSettingsFormConnectionFields } from './TTSProviderSettingsFormConnectionFields'
import { TTSProviderSettingsFormModelFields } from './TTSProviderSettingsFormModelFields'
import { TTSProviderSettingsFormVoiceFields } from './TTSProviderSettingsFormVoiceFields'
import { TTSProviderSettingsFormTestSection } from './TTSProviderSettingsFormTestSection'

export function TTSProviderSettingsForm({ vm }: { vm: TTSProviderSettingsViewModel }) {
  const { t } = vm

  return (
    <SettingsPageChrome
      title={t('tts.settings.title', 'TTS 语音合成设置')}
      trailing={
        <HelpTooltip
          size={14}
          content={t(
            'tts.settings.page_tooltip',
            '配置全局语音合成供应商、模型与发音人。OpenAI 兼容网关可只填 Base URL，无需 API Key 时留空即可获取模型并试听。'
          )}
        />
      }
    >
      <div className={stack.stack}>
        <div className={stack.stackGroup}>
          <div className={stack.sectionLabelRow}>
            <h3 className={stack.sectionLabel}>
              {t('tts.settings.section_connection', '连接')}
            </h3>
          </div>
          <section className={stack.cardSection}>
            <div className={`${styles.form} ${stack.cardBodyPadded}`}>
              <TTSProviderSettingsFormConnectionFields vm={vm} />
            </div>
          </section>
        </div>

        <div className={stack.stackGroup}>
          <div className={stack.sectionLabelRow}>
            <h3 className={stack.sectionLabel}>{t('tts.settings.section_model', '模型')}</h3>
          </div>
          <section className={stack.cardSection}>
            <div className={`${styles.form} ${stack.cardBodyPadded}`}>
              <TTSProviderSettingsFormModelFields vm={vm} />
            </div>
          </section>
        </div>

        <div className={stack.stackGroup}>
          <div className={stack.sectionLabelRow}>
            <h3 className={stack.sectionLabel}>{t('tts.settings.section_voice', '发音人')}</h3>
          </div>
          <section className={stack.cardSection}>
            <div className={`${styles.form} ${stack.cardBodyPadded}`}>
              <TTSProviderSettingsFormVoiceFields vm={vm} />
            </div>
          </section>
        </div>

        <div className={stack.stackGroup}>
          <div className={stack.sectionLabelRow}>
            <h3 className={stack.sectionLabel}>{t('tts.settings.section_test', '试听')}</h3>
          </div>
          <section className={stack.cardSection}>
            <div className={`${styles.form} ${stack.cardBodyPadded}`}>
              <TTSProviderSettingsFormTestSection vm={vm} />
            </div>
          </section>
        </div>
      </div>
    </SettingsPageChrome>
  )
}
