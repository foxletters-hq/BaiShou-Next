import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { RecallItem } from '@baishou/ui';

export interface UseRecallSearchResult {
  recallItems: RecallItem[];
  isSearchingRecall: boolean;
  handleRecallSearch: (query: string, tab: 'diary' | 'memory', mode?: 'semantic' | 'text') => Promise<void>;
  recallSearchMode: 'semantic' | 'text';
  toggleRecallSearchMode: () => void;
}

/**
 * 回忆搜索 Hook
 *
 * 职责：搜索日记和 RAG 记忆，返回可注入的回忆条目
 */
export function useRecallSearch(): UseRecallSearchResult {
  const { t } = useTranslation();
  const [recallItems, setRecallItems] = useState<RecallItem[]>([]);
  const [isSearchingRecall, setIsSearchingRecall] = useState(false);
  const [recallSearchMode, setRecallSearchMode] = useState<'semantic' | 'text'>('semantic');

  const toggleRecallSearchMode = useCallback(() => {
    setRecallSearchMode(prev => prev === 'semantic' ? 'text' : 'semantic');
  }, []);

  const handleRecallSearch = useCallback(async (query: string, tab: 'diary' | 'memory', mode?: 'semantic' | 'text') => {
    setIsSearchingRecall(true);
    try {
      if (tab === 'diary') {
        const dbEntries = await (window as any).api?.diary?.search(query);
        if (dbEntries) {
          setRecallItems(dbEntries.map((d: any) => ({
            id: d.id.toString(),
            type: 'diary',
            title: d.title || t('common.untitled', '无标题'),
            snippet: d.snippet || d.content?.substring(0, 100) || '',
            date: new Date(d.createdAt).toISOString().split('T')[0],
          })));
        } else {
          setRecallItems([]);
        }
      } else {
        const searchMode = mode || recallSearchMode;
        const dbEntries = await (window as any).api?.rag?.queryEntries({ 
          keyword: query, 
          limit: 30,
          mode: searchMode
        });
        if (dbEntries) {
          setRecallItems(dbEntries.map((r: any) => ({
            id: r.embeddingId,
            type: 'memory',
            title: t('agent.trace_title', '调用追踪 [{{modelId}}]', { modelId: r.modelId || t('common.system', '系统') }),
            snippet: r.text,
            date: new Date(r.createdAt || Date.now()).toISOString().split('T')[0],
          })));
        } else {
          setRecallItems([]);
        }
      }
    } catch (err) {
      console.error('[useRecallSearch] Search fail:', err);
      setRecallItems([]);
    } finally {
      setIsSearchingRecall(false);
    }
  }, [t, recallSearchMode]);

  return { recallItems, isSearchingRecall, handleRecallSearch, recallSearchMode, toggleRecallSearchMode };
}
