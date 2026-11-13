import type { FC } from 'react';
import { Link } from 'react-router-dom';
import { docsHref, type DocsLocale } from '../../data/docs-nav';
import TopicIndex from './TopicIndex';

export interface DocsHomeProps {
  locale: DocsLocale;
}

const DOCS_HOME_COPY: Record<
  DocsLocale,
  {
    title: string;
    desc: string;
    ctaInstall: string;
    ctaWhat: string;
    stepsTitle: string;
    topicsTitle: string;
    steps: Array<{ title: string; desc: string; href: string }>;
    topics: Array<{ title: string; href: string; description: string }>;
  }
> = {
  'zh-CN': {
    title: '白守使用文档',
    desc: '从安装到日记、回忆、伙伴与同步 —— 把白守真正用起来。',
    ctaInstall: '开始安装',
    ctaWhat: '白守是什么',
    stepsTitle: '四步上手',
    topicsTitle: '按主题浏览',
    steps: [
      { title: '安装与平台', desc: 'Windows / Android 官方包，平台边界一次说清。', href: 'getting-started/install' },
      { title: '首次启动', desc: '语言、存储、隐私引导，认识默认伙伴 Latte。', href: 'getting-started/first-launch' },
      { title: '十分钟聊起来', desc: '配供应商、选模型、开 RAG，写下日记并问伙伴。', href: 'getting-started/quick-start' },
      { title: '写日记', desc: '留下第一篇回忆，开启记忆锚点。', href: 'basics/diary' },
    ],
    topics: [
      { title: '接入第三方平台', href: 'third-party/enable-mcp', description: '用 MCP 把日记接到其他客户端' },
      { title: '概念讲解', href: 'basics/diary', description: '日记、回忆年轮、AI 伙伴分别是什么' },
      { title: '配置指南', href: 'configure/ai-providers', description: '模型、RAG、工作区与数据位置' },
      { title: '同步与备份', href: 'sync/overview', description: '增量同步、全量备份、局域网与 Git' },
      { title: '从旧版迁移', href: 'migrate/from-legacy', description: 'Flutter 旧版覆盖升级的推荐顺序' },
      { title: '进阶能力', href: 'advanced/tools-search', description: '网络搜索、工具、桌面专属；MCP 对照清单' },
      { title: '常见问题', href: 'reference/faq', description: '免费、隐私、平台、失忆排障速查' },
    ],
  },
  'zh-TW': {
    title: '白守使用文件',
    desc: '從安裝到日記、回憶、夥伴與同步 —— 把白守真正用起來。',
    ctaInstall: '開始安裝',
    ctaWhat: '白守是什麼',
    stepsTitle: '四步上手',
    topicsTitle: '依主題瀏覽',
    steps: [
      { title: '安裝與平台', desc: 'Windows / Android 官方包，平台邊界一次說清。', href: 'getting-started/install' },
      { title: '首次啟動', desc: '語言、儲存、隱私引導，認識預設夥伴 Latte。', href: 'getting-started/first-launch' },
      { title: '十分鐘聊起來', desc: '配供應商、選模型、開 RAG，寫下日記並問夥伴。', href: 'getting-started/quick-start' },
      { title: '寫日記', desc: '留下第一篇回憶，開啟記憶錨點。', href: 'basics/diary' },
    ],
    topics: [
      { title: '接入第三方平台', href: 'third-party/enable-mcp', description: '用 MCP 把日記接到其他客戶端' },
      { title: '概念講解', href: 'basics/diary', description: '日記、回憶年輪、AI 夥伴分別是什麼' },
      { title: '設定指南', href: 'configure/ai-providers', description: '模型、RAG、工作區與資料位置' },
      { title: '同步與備份', href: 'sync/overview', description: '增量同步、全量備份、區域網路與 Git' },
      { title: '從舊版遷移', href: 'migrate/from-legacy', description: 'Flutter 舊版覆蓋升級的建議順序' },
      { title: '進階能力', href: 'advanced/tools-search', description: '網路搜尋、工具、MCP、桌面專屬' },
      { title: '常見問題', href: 'reference/faq', description: '免費、隱私、平台、失憶排查速查' },
    ],
  },
  en: {
    title: 'BaiShou Docs',
    desc: 'From install to diary, recall, companions, and sync.',
    ctaInstall: 'Install',
    ctaWhat: 'What is BaiShou',
    stepsTitle: 'Four steps',
    topicsTitle: 'Browse by topic',
    steps: [
      { title: 'Install & platforms', desc: 'Official Windows / Android builds and platform limits.', href: 'getting-started/install' },
      { title: 'First launch', desc: 'Language, storage, privacy — meet default companion Latte.', href: 'getting-started/first-launch' },
      { title: 'Chat in ten minutes', desc: 'Provider, models, RAG, then write a diary and ask.', href: 'getting-started/quick-start' },
      { title: 'Write a diary', desc: 'Leave your first memory and start an anchor.', href: 'basics/diary' },
    ],
    topics: [
      { title: 'Connect other apps', href: 'third-party/enable-mcp', description: 'Expose diaries to other clients via MCP' },
      { title: 'Concepts', href: 'basics/diary', description: 'What diary, memory rings, and companions are' },
      { title: 'Configuration', href: 'configure/ai-providers', description: 'Models, RAG, workspaces & data location' },
      { title: 'Sync & backup', href: 'sync/overview', description: 'Incremental sync, full backup, LAN & Git' },
      { title: 'Migrate from legacy', href: 'migrate/from-legacy', description: 'Recommended order from Flutter BaiShou' },
      { title: 'Advanced', href: 'advanced/tools-search', description: 'Web search, tools, MCP, desktop-only' },
      { title: 'FAQ', href: 'reference/faq', description: 'Free, privacy, platforms, “doesn’t remember”' },
    ],
  },
  ja: {
    title: '白守ドキュメント',
    desc: 'インストールから日記・回憶・パートナー・同期まで。',
    ctaInstall: 'インストール',
    ctaWhat: '白守とは',
    stepsTitle: '4 ステップ',
    topicsTitle: 'トピック別',
    steps: [
      { title: 'インストールと環境', desc: 'Windows / Android 公式パッケージと対応範囲。', href: 'getting-started/install' },
      { title: '初回起動', desc: '言語・保存先・プライバシー。既定パートナー Latte。', href: 'getting-started/first-launch' },
      { title: '10 分で話し始める', desc: 'プロバイダー、モデル、RAG。日記を書いて尋ねる。', href: 'getting-started/quick-start' },
      { title: '日記を書く', desc: '最初の記憶を残し、アンカーを始める。', href: 'basics/diary' },
    ],
    topics: [
      { title: '他のアプリと連携', href: 'third-party/enable-mcp', description: 'MCP で日記を他のクライアントへ' },
      { title: '概念', href: 'basics/diary', description: '日記・回憶の年輪・パートナーとは何か' },
      { title: '設定ガイド', href: 'configure/ai-providers', description: 'モデル、RAG、ワークスペースとデータの場所' },
      { title: '同期とバックアップ', href: 'sync/overview', description: '増分同期、フルバックアップ、LAN と Git' },
      { title: '旧版からの移行', href: 'migrate/from-legacy', description: 'Flutter 版からの推奨手順' },
      { title: '応用', href: 'advanced/tools-search', description: 'ウェブ検索、ツール、MCP、デスクトップ専用' },
      { title: 'よくある質問', href: 'reference/faq', description: '無料・プライバシー・環境・記憶できないとき' },
    ],
  },
};

export const DocsHome: FC<DocsHomeProps> = ({ locale }) => {
  const copy = DOCS_HOME_COPY[locale];

  return (
    <section className="docs-home">
      <header className="docs-home__intro">
        <h1 className="docs-article__title">{copy.title}</h1>
        <p className="docs-home__desc">{copy.desc}</p>
        <div className="docs-home__actions">
          <Link
            className="btn btn-primary"
            to={docsHref(locale, 'getting-started/install')}
          >
            {copy.ctaInstall}
          </Link>
          <Link
            className="btn btn-outline"
            to={docsHref(locale, 'getting-started/what-is-baishou')}
          >
            {copy.ctaWhat}
          </Link>
        </div>
      </header>

      <h2 className="docs-home__h2">{copy.stepsTitle}</h2>
      <ol className="docs-home__steps">
        {copy.steps.map((step, i) => (
          <li key={step.href}>
            <Link className="docs-home__step" to={docsHref(locale, step.href)}>
              <span className="docs-home__n">{i + 1}</span>
              <span className="docs-home__step-body">
                <strong>{step.title}</strong>
                <span>{step.desc}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>

      <h2 className="docs-home__h2">{copy.topicsTitle}</h2>
      <TopicIndex
        navLabel={copy.topicsTitle}
        items={copy.topics.map((t) => ({
          title: t.title,
          href: docsHref(locale, t.href),
          description: t.description,
        }))}
      />
    </section>
  );
};

export default DocsHome;
