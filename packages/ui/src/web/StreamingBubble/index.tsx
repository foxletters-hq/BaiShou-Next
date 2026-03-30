import React from 'react';
import styles from './StreamingBubble.module.css';
import { MarkdownRenderer } from '../MarkdownRenderer';

// TODO: [Agent1-Dependency] i18n
const useTranslation = (): { t: (key: string, options?: any) => string } => ({
  t: (key: string) => {
    if (key === 'agent.chat.ai_label') return 'AI';
    if (key === 'agent.tools.tool_call') return '工具调用';
    return key;
  },
});

export interface ToolExecution {
  name: string;
  durationMs: number;
}

export interface StreamingBubbleProps {
  text: string;
  activeToolName?: string | null;
  completedTools?: ToolExecution[];
  aiProfile?: { name: string; avatarPath?: string | null; emoji?: string | null };
}

export const StreamingBubble: React.FC<StreamingBubbleProps> = ({
  text,
  activeToolName = null,
  completedTools = [],
  aiProfile = { name: 'AI' }
}) => {
  const { t } = useTranslation();
  const hasTools = completedTools.length > 0 || !!activeToolName;
  const aiName = aiProfile.name || t('agent.chat.ai_label');

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
    <div className={styles.container}>
      <Avatar />
      <div className={styles.messageCol}>
         <div className={styles.nameLabel}>{aiName}</div>
         
         {hasTools && (
           <ToolExecutionGroup 
              completedTools={completedTools} 
              activeToolName={activeToolName} 
           />
         )}
         
         {text.length > 0 && (
           <div className={styles.bubbleCard}>
              <MarkdownRenderer content={text} />
           </div>
         )}
         
         {text.length === 0 && !hasTools && (
           <div className={styles.dotsWrap}>
              <BouncingDotsIndicator />
           </div>
         )}
      </div>
    </div>
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
          <div className={styles.toolIcon}>🔧</div>
          <span className={styles.toolTitle}>{t('agent.tools.tool_call')}</span>
          <div className={styles.toolCountBadge}>
             {completedTools.length}/{totalTools}
          </div>
       </div>
       
       <div className={styles.toolList}>
          {completedTools.map((tool, idx) => (
            <div key={idx} className={styles.toolItem}>
               <span className={styles.checkIcon}>✅</span>
               <span className={styles.toolItemName}>{tool.name}</span>
               <span className={styles.toolItemDuration}>
                  {tool.durationMs < 1000 ? `${tool.durationMs}ms` : `${(tool.durationMs/1000).toFixed(1)}s`}
               </span>
            </div>
          ))}
          
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
