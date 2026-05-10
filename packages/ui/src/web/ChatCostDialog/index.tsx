import React, { useEffect, useState, useCallback } from 'react';
import styles from './ChatCostDialog.module.css';
import { useTranslation } from 'react-i18next';

export interface CostDetails {
  modelName?: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens?: number;
  estimatedCost: string; 
  lastInputTokens?: number;
}

export interface ChatCostDialogProps {
  details: CostDetails;
  onClose: () => void;
  isOpen: boolean;
  pricingLastUpdated?: Date | null;
  onRefreshPricing?: () => Promise<{ success: boolean; error?: string }>;
}

export const ChatCostDialog: React.FC<ChatCostDialogProps> = ({ 
  details, 
  onClose, 
  isOpen, 
  pricingLastUpdated,
  onRefreshPricing 
}) => {
  const { t } = useTranslation();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  // Close on Escape 
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const handleRefresh = useCallback(async () => {
    if (!onRefreshPricing || isRefreshing) return;
    setIsRefreshing(true);
    setRefreshError(null);
    try {
      const result = await onRefreshPricing();
      if (!result.success && result.error) {
        setRefreshError(result.error);
      }
    } catch (e: any) {
      setRefreshError(e?.message || t('agent.chat.pricing_refresh_failed', '刷新失败'));
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefreshPricing, isRefreshing, t]);

  const formatLastUpdated = useCallback((date: Date | null | undefined): string => {
    if (!date) return t('agent.chat.pricing_unknown', '未知');
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffMinutes < 1) return t('agent.chat.pricing_just_now', '刚刚');
    if (diffMinutes < 60) return t('agent.chat.pricing_minutes_ago', `${diffMinutes} 分钟前`, { count: diffMinutes });
    if (diffHours < 24) return t('agent.chat.pricing_hours_ago', `${diffHours} 小时前`, { count: diffHours });
    
    return date.toLocaleString();
  }, [t]);

  if (!isOpen) return null;

  return (
    <>
       <div className={styles.overlay} onClick={onClose} />
       <div className={styles.dialog} onClick={e => e.stopPropagation()}>
          <h2 className={styles.title}>{t('agent.chat.cost_detail_title', '当前计费')}</h2>
          
          <div className={styles.content}>
             <h3 className={styles.sectionTitle}>{t('agent.chat.cost_cumulative_title', '累计 API 消耗')}</h3>
             <div className={styles.spacer8} />
             <div className={styles.costRow}>
                <span className={styles.costLabel}>{t('agent.chat.cost_cumulative_total', '累计费用')}</span>
                <span className={styles.costValue}>{details.estimatedCost}</span>
             </div>
             <div className={styles.costRow}>
                <span className={styles.costLabel}>{t('agent.chat.cost_cumulative_input', '累计输入')}</span>
                <span className={styles.costValue}>{details.promptTokens} {t('agent.chat.tokens_unit', 'tokens')}</span>
             </div>
             <div className={styles.costRow}>
                <span className={styles.costLabel}>{t('agent.chat.cost_cumulative_output', '累计输出')}</span>
                <span className={styles.costValue}>{details.completionTokens} {t('agent.chat.tokens_unit', 'tokens')}</span>
             </div>
             
             <div className={styles.divider} />
             
             <h3 className={styles.sectionTitle}>{t('agent.chat.cost_context_title', '当前上下文')}</h3>
             <div className={styles.spacer8} />
             <div className={styles.costRow}>
                <span className={styles.costLabel}>{t('agent.chat.cost_context_size', '上下文大小')}</span>
                <span className={styles.costValue}>
                  {(details.lastInputTokens || details.promptTokens) > 0 
                    ? `${details.lastInputTokens || details.promptTokens} ${t('agent.chat.tokens_unit', 'tokens')}` 
                    : t('agent.chat.cost_no_data', '暂无数据')}
                </span>
             </div>

             <div className={styles.divider} />
             
             <h3 className={styles.sectionTitle}>{t('agent.chat.pricing_table_title', '价格表信息')}</h3>
             <div className={styles.spacer8} />
             <div className={styles.costRow}>
                <span className={styles.costLabel}>{t('agent.chat.pricing_last_updated', '最后更新')}</span>
                <span className={styles.costValue}>{formatLastUpdated(pricingLastUpdated)}</span>
             </div>
             {onRefreshPricing && (
               <div className={styles.spacer8} />
             )}
             {onRefreshPricing && (
               <div className={styles.costRow}>
                 <span className={styles.costLabel}></span>
                 <button 
                   className={styles.refreshButton} 
                   onClick={handleRefresh}
                   disabled={isRefreshing}
                 >
                   {isRefreshing 
                     ? t('agent.chat.pricing_refreshing', '刷新中...') 
                     : t('agent.chat.pricing_refresh', '刷新价格表')}
                 </button>
               </div>
             )}
             {refreshError && (
               <div className={styles.errorMessage}>
                 {refreshError}
               </div>
             )}
             
             <div className={styles.spacer16} />
             
             <p className={styles.disclaimer}>
               {t('agent.chat.cost_disclaimer', '提示：此费用计算数据来自本地 pricing 规则 (或 models.dev)，存在更新不及时或计费方式不同的情况，仅供参考。')}
             </p>
          </div>

          <div className={styles.actions}>
             <button className={styles.textButton} onClick={onClose}>
               {t('common.confirm', '确认')}
             </button>
          </div>
       </div>
    </>
  );
};
