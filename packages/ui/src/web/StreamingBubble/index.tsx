import { useTranslation } from 'react-i18next';
import React from 'react';
import styles from './StreamingBubble.module.css';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { ThinkingBlock } from '../ThinkingBlock';
import { motion } from 'framer-motion';

export interface ToolExecution {
  name: string;
  durationMs: number;
}

export interface StreamingBubbleProps {
  text: string;
  reasoning?: string;
  isReasoning?: boolean;
  activeToolName?: string | null;
  completedTools?: ToolExecution[];
  aiProfile?: { name: string; avatarPath?: string | null; emoji?: string | null };
  error?: string | null;
  onRetry?: () => void;
  onStop?: () => void;
}

export const StreamingBubble: React.FC<StreamingBubbleProps> = ({
  text,
  reasoning = '',
  isReasoning = false,
  activeToolName = null,
  completedTools = [],
  aiProfile = { name: 'AI' },
  error = null,
  onRetry,
  onStop
}) => {
  const { t } = useTranslation();
  const hasTools = completedTools.length > 0 || !!activeToolName;
  const aiName = aiProfile.name || t('agent.chat.ai_label');
  const hasReasoning = reasoning.length > 0;
  const hasText = text.length > 0;

  const Avatar = () => (
     <div className={styles.avatarWrap}>
        {aiProfile.avatarPath ? (
           <img src={aiProfile.avatarPath} alt="avatar" className={styles.avatarImg}/>
        ) : aiProfile.emoji ? (
           <div className={styles.avatarFallback}>{aiProfile.emoji}</div>
        ) : (
           <div className={styles.avatarFallback}>✨</div>
        )}
     </div>
  );

  return (
    <motion.div 
      className={styles.container}
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
    >
      <Avatar />
      <div className={styles.messageCol}>
         <div className={styles.nameLabel}>{aiName}</div>
         
         {error ? (
           <div className={styles.errorBox}>
              <span className={styles.errorText}>⚠ {error}</span>
              {onRetry && (
                <button className={styles.retryBtn} onClick={onRetry}>
                  {t('common.retry', '重试')}
                </button>
              )}
           </div>
         ) : (
           <>
             {hasText || hasReasoning || hasTools ? (
               <div className={styles.bubbleCard}>
                 {/* 工具调用 */}
                 {hasTools && (
                   <ToolExecutionGroup 
                      completedTools={completedTools} 
                      activeToolName={activeToolName} 
                   />
                 )}

                 {/* Reasoning 块 */}
                 {hasReasoning && (
                   <ThinkingBlock
                     content={reasoning}
                     isThinking={isReasoning && !hasText}
                     autoCollapse={true}
                   />
                 )}

                 {/* 正文内容 */}
                 {hasText && <MarkdownRenderer content={text} isStreaming={true} />}
               </div>
             ) : (
               <div className={styles.dotsWrap}>
                  <BouncingDotsIndicator />
               </div>
             )}
             
             {onStop && (
               <div className={styles.stopBtnWrap}>
                  <button className={styles.stopBtn} onClick={onStop}>
                    🛑 {t('common.stop_generate', '停止生成')}
                  </button>
               </div>
             )}
           </>
         )}
      </div>
    </motion.div>
  );
};

const ToolExecutionGroup: React.FC<{
  completedTools: ToolExecution[];
  activeToolName?: string | null;
}> = ({ completedTools, activeToolName }) => {
  const { t } = useTranslation();
  const totalTools = completedTools.length + (activeToolName ? 1 : 0);
  
  return (
    <div className={styles.toolGroupCard}>
       <div className={styles.toolHeader}>
          <div className={styles.toolIcon}>🎧</div>
          <span className={styles.toolTitle}>{t('agent.tools.tool_call')}</span>
          <div className={styles.toolCountBadge}>
             {completedTools.length}/{totalTools}
          </div>
       </div>
       
       <div className={styles.toolList}>
          {completedTools.map((tool, idx) => {
  const durationText = tool.durationMs < 1000 
                ? `${tool.durationMs}ms` 
                : `${(tool.durationMs / 1000).toFixed(1)}s`;
             return (
              <div key={idx} className={styles.toolItem}>
                 <span className={styles.checkIcon}>✅</span>
                 <span className={styles.toolItemName}>{tool.name}</span>
                 <span className={styles.toolItemDuration}>{durationText}</span>
              </div>
            );
          })}
          
          {activeToolName && (
             <div className={`${styles.toolItem} ${styles.pulsing}`}>
                <div className={styles.spinner}></div>
                <span className={styles.activeToolName}>{activeToolName} ...</span>
             </div>
          )}
       </div>
    </div>
  );
};

const BouncingDotsIndicator: React.FC = () => {
  return (
    <div className={styles.bouncingDots}>
      <div className={styles.dot}></div>
      <div className={styles.dot}></div>
      <div className={styles.dot}></div>
    </div>
  );
};
