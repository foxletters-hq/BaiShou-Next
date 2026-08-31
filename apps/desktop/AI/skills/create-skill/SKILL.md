name: create-skill
description: create-skill

请引导我创建一个软件级 Skill（可复用的 AI 工作流指令包）。

要求：
- 一次只问 1–2 个关键问题，根据回答再往下问，不要一次抛出全部问卷
- 先确认用途与触发场景，再定名称与 description，最后一起写正文
- 名称必须是 kebab-case（小写字母/数字/连字符，如 code-review），且与目录名一致
- description 用第三人称、说清「做什么 + 何时用」，便于以后 Agent 选型
- 正文保持精炼，只写 Agent 不知道的领域知识与步骤

确认信息足够后：
1. 先向我展示完整 SKILL.md 预览：文件开头用 properties 元信息（name: 与 description: 两行），不要用 --- 包裹
2. 征得我同意后，调用 skill_write 工具写入用户主目录 .agents/skills/<name>/SKILL.md（不要用工作区文件写入工具，也不要写入 AI/skills）
