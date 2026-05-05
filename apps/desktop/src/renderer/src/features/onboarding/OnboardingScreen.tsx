import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen, Layers, FolderOpen, ShieldCheck, ChevronRight, ChevronLeft, ArrowRight, Cpu, Import } from 'lucide-react';
import icon from '../../../../../resources/icon.png?asset';
import { CompressionChart } from './CompressionChart';
import styles from './OnboardingScreen.module.css';

export const OnboardingScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [isFinishing, setIsFinishing] = useState(false);

  useEffect(() => {
    // 监听引导完成准备就绪信号
    const cleanup = window.api.onboarding.onReady(() => {
       navigate('/');
    });

    // 初始获取默认路径
    window.api.onboarding.check().then((res) => {
       setSelectedPath(res.currentPath);
    });

    return () => cleanup();
  }, [navigate]);

  const ONBOARDING_PAGES = [
    {
      id: 'welcome',
      icon: <img src={icon} alt="BaiShou" className={styles.appLogo} />,
      title: t('onboarding.welcome_title', '欢迎来到白守'),
      desc: t('onboarding.welcome_desc', '结合大语言模型与本地优先原则，为您打造安全、私密的第二大脑。'),
      color: '#9AD4EA'
    },
    {
      id: 'philosophy',
      icon: <BookOpen size={48} />,
      title: t('onboarding.philosophy_title', '灵魂备份，记忆压缩'),
      desc: t('onboarding.philosophy_desc', '我们相信文字不仅是信息的载体，更是灵魂的切片。通过智能压缩，让跨越时空的对话成为可能。'),
      color: '#7EC8E3'
    },
    {
      id: 'compression',
      icon: <Layers size={48} />,
      title: t('onboarding.compression_title', '感性与理性的交织'),
      desc: t('onboarding.compression_desc', '独创的 AI 压缩算法，将繁杂的日记提炼为纯净的记忆向量。'),
      hasChart: true,
      color: '#64B5F6'
    },
    {
      id: 'ai-config',
      icon: <Cpu size={48} />,
      title: t('onboarding.ai_config_title', '配置 AI 服务'),
      desc: t('onboarding.ai_config_desc', '白守支持多种 AI 服务提供商。请在设置中配置您的 API Key，以启用 AI 伙伴功能。'),
      isAiConfig: true,
      color: '#BA68C8'
    },
    {
      id: 'storage',
      title: t('onboarding.storage_title', '数据属于你自己'),
      desc: t('onboarding.storage_desc', '请选择一个存放您灵魂备份的地方。后续所有数据都将只留存在此文件夹。'),
      isStorage: true,
      color: '#FFB74D'
    },
    {
      id: 'import',
      icon: <Import size={48} />,
      title: t('onboarding.import_title', '导入数据'),
      desc: t('onboarding.import_desc', '如果您有之前的备份数据，可以在完成引导后通过设置中的"数据管理"功能导入。'),
      isImport: true,
      color: '#4DB6AC'
    },
    {
      id: 'privacy',
      icon: <ShieldCheck size={48} />,
      title: t('onboarding.privacy_title', '纯白誓约，锁定隐私'),
      desc: t('onboarding.privacy_desc', '您的隐私像白纸般纯洁。我们承诺不上传、不归档您的任何私密思想。'),
      isLast: true,
      color: '#81C784'
    }
  ];

  const handleNext = () => {
    if (currentIndex < ONBOARDING_PAGES.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handlePickDirectory = async () => {
    const path = await window.api.onboarding.pickDirectory();
    if (path) {
      const separator = path.includes('\\') ? '\\' : '/';
      const dirSuffix = 'baishou-data';
      const finalPath = path.endsWith(separator) ? `${path}${dirSuffix}` : `${path}${separator}${dirSuffix}`;
      setSelectedPath(finalPath);
      await window.api.onboarding.setDirectory(finalPath);
    }
  };

  const handleFinish = async () => {
    setIsFinishing(true);
    try {
      await window.api.onboarding.finish();
    } catch (e) {
      console.error('完成引导失败', e);
      setIsFinishing(false);
    }
  };

  const currentPage = ONBOARDING_PAGES[currentIndex];

  return (
    <div className={styles.screen} style={{ '--theme-color': currentPage.color } as React.CSSProperties}>
      {/* Background Orbs */}
      <div className={styles.bgOrb1} />
      <div className={styles.bgOrb2} />

      <div className={styles.contentBox}>
        <div className={styles.slideContainer}>
          {ONBOARDING_PAGES.map((page, index) => (
            <div
              key={page.id}
              className={`${styles.page} ${index === currentIndex ? styles.active : ''} ${index < currentIndex ? styles.prev : ''}`}
            >
              {page.icon && (
                <div className={styles.iconWrapper}>
                  {page.icon}
                </div>
              )}
              <h1 className={styles.title}>{page.title}</h1>
              <p className={styles.subtitle}>{page.desc}</p>

              {page.hasChart && (
                <div style={{ width: '100%', maxWidth: 400, height: 140, marginTop: 16 }}>
                  <CompressionChart />
                </div>
              )}

              {page.isAiConfig && (
                <div className={styles.storageBox}>
                   <div className={styles.pathLabel}>{t('onboarding.ai_config_hint', '提示')}</div>
                   <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                     {t('onboarding.ai_config_steps', '完成引导后，请前往：设置 → AI 服务配置，添加您的 API Key。支持 OpenAI、Claude、Gemini 等多种服务。')}
                   </div>
                </div>
              )}

              {page.isStorage && (
                <div className={styles.storageBox}>
                   <div className={styles.pathLabel}>{t('onboarding.current_storage', '当前存储位置')}</div>
                   <div className={styles.pathText}>{selectedPath}</div>
                   <button className={styles.pickBtn} onClick={handlePickDirectory}>
                      <FolderOpen size={16} />
                      {t('onboarding.change_storage', '更改存储路径')}
                   </button>
                </div>
              )}

              {page.isImport && (
                <div className={styles.storageBox}>
                   <div className={styles.pathLabel}>{t('onboarding.import_hint', '提示')}</div>
                   <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                     {t('onboarding.import_steps', '完成引导后，请前往：设置 → 数据管理 → 导入备份，选择您的 ZIP 备份文件即可恢复数据。')}
                   </div>
                </div>
              )}

               {page.isLast && (
                <div className={styles.slogan}>
                   {t('onboarding.slogan', '「纯白誓约，守护一生」')}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className={styles.footer}>
          <div className={styles.indicators}>
            {ONBOARDING_PAGES.map((_, i) => (
              <div 
                key={i} 
                className={`${styles.dot} ${i === currentIndex ? styles.dotActive : ''}`}
                onClick={() => setCurrentIndex(i)}
              />
            ))}
          </div>

          <div className={styles.btnGroup}>
            {currentIndex > 0 && (
              <button className={styles.btnBack} onClick={handleBack}>
                <ChevronLeft size={16} />
                {t('common.back', '返回')}
              </button>
            )}

            {currentPage.isLast ? (
              <button className={styles.btnPrimary} onClick={handleFinish} disabled={isFinishing}>
                {isFinishing ? t('common.loading', '完成中...') : t('onboarding.get_started', '开始旅程')}
                {!isFinishing && <ArrowRight size={18} />}
              </button>
            ) : (
              <button className={styles.btnNext} onClick={handleNext}>
                {t('common.next', '下一步')}
                <ChevronRight size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
