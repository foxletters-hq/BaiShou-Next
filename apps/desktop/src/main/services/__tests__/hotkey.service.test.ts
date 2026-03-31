import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HotkeyService } from '../hotkey.service';
import { globalShortcut } from 'electron';

// 顶层拦截 Electron 环境以进行离线测试
vi.mock('electron', () => ({
  globalShortcut: {
    register: vi.fn().mockReturnValue(true),
    unregisterAll: vi.fn(),
  },
  BrowserWindow: vi.fn(),
}));

describe('HotkeyService', () => {
  let mockRepo: any;
  let mockWindow: any;
  let service: HotkeyService;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRepo = {
      getHotkeyConfig: vi.fn().mockResolvedValue({
        hotkeyEnabled: true,
        hotkeyModifier: 'Alt',
        hotkeyKey: 'S'
      })
    };

    mockWindow = {
      isDestroyed: vi.fn().mockReturnValue(false),
      isMinimized: vi.fn().mockReturnValue(false),
      isVisible: vi.fn().mockReturnValue(false),
      isFocused: vi.fn().mockReturnValue(false),
      hide: vi.fn(),
      show: vi.fn(),
      restore: vi.fn(),
      focus: vi.fn(),
      setSkipTaskbar: vi.fn(),
      setAlwaysOnTop: vi.fn(),
    };

    service = new HotkeyService(mockRepo, mockWindow);
  });

  it('should register hotkey if enabled in config on start', async () => {
    await service.start();
    expect(mockRepo.getHotkeyConfig).toHaveBeenCalled();
    expect(globalShortcut.register).toHaveBeenCalledWith('Alt+S', expect.any(Function));
    expect((service as any).isEnabled).toBe(true);
  });

  it('should ignore missing keys during parsing', async () => {
    mockRepo.getHotkeyConfig.mockResolvedValueOnce({
      hotkeyEnabled: true,
      hotkeyModifier: 'CommandOrControl',
      hotkeyKey: 'key' // 解析出空或者非法情况
    });
    const tempService = new HotkeyService(mockRepo, mockWindow);
    await tempService.start();
    // 由于只有 "KEY"，去掉 key 后为空字符
    expect(globalShortcut.register).not.toHaveBeenCalled();
  });

  it('should update and re-register hotkey', () => {
    service.update({
      hotkeyEnabled: true,
      hotkeyModifier: 'Ctrl',
      hotkeyKey: 'Space'
    });
    expect(globalShortcut.unregisterAll).toHaveBeenCalled();
    // Ctrl 被映射为 CommandOrControl, Space 照样保留
    expect(globalShortcut.register).toHaveBeenCalledWith('CommandOrControl+SPACE', expect.any(Function));
  });

  it('should unregister all on stop', () => {
    service.stop();
    expect(globalShortcut.unregisterAll).toHaveBeenCalled();
    expect((service as any).isEnabled).toBe(false);
  });

  describe('toggleWindow', () => {
    it('should hide window if visible, not minimized, and focused', async () => {
      mockWindow.isVisible.mockReturnValue(true);
      mockWindow.isMinimized.mockReturnValue(false);
      mockWindow.isFocused.mockReturnValue(true);

      await service.toggleWindow();
      expect(mockWindow.hide).toHaveBeenCalled();
      expect(mockWindow.show).not.toHaveBeenCalled();
    });

    it('should show window if hidden', async () => {
      mockWindow.isVisible.mockReturnValue(false);
      mockWindow.isMinimized.mockReturnValue(false);
      mockWindow.isFocused.mockReturnValue(false);

      await service.toggleWindow();
      expect(mockWindow.show).toHaveBeenCalled();
      expect(mockWindow.focus).toHaveBeenCalled();
    });

    it('should restore window if minimized', async () => {
      mockWindow.isVisible.mockReturnValue(true);
      mockWindow.isMinimized.mockReturnValue(true);
      mockWindow.isFocused.mockReturnValue(false);

      await service.toggleWindow();
      expect(mockWindow.restore).toHaveBeenCalled();
      // focus 也必须要抢占
      expect(mockWindow.focus).toHaveBeenCalled();
    });
  });
});
