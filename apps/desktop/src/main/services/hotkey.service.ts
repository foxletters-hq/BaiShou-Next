import { globalShortcut, BrowserWindow } from 'electron';
import type { SettingsRepository } from '@baishou/database';
import type { HotkeyConfig } from '@baishou/shared';

/**
 * 全局快捷键服务 (桌面端系统级)
 * 依赖 Electron 的 globalShortcut 实现全局键盘钩子，执行呼出/隐藏应用的动作。
 */
export class HotkeyService {
  private isEnabled = false;

  constructor(
    private readonly settingsRepo: SettingsRepository,
    private readonly mainWindow: BrowserWindow
  ) {}

  async start(): Promise<void> {
    console.log('[HotkeyService] 🚀 Starting HotkeyService initialization...');
    try {
      const config = await this.settingsRepo.getHotkeyConfig();
      console.log('[HotkeyService] 📦 Loaded config from DB:', JSON.stringify(config));
      
      this.isEnabled = config?.hotkeyEnabled ?? false;
      
      if (this.isEnabled) {
        console.log('[HotkeyService] ✅ Global shortcut is ENABLED. Proceeding to register...');
        this.register(config);
      } else {
        console.log('[HotkeyService] ⏸️ Global shortcut is DISABLED in settings. Skipping registration.');
      }
    } catch (e) {
      console.error('[HotkeyService] ❌ Failed to start HotkeyService:', e);
    }
  }

  update(config: HotkeyConfig): void {
    console.log('[HotkeyService] ✏️ Hotkey configuration updated:', config);
    this.unregisterAll();
    this.isEnabled = config.hotkeyEnabled;
    if (this.isEnabled) {
      this.register(config);
    } else {
      console.log('[HotkeyService] ⏸️ Global shortcut disabled via settings update.');
    }
  }

  stop(): void {
    console.log('[HotkeyService] 🛑 Stopping hotkey service...');
    this.unregisterAll();
    this.isEnabled = false;
  }

  private register(config: HotkeyConfig): void {
    if (!config.hotkeyKey || !config.hotkeyModifier) {
      console.log('[HotkeyService] ⚠️ Invalid shortcut configuration. Skipping registration.', config);
      return;
    }

    const accelerator = this.parseAccelerator(config.hotkeyModifier, config.hotkeyKey);
    if (!accelerator) {
      console.log(`[HotkeyService] ⚠️ Could not parse accelerator for ${config.hotkeyModifier} + ${config.hotkeyKey}`);
      return;
    }
    
    console.log(`[HotkeyService] 🔄 Attempting to register global shortcut: ${accelerator}`);

    try {
      // 注册全局热键拦截
      const success = globalShortcut.register(accelerator, () => {
        console.log(`[HotkeyService] 🎯 Global shortcut [${accelerator}] triggered! Toggling window...`);
        this.toggleWindow();
      });

      if (!success) {
        console.warn(`[HotkeyService] ❌ Failed to register global shortcut: ${accelerator}. This is usually because another application has already registered this OS-level shortcut, or it's reserved by Windows.`);
      } else {
        console.log(`[HotkeyService] ✅ Successfully registered global shortcut: ${accelerator}`);
      }
    } catch (e) {
      console.error(`[HotkeyService] 💀 Exception thrown while registering global shortcut ${accelerator}:`, e);
    }
  }

  private unregisterAll(): void {
    globalShortcut.unregisterAll();
  }

  /**
   * 隐藏/显现主窗口的主线控制机制（包含老版强杀至前台的 OS 焦点策略）
   */
  public async toggleWindow(): Promise<void> {
    try {
      const win = this.mainWindow;
      if (!win || win.isDestroyed()) return;

      const isMinimized = win.isMinimized();
      const isVisible = win.isVisible();
      const isFocused = win.isFocused();

      if (isVisible && !isMinimized && isFocused) {
        win.hide();
      } else {
        if (isMinimized) {
          win.restore();
        }
        
        if (process.platform !== 'linux') {
          win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        }
        
        // 无论是否 visible 都调用 show，这是拉起焦点的重要前置步骤
        win.show();
        win.focus();

        if (process.platform !== 'linux') {
          win.setVisibleOnAllWorkspaces(false);
        }
        
        // 保留原有的针对 Windows 置顶 hack (双重保险)
        if (process.platform === 'win32') {
          win.setSkipTaskbar(false);
          win.setAlwaysOnTop(true);
          win.setAlwaysOnTop(false);
        }
      }
    } catch (e) {
      console.error('[HotkeyService] Toggle window failed', e);
    }
  }

  /**
   * 将遗留的或者分离的设置组合转换为合法的 Electron Accelerator 字符串
   * 参考: https://www.electronjs.org/docs/latest/api/accelerator
   */
  private parseAccelerator(modifier: string, key: string): string | null {
    // 解析修饰键
    let modStr = 'Alt';
    switch (modifier.toLowerCase()) {
      case 'alt': modStr = 'Alt'; break;
      case 'ctrl':
      case 'control': modStr = 'CommandOrControl'; break;
      case 'shift': modStr = 'Shift'; break;
      case 'meta':
      case 'win':
      case 'cmd': modStr = 'Super'; break; // Electron 里 Windows 徽标键/Mac Cmd键统一可用 Super 表示，或者用 CmdOrCtrl/Command
      case 'cmdorctrl': modStr = 'CommandOrControl'; break;
      default: modStr = 'Alt';
    }

    // 解析主键。原版形式 "keyS" -> "S", "f1" -> "F1"
    let keyStr = key.replace(/^key/i, '').toUpperCase();
    
    // 如果是数字或者特殊功能键
    if (!keyStr) return null;

    // 特殊键位转换映射 (兼容前端直接传递 e.key 及可能的变形)
    const specialMap: Record<string, string> = {
      ' ': 'SPACE',
      'ARROWUP': 'UP',
      'ARROWDOWN': 'DOWN',
      'ARROWLEFT': 'LEFT',
      'ARROWRIGHT': 'RIGHT',
      'ESCAPE': 'ESC',
      'ENTER': 'RETURN'
    };

    if (specialMap[keyStr]) {
      keyStr = specialMap[keyStr];
    } else if (keyStr.startsWith('DIGIT')) {
      // "DIGIT1" -> "1"
      keyStr = keyStr.replace('DIGIT', '');
    }

    return `${modStr}+${keyStr}`;
  }
}
