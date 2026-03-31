/**
 * 这是一个极简的供前端调用的包裹 Action 工具
 * 对应于 Implementation Plan 里的规范，我们在 Store 被触发导入后统一做一下刷新
 */
import { useSettingsStore } from './settings.store';
import { useUserProfileStore } from './user-profile.store';
import { usePromptShortcutStore } from './prompt-shortcut.store';

/**
 * 前端发起从物理路径还原旧版配置的串联钩子
 */
export const runLegacyImportFlow = async (filePath: string) => {
  if (typeof window === 'undefined' || !(window as any).api?.import) {
    return;
  }
  
  // 1. 将脏活累活交由主进程 (Node Core端) 去处理
  await (window as any).api.import.legacyData(filePath);
  
  // 2. 全部完成后，利用已存在的响应式 Action 更新前端全量状态
  await useSettingsStore.getState().loadConfig();
  await useUserProfileStore.getState().loadProfile();
  await usePromptShortcutStore.getState().loadShortcuts();
};
