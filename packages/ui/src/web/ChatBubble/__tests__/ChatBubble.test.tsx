import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChatBubble } from '../index';
import { MockChatMessage } from '@baishou/shared/src/mock/agent.mock';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('../../Toast/useToast', () => ({
  useToast: () => ({ showSuccess: vi.fn(), showError: vi.fn() })
}));

describe('ChatBubble Component', () => {

  const baseUserMessage: MockChatMessage = {
    id: 'user-1',
    sessionId: 'session-1',
    role: 'user',
    content: '你好，请帮我搜索明天的天气',
    timestamp: new Date('2026-04-02T10:00:00')
  };

  const baseAiMessage: MockChatMessage = {
    id: 'ai-1',
    sessionId: 'session-1',
    role: 'assistant',
    content: '这是一条普通的 Markdown 回复。',
    timestamp: new Date('2026-04-02T10:00:05')
  };

  it('renders user message correctly', () => {
    const { container } = render(<ChatBubble message={baseUserMessage} />);
    expect(screen.getByText('你好，请帮我搜索明天的天气')).toBeInTheDocument();
  });

  it('renders basic AI message correctly', () => {
    render(<ChatBubble message={baseAiMessage} />);
    expect(screen.getByText('这是一条普通的 Markdown 回复。')).toBeInTheDocument();
  });

  it('renders reasoning block when isReasoning is true', () => {
    const reasoningMessage: MockChatMessage = {
      ...baseAiMessage,
      isReasoning: true,
    };
    const { container } = render(<ChatBubble message={reasoningMessage} />);
    
    // We expect a details tag or a block that indicates thinking process
    const details = container.querySelector('details');
    expect(details).toBeInTheDocument();
    expect(screen.getByText('思考过程')).toBeInTheDocument();
  });

  it('renders tool invocations correctly', () => {
    const messageWithTools: MockChatMessage = {
      ...baseAiMessage,
      content: '根据天气 API，明天晴天。',
      toolInvocations: [
        {
          toolCallId: 'call_123',
          toolName: 'weather_search',
          state: 'result',
          args: { location: 'Beijing', date: 'tomorrow' },
          result: { weather: 'Sunny', temp: 25 }
        }
      ]
    };
    render(<ChatBubble message={messageWithTools} />);
    
    // Expect tool call block to be visible
    expect(screen.getByText('weather_search')).toBeInTheDocument();
  });

});
