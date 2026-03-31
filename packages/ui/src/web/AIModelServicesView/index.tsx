import React, { useState } from 'react';
import styles from './AIModelServicesView.module.css';

export interface AIProviderConfig {
  providerId: string;
  enabled: boolean;
  apiKey: string;
  apiBaseUrl?: string;
}

export interface AIModelServicesViewProps {
  providers: Record<string, AIProviderConfig>;
  onUpdateProvider: (providerId: string, updates: Partial<AIProviderConfig>) => void;
}

// 供界面展示使用的主要云脑预设名单（包含原有的 13 个主流平台意向）
const KNOWN_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', icon: '🧠', defaultBase: 'https://api.openai.com/v1' },
  { id: 'anthropic', name: 'Anthropic (Claude)', icon: '🔮', defaultBase: 'https://api.anthropic.com' },
  { id: 'google', name: 'Google (Gemini)', icon: '🌌', defaultBase: 'https://generativelanguage.googleapis.com' },
  { id: 'ollama', name: 'Ollama (Local)', icon: '🦙', defaultBase: 'http://localhost:11434/v1' },
  { id: 'deepseek', name: 'DeepSeek (深度求索)', icon: '🐋', defaultBase: 'https://api.deepseek.com' },
  { id: 'kimi', name: 'Moonshot (Kimi)', icon: '🌙', defaultBase: 'https://api.moonshot.cn/v1' },
  { id: 'qwen', name: 'Qwen (阿里通义)', icon: '☁️', defaultBase: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { id: 'zhipu', name: 'ZhipuAI (智谱清言)', icon: '🧩', defaultBase: 'https://open.bigmodel.cn/api/paas/v4' },
  { id: 'xunfei', name: 'Xunfei (星火)', icon: '✨', defaultBase: 'https://spark-api-open.xf-yun.com/v1' },
  { id: 'minimax', name: 'MiniMax (海螺)', icon: '🐚', defaultBase: 'https://api.minimax.chat/v1' },
  { id: 'stepfun', name: 'StepFun (阶跃星辰)', icon: '💫', defaultBase: 'https://api.stepfun.com/v1' },
  { id: 'yi', name: '01.AI (零一万物)', icon: '🔢', defaultBase: 'https://api.lingyiwanwu.com/v1' },
  { id: 'groq', name: 'Groq (极速 LPU)', icon: '⚡', defaultBase: 'https://api.groq.com/openai/v1' },
];

export const AIModelServicesView: React.FC<AIModelServicesViewProps> = ({ providers, onUpdateProvider }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    if (expandedId === id) setExpandedId(null);
    else setExpandedId(id);
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.headerTitle}>大模型服务集成端</h3>
      <p className={styles.headerSubtitle}>启用的服务商才会出现在对话模型池中。您的 API Key 此刻已受跨进程加密托管。</p>

      <div className={styles.list}>
        {KNOWN_PROVIDERS.map((kp) => {
          const config = providers[kp.id] || { providerId: kp.id, enabled: false, apiKey: '', apiBaseUrl: '' };
          const isExpanded = expandedId === kp.id;

          return (
            <div key={kp.id} className={`${styles.providerCard} ${isExpanded ? styles.expanded : ''}`}>
              <div className={styles.cardHeader} onClick={() => toggleExpand(kp.id)}>
                <div className={styles.brandRow}>
                  <div className={styles.brandIcon}>{kp.icon}</div>
                  <div className={styles.brandName}>{kp.name}</div>
                </div>
                
                <div className={styles.actionsRow} onClick={(e) => e.stopPropagation()}>
                  <label className={styles.switch}>
                    <input 
                      type="checkbox" 
                      checked={config.enabled}
                      onChange={(e) => onUpdateProvider(kp.id, { enabled: e.target.checked })}
                    />
                    <span className={styles.slider}></span>
                  </label>
                  <button className={styles.collapseBtn}>
                    {isExpanded ? '▲' : '▼'}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className={styles.cardBody}>
                   <div className={styles.inputGroup}>
                     <label>API Key 鉴权口令</label>
                     <input 
                       className={styles.textField}
                       type="password"
                       placeholder="sk-..."
                       value={config.apiKey}
                       onChange={(e) => onUpdateProvider(kp.id, { apiKey: e.target.value })}
                     />
                   </div>
                   <div className={styles.inputGroup}>
                     <label>自定义反向代理节点 (Base URL)</label>
                     <input 
                       className={styles.textField}
                       type="text"
                       placeholder={kp.defaultBase}
                       value={config.apiBaseUrl || ''}
                       onChange={(e) => onUpdateProvider(kp.id, { apiBaseUrl: e.target.value })}
                     />
                   </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
