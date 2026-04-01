import React, { useState } from 'react';
import styles from './ToolResultGroupCard.module.css';
import { MockToolInvocation } from '@baishou/shared/src/mock/agent.mock';
import { useTranslation } from 'react-i18next';
import { Wrench, ChevronDown, CheckCircle2, XCircle, BrainCircuit, Book, Globe, Clock, MessageCircle } from 'lucide-react';

export interface ToolResultGroupProps {
  invocations: MockToolInvocation[];
}

export const ToolResultGroup: React.FC<ToolResultGroupProps> = ({ invocations }) => {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();

  if (!invocations || invocations.length === 0) return null;

  // Derive domain from the first available invocation
  let primaryTheme = styles.themeWrench;
  let MasterIcon = Wrench;

  const sampleTool = invocations[0]?.toolName?.toLowerCase() || '';
  if (sampleTool.includes('diary')) {
    primaryTheme = styles.themeBook;
    MasterIcon = Book;
  } else if (sampleTool.includes('memory') || sampleTool.includes('vector')) {
    primaryTheme = styles.themeBrain;
    MasterIcon = BrainCircuit;
  } else if (sampleTool.includes('web') || sampleTool.includes('url')) {
    primaryTheme = styles.themeGlobe;
    MasterIcon = Globe;
  } else if (sampleTool.includes('message') || sampleTool.includes('summary')) {
    primaryTheme = styles.themeGlobe;
    MasterIcon = MessageCircle;
  } else if (sampleTool.includes('time')) {
    primaryTheme = styles.themeWrench;
    MasterIcon = Clock;
  }

  return (
    <div className={styles.groupContainer}>
       <div className={`${styles.groupCard} ${primaryTheme}`}>
          <div 
            className={styles.headerRow} 
            onClick={() => setExpanded(!expanded)}
          >
             <div className={styles.iconBox}>
                <MasterIcon size={16} strokeWidth={2.5} />
             </div>
             
             <div className={styles.titleArea}>
                <span className={styles.titleText}>
                   {t('agent.tools.tool_call_results', { count: invocations.length })}
                </span>
                <span className={styles.countBadge}>{invocations.length}</span>
             </div>
             
             <div className={`${styles.expandBtn} ${expanded ? styles.expandBtnRotated : ''}`}>
                <ChevronDown size={14} />
             </div>
          </div>
          
          {expanded && (
             <div className={styles.childrenArea}>
                {invocations.map((inv, index) => <ToolResultItem key={inv.toolCallId || index} invocation={inv} themeClass={primaryTheme} />)}
             </div>
          )}
       </div>
    </div>
  );
};

const ToolResultItem: React.FC<{ invocation: MockToolInvocation, themeClass: string }> = ({ invocation, themeClass }) => {
  const [expanded, setExpanded] = useState(false);
  
  const getToolName = () => {
    if (invocation.toolName) return invocation.toolName;
    const callId = invocation.toolCallId;
    if (!callId) return 'tool_invocation';
    return callId;
  };
  
  const resultObj = typeof invocation.result === 'string' ? { content: invocation.result } : (invocation.result || { content: '' });
  const rawContent = typeof invocation.result === 'string' ? invocation.result : JSON.stringify(resultObj);
  const isError = rawContent.startsWith('Error') || rawContent.startsWith('Tool execution failed:') || rawContent.toLowerCase().includes('failed');
  
  const toolName = getToolName();

  // Try to parse JSON for structured rendering
  let parsedJson: any = null;
  if (typeof invocation.result === 'object' && invocation.result !== null) {
      parsedJson = invocation.result;
  } else {
      try {
        parsedJson = JSON.parse(rawContent);
      } catch (e) {
        // Expected for plain text callbacks
      }
  }

  const renderStructuredData = (data: any) => {
    if (Array.isArray(data)) {
      return (
         <div className={styles.structDataGrid}>
           {data.map((item, i) => (
              <div key={i} className={styles.structItem}>
                 {item.title && <div className={styles.structTitle}>{item.title}</div>}
                 {item.url && <a href={item.url} target="_blank" rel="noreferrer" className={styles.structLink}>{item.url}</a>}
                 {item.snippet && <div className={styles.structSnippet}>{item.snippet}</div>}
                 {item.summary && <div className={styles.structSnippet}>{item.summary}</div>}
                 
                 {/* For generic flat objects */}
                 {(!item.title && !item.snippet && typeof item === 'object') && Object.keys(item).map(k => (
                    <div className={styles.structValueRow} key={k}>
                       <span className={styles.structKey}>{k}</span>
                       <span className={styles.structVal}>{String(item[k])}</span>
                    </div>
                 ))}
              </div>
           ))}
         </div>
      );
    } else if (typeof data === 'object' && data !== null) {
      return (
         <div className={styles.structDataGrid}>
           {data.title && <div className={styles.structTitle}>{data.title}</div>}
           {data.snippet && <div className={styles.structSnippet}>{data.snippet}</div>}
           <div className={styles.structItem}>
              {Object.keys(data).filter(k => k !== 'title' && k !== 'snippet').map(k => (
                 <div className={styles.structValueRow} key={k}>
                    <span className={styles.structKey}>{k}</span>
                    <span className={styles.structVal}>{String(data[k])}</span>
                 </div>
              ))}
           </div>
         </div>
      );
    }
    // Fallback if structured but unknown shape
    return <pre className={styles.resultTextLog}>{JSON.stringify(data, null, 2)}</pre>;
  };

  return (
    <div className={`${styles.itemCard} ${themeClass} ${isError ? styles.itemError : ''}`}>
       <div 
         className={styles.itemHeader} 
         onClick={() => setExpanded(!expanded)}
       >
          <span className={styles.itemStatusWrap}>
             {isError ? <XCircle size={14} color="rgba(244, 67, 54, 1)" /> : <CheckCircle2 size={14} />}
          </span>
          <span className={styles.itemName}>{toolName}</span>
       </div>
       
       <div className={`${styles.itemBodyCollapsible} ${expanded ? styles.itemBodyExpanded : ''}`}>
          <div className={styles.contentWrapper}>
             {parsedJson && !isError ? (
               renderStructuredData(parsedJson)
             ) : (
               <pre className={`${styles.resultTextLog} ${isError ? styles.errorText : ''}`}>{rawContent}</pre>
             )}
          </div>
       </div>
    </div>
  );
};
