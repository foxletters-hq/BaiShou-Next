import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../Button/Button';
import { Input } from '../Input/Input';
import { Select } from '../Select/Select';
import { useToast } from '../Toast';
import styles from './TTSProviderSettings.module.css';

interface TtsProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  modelId: string;
  voice: string;
  speed: number;
  responseFormat: string;
}

interface TTSProviderSettingsProps {
  onSaveConfig?: (config: TtsProviderConfig) => Promise<void>;
  onTestTts?: (config: TtsProviderConfig, text: string) => Promise<{ success: boolean; audioBase64?: string; format?: string }>;
}

export const TTSProviderSettings: React.FC<TTSProviderSettingsProps> = ({
  onSaveConfig,
  onTestTts,
}) => {
  const { t } = useTranslation();
  const toast = useToast();

  const [providerType, setProviderType] = useState<string>('openai-tts');
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1');
  const [apiKey, setApiKey] = useState('');
  const [modelId, setModelId] = useState('tts-1');
  const [voice, setVoice] = useState('alloy');
  const [speed, setSpeed] = useState(1.0);
  const [responseFormat, setResponseFormat] = useState('mp3');
  const [testText, setTestText] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const providerOptions = [
    { value: 'openai-tts', label: 'OpenAI 兼容 TTS' },
    { value: 'mimo-tts', label: '小米 MiMo TTS' },
  ];

  const formatOptions = [
    { value: 'mp3', label: 'MP3' },
    { value: 'wav', label: 'WAV' },
    { value: 'aac', label: 'AAC' },
  ];

  useEffect(() => {
    if (providerType === 'mimo-tts') {
      setModelId('mimo-v2.5-tts');
      setVoice('冰糖');
      setResponseFormat('wav');
      setBaseUrl('');
    } else {
      setModelId('tts-1');
      setVoice('alloy');
      setResponseFormat('mp3');
      setBaseUrl('https://api.openai.com/v1');
    }
  }, [providerType]);

  const handleSave = useCallback(async () => {
    if (!apiKey.trim()) {
      toast.showError(t('tts.settings.api_key_required', '请填写 API Key'));
      return;
    }
    if (!baseUrl.trim() && providerType === 'openai-tts') {
      toast.showError(t('tts.settings.base_url_required', '请填写 Base URL'));
      return;
    }

    setIsSaving(true);
    try {
      await onSaveConfig?.({
        id: providerType,
        name: providerType === 'openai-tts' ? 'OpenAI 兼容 TTS' : '小米 MiMo TTS',
        baseUrl: baseUrl.replace(/\/$/, ''),
        apiKey: apiKey.trim(),
        modelId,
        voice: voice.trim() || (providerType === 'mimo-tts' ? '冰糖' : 'alloy'),
        speed,
        responseFormat,
      });
      toast.showSuccess(t('tts.settings.save_success', 'TTS 配置已保存'));
    } catch (error: any) {
      toast.showError(t('tts.settings.save_failed', '保存失败: ') + error.message);
    } finally {
      setIsSaving(false);
    }
  }, [providerType, baseUrl, apiKey, modelId, voice, speed, responseFormat, onSaveConfig, t, toast]);

  const handleTest = useCallback(async () => {
    if (!testText.trim()) {
      toast.showError(t('tts.settings.test_text_required', '请输入测试文本'));
      return;
    }
    if (!apiKey.trim()) {
      toast.showError(t('tts.settings.api_key_required', '请先填写 API Key'));
      return;
    }

    setIsTesting(true);
    try {
      const result = await onTestTts?.({
        id: providerType,
        name: providerType === 'openai-tts' ? 'OpenAI 兼容 TTS' : '小米 MiMo TTS',
        baseUrl: baseUrl.replace(/\/$/, ''),
        apiKey: apiKey.trim(),
        modelId,
        voice: voice.trim() || (providerType === 'mimo-tts' ? '冰糖' : 'alloy'),
        speed,
        responseFormat,
      }, testText.trim());

      if (result?.success && result.audioBase64) {
        const audio = new Audio(`data:audio/${result.format || 'mp3'};base64,${result.audioBase64}`);
        await audio.play();
        toast.showSuccess(t('tts.settings.test_success', '测试成功，正在播放'));
      } else {
        toast.showError(t('tts.settings.test_failed', '测试失败'));
      }
    } catch (error: any) {
      toast.showError(t('tts.settings.test_error', '测试出错: ') + error.message);
    } finally {
      setIsTesting(false);
    }
  }, [providerType, baseUrl, apiKey, modelId, voice, speed, responseFormat, testText, onTestTts, t, toast]);

  const showSpeedControl = providerType === 'openai-tts';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('tts.settings.title', 'TTS 语音合成设置')}</h2>
        <p className={styles.description}>
          {t('tts.settings.description', '配置 TTS 供应商、模型和发音参数')}
        </p>
      </div>

      <div className={styles.form}>
        <div className={styles.section}>
          <label className={styles.label}>{t('tts.settings.provider_label', 'TTS 供应商')}</label>
          <Select
            options={providerOptions}
            value={providerType}
            onChange={(e) => setProviderType(e.target.value)}
          />
        </div>

        {providerType === 'openai-tts' && (
          <div className={styles.section}>
            <Input
              label={t('tts.settings.base_url_label', 'API Base URL')}
              placeholder="https://api.openai.com/v1"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>
        )}

        <div className={styles.section}>
          <Input
            label={t('tts.settings.api_key_label', 'API Key')}
            type="password"
            placeholder="sk-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>

        <div className={styles.section}>
          <Input
            label={t('tts.settings.model_id_label', '模型 ID')}
            placeholder={providerType === 'mimo-tts' ? 'mimo-v2.5-tts' : 'tts-1'}
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
          />
        </div>

        <div className={styles.section}>
          <Input
            label={t('tts.settings.voice_label', '发音人 (Voice ID)')}
            placeholder={providerType === 'mimo-tts' ? '冰糖' : 'alloy'}
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
          />
          <span className={styles.hint}>
            {t('tts.settings.voice_hint', '请输入当前模型支持的具体发音人/音色 ID')}
          </span>
        </div>

        {showSpeedControl && (
          <div className={styles.section}>
            <div className={styles.sliderHeader}>
              <label className={styles.label}>{t('tts.settings.speed_label', '语速比例 (Speed)')}</label>
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
        )}

        <div className={styles.section}>
          <label className={styles.label}>{t('tts.settings.format_label', '音频格式')}</label>
          <Select
            options={formatOptions}
            value={responseFormat}
            onChange={(e) => setResponseFormat(e.target.value)}
          />
        </div>

        <div className={styles.section}>
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
            >
              {isTesting ? t('tts.settings.testing', '测试中...') : t('tts.settings.test_button', '测试')}
            </Button>
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <Button
          variant="elevated"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? t('tts.settings.saving', '保存中...') : t('common.save', '保存配置')}
        </Button>
      </div>
    </div>
  );
};
