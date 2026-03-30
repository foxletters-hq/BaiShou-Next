import { useState } from 'react';

export function useSettingsMock() {
  const [themeMode, setThemeMode] = useState<'system'|'light'|'dark'>('system');
  const [seedColor, setSeedColor] = useState<string>('#9AD4EA');
  const [language, setLanguage] = useState<'system'|'zh'|'en'|'ja'|'zh-TW'>('system');

  return {
    state: { themeMode, seedColor, language },
    actions: { setThemeMode, setSeedColor, setLanguage }
  };
}
