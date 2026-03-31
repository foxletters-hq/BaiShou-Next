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

  /**
   * 初始化服务：从数据库中直接读取当前配制决定是否注册热键
   */
  async start(): Promise<void> {
    const config = await this.settingsRepo.getHotkeyConfig();
    this.isEnabled = config.hotkeyEnabled;
    if (this.isEnabled) {
      this.register(config);
    }
  }

  /**
   * 更新并且重新注册热键
   */
  update(config: HotkeyConfig): void {
    this.unregisterAll();
    this.isEnabled = config.hotkeyEnabled;
    if (this.isEnabled) {
      this.register(config);
    }
  }

  /**
   * 停止所有全局监听
   */
  stop(): void {
    this.unregisterAll();
    this.isEnabled = false;
  }

  private register(config: HotkeyConfig): void {
    const accelerator = this.parseAccelerator(config.hotkeyModifier, config.hotkeyKey);
    if (!accelerator) return;

    try {
      // 注册全局热键拦截
      const success = globalShortcut.register(accelerator, () => {
        this.toggleWindow();
      });

      if (!success) {
        console.warn(`[HotkeyService] Failed to register global shortcut: ${accelerator}`);
      } else {
        console.log(`[HotkeyService] Successfully registered global shortcut: ${accelerator}`);
      }
    } catch (e) {
      console.error(`[HotkeyService] Error while registering global shortcut ${accelerator}:`, e);
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

      // 当窗口可见并且拥有焦点并且没有被最小化时，隐藏
      if (isVisible && !isMinimized && isFocused) {
        win.hide();
      } else {
        if (isMinimized) {
          win.restore();
        }
        if (!isVisible) {
          win.show();
        }
        
        // 强制占据前台及分配焦点
        win.focus();
        
        // 针对 Windows 的特别策略还原，强制脱离可能遮挡它的置顶或全屏应用
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

    return `${modStr}+${keyStr}`;
  }
}
