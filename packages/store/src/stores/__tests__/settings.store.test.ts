import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from '../settings.store';

describe('useSettingsStore (User Preferences)', () => {
  beforeEach(() => {
    // Reset to defaults
    useSettingsStore.setState({
      themeMode: 'system',
      useGlassmorphism: true,
      locale: 'zh',
    });
  });

  it('should initialize with default user preferences', () => {
    const state = useSettingsStore.getState();
    expect(state.themeMode).toBe('system');
    expect(state.useGlassmorphism).toBe(true);
    expect(state.locale).toBe('zh');
  });

  it('setThemeMode should update theme settings', () => {
    const store = useSettingsStore.getState();
    store.setThemeMode('dark');
    
    expect(useSettingsStore.getState().themeMode).toBe('dark');
    
    store.setThemeMode('light');
    expect(useSettingsStore.getState().themeMode).toBe('light');
  });

  it('setLocale should strictly set the globally synced language string', () => {
    const store = useSettingsStore.getState();
    store.setLocale('en');
    
    expect(useSettingsStore.getState().locale).toBe('en');
  });

  it('toggleGlassmorphism disables rich visual effects without touching other properties', () => {
    const store = useSettingsStore.getState();
    store.toggleGlassmorphism(false);
    
    const nextState = useSettingsStore.getState();
    expect(nextState.useGlassmorphism).toBe(false);
    expect(nextState.themeMode).toBe('system'); // unmutated
  });
});
