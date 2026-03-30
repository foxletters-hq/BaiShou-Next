import { useState } from 'react';

export function useSummaryDashboardMock() {
  const [activeTab, setActiveTab] = useState<'panel' | 'gallery'>('panel');
  const [lookbackMonths, setLookbackMonths] = useState(1);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // 未来应替换为对 Agent 3 的 store 的访问
  const stats = {
    totalDiaryCount: 125,
    totalWeeklyCount: 12,
    totalMonthlyCount: 4,
    totalQuarterlyCount: 1,
    totalYearlyCount: 0,
  };

  const handleCopyContext = () => {
    // 调用剪贴板或 RAG 接口
    alert('Context copied!');
  };

  const summaries = [
    { id: '1', title: '2026年第13周', dateRange: '03.24-03.30', type: 'week' as const, summaryText: '本周完成了跨 Agent 并行流的设计。' },
    { id: '2', title: '2026年3月总结', dateRange: '03.01-03.31', type: 'month' as const, summaryText: '整个三月都沉浸在 BaiShou Next 的双端架构中。' }
  ];

  return {
    state: { activeTab, lookbackMonths, viewMode, stats, summaries },
    actions: { setActiveTab, setLookbackMonths, setViewMode, handleCopyContext }
  };
}
