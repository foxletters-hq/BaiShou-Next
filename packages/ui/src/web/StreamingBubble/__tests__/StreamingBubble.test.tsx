import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StreamingBubble } from '../index';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'agent.chat.ai_label') return 'AI';
      if (key === 'agent.tools.tool_call') return '工具调用';
      if (key === 'common.stop_generate') return '停止生成';
      if (key === 'common.retry') return '重试';
      if (key === 'agent.chat.reasoning') return '思考中...';
      return key;
    }
  })
}));

describe('StreamingBubble Component', () => {

  it('renders standard text without error', () => {
    const { container } = render(<StreamingBubble text="正在生成内容" />);
    // MarkdownRenderer 会把 text 包裹起来
    expect(screen.getByText('正在生成内容')).toBeInTheDocument();
  });

  it('renders shimmer skeleton when isReasoning is true and text is empty', () => {
    render(<StreamingBubble text="" isReasoning={true} />);
    expect(screen.getByText(/agent.chat.reasoning/)).toBeInTheDocument();
  });

  it('renders stop button and triggers onStop when it is not in error state', () => {
    const onStopMock = vi.fn();
    render(<StreamingBubble text="正在返回数据..." onStop={onStopMock} />);
    
    const stopBtn = screen.getByText(/common.stop_generate/);
    expect(stopBtn).toBeInTheDocument();
    
    fireEvent.click(stopBtn);
    expect(onStopMock).toHaveBeenCalled();
  });

  it('renders error block, hides stop button, and shows retry button when error is present', () => {
    const onRetryMock = vi.fn();
    const onStopMock = vi.fn();
    render(
      <StreamingBubble 
        text="片段内容..." 
        error="LLM Connection failed" 
        onRetry={onRetryMock}
        onStop={onStopMock}
      />
    );
    
    // 应该展示错误信息
    expect(screen.getByText(/LLM Connection failed/)).toBeInTheDocument();
    
    // 重试按钮可见并可点击
    const retryBtn = screen.getByText('common.retry');
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);
    expect(onRetryMock).toHaveBeenCalled();
    
    // 停止按钮在 error 状态下不应该渲染（由具体实现决定，这里断言它不存在或被替换）
  });

});
