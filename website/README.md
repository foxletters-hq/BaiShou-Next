# BaiShou 官网 (@baishou/website)

白守（BaiShou-Next）产品官方网站与多语言文档中心，基于 **Vite + React 18 + React Router + TypeScript** 构建，支持构建期静态预渲染（SSG）；使用文档与官网共用同一套 Layout / Header，自研侧栏 + 正文布局。

- 线上地址：https://foxletters.com
- 使用文档：https://foxletters.com/docs/
- 主项目：https://github.com/foxletters-hq/BaiShou-Next

## 本地开发

在 `website/` 目录下执行（已通过 `website/pnpm-workspace.yaml` 与根 monorepo 依赖隔离）：

```bash
cd website
pnpm install --frozen-lockfile
pnpm run dev
```

- 官网首页：http://localhost:4321/
- 文档（简中）：http://localhost:4321/docs/
- 文档（English）：http://localhost:4321/en/docs/
- 文档（繁中）：http://localhost:4321/zh-tw/docs/
- 文档（日本語）：http://localhost:4321/ja/docs/

## 文档内容

文档源文件在 `src/content/docs/`：

| 语言 | 路径前缀 | 内容目录 |
|------|----------|----------|
| 简体中文（默认） | `/docs/` | `src/content/docs/docs/` |
| English | `/en/docs/` | `src/content/docs/en/docs/` |
| 繁體中文 | `/zh-tw/docs/` | `src/content/docs/zh-tw/docs/` |
| 日本語 | `/ja/docs/` | `src/content/docs/ja/docs/` |

同一相对路径与文件名用于关联多语言页面。侧边栏与文案在 `src/data/docs-nav.ts` 中维护；路由见 `src/App.tsx` 与 `src/pages/DocsRoutePage.tsx`。

## 代码规范

提交前请执行 `pnpm run check` 与 `pnpm run lint`，规范由 [eslint.config.js](./eslint.config.js) 与 [scripts/check-max-lines.mjs](./scripts/check-max-lines.mjs) 共同保证：

| 规范 | 要求 | 检查方式 |
|------|------|----------|
| 单文件行数 | `.ts` / `.tsx` / `.js` / `.mjs` 与 `.css` 均不超过 **300 行**（不含空行与注释），超过即拆分 | ESLint `max-lines` + `pnpm run check:lines` |
| 单函数行数 | 不超过 120 行（警告） | ESLint `max-lines-per-function` |
| 基础质量 | 禁用 `var`、`==`、未使用变量、空 `catch` 块、`any` | ESLint + typescript-eslint |
| 格式 | UTF-8、LF、2 空格缩进 | [.editorconfig](./.editorconfig) |

目录约定：

- `src/styles/modules/`：官网样式，按区块拆分，由 `src/styles/global.css` 统一 `@import`；
- `src/styles/docs/`：文档页样式，由 `src/styles/docs.css` 统一引入；
- `src/components/`：React 组件，按职责拆分；
- `src/scripts/`：WebGL 雨滴与 Lenis 滚动控制器；
- `src/data/`：站点与文档导航数据，体量大时按主题拆文件；
- 新增文案须同步 `zh-CN`、`zh-TW`、`en`、`ja` 四个语言文件及 `src/i18n/types.ts`。

常用命令：

```bash
pnpm run check     # 行数检查 + TypeScript 类型检查
pnpm run lint      # ESLint + 行数检查
pnpm run lint:fix  # 自动修复可修复项
pnpm test          # 运行回归测试
pnpm run build     # 生成文档清单 + 客户端构建 + SSG 静态预渲染
```

## 构建与预渲染

```bash
pnpm run build
pnpm run preview
```

## 部署

对外主站是 `https://foxletters.com`（1Panel VPS + EdgeOne 全球加速），页面里的 canonical、sitemap、`robots.txt` 均以此为准。

更新上线只需在 VPS 上执行 [deploy/update-vps-mirror.sh](./deploy/update-vps-mirror.sh) 拉取最新代码、构建并同步到 1Panel（见 [deploy/README.md](./deploy/README.md)）。

## 贡献

向本仓库提交**包含代码变更**的 Pull Request 前，须签署 [foxletters-hq 组织级个人贡献者协议（CLA v1.1）](../legal/CLA-organization.md)：

- 可直接访问 **[CLA Assistant 签署页面](https://cla-assistant.io/foxletters-hq/BaiShou-Next)** 登录 GitHub 一键签署；
- 若你已向组织内其他仓库签署过，无需重复签署；纯文档纠错 PR 通常免签。
- 详见 [../.github/CLA.md](../.github/CLA.md)。

## 开源许可证与版权

- **官网源代码（`website/` 目录）**：在 [MIT License](./LICENSE) 下发布（独立于主仓库客户端与核心代码的 `AGPL-3.0-or-later` 许可，见 [../LICENSE](../LICENSE)）；
- **美术资产与商标**：白守官方应用图标、Logo、主题背景图、角色头像及立绘美术资源保留所有权利（All Rights Reserved），不属于 MIT 许可范围；商标权归项目托管方所有。详见 [COPYRIGHT](./COPYRIGHT) 与 [../legal/LICENSE-ASSETS.md](../legal/LICENSE-ASSETS.md)。

## 贡献者

参见仓库 [Contributors](https://github.com/foxletters-hq/BaiShou-Next/graphs/contributors) 页面。
