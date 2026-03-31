import { eq } from 'drizzle-orm';
import { systemSettingsTable } from '../schema/system-settings';
import type { 
  AIProviderConfig, GlobalModelsConfig, AgentBehaviorConfig, RagConfig, 
  WebSearchConfig, SummaryConfig, ToolManagementConfig, McpServerConfig 
} from '@baishou/shared';
import {
  DEFAULT_AI_PROVIDERS, DEFAULT_GLOBAL_MODELS, DEFAULT_AGENT_BEHAVIOR, 
  DEFAULT_RAG_CONFIG, DEFAULT_WEB_SEARCH_CONFIG, DEFAULT_SUMMARY_CONFIG, 
  DEFAULT_TOOL_MANAGEMENT_CONFIG, DEFAULT_MCP_SERVER_CONFIG
} from './settings.defaults';

export class SettingsRepository {
  constructor(private readonly db: any) {}

  /**
   * 获取指定键的配置，并反序列化为模型 T。若不存在则返回 null。
   */
  async get<T>(key: string): Promise<T | null> {
    const result = await this.db
      .select({ value: systemSettingsTable.value })
      .from(systemSettingsTable)
      .where(eq(systemSettingsTable.key, key))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    try {
      return JSON.parse(result[0].value) as T;
    } catch (e) {
      console.error(`[SettingsRepository] Failed to parse JSON for key: ${key}`, e);
      return null;
    }
  }

  /**
   * 将任意数据模型序列化为 JSON 字符串，并保存至数据库。支持插入和更新 (Upsert)。
   */
  async set<T>(key: string, value: T): Promise<void> {
    const jsonStr = JSON.stringify(value);
    
    await this.db.insert(systemSettingsTable)
      .values({
        key,
        value: jsonStr,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: systemSettingsTable.key,
        set: {
          value: jsonStr,
          updatedAt: new Date()
        }
      });
  }

  /**
   * 删除指定的配置键。
   */
  async delete(key: string): Promise<void> {
    await this.db.delete(systemSettingsTable)
      .where(eq(systemSettingsTable.key, key));
  }

  // --- 领域配置获取与保存 (Domain Configs) ---

  async getAIProviderConfigs(): Promise<AIProviderConfig[]> {
     return (await this.get<AIProviderConfig[]>('ai_providers')) ?? DEFAULT_AI_PROVIDERS;
  }
  async setAIProviderConfigs(config: AIProviderConfig[]): Promise<void> {
     await this.set('ai_providers', config);
  }

  async getGlobalModelsConfig(): Promise<GlobalModelsConfig> {
     return (await this.get<GlobalModelsConfig>('global_models')) ?? DEFAULT_GLOBAL_MODELS;
  }
  async setGlobalModelsConfig(config: GlobalModelsConfig): Promise<void> {
     await this.set('global_models', config);
  }

  async getAgentBehaviorConfig(): Promise<AgentBehaviorConfig> {
     return (await this.get<AgentBehaviorConfig>('agent_behavior')) ?? DEFAULT_AGENT_BEHAVIOR;
  }
  async setAgentBehaviorConfig(config: AgentBehaviorConfig): Promise<void> {
     await this.set('agent_behavior', config);
  }

  async getRagConfig(): Promise<RagConfig> {
     return (await this.get<RagConfig>('rag_config')) ?? DEFAULT_RAG_CONFIG;
  }
  async setRagConfig(config: RagConfig): Promise<void> {
     await this.set('rag_config', config);
  }

  async getWebSearchConfig(): Promise<WebSearchConfig> {
     return (await this.get<WebSearchConfig>('web_search_config')) ?? DEFAULT_WEB_SEARCH_CONFIG;
  }
  async setWebSearchConfig(config: WebSearchConfig): Promise<void> {
     await this.set('web_search_config', config);
  }

  async getSummaryConfig(): Promise<SummaryConfig> {
     return (await this.get<SummaryConfig>('summary_config')) ?? DEFAULT_SUMMARY_CONFIG;
  }
  async setSummaryConfig(config: SummaryConfig): Promise<void> {
     await this.set('summary_config', config);
  }

  async getToolManagementConfig(): Promise<ToolManagementConfig> {
     return (await this.get<ToolManagementConfig>('tool_management_config')) ?? DEFAULT_TOOL_MANAGEMENT_CONFIG;
  }
  async setToolManagementConfig(config: ToolManagementConfig): Promise<void> {
     await this.set('tool_management_config', config);
  }

  async getMcpServerConfig(): Promise<McpServerConfig> {
     return (await this.get<McpServerConfig>('mcp_server_config')) ?? DEFAULT_MCP_SERVER_CONFIG;
  }
  async setMcpServerConfig(config: McpServerConfig): Promise<void> {
     await this.set('mcp_server_config', config);
  }
}
