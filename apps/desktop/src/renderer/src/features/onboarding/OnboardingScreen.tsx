import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './OnboardingScreen.module.css';
import { useTranslation } from 'react-i18next';


// ─── Pages Config ───────────────────────────────────────────────────────────



export const OnboardingScreen: React.FC = () => {
  const { t } = useTranslation();
  const ONBOARDING_PAGES = [
  {
    id: 'welcome',
    icon: '✨',
    title: t('onboarding.welcome', '欢迎来到 BaiShou Next'),
    subtitle: t('onboarding.welcome_desc', '结合大语言模型与本地优先原则，打造极速、安全、无限制的隐私AI伴侣。'),
  },
  {
    id: 'features',
    icon: '🧠',
    title: t('onboarding.agent_title', 'Agent 生态架构'),
    subtitle: t('onboarding.agent_desc', '包含全链路智能交互、自动数据流总结和记忆RAG连接。'),
  },
  {
    id: 'privacy',
    icon: '🔒',
    title: t('onboarding.privacy_title', '数据属于你自己'),
    subtitle: t('onboarding.privacy_desc', '所有聊天与日志资料只保留在终端硬盘，完全脱开云端服务商审查绑定，隐私获得铁桶防护。'),
  },
  {
    id: 'setup',
    icon: '⚙️',
    title: t('onboarding.final_title', '配置 AI 动力源'),
    subtitle: t('onboarding.final_desc', '请为工作站配置提供底层回复能力的核心厂商。之后您可进一步在设置更改。'),
    isSetup: true,
  },
];
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);

  // Setup Form State
  const [provider, setProvider] = useState('openai');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');

  const isLastPage = currentIndex === ONBOARDING_PAGES.length - 1;

  const handleNext = () => {
  if (isLastPage) {
      handleComplete();
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handleSkip = () => {
  handleComplete();
  };

  const handleComplete = () => {
  // In real app: save provider, apiKey, baseUrl to Zustand and mark onboarding as complete
    navigate('/');
  };

  return (
    <div className={styles.screen}>
      {/* Animated Background */}
      <div className={styles.bgCircle1} />
      <div className={styles.bgCircle2} />

      <div className={styles.contentBox}>
        <div className={styles.pageContainer}>
          {ONBOARDING_PAGES.map((page, index) => {


            const isActive = index === currentIndex;
            const isPrevious = index < currentIndex;
            
            let className = styles.page;
            if (isActive) className += ` ${styles.active}`;
            if (isPrevious) className += ` ${styles.previous}`;

            return (
              <div key={page.id} className={className}>
                <div className={styles.heroIcon}>{page.icon}</div>
                <h1 className={styles.title}>{page.title}</h1>
                <p className={styles.subtitle}>{page.subtitle}</p>

                {page.isSetup && (
                  <div className={styles.setupForm}>
                    <div className={styles.inputGroup}>
                      <label className={styles.inputLabel}>{t('onboarding.provider', '模型提供商')}</label>
                      <select 
                        className={styles.inputField} 
                        value={provider} 
                        onChange={(e) => setProvider(e.target.value)}
                      >
                        <option value="openai">{t('onboarding.openai', 'OpenAI 或兼容通用口')}</option>
                        <option value="anthropic">Anthropic Claude</option>
                        <option value="gemini">Google Gemini</option>
                        <option value="ollama">{t('onboarding.ollama', 'Ollama (本地离线推理)')}</option>
                        <option value="deepseek">DeepSeek</option>
                      </select>
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={styles.inputLabel}>{t('common.api_key', 'API Key')} {provider === 'ollama' ? t('onboarding.leave_blank', '(本地方案可留空)') : ''}</label>
                      <input 
                        type="password" 
                        placeholder={provider === 'ollama' ? t('onboarding.no_key', '无须输入 Key') : t('onboarding.enter_key', '输入服务商分发的 sk-... 密钥格式')} 
                        className={styles.inputField}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        disabled={provider === 'ollama'}
                      />
                    </div>
                    
                    <div className={styles.inputGroup}>
                      <label className={styles.inputLabel}>{t('common.base_url', '基础 URL (Base URL, 可选)')}</label>
                      <input 
                        type="text" 
                        placeholder="https://api.openai.com/v1" 
                        className={styles.inputField}
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Navigation Controls */}
        <div className={styles.controls}>
          <div className={styles.indicators}>
            {ONBOARDING_PAGES.map((_, index) => (
               <div 
                 key={index} 
                 className={`${styles.dot} ${index === currentIndex ? styles.active : ''}`}
                 onClick={() => setCurrentIndex(index)}
                 style={{ cursor: 'pointer' }}
               />
            ))}
          </div>

          <div className={styles.btnGroup}>
            {!isLastPage && (
              <button className={`${styles.btn} ${styles.btnSkip}`} onClick={handleSkip}>
                {t('common.skip', '跳过配置')}
              </button>
            )}
            
            <button 
              className={`${styles.btn} ${isLastPage ? styles.btnPrimary : styles.btnNext}`}
              onClick={handleNext}
              disabled={isLastPage && provider !== 'ollama' && !apiKey.trim()}
            >
              {isLastPage ? t('onboarding.finish', '初始化启动 ✨') : t('onboarding.next', '下一步')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
