import type { Locale } from '../i18n';

export type DocsLocale = Locale;

export interface DocsNavItem {
  slug: string;
  label: Record<DocsLocale, string>;
}

export interface DocsNavGroup {
  id: string;
  label: Record<DocsLocale, string>;
  items: DocsNavItem[];
}

const L = (
  zhCN: string,
  zhTW: string,
  en: string,
  ja: string,
): Record<DocsLocale, string> => ({
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  en,
  ja,
});

/** slug 相对路径，不含 locale / docs 前缀，例如 getting-started/install */
export const DOCS_SIDEBAR: DocsNavGroup[] = [
  {
    id: 'getting-started',
    label: L('入门', '入門', 'Getting started', 'はじめに'),
    items: [
      {
        slug: 'getting-started/what-is-baishou',
        label: L('白守是什么', '白守是什麼', 'What is BaiShou', '白守とは'),
      },
      {
        slug: 'getting-started/install',
        label: L('安装与平台', '安裝與平台', 'Install & platforms', 'インストールと対応環境'),
      },
      {
        slug: 'getting-started/first-launch',
        label: L('首次启动', '首次啟動', 'First launch', '初回起動'),
      },
      {
        slug: 'getting-started/quick-start',
        label: L('十分钟聊起来', '十分鐘聊起來', 'Chat in ten minutes', '10 分で話し始める'),
      },
    ],
  },
  {
    id: 'third-party',
    label: L('接入第三方平台', '接入第三方平台', 'Connect other apps', '他のアプリと連携'),
    items: [
      {
        slug: 'third-party/enable-mcp',
        label: L('开启 MCP', '開啟 MCP', 'Turn on MCP', 'MCP をオンにする'),
      },
      {
        slug: 'third-party/cursor',
        label: L('Cursor', 'Cursor', 'Cursor', 'Cursor'),
      },
      {
        slug: 'third-party/chatgpt',
        label: L('ChatGPT', 'ChatGPT', 'ChatGPT', 'ChatGPT'),
      },
      {
        slug: 'third-party/cherry-studio',
        label: L('Cherry Studio', 'Cherry Studio', 'Cherry Studio', 'Cherry Studio'),
      },
      {
        slug: 'third-party/workbuddy',
        label: L('WorkBuddy', 'WorkBuddy', 'WorkBuddy', 'WorkBuddy'),
      },
    ],
  },
  {
    id: 'basics',
    label: L('概念讲解', '概念講解', 'Concepts', '概念'),
    items: [
      {
        slug: 'basics/diary',
        label: L('写日记', '寫日記', 'Write diary', '日記を書く'),
      },
      {
        slug: 'basics/memories',
        label: L('回忆与共同回忆', '回憶與共同回憶', 'Memories & shared recall', '回憶と共同回憶'),
      },
      {
        slug: 'basics/companions',
        label: L('AI 伙伴与对话', 'AI 夥伴與對話', 'AI companions & chat', 'AI パートナーと会話'),
      },
      {
        slug: 'basics/latte',
        label: L('看板娘 Latte', '看板娘 Latte', 'Mascot Latte', '看板娘 Latte'),
      },
    ],
  },
  {
    id: 'configure',
    label: L('配置指南', '設定指南', 'Configuration', '設定ガイド'),
    items: [
      {
        slug: 'configure/ai-providers',
        label: L(
          '配置 AI 供应商与模型',
          '設定 AI 供應商與模型',
          'AI providers & models',
          'AI プロバイダーとモデル',
        ),
      },
      {
        slug: 'configure/rag',
        label: L('RAG 记忆管理', 'RAG 記憶管理', 'RAG memory', 'RAG 記憶管理'),
      },
      {
        slug: 'configure/workspace',
        label: L(
          '工作区与数据位置',
          '工作區與資料位置',
          'Workspaces & data location',
          'ワークスペースとデータの場所',
        ),
      },
    ],
  },
  {
    id: 'sync',
    label: L('同步与备份', '同步與備份', 'Sync & backup', '同期とバックアップ'),
    items: [
      {
        slug: 'sync/overview',
        label: L('三种方式怎么选', '三種方式怎麼選', 'Which method to use', 'どれを使うべきか'),
      },
      {
        slug: 'sync/incremental',
        label: L('增量同步', '增量同步', 'Incremental sync', '増分同期'),
      },
      {
        slug: 'sync/backup',
        label: L('备份与恢复', '備份與還原', 'Backup & restore', 'バックアップと復元'),
      },
    ],
  },
  {
    id: 'migrate',
    label: L('迁移', '遷移', 'Migration', '移行'),
    items: [
      {
        slug: 'migrate/from-legacy',
        label: L(
          '从旧版白守迁移',
          '從舊版白守遷移',
          'Migrate from legacy BaiShou',
          '旧版白守からの移行',
        ),
      },
    ],
  },
  {
    id: 'advanced',
    label: L('进阶', '進階', 'Advanced', '応用'),
    items: [
      {
        slug: 'advanced/tools-search',
        label: L('网络搜索与工具', '網路搜尋與工具', 'Web search & tools', 'ウェブ検索とツール'),
      },
      {
        slug: 'advanced/mcp',
        label: L('MCP 服务', 'MCP 服務', 'MCP server', 'MCP サーバー'),
      },
      {
        slug: 'advanced/desktop',
        label: L('桌面端专属', '桌面端專屬', 'Desktop-only features', 'デスクトップ専用機能'),
      },
    ],
  },
  {
    id: 'reference',
    label: L('参考', '參考', 'Reference', 'リファレンス'),
    items: [
      {
        slug: 'reference/privacy',
        label: L('隐私与开源', '隱私與開源', 'Privacy & open source', 'プライバシーとオープンソース'),
      },
      {
        slug: 'reference/platforms',
        label: L('桌面与移动差异', '桌面與行動差異', 'Desktop vs mobile', 'デスクトップとモバイルの違い'),
      },
      {
        slug: 'reference/faq',
        label: L('常见问题', '常見問題', 'FAQ', 'よくある質問'),
      },
    ],
  },
];
