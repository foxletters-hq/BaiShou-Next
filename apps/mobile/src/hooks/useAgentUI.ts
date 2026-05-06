import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useBaishou } from '../providers/BaishouProvider';

// 记忆召回项接口
interface RecallItem {
  id: string;
  type: string;
  title: string;
  snippet: string;
  date: string;
}

export function useAgentUI() {
  const { t } = useTranslation();
  const { services } = useBaishou();

  // UI 状态
  const [showSessionList, setShowSessionList] = useState(false);
  const [showCostDialog, setShowCostDialog] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showShortcutSheet, setShowShortcutSheet] = useState(false);
  const [showRecallSheet, setShowRecallSheet] = useState(false);
  const [showToolManager, setShowToolManager] = useState(false);
  const [recallItems, setRecallItems] = useState<RecallItem[]>([]);
  const [isSearchingRecall, setIsSearchingRecall] = useState(false);
  const isUserScrollingRef = useRef(false);

  // 监听滚动
  const handleScroll = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const isAtBottom = contentSize.height - contentOffset.y - layoutMeasurement.height < 150;
    isUserScrollingRef.current = !isAtBottom;
    setShowScrollButton(!isAtBottom);
  }, []);

  // 滚动到底部
  const scrollToBottom = useCallback((flatListRef: any, force = false) => {
    if (flatListRef.current && (!isUserScrollingRef.current || force)) {
      flatListRef.current.scrollToEnd({ animated: true });
      if (force) {
        setShowScrollButton(false);
        isUserScrollingRef.current = false;
      }
    }
  }, []);

  // 记忆召回搜索
  const handleRecallSearch = useCallback(async (query: string, tab: 'diary' | 'memory') => {
    if (!services) return;
    setIsSearchingRecall(true);
    try {
      if (tab === 'diary') {
        const dbEntries = await services.diaryService.search(query);
        if (dbEntries) {
          setRecallItems(dbEntries.map((d: any) => ({
            id: d.id.toString(),
            type: 'diary',
            title: d.title || t('agent.recall.noTitle', '无标题'),
            snippet: d.snippet || d.content?.substring(0, 100) || '',
            date: new Date(d.createdAt).toISOString().split('T')[0]
          })));
        } else {
          setRecallItems([]);
        }
      } else {
        setRecallItems([]);
      }
    } catch (err) {
      console.error('[AgentUI] Search fail:', err);
      setRecallItems([]);
    } finally {
      setIsSearchingRecall(false);
    }
  }, [services, t]);

  // 注入记忆
  const handleInjectRecall = useCallback((items: RecallItem[]) => {
    setShowRecallSheet(false);
  }, []);

  return {
    // 状态
    showSessionList,
    showCostDialog,
    showScrollButton,
    showShortcutSheet,
    showRecallSheet,
    showToolManager,
    recallItems,
    isSearchingRecall,
    // 方法
    setShowSessionList,
    setShowCostDialog,
    setShowScrollButton,
    setShowShortcutSheet,
    setShowRecallSheet,
    setShowToolManager,
    handleScroll,
    scrollToBottom,
    handleRecallSearch,
    handleInjectRecall,
  };
}
