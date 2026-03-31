import React, { useState, useEffect, useCallback } from 'react';
import styles from './HotkeySettingsCard.module.css';

export interface HotkeyConfig {
  hotkeyEnabled: boolean;
  hotkeyModifier: string;
  hotkeyKey: string;
}

interface HotkeySettingsCardProps {
  config: HotkeyConfig;
  onChange: (config: HotkeyConfig) => void;
}

export const HotkeySettingsCard: React.FC<HotkeySettingsCardProps> = ({ config, onChange }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [localModifier, setLocalModifier] = useState(config.hotkeyModifier);
  const [localKey, setLocalKey] = useState(config.hotkeyKey);

  const saveKey = useCallback((modifier: string, keyStr: string) => {
    onChange({ ...config, hotkeyModifier: modifier, hotkeyKey: keyStr });
  }, [config, onChange]);

  useEffect(() => {
    if (isRecording) {
      const handleKeyDown = (e: KeyboardEvent) => {
        e.preventDefault();
        const key = e.key.toUpperCase();
        if (['ALT', 'CONTROL', 'META', 'SHIFT'].includes(key)) return; 

        let modifierStr = 'Alt';
        if (e.metaKey) modifierStr = 'CommandOrControl';
        if (e.ctrlKey) modifierStr = 'CommandOrControl';
        if (e.altKey) modifierStr = 'Alt';
        if (e.shiftKey) modifierStr = 'Shift';

        setLocalModifier(modifierStr);
        setLocalKey(key);
        saveKey(modifierStr, key);
        setIsRecording(false);
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isRecording, saveKey]);

  useEffect(() => {
    setLocalModifier(config.hotkeyModifier);
    setLocalKey(config.hotkeyKey);
  }, [config.hotkeyModifier, config.hotkeyKey]);

  const displayString = `${localModifier.replace('CommandOrControl', 'Ctrl / Cmd')} + ${localKey}`;

  return (
    <div className={styles.container}>
      <div className={styles.row}>
        <div className={styles.info}>
          <span className={styles.title}>启用全局快捷键唤出</span>
          <span className={styles.subtitle}>跨应用随时呼出或隐藏沉浸式窗口</span>
        </div>
        <label className={styles.switch}>
          <input 
            type="checkbox" 
            checked={config.hotkeyEnabled}
            onChange={(e) => onChange({ ...config, hotkeyEnabled: e.target.checked })}
          />
          <span className={styles.slider}></span>
        </label>
      </div>

      <div className={styles.row}>
        <div className={styles.info}>
          <span className={styles.title}>录入专属组合键</span>
          <span className={styles.subtitle}>尝试按下您偏好的组合键（不支持单键哦）</span>
        </div>
        
        <div className={styles.inputGroup}>
          <input 
             className={styles.keyInput} 
             value={isRecording ? '正在监听按键输入...' : displayString} 
             readOnly 
          />
          <button 
             className={`${styles.recordBtn} ${isRecording ? styles.recording : ''}`}
             onClick={() => setIsRecording(!isRecording)}
             disabled={!config.hotkeyEnabled}
             style={{ opacity: config.hotkeyEnabled ? 1 : 0.5 }}
          >
             {isRecording ? '中止' : '点击重新录制'}
          </button>
        </div>
      </div>
    </div>
  );
};
