import { globalShortcut, BrowserWindow } from 'electron';

export class ShortcutService {
  public static register(mainWindow: BrowserWindow) {
    const toggleWindow = () => {
      if (mainWindow.isVisible()) {
        if (mainWindow.isFocused()) {
          mainWindow.hide();
        } else {
          mainWindow.focus();
        }
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    };

    // Register Alt+Space to toggle the chat window globally
    globalShortcut.register('Alt+Space', toggleWindow);
    
    // Ensure cleanup
    mainWindow.on('closed', () => {
      this.unregisterAll();
    });
  }

  public static unregisterAll() {
    globalShortcut.unregisterAll();
  }
}
