/**
 * 个人资料主模型
 */
export interface UserProfile {
  nickname: string;                   // 昵称
  avatarPath: string | null;          // 头像文件绝对或相对路径
  activePersonaId: string;            // 当前激活的身份卡 ID
  personas: Record<string, Persona>;  // 所有身份卡字典（键为 personaId）
}

/**
 * 独立身份卡与对应的事实集
 */
export interface Persona {
  id: string;                         // 身份卡 ID
  facts: Record<string, string>;      // 具体事实映射记录，例如：{'职业': '程序员', '爱好': '打游戏'}
}
