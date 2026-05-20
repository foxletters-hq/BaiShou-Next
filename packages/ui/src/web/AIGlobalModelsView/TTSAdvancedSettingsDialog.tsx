import React, { useState, useEffect } from 'react';
import { Modal } from '../Modal/Modal';
import { Button } from '../Button/Button';
import { Input } from '../Input/Input';
import { Select } from '../Select/Select';
import { TtsSettings } from '@baishou/shared';
import { useTranslation } from 'react-i18next';
import styles from './TTSAdvancedSettingsDialog.module.css';

export interface TTSAdvancedSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  settings?: TtsSettings;
  onSave: (settings: TtsSettings) => void;
}

export const TTSAdvancedSettingsDialog: React.FC<TTSAdvancedSettingsDialogProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const { t } = useTranslation();

  const [voice, setVoice] = useState<string>('alloy');
  const [speed, setSpeed] = useState<number>(1.0);
  const [responseFormat, setResponseFormat] = useState<string>('mp3');

  useEffect(() => {
    if (isOpen && settings) {
      setVoice(settings.voice || 'alloy');
      setSpeed(settings.speed ?? 1.0);
      setResponseFormat(settings.responseFormat || 'mp3');
    }
  }, [isOpen, settings]);

  const handleSave = () => {
    onSave({
      voice: voice.trim() || 'alloy',
      speed,
      responseFormat,
    });
    onClose();
  };

  const formatOptions = [
    { value: 'mp3', label: 'MP3' },
    { value: 'wav', label: 'WAV' },
    { value: 'aac', label: 'AAC' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('models.tts.advanced_title', '语音合成 (TTS) 高级设置')}>
      <div className={styles.container}>
        {/* 发音人直接输入框 */}
        <div className={styles.section}>
          <Input
            label={t('models.tts.voice_label', '发音人角色 (Voice ID)')}
            placeholder={t('models.tts.voice_placeholder', '例如 alloy, echo, Mia, xiaole 等')}
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
          />
          <span className={styles.hint}>
            {t('models.tts.voice_hint', '请输入您当前 TTS 模型所支持的具体发音人/音色 ID（例如 OpenAI 默认可用 alloy，小米 TTS 填写 Mia ）。')}
          </span>
        </div>

        {/* 播放语速 */}
        <div className={styles.section}>
          <div className={styles.sliderHeader}>
            <label className={styles.label}>{t('models.tts.speed_label', '语速比例 (Speed)')}</label>
            <span className={styles.sliderValue}>{speed.toFixed(1)}x</span>
          </div>
          <div className={styles.sliderWrapper}>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className={styles.rangeInput}
            />
          </div>
        </div>

        {/* 音频格式 */}
        <div className={styles.section}>
          <label className={styles.label}>{t('models.tts.format_label', '返回格式 (Format)')}</label>
          <Select
            options={formatOptions}
            value={responseFormat}
            onChange={(e) => setResponseFormat(e.target.value)}
          />
        </div>

        {/* 底部按钮 */}
        <div className={styles.actions}>
          <Button variant="outlined" onClick={onClose}>
            {t('common.cancel', '取消')}
          </Button>
          <Button variant="elevated" onClick={handleSave}>
            {t('common.save', '保存配置')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
