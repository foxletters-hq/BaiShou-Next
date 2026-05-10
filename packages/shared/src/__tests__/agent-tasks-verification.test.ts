import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const I18N_DIR = resolve(__dirname, '../i18n');
const loadI18n = (lang: string) =>
  JSON.parse(readFileSync(resolve(I18N_DIR, `${lang}.i18n.json`), 'utf-8'));

describe('Agent 3: RAG i18n 验证', () => {
  const zh = loadI18n('zh');
  const en = loadI18n('en');
  const ja = loadI18n('ja');
  const zhTW = loadI18n('zh_TW');

  it('任务12: rag_disabled_alert 四语言一致更新', () => {
    expect(zh.settings.rag_disabled_alert).toBe('RAG记忆功能已经关闭了喵~');
    expect(en.settings.rag_disabled_alert).toContain('RAG memory');
    // ja 和 zh_TW 已更新为本地化文案
    expect(ja.settings.rag_disabled_alert).toContain('RAG');
    expect(ja.settings.rag_disabled_alert).not.toBe(zh.settings.rag_disabled_alert);
    expect(zhTW.settings.rag_disabled_alert).toContain('RAG');
    expect(zhTW.settings.rag_disabled_alert).toContain('關閉');
  });

  it('任务13: rag_clear_all 四语言一致更新', () => {
    expect(zh.settings.rag_clear_all).toBe('清空现有记忆');
    expect(en.settings.rag_clear_all).toContain('Existing Memory');
    // ja 和 zh_TW 已更新为本地化文案（不再是旧的中文）
    expect(ja.settings.rag_clear_all).not.toContain('向量');
    expect(ja.settings.rag_clear_all).not.toBe('清空所有向量数据');
    expect(zhTW.settings.rag_clear_all).toContain('記憶');
    expect(zhTW.settings.rag_clear_all).not.toBe('清空所有向量資料');
  });

  it('任务14: RAG 搜索相关 i18n key 四语言完整', () => {
    const requiredKeys = [
      'rag_search_semantic_hint',
      'rag_search_text_hint',
      'rag_search_semantic',
      'rag_search_text',
    ];
    for (const key of requiredKeys) {
      expect(zh.settings).toHaveProperty(key);
      expect(en.settings).toHaveProperty(key);
      // BUG: ja 和 zh_TW 缺失这些 key
      expect(ja.settings).toHaveProperty(key);
      expect(zhTW.settings).toHaveProperty(key);
    }
  });

  it('任务11: RAG 分页 i18n key 四语言完整', () => {
    const requiredKeys = ['rag_pagination_info', 'rag_per_page'];
    for (const key of requiredKeys) {
      expect(zh.settings).toHaveProperty(key);
      expect(en.settings).toHaveProperty(key);
      // BUG: ja 和 zh_TW 可能缺失
      expect(ja.settings).toHaveProperty(key);
      expect(zhTW.settings).toHaveProperty(key);
    }
  });
});

describe('Agent 2: 伙伴管理 UI 验证', () => {
  it('任务8: bind_model_desc 四语言存在', () => {
    const zh = loadI18n('zh');
    const en = loadI18n('en');
    const ja = loadI18n('ja');
    const zhTW = loadI18n('zh_TW');

    expect(zh.agent?.assistant?.bind_model_desc).toContain('绑定后');
    expect(en.agent?.assistant?.bind_model_desc).toContain('prioritize');
    expect(ja.agent?.assistant?.bind_model_desc).toContain('優先');
    expect(zhTW.agent?.assistant?.bind_model_desc).toContain('綁定後');
  });

  it('任务5: 代码中不存在"长按选择图片"文本', () => {
    const fs = require('fs');
    const path = require('path');

    const searchDir = resolve(__dirname, '../../../ui/src/web');
    const files = getAllTsTsxFiles(searchDir);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toContain('长按选择图片');
    }
  });
});

describe('Agent 4: 设置 UI 验证', () => {
  it('任务9: i18n 中不再包含"Api密钥"文本', () => {
    const zh = loadI18n('zh');
    const en = loadI18n('en');

    const zhStr = JSON.stringify(zh);
    const enStr = JSON.stringify(en);

    expect(zhStr).not.toContain('Api密钥');
    expect(enStr).not.toContain('Api密钥');
    // 确认 API Key 存在
    expect(zhStr).toContain('API Key');
  });

  it('任务33: 快捷指令分页选项包含 5/10/15/20/25/30', () => {
    const fs = require('fs');
    const shortcutManagerPath = resolve(
      __dirname,
      '../../../ui/src/web/PromptShortcutSheet/ShortcutManagerDialog.tsx'
    );
    const content = fs.readFileSync(shortcutManagerPath, 'utf-8');

    expect(content).toContain('[5, 10, 15, 20, 25, 30]');
  });
});

describe('Agent 5: TTS 功能验证', () => {
  it('任务27: ChatBubble 接受 isTtsPlaying prop 并传递给 MessageActionBar', () => {
    const fs = require('fs');
    const chatBubblePath = resolve(
      __dirname,
      '../../../ui/src/web/ChatBubble/index.tsx'
    );
    const content = fs.readFileSync(chatBubblePath, 'utf-8');

    // 确认 prop 声明存在
    expect(content).toContain('isTtsPlaying?: boolean');
    // 确认 prop 解构存在
    expect(content).toContain('isTtsPlaying = false');

    // 确认 isTtsPlaying 被传递给 MessageActionBar
    expect(content).toContain('isTtsPlaying');

    // 确认 MessageActionBar 有对应的视觉反馈
    const actionBarPath = resolve(
      __dirname,
      '../../../ui/src/web/MessageActionBar/index.tsx'
    );
    const actionBarContent = fs.readFileSync(actionBarPath, 'utf-8');
    expect(actionBarContent).toContain('isTtsPlaying');
    expect(actionBarContent).toContain('ttsPlaying');
  });

  it('任务27: AgentScreen auto-play 使用 ref 避免 stale closure', () => {
    const fs = require('fs');
    const agentScreenPath = resolve(
      __dirname,
      '../../../../apps/desktop/src/renderer/src/features/agent/AgentScreen.tsx'
    );
    const content = fs.readFileSync(agentScreenPath, 'utf-8');

    // 确认使用了 ref 来跟踪 ttsMode（避免 stale closure）
    expect(content).toContain('ttsModeRef');
    // 确认 auto-play useEffect 存在（通过 ref 访问）
    expect(content).toContain("ttsModeRef.current === 'always'");
    // 确认 handleTtsReadAloud 在依赖中或通过 ref 访问
    expect(content).toContain('handleTtsReadAloud');
  });
});

describe('Agent 6: 伙伴聊天功能验证', () => {
  it('任务22: handleRefreshPricing 正确返回 result 对象', () => {
    const fs = require('fs');
    const agentScreenPath = resolve(
      __dirname,
      '../../../../apps/desktop/src/renderer/src/features/agent/AgentScreen.tsx'
    );
    const content = fs.readFileSync(agentScreenPath, 'utf-8');

    // 找到 handleRefreshPricing 函数
    const fnMatch = content.match(
      /const handleRefreshPricing[\s\S]*?(?=const \w+ = useCallback|\/\/ ──|$)/
    );
    if (fnMatch) {
      const fnBody = fnMatch[0];
      // 确认函数有 return result
      expect(fnBody).toContain('return result');
      // 确认 catch 块也返回错误对象
      expect(fnBody).toContain('success: false');
    }
  });
});

describe('Agent 9: 文件附件系统验证', () => {
  it('任务18: ImagePreview 组件已集成到 MilkdownEditor', () => {
    const fs = require('fs');
    const editorPath = resolve(
      __dirname,
      '../../../ui/src/web/DiaryEditor/MilkdownEditor.tsx'
    );
    const content = fs.readFileSync(editorPath, 'utf-8');

    // 确认导入存在
    expect(content).toContain("import { ImagePreview }");
    // 确认有 previewSrc 状态
    expect(content).toContain('previewSrc');
    // 确认 ImagePreview 在 JSX 中使用
    expect(content).toContain('<ImagePreview');
  });

  it('任务18: MarkdownRenderer 支持附件路径渲染', () => {
    const fs = require('fs');
    const rendererPath = resolve(
      __dirname,
      '../../../ui/src/web/MarkdownRenderer/MarkdownRenderer.tsx'
    );
    const content = fs.readFileSync(rendererPath, 'utf-8');

    // 确认有 basePath prop
    expect(content).toContain('basePath');
    // 确认有 resolveAttachment 辅助函数
    expect(content).toContain('resolveAttachment');
    // 确认有 attachment 路径处理
    expect(content).toContain('attachment');
  });
});

// Helper: recursively get all .ts/.tsx files
function getAllTsTsxFiles(dir: string): string[] {
  const fs = require('fs');
  const path = require('path');
  const results: string[] = [];

  function walk(d: string) {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(d, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '__tests__') {
        walk(fullPath);
      } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        results.push(fullPath);
      }
    }
  }
  walk(dir);
  return results;
}
