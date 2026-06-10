import React from 'react'
import { Button } from '../Button/Button'
import { Input } from '../Input/Input'
import styles from './TTSProviderSettings.module.css'
import type { TTSProviderSettingsViewModel } from './useTTSProviderSettings'

export function TTSProviderSettingsFormTestSection({ vm }: { vm: TTSProviderSettingsViewModel }) {
  const { t, testText, setTestText, handleTest, isTesting } = vm

  return (
    <div className={`${styles.section} ${styles.fullWidthSection}`}>
      <label className={styles.label}>{t('tts.settings.test_label', '测试 TTS')}</label>
      <div className={styles.testRow}>
        <Input
          placeholder={t('tts.settings.test_placeholder', '输入一段文本测试语音合成效果')}
          value={testText}
          onChange={(e) => setTestText(e.target.value)}
          className={styles.testInput}
        />
        <Button
          variant="elevated"
          onClick={handleTest}
          disabled={isTesting}
          className={styles.testBtn}
        >
          {isTesting
            ? t('tts.settings.testing', '测试中...')
            : t('tts.settings.test_button', '测试')}
        </Button>
      </div>
    </div>
  )
}
