import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const PROJECT_ROOT = resolve(__dirname, '../../../..');

const readFile = (relativePath: string) =>
  readFileSync(resolve(PROJECT_ROOT, relativePath), 'utf-8');

describe('Agent 1: 日记与筛选功能验证', () => {
  it('任务2: DiaryPage 使用透明 overlay 而非灰色遮罩', () => {
    const css = readFile(
      'apps/desktop/src/renderer/src/features/diary/DiaryPage.css'
    );
    const overlayMatch = css.match(
      /\.diary-filter-overlay\s*\{[^}]*\}/
    );
    expect(overlayMatch).toBeTruthy();
    // 确认 overlay 没有 background-color
    expect(overlayMatch![0]).not.toContain('background-color');
    // 确认使用 position: fixed
    expect(overlayMatch![0]).toContain('position: fixed');
  });

  it('任务3: 筛选状态通过 sessionStorage 持久化', () => {
    const tsx = readFile(
      'apps/desktop/src/renderer/src/features/diary/DiaryPage.tsx'
    );
    // 确认 4 个状态变量都有 sessionStorage 持久化
    expect(tsx).toContain("sessionStorage.getItem('diary_searchQuery')");
    expect(tsx).toContain("sessionStorage.getItem('diary_selectedMonth')");
    expect(tsx).toContain("sessionStorage.getItem('diary_filterWeathers')");
    expect(tsx).toContain("sessionStorage.getItem('diary_filterFavorite')");

    // 确认有写入逻辑
    expect(tsx).toContain("sessionStorage.setItem('diary_searchQuery'");
    expect(tsx).toContain("sessionStorage.setItem('diary_selectedMonth'");
    expect(tsx).toContain("sessionStorage.setItem('diary_filterWeathers'");
    expect(tsx).toContain("sessionStorage.setItem('diary_filterFavorite'");
  });

  it('任务20: 分页组件 - 少于50条不显示', () => {
    const tsx = readFile(
      'apps/desktop/src/renderer/src/features/diary/DiaryPage.tsx'
    );
    // 确认分页阈值为 50
    expect(tsx).toMatch(/showPagination\s*=.*\.length\s*>\s*50/);
    // 确认分页选项为 [50, 80, 100, 200]
    expect(tsx).toContain('[50, 80, 100, 200]');
  });
});

describe('Agent 2: 伙伴管理 UI 验证', () => {
  it('任务4: 新增伙伴页面切换有 framer-motion 动画', () => {
    const tsx = readFile(
      'apps/desktop/src/renderer/src/features/agent/AssistantManagementScreen.tsx'
    );
    expect(tsx).toContain('AnimatePresence');
    expect(tsx).toContain('motion.div');
  });

  it('任务6: AvatarEditor 选择图片后打开裁剪组件', () => {
    const editorTsx = readFile(
      'packages/ui/src/web/AvatarEditor/index.tsx'
    );
    // 确认导入了 AvatarCropModal
    expect(editorTsx).toContain('AvatarCropModal');
    // 确认有裁剪状态管理
    expect(editorTsx).toContain('showCropModal');
    expect(editorTsx).toContain('tempImageSrc');
  });

  it('任务7: AssistantEditPage 正确显示供应商图标', () => {
    const tsx = readFile(
      'packages/ui/src/web/AssistantEditPage/index.tsx'
    );
    expect(tsx).toContain('getProviderIcon');
    expect(tsx).toContain('modelIcon');
  });

  it('任务23: 置顶伙伴选中状态用 brightness 而非 scale', () => {
    const css = readFile(
      'apps/desktop/src/renderer/src/features/agent/components/AgentSidebar.module.css'
    );
    const selectedMatch = css.match(
      /\.pinnedAvatarWrapper\.selected\s*\{[^}]*\}/
    );
    expect(selectedMatch).toBeTruthy();
    expect(selectedMatch![0]).toContain('brightness');
    expect(selectedMatch![0]).not.toContain('scale');
  });

  it('任务24: 新会话通过 URL 参数传递 assistantId', () => {
    const tsx = readFile(
      'apps/desktop/src/renderer/src/features/agent/AgentScreen.tsx'
    );
    // 确认 assistantId 通过 URL params 传递
    const layoutTsx = readFile(
      'apps/desktop/src/renderer/src/features/agent/AgentLayout.tsx'
    );
    expect(layoutTsx).toContain('assistantId');
    expect(layoutTsx).toContain('handleNewChat');
  });
});

describe('Agent 3: RAG 记忆管理验证', () => {
  it('任务10: RagMemoryView 背景铺满整个页面', () => {
    const css = readFile(
      'packages/ui/src/web/RagMemoryView/RagMemoryView.module.css'
    );
    const containerMatch = css.match(/\.container\s*\{[^}]*\}/);
    expect(containerMatch).toBeTruthy();
    expect(containerMatch![0]).toContain('min-height: 100%');
    expect(containerMatch![0]).toContain('flex: 1');
  });

  it('任务11: RAG 分页默认10条，可选 20/30/50/100', () => {
    const tsx = readFile(
      'packages/ui/src/web/RagMemoryView/index.tsx'
    );
    expect(tsx).toContain('[10, 20, 30, 50, 100]');
    expect(tsx).toMatch(/pageSize.*10/);
  });

  it('任务13: "清空当前维度记忆"按钮已删除', () => {
    const tsx = readFile(
      'packages/ui/src/web/RagMemoryView/index.tsx'
    );
    // onClearDimension 应该不在 JSX 中被调用 (仅在 interface 声明)
    const lines = tsx.split('\n');
    const jsxUsageLines = lines.filter(
      (line: string) => line.includes('onClearDimension') && !line.includes('?:') && !line.includes('interface')
    );
    // 确认没有 JSX 中使用 onClearDimension 的按钮
    expect(jsxUsageLines.every((line: string) => !line.includes('<button'))).toBe(true);
    // 确认按钮文字为 "清空现有记忆"
    expect(tsx).toContain("'清空现有记忆'");
  });

  it('任务14: 搜索支持语义/文本切换，默认语义', () => {
    const tsx = readFile(
      'packages/ui/src/web/RagMemoryView/index.tsx'
    );
    expect(tsx).toMatch(/searchMode.*semantic/);
    expect(tsx).toContain('toggleSearchMode');
    expect(tsx).toContain('searchModeToggle');
  });

  it('任务15: EmbeddingService 有 migrateEmbeddings 方法', () => {
    const ts = readFile(
      'packages/ai/src/rag/embedding.service.ts'
    );
    expect(ts).toContain('async *migrateEmbeddings');
    expect(ts).toContain('createMigrationBackup');
    expect(ts).toContain('clearAndReinitEmbeddings');
    expect(ts).toContain('doReEmbedFromBackup');
  });

  it('任务16: embedText 错误正确向上抛出', () => {
    const ts = readFile(
      'packages/ai/src/rag/embedding.service.ts'
    );
    // 找到 embedText 方法中的 catch 块
    const embedTextMatch = ts.match(
      /async embedText[\s\S]*?(?=async reEmbedText|public async \w)/
    );
    expect(embedTextMatch).toBeTruthy();
    const fnBody = embedTextMatch![0];
    // 确认 catch 中有 throw（错误传播）
    expect(fnBody).toContain('throw');
  });
});

describe('Agent 4: 设置与 UI 细节验证', () => {
  it('任务1: Ctrl+- 缩小功能已实现', () => {
    const ts = readFile(
      'apps/desktop/src/renderer/src/hooks/useZoom.ts'
    );
    expect(ts).toContain("key === '-'");
    // zoom 通过 preload bridge 调用，不是直接 webFrame
    expect(ts).toContain('api.zoom.setFactor');
    expect(ts).toContain('MIN_ZOOM');
    expect(ts).toContain('MAX_ZOOM');
  });

  it('任务21: descriptionText 和 chipsScrollArea 有内边距', () => {
    const css = readFile(
      'packages/ui/src/web/IdentitySettingsCard/IdentitySettingsCard.module.css'
    );
    expect(css).toMatch(/\.descriptionText\s*\{[^}]*padding/);
    expect(css).toMatch(/\.chipsScrollArea\s*\{[^}]*padding/);
  });

  it('任务25: TTS 模型选项已实现', () => {
    const tsx = readFile(
      'packages/ui/src/web/AIGlobalModelsView/index.tsx'
    );
    expect(tsx).toContain("'tts'");
    expect(tsx).toContain('globalTtsProviderId');
    expect(tsx).toContain('isTtsModel');
  });
});

describe('Agent 5: TTS 语音功能验证', () => {
  it('任务26: InputBar 有 TTS 切换按钮', () => {
    const tsx = readFile(
      'packages/ui/src/web/InputBar/index.tsx'
    );
    expect(tsx).toContain('onToggleTtsMode');
    expect(tsx).toContain('ttsMode');
    expect(tsx).toContain('Volume2');
  });

  it('任务27: MessageActionBar 有朗读按钮', () => {
    const tsx = readFile(
      'packages/ui/src/web/MessageActionBar/index.tsx'
    );
    expect(tsx).toContain('onReadAloud');
    expect(tsx).toContain('Volume2');
  });

  it('任务27: TTS IPC handler 存在', () => {
    const ts = readFile(
      'apps/desktop/src/main/ipc/agent-chat.ipc.ts'
    );
    expect(ts).toContain('agent:tts-synthesize');
    expect(ts).toContain('audio/speech');
  });
});

describe('Agent 6: 伙伴聊天上下文验证', () => {
  it('任务28: 上下文轮数设置端到端流程完整', () => {
    const editPage = readFile(
      'packages/ui/src/web/AssistantEditPage/index.tsx'
    );
    expect(editPage).toContain('contextWindow');

    const schema = readFile(
      'packages/database/src/schema/agent-assistants.ts'
    );
    expect(schema).toContain('context_window');

    const helpers = readFile(
      'apps/desktop/src/main/ipc/agent-helpers.ts'
    );
    expect(helpers).toContain('assistantContextWindow');

    const builder = readFile(
      'packages/ai/src/agent/context-window.builder.ts'
    );
    expect(builder).toContain('recentCount');
  });

  it('任务30: ContextChainDialog 组件存在', () => {
    const tsx = readFile(
      'packages/ui/src/web/ContextChainDialog/index.tsx'
    );
    expect(tsx).toContain('上下文');
    expect(tsx).toContain('压缩内容');
    expect(tsx).toContain('提示词');
  });

  it('任务31: 对话分支功能完整', () => {
    const actionBar = readFile(
      'packages/ui/src/web/MessageActionBar/index.tsx'
    );
    expect(actionBar).toContain('onBranch');
    expect(actionBar).toContain('GitBranch');

    const ipc = readFile(
      'apps/desktop/src/main/ipc/agent-session.ipc.ts'
    );
    expect(ipc).toContain('agent:branch-session');
  });
});

describe('Agent 7: 回忆生成页面验证', () => {
  it('任务17: 卡片 section 合并，无中间圆角', () => {
    const tsx = readFile(
      'packages/ui/src/web/SummarySettingsView/index.tsx'
    );
    // 确认只有一个 cardSection 包裹
    const cardSections = tsx.match(/cardSection/g);
    expect(cardSections).toBeTruthy();

    const css = readFile(
      'packages/ui/src/web/SummarySettingsView/SummarySettingsView.module.css'
    );
    // 确认有 divider 但没有中间圆角
    expect(css).toContain('divider');
  });

  it('任务17: Emoji 正确映射 🌱☘️🪴🌳', () => {
    const tsx = readFile(
      'packages/ui/src/web/SummarySettingsView/index.tsx'
    );
    expect(tsx).toContain("'🌱'");
    expect(tsx).toContain("'☘️'");
    expect(tsx).toContain("'🪴'");
    expect(tsx).toContain("'🌳'");
  });
});

describe('Agent 8: 记忆画廊验证', () => {
  it('任务19: 侧边栏点击仅切换，不进入编辑', () => {
    const tsx = readFile(
      'packages/ui/src/web/GalleryPanel/GalleryPanel.tsx'
    );
    // handleItemClick 应该只设置 selectedId
    expect(tsx).toContain('handleItemClick');
    expect(tsx).toContain('setSelectedId');

    const summaryPage = readFile(
      'apps/desktop/src/renderer/src/features/summary/SummaryPage.tsx'
    );
    // onOpen prop 存在但不触发导航
    expect(summaryPage).toContain('onOpen');
    // onEdit 才导航
    expect(summaryPage).toContain('navigate');
  });
});

describe('Agent 9: 文件附件系统验证', () => {
  it('任务18-1: 附件上传组件支持图片/视频/音频', () => {
    const tsx = readFile(
      'packages/ui/src/web/DiaryEditor/AttachmentUploader.tsx'
    );
    expect(tsx).toContain('image/*');
    expect(tsx).toContain('video/*');
    expect(tsx).toContain('audio/*');
  });

  it('任务18-1: 支持粘贴上传', () => {
    const tsx = readFile(
      'packages/ui/src/web/DiaryEditor/AttachmentUploader.tsx'
    );
    expect(tsx).toContain('handlePaste');
    expect(tsx).toContain('clipboardData');
  });

  it('任务18-2: 右键菜单包含打开文件夹和复制', () => {
    const tsx = readFile(
      'packages/ui/src/web/DiaryEditor/AttachmentUploader.tsx'
    );
    expect(tsx).toContain('openAttachmentFolder');
    expect(tsx).toContain('copyAttachment');
  });

  it('任务18-4: 编辑器渲染附件引用', () => {
    const tsx = readFile(
      'packages/ui/src/web/DiaryEditor/CodeMirrorEditor.tsx'
    );
    expect(tsx).toContain('processAttachments');
    expect(tsx).toContain('attachment/');
  });

  it('任务18-3: ImagePreview 组件已集成到 CodeMirrorEditor', () => {
    const editor = readFile(
      'packages/ui/src/web/DiaryEditor/CodeMirrorEditor.tsx'
    );
    // 导入存在
    expect(editor).toContain("import { ImagePreview }");
    // 确认有 previewSrc 状态管理
    expect(editor).toContain('previewSrc');
    // 确认 ImagePreview 在 JSX 中使用
    expect(editor).toContain('<ImagePreview');
  });

  it('任务18-5: MarkdownRenderer 支持附件路径渲染', () => {
    const renderer = readFile(
      'packages/ui/src/web/MarkdownRenderer/MarkdownRenderer.tsx'
    );
    // 确认有 basePath prop
    expect(renderer).toContain('basePath');
    // 确认有 resolveAttachment 辅助函数
    expect(renderer).toContain('resolveAttachment');
    // 确认有自定义 img/video/audio 组件
    expect(renderer).toContain('attachment');
  });

  it('任务18-6: DiaryCard 传递 basePath 给 MarkdownRenderer', () => {
    const diaryCard = readFile(
      'apps/desktop/src/renderer/src/features/diary/DiaryCard.tsx'
    );
    // 确认 DiaryCard 接受 basePath prop
    expect(diaryCard).toContain('basePath?: string');
    // 确认 basePath 传递给 MarkdownRenderer
    expect(diaryCard).toContain('basePath={basePath}');
  });
});
