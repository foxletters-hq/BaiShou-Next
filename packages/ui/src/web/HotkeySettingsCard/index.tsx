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

  const getEndKeyFromCode = useCallback((code: string): string | null => {
    switch (code) {
      case 'KeyA': case 'KeyB': case 'KeyC': case 'KeyD': case 'KeyE':
      case 'KeyF': case 'KeyG': case 'KeyH': case 'KeyI': case 'KeyJ':
      case 'KeyK': case 'KeyL': case 'KeyM': case 'KeyN': case 'KeyO':
      case 'KeyP': case 'KeyQ': case 'KeyR': case 'KeyS': case 'KeyT':
      case 'KeyU': case 'KeyV': case 'KeyW': case 'KeyX': case 'KeyY':
      case 'KeyZ':
      case 'Digit0': case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4':
      case 'Digit5': case 'Digit6': case 'Digit7': case 'Digit8': case 'Digit9':
      case 'Numpad0': case 'Numpad1': case 'Numpad2': case 'Numpad3': case 'Numpad4':
      case 'Numpad5': case 'Numpad6': case 'Numpad7': case 'Numpad8': case 'Numpad9':
        return code.slice(-1);
      case 'Space': return 'Space';
      case 'Enter': case 'NumpadEnter': return 'Return';
      case 'ArrowUp': return 'Up';
      case 'ArrowDown': return 'Down';
      case 'ArrowLeft': return 'Left';
      case 'ArrowRight': return 'Right';
      case 'Escape': return 'Esc';
      case 'Backquote': return '\`';
      case 'Period': return '.';
      case 'Slash': return '/';
      case 'Semicolon': return ';';
      case 'BracketLeft': return '[';
      case 'BracketRight': return ']';
      case 'Backslash': return '\\\\';
      case 'Quote': return "'";
      case 'Comma': return ',';
      case 'Minus': return '-';
      case 'Equal': return '=';
      default: return null;
    }
  }, []);

  useEffect(() => {
    if (isRecording) {
      const handleKeyDown = (e: KeyboardEvent) => {
        e.preventDefault();
        
        let modifierStr = 'Alt';
        if (e.metaKey || e.ctrlKey) modifierStr = 'CommandOrControl';
        else if (e.altKey) modifierStr = 'Alt';
        else if (e.shiftKey) modifierStr = 'Shift';

        const parsedKey = getEndKeyFromCode(e.code);
        if (!parsedKey) return; // ignore modifier-only presses or unmapped keys

        let finalKey = parsedKey;
        if (finalKey === 'Return') finalKey = 'Enter';
        if (finalKey === 'Esc') finalKey = 'Escape';

        setLocalModifier(modifierStr);
        setLocalKey(finalKey);
        
        // Pass standard normalized format to backend (which expects Space, Up, Return etc)
        // Convert display names back to canonical backend names if needed.
        const backendKey = parsedKey === '\\\\' ? 'Backslash' : parsedKey;
        saveKey(modifierStr, backendKey);
        setIsRecording(false);
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
    return undefined;
  }, [isRecording, saveKey, getEndKeyFromCode]);

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
