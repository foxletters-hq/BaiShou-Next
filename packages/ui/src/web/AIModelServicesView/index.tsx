import React, { useState } from 'react';
import styles from './AIModelServicesView.module.css';
import { useTranslation } from 'react-i18next';


export interface AIProviderConfig {
  providerId: string;
  enabled: boolean;
  apiKey: string;
  apiBaseUrl?: string;
  models?: string[];
  enabledModels?: string[];
}

export interface AIModelServicesViewProps {
  providers: Record<string, AIProviderConfig>;
  onUpdateProvider: (providerId: string, updates: Partial<AIProviderConfig>) => void;
  onTestConnection?: (providerId: string, apiKey: string, baseUrl?: string) => Promise<void>;
  onFetchModels?: (providerId: string, apiKey: string, baseUrl?: string) => Promise<string[]>;
}

// 核心自带云脑，可追加后续通过新增按钮自定义的类型
const BASE_KNOWN_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', icon: '🧠', defaultBase: 'https://api.openai.com/v1' },
  { id: 'anthropic', name: 'Anthropic (Claude)', icon: '🔮', defaultBase: 'https://api.anthropic.com' },
  { id: 'google', name: 'Google (Gemini)', icon: '🌌', defaultBase: 'https://generativelanguage.googleapis.com' },
  { id: 'ollama', name: 'Ollama (Local)', icon: '🦙', defaultBase: 'http://localhost:11434/v1' },
  { id: 'deepseek', name: 'DeepSeek (深度求索)', icon: '🐋', defaultBase: 'https://api.deepseek.com' },
  { id: 'kimi', name: 'Moonshot (Kimi)', icon: '🌙', defaultBase: 'https://api.moonshot.cn/v1' },
  { id: 'qwen', name: 'Qwen (阿里通义)', icon: '☁️', defaultBase: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { id: 'zhipu', name: 'ZhipuAI (智谱清言)', icon: '🧩', defaultBase: 'https://open.bigmodel.cn/api/paas/v4' },
  { id: 'xunfei', name: 'Xunfei (星火)', icon: '✨', defaultBase: 'https://spark-api-open.xf-yun.com/v1' },
];

export const AIModelServicesView: React.FC<AIModelServicesViewProps> = ({
  const { t } = useTranslation(); 
  providers, 
  onUpdateProvider, 
  onTestConnection, 
  onFetchModels 
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingTest, setLoadingTest] = useState<Record<string, boolean>>({});
  const [loadingFetch, setLoadingFetch] = useState<Record<string, boolean>>({});

  // 合并已知的和用户自行录入的 Providers
  const displayIds = new Set<string>();
  BASE_KNOWN_PROVIDERS.forEach(p => displayIds.add(p.id));
  Object.keys(providers).forEach(pid => displayIds.add(pid));

  const ALL_LIST = Array.from(displayIds).map(id => {
    const base = BASE_KNOWN_PROVIDERS.find(b => b.id === id);
    if (base) return base;
    return { id, name: id.toUpperCase(), icon: '🌐', defaultBase: '' }; // Fallback for custom added
  });

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const handleTest = async (id: string, config: AIProviderConfig) => {
    if (!onTestConnection) return;
    if (!config.apiKey) {
      alert('请先填写 API Key (鉴权口令) 后再测试连通性！');
      return;
    }
    setLoadingTest(prev => ({ ...prev, [id]: true }));
    try {
      await onTestConnection(id, config.apiKey, config.apiBaseUrl);
      alert('✅ 测通成功！该节点返回的信号良好。');
    } catch (e: any) {
      alert(`❌ 测通失败: ${e.message}`);
    } finally {
      setLoadingTest(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleFetch = async (id: string, config: AIProviderConfig) => {
    if (!onFetchModels) return;
    if (!config.apiKey) {
      alert('请先填写 API Key，以获取您的账户有权访问的流式图表。');
      return;
    }
    setLoadingFetch(prev => ({ ...prev, [id]: true }));
    try {
      const RemoteModels = await onFetchModels(id, config.apiKey, config.apiBaseUrl);
      // 默认全选拉取到的模型，或与早期的 enabledModels 进行对冲合并
      const oldEnabled = new Set(config.enabledModels || []);
      const newEnabled = RemoteModels.filter(rm => oldEnabled.size === 0 || oldEnabled.has(rm));
      
      onUpdateProvider(id, { 
        models: RemoteModels, 
        enabledModels: newEnabled.length > 0 ? newEnabled : RemoteModels 
      });
      alert(`🎉 成功拉取 ${RemoteModels.length} 个模型！`);
    } catch (e: any) {
      alert(`⚠️ 无法获取可用模型组: ${e.message}`);
    } finally {
      setLoadingFetch(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleToggleModel = (providerId: string, modelId: string, isChecked: boolean, config: AIProviderConfig) => {
    const activeList = [...(config.enabledModels || [])];
    if (isChecked) {
      if (!activeList.includes(modelId)) activeList.push(modelId);
    } else {
      const idx = activeList.indexOf(modelId);
      if (idx !== -1) activeList.splice(idx, 1);
    }
    onUpdateProvider(providerId, { enabledModels: activeList });
  };

  const handleCreateCustom = () => {
    const rawInput = window.prompt("请输入自定义供应商标识（例如: proxy_openai）：\n*将创建一个新的空白接口点卡片以供使用。");
    if (rawInput && rawInput.trim() !== '') {
       const pid = rawInput.trim().toLowerCase();
       if (!providers[pid]) {
          onUpdateProvider(pid, { enabled: true, apiKey: '' });
          setExpandedId(pid);
       } else {
          alert('该提供商标签已存在于云脑池中。');
       }
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleInfo}>
          <h3 className={styles.title}>{t('services.title', '大模型服务集成配置')}</h3>
          <p className={styles.subtitle}>{t('services.subtitle', '管控所有云端与局域网供应商 API。仅展示您已启用的服务商。')}</p>
        </div>
        <button className={styles.addCustomBtn} onClick={handleCreateCustom}>
          ➕ {t('services.add_custom', '新增自定义供应源')}
        </button>
      </div>

      <div className={styles.list}>
        {ALL_LIST.map((kp) => {
          const config = providers[kp.id] || { providerId: kp.id, enabled: false, apiKey: '', apiBaseUrl: '' };
          const isExpanded = expandedId === kp.id;
          const isTesting = loadingTest[kp.id] || false;
          const isFetching = loadingFetch[kp.id] || false;

          return (
            <div key={kp.id} className={`${styles.providerCard} ${isExpanded ? styles.expanded : ''} ${!config.enabled ? styles.disabled : ''}`}>
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
                  <div className={styles.collapseBtn}>
                    {isExpanded ? '▲' : '▼'}
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className={styles.cardBody}>
                   <div className={styles.configsGrid}>
                      <div className={styles.inputGroup}>
                        <label>🔑 {t('services.api_key', 'API Key 授权秘钥')}</label>
                        <input 
                          className={styles.textField}
                          type="password"
                          placeholder="sk-..."
                          value={config.apiKey}
                          onChange={(e) => onUpdateProvider(kp.id, { apiKey: e.target.value })}
                        />
                      </div>
                      <div className={styles.inputGroup}>
                        <label>🌐 {t('services.base_url', '自定义请求地址 (Base URL)')}</label>
                        <input 
                          className={styles.textField}
                          type="text"
                          placeholder={kp.defaultBase}
                          value={config.apiBaseUrl || ''}
                          onChange={(e) => onUpdateProvider(kp.id, { apiBaseUrl: e.target.value })}
                        />
                      </div>
                   </div>

                   {/* Connection Tools */}
                   <div className={styles.toolsRow}>
                      <button 
                        className={styles.toolBtnPrimary} 
                        onClick={() => handleTest(kp.id, config)}
                        disabled={isTesting}
                      >
                        {isTesting ? t('services.testing', '⏳ 测速中...') : t('services.test_conn', '⚡ 测试连接')}
                      </button>
                      <button 
                        className={styles.toolBtnSecondary} 
                        onClick={() => handleFetch(kp.id, config)}
                        disabled={isFetching}
                      >
                        {isFetching ? t('services.fetching', '⏳ 读取中...') : t('services.fetch_models', '📡 获取模型列表')}
                      </button>
                   </div>

                   {/* Model List Checkbox Area */}
                   {config.models && config.models.length > 0 && (
                     <div className={styles.modelsContainer}>
                        <div className={styles.modelsLabel}>
                           {t('services.select_models', '勾选您将在对话界面显示的模型组合：')}
                        </div>
                        <div className={styles.modelsGrid}>
                           {config.models.map(mdl => {
                             const isChecked = (config.enabledModels || []).includes(mdl);
                             return (
                               <label key={mdl} className={styles.modelCheckboxItem}>
                                 <input 
                                   type="checkbox" 
                                   checked={isChecked}
                                   onChange={e => handleToggleModel(kp.id, mdl, e.target.checked, config)}
                                 />
                                 <span>{mdl}</span>
                               </label>
                             );
                           })}
                        </div>
                     </div>
                   )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
