/**
 * @deprecated 请从 `@baishou/shared` 的 message-metadata 模块导入。
 * 此文件保留 re-export，避免破坏现有 import 路径。
 */
export {
  MESSAGE_TIME_TAG,
  MESSAGE_CONTENT_TAG,
  MODEL_METADATA_ROLES,
  shouldWrapRoleForModel,
  buildMessageTimeLine,
  wrapMessageContentBlock,
  wrapMessageBodyForModel,
  prefixTextWithMessageTimestamp,
  sanitizeAssistantGeneratedText,
  stripLeakedMessageTimeFromAssistantText,
  injectModelMetadata,
  injectModelMetadataIntoAssistantParts,
  injectModelMetadataIntoToolResults
} from '../message-metadata'

export type { ModelMetadataRole, ModelMetadataContent } from '../message-metadata'
