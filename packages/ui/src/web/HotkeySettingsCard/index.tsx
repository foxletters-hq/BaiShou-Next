import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MdOutlineKeyboard, MdOutlineEdit } from 'react-icons/md';
import '../shared/SettingsListTile.css';

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
    'CommandOrControl+C', 'CommandOrControl+V', 'CommandOrControl+X',
    'CommandOrControl+W', 'CommandOrControl+Q', 'CommandOrControl+R',
    'Alt+F4', 'Alt+TAB'
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
        if (e.metaKey || e.ctrlKey) modifierStr = 'CommandOrControl';
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
    <div>
      <div className="settings-list-tile settings-list-tile-noclick">
        <div className="settings-list-tile-leading">
          <MdOutlineKeyboard size={24} />
        </div>
        <div className="settings-list-tile-content">
          <span className="settings-list-tile-title">{t('hotkey.enable_global', '启用全局快捷键唤出')}</span>
          <span className="settings-list-tile-subtitle">
            {config.hotkeyEnabled 
              ? t('hotkey.enable_global_desc', '跨应用随时呼出或隐藏控制台界面', { hotkey: displayString })
              : t('hotkey.enable_global_desc_disabled', '未开启全局呼出快捷键')}
          </span>
        </div>
        <label className="settings-switch-label" onClick={(e) => e.stopPropagation()}>
          <input 
            type="checkbox" 
            checked={config.hotkeyEnabled}
            onChange={(e) => onChange({ ...config, hotkeyEnabled: e.target.checked })}
          />
          <span className="settings-switch-slider" />
        </label>
      </div>

      {config.hotkeyEnabled && (
        <>
          <div className="settings-list-divider indent" />
          <div className="settings-list-tile settings-list-tile-noclick">
            <div className="settings-list-tile-leading" style={{ paddingLeft: 24 }} />
            <div className="settings-list-tile-content">
              <span className="settings-list-tile-title">{t('hotkey.record_combo', '录入快捷组合键')}</span>
              {isConflict && (
                <span className="settings-list-tile-subtitle" style={{ color: '#ef4444' }}>
                  ⚠ {t('hotkey.warning', '警告：可能会产生按键冲突')}
                </span>
              )}
            </div>
            
            <button 
              className="settings-text-btn"
              style={{
                background: isRecording ? 'rgba(91, 168, 245, 0.1)' : 'rgba(0,0,0,0.05)',
                color: isConflict && !isRecording ? '#ef4444' : 'inherit',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 20
              }}
              onClick={() => setIsRecording(!isRecording)}
            >
              <MdOutlineEdit size={16} />
              {isRecording ? t('hotkey.listening', '正在监听...') : displayString}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
