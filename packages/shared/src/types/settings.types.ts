export interface AIProviderConfig {
  id: string;
  name: string;
  isEnabled: boolean;
  apiKey: string;
  baseUrl: string;
  customModels: string[];
}

export interface ProviderModelMap {
  [providerId: string]: string[];
}

export interface GlobalModelsConfig {
  defaultProviderId: string;
  defaultModelId: string;
  reasoningProviderId: string;
  reasoningModelId: string;
}

export interface FeatureSettingsConfig {
  ragEnabled: boolean;
  ragSimilarityThreshold: number;
  searchMaxResults: number;
  searchIncludeDiary: boolean;
  summaryAutoGenerate: boolean;
  devModeEnabled: boolean;
}

export interface DevicePreferences {
  nickname?: string;
  identity_facts?: string[];
  theme_mode?: number;
  seed_color?: number;
  ai_providers_list?: any[];
  global_dialogue_provider_id?: string;
  global_dialogue_model_id?: string;
  global_naming_provider_id?: string;
  global_naming_model_id?: string;
  global_summary_provider_id?: string;
  global_summary_model_id?: string;
  global_embedding_provider_id?: string;
  global_embedding_model_id?: string;
  global_embedding_dimension?: number;
  ai_provider?: string;
  ai_model?: string;
  ai_naming_model?: string;
  api_key?: string;
  base_url?: string;
  monthly_summary_source?: string;
  agent_context_window_size?: number;
  companion_compress_tokens?: number;
  companion_truncate_tokens?: number;
  agent_persona?: string;
  agent_guidelines?: string;
  summary_prompt_instructions?: string;
  all_summary_instructions?: any;
  all_tool_configs?: any;
  disabled_tool_ids?: string[];
  rag_global_enabled?: boolean;
  rag_top_k?: number;
  rag_similarity_threshold?: number;
  web_search_engine?: string;
  web_search_max_results?: number;
  web_search_rag_enabled?: boolean;
  tavily_api_key?: string;
  web_search_rag_max_chunks?: number;
  web_search_rag_chunks_per_source?: number;
  web_search_plain_snippet_length?: number;
  sync_target?: number;
  webdav_url?: string;
  webdav_username?: string;
  webdav_password?: string;
  webdav_path?: string;
  s3_endpoint?: string;
  s3_access_key?: string;
  s3_secret_key?: string;
  s3_bucket?: string;
  s3_region?: string;
  s3_path?: string;
  mcp_server_enabled?: boolean;
  mcp_server_port?: number;
}

