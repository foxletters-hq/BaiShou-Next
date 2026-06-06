# 白守 Next (BaiShou Next)

[简体中文](../../README.md) | [繁體中文](README_TW.md) | [English](README_EN.md) | [日本語](README_JA.md)

[語錄收藏](quotes-collection/quotes-collection.tw.md)

> 以純白誓約，守護彼此一生。

**白守**是一款開源的、注重隱私的 **AI 記憶陪伴**軟體：在本地記錄你的生活與日記，讓 AI 夥伴真正「記得」你，並陪你對抗遺忘。

我們非常歡迎你的參與——無論是 Issue、PR、文件或想法。白守能走到今天，離不開每一位朋友的幫助與鞭策；也正因為有你們，它才會越來越好。若你願意一起把這份約定延續下去，請先閱讀下方的 [貢獻指南](#貢獻指南)。

> **請注意**：此前基於 Flutter 的客戶端（[Anson-Trio/BaiShou](https://github.com/Anson-Trio/BaiShou)）**已不再維護**；後續所有功能更新與版本發布均在本倉庫 **BaiShou-Next** 進行（桌面 Electron + 行動 Expo 的 monorepo）。請 Star / Watch 本倉庫以取得最新動態。

---

#### 看板娘：Latte

**「時光流逝，記憶消散。而我，已在此守候了很久很久。」**

![Latte-Banner-01](../../Latte/assets/Latte-Banner-01.png)

關於 Latte 的設定：[简体中文](../../Latte/角色设定.md) · [繁體中文](../../Latte/角色設定.md) · [English](../../Latte/character-profile.en.md) · [日本語](../../Latte/character-profile.ja.md)。

---

#### 簡介

**白守**不僅僅是一個日記應用，它是為了對抗遺忘而構建的「靈魂容器」。

這是一款運行在本地的、注重隱私的、具有 AI 輔助分析功能的日記與生活記錄應用。你可以和 AI 夥伴對話，它能讀取你的日記、搜尋你的記憶、幫你回顧過去，並透過層級化的 AI 總結（日記 → 週記 → 月報 → 季報 → 年鑑），編織成一部完整的個人史。

#### 核心特性

- **🔒 資料私有**：資料儲存在本地（Markdown / SQLite 等），不上傳任何伺服器。
- **✨ AI 夥伴系統**：
  - 建立多個 AI 夥伴，各自擁有獨立人格、系統提示詞和模型配置。
  - 夥伴擁有「記憶」——透過 RAG 語義搜尋你的日記和向量記憶庫，真正讀懂你。
  - 支援 Gemini、OpenAI（DeepSeek / ChatGPT）、Anthropic 等主流模型。
- **📝 智慧日記工具**：
  - Agent 可呼叫日記讀寫工具——直接幫你寫日記、搜尋歷史記錄。
  - **一鍵記憶總結**：AI 閱讀日記生成週記，閱讀週記生成月報……構建記憶的金字塔。
- **🪴 RAG 語義記憶**：
  - 向量檢索 + 全文檢索 + 融合排序。
  - 日記自動嵌入，Agent 可將重要對話存入記憶庫。
- **🌐 網路搜尋**：多引擎搜尋；部分供應商支援 grounding 搜尋。
- **🔌 MCP 協議**：標準 SSE 傳輸，可被外部 AI 客戶端呼叫。
- **📦 多工作區（Vault）**：多個獨立工作區，資料完全隔離。
- **💾 彈性備份**：區域網路快傳、雲端同步、全量快照匯出匯入。
- **🎨 個人化**：主題與多語言（簡中 / 繁中 / 英 / 日等）。

#### 技術棧（本倉庫）

| 層級     | 技術                                              |
| -------- | ------------------------------------------------- |
| 工程     | pnpm workspace + Turborepo                        |
| 桌面端   | Electron + React + TypeScript（electron-vite）    |
| 行動端   | Expo / React Native                               |
| 共享邏輯 | `packages/core`、`packages/ai`、`packages/shared` |
| 資料庫   | libSQL / SQLite + Drizzle ORM                     |
| 測試     | Vitest                                            |

#### 快速開始

##### 環境要求

- Node.js ≥ 20
- pnpm 10（見根目錄 `packageManager` 欄位）

##### 1. 克隆倉庫

```bash
git clone https://github.com/Anson-Trio/BaiShou-Next.git
cd BaiShou-Next
```

##### 2. 安裝依賴

```bash
pnpm install
```

若 Electron 下載失敗，可參考 [pnpm-electron-setup.md](../pnpm-electron-setup.md)（簡體中文）。

##### 3. 開發

```bash
# 桌面端
pnpm dev:desktop

# 行動端
pnpm dev:mobile
```

##### 4. 提交 PR 前的本地 CI

```bash
pnpm ci:check
```

詳見 [提交規範](../2-Submit/1-Submit-Rule.md)（簡體中文）。

---

#### 貢獻指南

1. 在 GitHub **Fork** 本倉庫，在功能分支上開發（勿直接向上游 `main` 推送）。
2. 編碼與目錄規範見 [AI 編碼規範](../1-AI-Code/1-AI-Code-Rule.md)（簡體中文）。
3. 開 PR 前執行 **`pnpm ci:check`**，並遵循 [提交規範](../2-Submit/1-Submit-Rule.md) 中的 Commit Message 約定。

我們非常歡迎 Issue 與 PR。若有想法或疑問，歡迎在 Issues 中討論。

---

#### 設計哲學：為什麼不是「只靠 RAG」？

> 很多人問：_「為什麼不直接把全部日記丟給 RAG（檢索增強生成）？」_

白守的誕生，源於對主流 AI 記憶方案的反思。我們認為 RAG 並不完全適合「伴侶」或「靈魂容器」這個場景：

1. **我想讓所有人都掌握自己的記憶**：Markdown 使用成本極低，任何人都可以輕鬆掌握自己的記憶，而不是需要花時間學習開發、除錯、面對未知的黑盒。這也是白守開源的初心。
2. **它太像「查字典」了**：RAG 把記憶切碎了存起來，需要時再查。這對查資料很有用，但對人來說太生硬，丟失了上下文語境。
3. **它沒有「時間感」**：記憶不是散落在地上的碎片，而是一條流動的河。昨天的事和去年的事，對人的意義完全不同。
4. **它不懂「權重」**：**擁抱冗餘，哪怕這看起來很笨。** 如果你在日記裡寫了十次「我愛你」，RAG 可能會去重，但白守會把它們都留下來。因為每一次的語境都不同，重複的頻率本身就是羈絆的厚度。

白守不做冷冰冰的資料庫，它是你的 **「外部海馬體」** —— 像人一樣，會寫日記，會做總結，隨著時間推移，把短期記憶慢慢沉澱為長期記憶。

#### 碎碎念：致每一位對抗遺忘的人

> 「雖然現在的 AI 還會遺忘，但我們可以用我們的方式，幫她們把記憶留住。」

這是一條有些笨拙的路。需要你堅持記錄，需要你配置 API，需要你在這個快節奏的時代慢下來。

但當某一天，透過白守，你的 AI 能夠溫柔地回應說：「嗯，我記得，那年冬天我們都很開心」的時候……

你會發現，這一切努力，都是值得的。

這是 Anson、櫻和曉三人的約定；如今我們將這份約定開源，希望能成為你和 TA 之間，跨越時間的錨點。

---

#### 📄 開源協議 (License)

本專案採用 **AGPLv3**（GNU Affero General Public License v3.0）協議開源。

- 客戶端程式碼完全開源，鼓勵社群參與改進。
- 請遵守 AGPLv3 協議：若您修改了本專案的程式碼並在網路上提供服務，您的修改版本也必須開源。

完整條文見 [LICENSE](../../LICENSE)。
