import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './OnboardingScreen.module.css';

// ─── Pages Config ───────────────────────────────────────────────────────────

const ONBOARDING_PAGES = [
  {
    id: 'welcome',
    icon: '✨',
    title: '欢迎来到 BaiShou Next',
    subtitle: '基于先进的大语言模型，结合本地优先架构，为您打造极速、隐私的 AI 协同伴侣。',
  },
  {
    id: 'features',
    icon: '🧠',
    title: '多 Agent 生态系统',
    subtitle: '不仅是聊天。你可以创建专属数字分身，组建 AI 团队，自动生成周期总结并关联长时记忆。',
  },
  {
    id: 'privacy',
    icon: '🔒',
    title: '数据资产，尽在掌握',
    subtitle: '您的所有对话、日记与向量记忆数据默认存储在本地，真正保障隐私与自主权。',
  },
  {
    id: 'setup',
    icon: '⚙️',
    title: '最后一步，准备点火',
    subtitle: '配置您的核心 AI 提供商以激活应用。您随时可以在设置中修改或添加更多模型。',
    isSetup: true,
  },
];

export const OnboardingScreen: React.FC = () => {
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
                      <label className={styles.inputLabel}>模型提供商</label>
                      <select 
                        className={styles.inputField} 
                        value={provider} 
                        onChange={(e) => setProvider(e.target.value)}
                      >
                        <option value="openai">OpenAI (推荐)</option>
                        <option value="anthropic">Anthropic Claude</option>
                        <option value="gemini">Google Gemini</option>
                        <option value="ollama">Ollama (本地部署)</option>
                        <option value="deepseek">DeepSeek</option>
                      </select>
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={styles.inputLabel}>API Key {provider === 'ollama' ? '(留空)' : ''}</label>
                      <input 
                        type="password" 
                        placeholder={provider === 'ollama' ? '不需要 Key' : '输入您的秘钥 sk-...'} 
                        className={styles.inputField}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        disabled={provider === 'ollama'}
                      />
                    </div>
                    
                    <div className={styles.inputGroup}>
                      <label className={styles.inputLabel}>Base URL (可选)</label>
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
                跳过
              </button>
            )}
            
            <button 
              className={`${styles.btn} ${isLastPage ? styles.btnPrimary : styles.btnNext}`}
              onClick={handleNext}
              disabled={isLastPage && provider !== 'ollama' && !apiKey.trim()}
            >
              {isLastPage ? '开始旅程 ✨' : '下一步'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
