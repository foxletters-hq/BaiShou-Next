/** 模型上下文中的消息元数据 XML 标签名 */
export const MESSAGE_TIME_TAG = 'message-time'
export const MESSAGE_CONTENT_TAG = 'message-content'

/** 送入 LLM 时需包裹元数据的消息角色 */
export const MODEL_METADATA_ROLES = ['user', 'assistant', 'system', 'tool'] as const

export type ModelMetadataRole = (typeof MODEL_METADATA_ROLES)[number]

export function shouldWrapRoleForModel(role: string): role is ModelMetadataRole {
  return (MODEL_METADATA_ROLES as readonly string[]).includes(role)
}
