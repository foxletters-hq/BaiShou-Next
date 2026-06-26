import { globalShortcut, BrowserWindow } from 'electron'
import type { HotkeyConfig } from '@baishou/shared'
import { logger } from '@baishou/shared'

export interface HotkeyConfigReader {
  getHotkeyConfig(): Promise<HotkeyConfig>
}

/**
 * 全局快捷键服务 (桌面端系统级)
 * 依赖 Electron 的 globalShortcut 实现全局键盘钩子，执行呼出/隐藏应用的动作。
 */
export class HotkeyService {
  private isEnabled = false

  constructor(
    private readonly configStore: HotkeyConfigReader,
    private readonly mainWindow: BrowserWindow
  ) {}

  async start(): Promise<void> {
    logger.info('[HotkeyService] 🚀 Starting HotkeyService initialization...')
    try {
      const config = await this.configStore.getHotkeyConfig()
      logger.info('[HotkeyService] 📦 Loaded config from DB:', JSON.stringify(config))

      this.isEnabled = config?.hotkeyEnabled ?? false

      if (this.isEnabled) {
        logger.info('[HotkeyService] ✅ Global shortcut is ENABLED. Proceeding to register...')
        this.register(config)
      } else {
        logger.info(
          '[HotkeyService] ⏸️ Global shortcut is DISABLED in settings. Skipping registration.'
        )
      }
    } catch (e: any) {
      logger.error('[HotkeyService] ❌ Failed to start HotkeyService:', e)
    }
  }

  update(config: HotkeyConfig): boolean {
    logger.info('[HotkeyService] ✏️ Hotkey configuration updated:', { config })
    this.unregisterAll()
    this.isEnabled = config.hotkeyEnabled
    if (this.isEnabled) {
      return this.register(config)
    }
    logger.info('[HotkeyService] ⏸️ Global shortcut disabled via settings update.')
    return true
  }

  stop(): void {
    logger.info('[HotkeyService] 🛑 Stopping hotkey service...')
    this.unregisterAll()
    this.isEnabled = false
  }

  private register(config: HotkeyConfig): boolean {
    if (!config.hotkeyKey || !config.hotkeyModifier) {
      logger.info('[HotkeyService] ⚠️ Invalid shortcut configuration. Skipping registration.', {
        config
      })
      return false
    }

    const accelerator = this.parseAccelerator(config.hotkeyModifier, config.hotkeyKey)
    if (!accelerator) {
      logger.info(
        `[HotkeyService] ⚠️ Could not parse accelerator for ${config.hotkeyModifier} + ${config.hotkeyKey}`
      )
      return false
    }

    logger.info(`[HotkeyService] 🔄 Attempting to register global shortcut: ${accelerator}`)

    try {
      const success = globalShortcut.register(accelerator, () => {
        logger.info(
          `[HotkeyService] 🎯 Global shortcut [${accelerator}] triggered! Toggling window...`
        )
        this.toggleWindow()
      })

      if (!success) {
        logger.warn(
          `[HotkeyService] ❌ Failed to register global shortcut: ${accelerator}. This is usually because another application has already registered this OS-level shortcut, or it's reserved by Windows.`
        )
      } else {
        logger.info(`[HotkeyService] ✅ Successfully registered global shortcut: ${accelerator}`)
      }
      return success
    } catch (e: any) {
      logger.error(
        `[HotkeyService] 💀 Exception thrown while registering global shortcut ${accelerator}:`,
        e
      )
      return false
    }
  }

  private unregisterAll(): void {
    globalShortcut.unregisterAll()
  }

  /**
   * 隐藏/显现主窗口的主线控制机制（包含老版强杀至前台的 OS 焦点策略）
   */
  public async toggleWindow(): Promise<void> {
    try {
      const win = this.mainWindow
      if (!win || win.isDestroyed()) return

      const isMinimized = win.isMinimized()
      const isVisible = win.isVisible()
      const isFocused = win.isFocused()

      // 当窗口绝对处于前台活跃状态时才隐藏
      if (isVisible && !isMinimized && isFocused) {
        win.hide()
      } else {
        if (isMinimized) {
          win.restore()
        }

        // 增强窗口前置逻辑 (macOS/Windows)
        if (process.platform !== 'linux') {
          win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
        }

        // 无论是否 visible 都调用 show，这是拉起焦点的重要前置步骤
        win.show()
        win.focus()

        if (process.platform !== 'linux') {
          win.setVisibleOnAllWorkspaces(false)
        }

        // 保留原有的针对 Windows 置顶 hack (双重保险)
        if (process.platform === 'win32') {
          win.setSkipTaskbar(false)
          win.setAlwaysOnTop(true)
          win.setAlwaysOnTop(false)
        }
      }
    } catch (e: any) {
      logger.error('[HotkeyService] Toggle window failed', e)
    }
  }

  /**
   * 将遗留的或者分离的设置组合转换为合法的 Electron Accelerator 字符串
   * 参考: https://www.electronjs.org/docs/latest/api/accelerator
   */
  private parseAccelerator(modifier: string, key: string): string | null {
    let modStr = 'Alt'
    switch (modifier.toLowerCase()) {
      case 'alt':
        modStr = 'Alt'
        break
      case 'ctrl':
      case 'control':
      case 'commandorcontrol':
        modStr = 'CommandOrControl'
        break
      case 'shift':
        modStr = 'Shift'
        break
      case 'meta':
      case 'win':
      case 'cmd':
        modStr = 'Super'
        break
      case 'cmdorctrl':
        modStr = 'CommandOrControl'
        break
      default:
        modStr = 'Alt'
    }

    const trimmedKey = key.trim()
    if (!trimmedKey) return null

    const canonicalKeyMap: Record<string, string> = {
      space: 'Space',
      return: 'Return',
      enter: 'Return',
      esc: 'Esc',
      escape: 'Esc',
      up: 'Up',
      down: 'Down',
      left: 'Left',
      right: 'Right',
      backslash: '\\',
      tab: 'Tab'
    }

    const normalizedKey = trimmedKey.replace(/^key/i, '')
    const mapped =
      canonicalKeyMap[normalizedKey.toLowerCase()] ??
      canonicalKeyMap[trimmedKey.toLowerCase()] ??
      normalizedKey

    if (!mapped) return null

    if (mapped.length === 1) {
      return `${modStr}+${mapped.toUpperCase()}`
    }

    return `${modStr}+${mapped}`
  }
}
