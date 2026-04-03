import React, { useState, useEffect, useCallback } from 'react';
import styles from './HotkeySettingsCard.module.css';
import { useTranslation } from 'react-i18next';


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
  const { t } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);
  const [localModifier, setLocalModifier] = useState(config.hotkeyModifier);
  const [localKey, setLocalKey] = useState(config.hotkeyKey);

  const CONFLICT_LIST = [
    'CommandOrControl+C',
    'CommandOrControl+V',
    'CommandOrControl+X',
    'CommandOrControl+W',
    'CommandOrControl+Q',
    'CommandOrControl+R',
    'Alt+F4',
    'Alt+TAB'
  ];

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
    return undefined;
  }, [isRecording, saveKey]);

  useEffect(() => {
    setLocalModifier(config.hotkeyModifier);
    setLocalKey(config.hotkeyKey);
  }, [config.hotkeyModifier, config.hotkeyKey]);

  const displayString = `${localModifier.replace('CommandOrControl', 'Ctrl / Cmd')} + ${localKey}`;
  const comboStr = `${localModifier}+${localKey}`;
  const isConflict = CONFLICT_LIST.includes(comboStr) || CONFLICT_LIST.includes(comboStr.toUpperCase());

  return (
    <div className={styles.container}>
      <div className={styles.row}>
        <div className={styles.info}>
          <span className={styles.title}>{t('hotkey.enable_global', '启用全局快捷键唤出')}</span>
          <span className={styles.subtitle}>{t('hotkey.enable_global_desc', '跨应用随时呼出或隐藏控制台界面')}</span>
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

      <div className={`${styles.row} ${styles.colRow}`}>
        <div className={styles.hotkeyHeader}>
          <div className={styles.info}>
            <span className={styles.title}>{t('hotkey.record_combo', '录入快捷组合键')}</span>
            <span className={styles.subtitle}>{t('hotkey.record_combo_desc', '尝试按下您偏好的组合键以录入（不支持单击）')}</span>
          </div>
          
          <div className={`${styles.inputGroup} ${isConflict ? styles.conflictGroup : ''}`}>
            <input 
               className={`${styles.keyInput} ${isConflict ? styles.conflictText : ''}`} 
               value={isRecording ? t('hotkey.listening', '正在监听按键输入...') : displayString} 
               readOnly 
            />
            <button 
               className={`${styles.recordBtn} ${isRecording ? styles.recording : ''}`}
               onClick={() => setIsRecording(!isRecording)}
               disabled={!config.hotkeyEnabled}
               style={{ opacity: config.hotkeyEnabled ? 1 : 0.5 }}
            >
               {isRecording ? t('common.abort', '中止') : t('hotkey.rerecord', '重新录入')}
            </button>
          </div>
        </div>
        
        {isConflict && (
          <div className={styles.conflictWarningBox}>
             ⚠️ {t('hotkey.warning', '警告：此组合键可能会与系统原生操作或浏览器快捷键产生冲突。')}
          </div>
        )}
      </div>
    </div>
  );
};
