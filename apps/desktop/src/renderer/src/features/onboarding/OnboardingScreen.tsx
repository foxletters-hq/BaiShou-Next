import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen, Layers, FolderOpen, ShieldCheck, ChevronRight, ChevronLeft, ArrowRight } from 'lucide-react';
import { CompressionChart } from './CompressionChart';
import icon from '../../../../../resources/icon.png?asset';
import styles from './OnboardingScreen.module.css';

export const OnboardingScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [isFinishing, setIsFinishing] = useState(false);

  useEffect(() => {
    // 监听引导完成准备就绪信号
    const cleanup = (window as any).api.onboarding.onReady(() => {
       navigate('/');
    });

    // 初始获取默认路径
    (window as any).api.onboarding.check().then((res: any) => {
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
      component: <CompressionChart />,
      color: '#64B5F6'
    },
    {
      id: 'storage',
      icon: <FolderOpen size={48} />,
      title: t('onboarding.storage_title', '数据属于你自己'),
      desc: t('onboarding.storage_desc', '请选择一个存放您灵魂备份的地方。后续所有数据都将只留存在此文件夹。'),
      isStorage: true,
      color: '#FFB74D'
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
    const path = await (window as any).api.onboarding.pickDirectory();
    if (path) {
      setSelectedPath(path);
      await (window as any).api.onboarding.setDirectory(path);
    }
  };

  const handleFinish = async () => {
    setIsFinishing(true);
    try {
      await (window as any).api.onboarding.finish();
    } catch (e) {
      console.error('Finish onboarding failed', e);
      setIsFinishing(false);
    }
  };

  const currentPage = ONBOARDING_PAGES[currentIndex];

  return (
    <div className={styles.screen} style={{ '--theme-color': currentPage.color } as any}>
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
              <div className={styles.iconWrapper}>
                {page.icon}
              </div>
              <h1 className={styles.title}>{page.title}</h1>
              <p className={styles.subtitle}>{page.desc}</p>

              {page.component && (
                <div className={styles.componentWrapper}>
                  {page.component}
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

              {page.isLast && (
                <div className={styles.slogan}>
                   「纯白誓约，守护一生」
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
