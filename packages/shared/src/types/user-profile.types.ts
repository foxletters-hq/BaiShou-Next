/**
 * 个人资料主模型
 */
export interface UserProfile {
  nickname: string // 昵称
  avatarPath: string | null // 头像文件绝对或相对路径
  avatarFileMissing?: boolean // 头像文件不存在标记（运行时检测，不持久化）
  chatBackgroundPath?: string | null // 聊天背景图相对路径（如 backgrounds/xxx.jpg）
  activePersonaId: string // 当前激活的身份卡 ID
  personas: Record<string, Persona> // 所有身份卡字典（键为 personaId）
  recentPersonaIds?: string[] // 最近使用的身份卡 ID 列表（用于快速切换）
}

/**
 * 独立身份卡与对应的事实集
 */
export interface Persona {
  id: string // 身份卡 ID
  facts: Record<string, string> // 具体事实映射记录，例如：{'职业': '程序员', '爱好': '打游戏'}
}
