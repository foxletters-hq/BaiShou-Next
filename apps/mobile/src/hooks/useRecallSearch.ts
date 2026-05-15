import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useBaishou } from '../providers/BaishouProvider';

export interface RecallItem {
  id: string;
  type: string;
  title: string;
  snippet: string;
  date: string;
}

export interface UseRecallSearchResult {
  recallItems: RecallItem[];
  isSearchingRecall: boolean;
  handleRecallSearch: (query: string, tab: 'diary' | 'memory') => Promise<void>;
}

/**
 * 回忆搜索 Hook
 *
 * 职责：搜索日记和 RAG 记忆，返回可注入的回忆条目
 */
export function useRecallSearch(): UseRecallSearchResult {
  const { t } = useTranslation();
  const { services } = useBaishou();
  const [recallItems, setRecallItems] = useState<RecallItem[]>([]);
  const [isSearchingRecall, setIsSearchingRecall] = useState(false);

  const handleRecallSearch = useCallback(async (query: string, tab: 'diary' | 'memory') => {
    setIsSearchingRecall(true);
    try {
      if (tab === 'diary') {
        const dbEntries = await services?.diaryService?.search(query);
        if (dbEntries) {
          setRecallItems(dbEntries.map((d: any) => ({
            id: d.id.toString(),
            type: 'diary' as const,
            title: d.title || t('common.untitled', '无标题'),
            snippet: d.snippet || d.content?.substring(0, 100) || '',
            date: new Date(d.createdAt).toISOString().split('T')[0],
          })));
        } else {
          setRecallItems([]);
        }
      } else {
        setRecallItems([]);
      }
    } catch (err) {
      console.error('[useRecallSearch] Search fail:', err);
      setRecallItems([]);
    } finally {
      setIsSearchingRecall(false);
    }
  }, [services, t]);

  return { recallItems, isSearchingRecall, handleRecallSearch };
}
