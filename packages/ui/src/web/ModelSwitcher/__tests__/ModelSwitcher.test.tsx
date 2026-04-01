import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ModelSwitcher } from '../index';
import { MOCK_PROVIDERS } from '@baishou/shared/src/mock/agent.mock';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback: string) => fallback || key })
}));

describe('ModelSwitcher Component', () => {

  it('renders nothing when not open', () => {
    const { container } = render(
      <ModelSwitcher 
        isOpen={false} 
        onClose={vi.fn()} 
        providers={MOCK_PROVIDERS} 
        onSelect={vi.fn()} 
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders correctly and searches models by keyword', () => {
    render(
      <ModelSwitcher 
        isOpen={true} 
        onClose={vi.fn()} 
        providers={MOCK_PROVIDERS} 
        onSelect={vi.fn()} 
      />
    );
    
    // Check if models exist
    expect(screen.getByText('gpt-4o')).toBeInTheDocument();
    
    // Search for claude
    const input = screen.getByPlaceholderText('搜索模型 ...');
    fireEvent.change(input, { target: { value: 'claude' } });
    
    // gpt shouldn't be there 
    expect(screen.queryByText('gpt-4o')).not.toBeInTheDocument();
    expect(screen.getByText('claude-3-opus')).toBeInTheDocument();
  });

  it('calls onSelect and onClose when a model is clicked', () => {
    const onSelectMock = vi.fn();
    const onCloseMock = vi.fn();

    render(
      <ModelSwitcher 
        isOpen={true} 
        onClose={onCloseMock} 
        providers={MOCK_PROVIDERS} 
        onSelect={onSelectMock} 
      />
    );

    const modelNode = screen.getByText('gpt-4o');
    fireEvent.click(modelNode);

    expect(onSelectMock).toHaveBeenCalledWith('openai_1', 'gpt-4o');
    expect(onCloseMock).toHaveBeenCalled();
  });
});
