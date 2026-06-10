/** 新建日记时的默认正文模板（{time} 为 HH:mm:ss，{date} 为 yyyy-MM-dd） */
export const DEFAULT_DIARY_NEW_ENTRY_TEMPLATE = '##### {time}\n\n\u200B'

/** 追加记录时插入的时间块模板 */
export const DEFAULT_DIARY_APPEND_BLOCK_TEMPLATE = '\n\n##### {time}\n\n\u200B'

/** 伙伴使用写日记 / 编辑日记工具时的默认书写规范 */
export const DEFAULT_DIARY_AI_WRITING_PROMPT = `书写日记时请遵守以下格式：
1. 每条新记录必须以 Markdown 五级标题（#####）作为时间戳行。
2. 时间格式必须为 HH:mm:ss（24 小时制，含秒），例如：##### 14:30:05
3. 时间标题后空一行再写正文。
4. 标签请通过工具的 tags 参数传递，不要只写在正文中。`
