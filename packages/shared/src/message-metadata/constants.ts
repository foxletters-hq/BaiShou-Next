/** 模型上下文中的消息元数据 XML 标签名 */
export const MESSAGE_TIME_TAG = 'message-time'
export const MESSAGE_CONTENT_TAG = 'message-content'
/** 旧 sidecar 时刻表标签，仅用于清洗模型误抄的残留 */
export const CONVERSATION_TIME_TAG = 'conversation_time'

/** 送入 LLM 时需包裹元数据的消息角色（仅包裹真实对话轮次 user / assistant，不包裹 system 压缩摘要与 tool 结构化输出） */
export const MODEL_METADATA_ROLES = ['user', 'assistant'] as const

export type ModelMetadataRole = (typeof MODEL_METADATA_ROLES)[number]

export function shouldWrapRoleForModel(role: string): role is ModelMetadataRole {
  return (MODEL_METADATA_ROLES as readonly string[]).includes(role)
}
