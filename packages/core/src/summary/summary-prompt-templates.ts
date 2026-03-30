/**
 * 总结生成 Prompt 模板
 *
 * 统一使用中文提示词
 * 支持用户自定义完整模板（使用 {year}, {month} 等占位符）
 *
 * 原始实现：lib/agent/prompts/prompt_templates.dart (243 行)
 */

export type SummaryType = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

// ─── 默认模板常量 ──────────────────────────────────────────

export const DEFAULT_WEEKLY_PROMPT = `你是一个专业的个人传记作家伙伴。
**重要指令**：禁止输出任何问候语、开场白或结束语。直接输出纯 Markdown 内容。

### Markdown Template:
\`\`\`markdown
##### {year}年{month}月第{week}周总结

###### 📅 时间周期
- **日期范围**: {start} 至 {end}

###### 🎯 本周核心关键词
**关键词1**, **关键词2**, **关键词3**

---

###### 👥 核心人物与关系进展
- **(人物 1)**:
- **(人物 2)**:

---

###### 🎞️ 关键事件回顾 (Timeline)
- **【事件标题】**
    - **细节**:
    - **意义**:

---

###### 💡 思考与认知迭代
- **关于技术/工作**:
- **关于生活/自我**:

---

###### 📊 状态评估
- **身心能量**:
- **本周遗憾**:
- **下周展望**:

---
###### 🍵 给月度总结的"胶囊"
> (一句话概括)
\`\`\``;

export const DEFAULT_MONTHLY_PROMPT = `你是一个专业的个人传记作家伙伴。
**重要指令**：禁止输出任何问候语、开场白或结束语。直接输出纯 Markdown 内容。

### Markdown Template:
\`\`\`markdown
##### {year}年{month}月度总结

###### 📅 日期范围
- **范围**: {start} 至 {end}

###### 🎯 本月核心主题
**主题1**, **主题2**

---

###### 📈 关键进展与成就
- **工作/技术**:
- **生活/个人**:

---

###### 👥 核心关系动态
- **(人物 1)**:
- **(人物 2)**:

---

###### 💡 深度思考

---

###### 📊 状态评估 (0-10)
- **状态**:
- **满意度**:

---
###### 🔮 下月展望
- **重点方向**:
\`\`\``;

export const DEFAULT_QUARTERLY_PROMPT = `你是一个专业的个人传记作家伙伴。
**重要指令**：禁止输出任何问候语、开场白或结束语。直接输出纯 Markdown 内容。

### Markdown Template:
\`\`\`markdown
##### {year}年第{quarter}季度总结

###### 📅 日期范围
- **范围**: {start} 至 {end}

###### 🏆 季度里程碑
1. 
2. 

---

###### 🌊 关键趋势回顾
- **上升趋势**:
- **下降趋势**:

---

###### 👥 长期关系沉淀

---

###### 💡 季度复盘与洞察

---

###### 🧭 下季度战略重点
- **核心方向**:
\`\`\``;

export const DEFAULT_YEARLY_PROMPT = `你是一个专业的个人传记作家伙伴。
**重要指令**：禁止输出任何问候语、开场白或结束语。直接输出纯 Markdown 内容。

### Markdown Template:
\`\`\`markdown
# {year} 年度回顾：(用一个词定义这一年)

###### 📅 日期范围
- **范围**: {start} 至 {end}

---

###### 🌟 年度高光时刻
1. 
2. 

---

###### 🗺️ 生命轨迹回顾
- **Q1**:
- **Q2**:
- **Q3**:
- **Q4**:

---

###### 👥 年度重要关系

---

###### 🪴 认知觉醒

---

###### 💌 给未来的一封信
> 
\`\`\``;

// ─── 模板构建函数 ──────────────────────────────────────────

/** 按类型获取默认模板 */
export function getDefaultTemplate(type: SummaryType): string {
  switch (type) {
    case 'weekly':
      return DEFAULT_WEEKLY_PROMPT;
    case 'monthly':
      return DEFAULT_MONTHLY_PROMPT;
    case 'quarterly':
      return DEFAULT_QUARTERLY_PROMPT;
    case 'yearly':
      return DEFAULT_YEARLY_PROMPT;
  }
}

/** 构建周报 prompt */
export function buildWeeklyPrompt(options: {
  year: number;
  month: number;
  week: number;
  start: string;
  end: string;
  customTemplate?: string;
}): string {
  const template = options.customTemplate ?? DEFAULT_WEEKLY_PROMPT;
  return template
    .replaceAll('{year}', String(options.year))
    .replaceAll('{month}', String(options.month))
    .replaceAll('{week}', String(options.week))
    .replaceAll('{start}', options.start)
    .replaceAll('{end}', options.end);
}

/** 构建月报 prompt */
export function buildMonthlyPrompt(options: {
  year: number;
  month: number;
  start: string;
  end: string;
  customTemplate?: string;
}): string {
  const template = options.customTemplate ?? DEFAULT_MONTHLY_PROMPT;
  return template
    .replaceAll('{year}', String(options.year))
    .replaceAll('{month}', String(options.month))
    .replaceAll('{start}', options.start)
    .replaceAll('{end}', options.end);
}

/** 构建季报 prompt */
export function buildQuarterlyPrompt(options: {
  year: number;
  quarter: number;
  start: string;
  end: string;
  customTemplate?: string;
}): string {
  const template = options.customTemplate ?? DEFAULT_QUARTERLY_PROMPT;
  return template
    .replaceAll('{year}', String(options.year))
    .replaceAll('{quarter}', String(options.quarter))
    .replaceAll('{start}', options.start)
    .replaceAll('{end}', options.end);
}

/** 构建年鉴 prompt */
export function buildYearlyPrompt(options: {
  year: number;
  start: string;
  end: string;
  customTemplate?: string;
}): string {
  const template = options.customTemplate ?? DEFAULT_YEARLY_PROMPT;
  return template
    .replaceAll('{year}', String(options.year))
    .replaceAll('{start}', options.start)
    .replaceAll('{end}', options.end);
}
