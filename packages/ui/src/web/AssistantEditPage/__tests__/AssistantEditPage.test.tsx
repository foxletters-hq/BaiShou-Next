// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { AssistantEditPage, AssistantFormData } from '../index';

vi.mock('../MarkdownRenderer', () => ({
  MarkdownRenderer: () => <div data-testid="mock-markdown">Mocked MarkdownRenderer</div>
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, _def: string) => _def || key })
}));

describe('AssistantEditPage Component', () => {
  const defaultAssistant: AssistantFormData = {
    id: '123',
    name: 'Test Bot',
    emoji: '🤖',
    description: 'A test bot',
    systemPrompt: 'You are a test bot.',
    contextWindow: 10,
    compressTokenThreshold: 60000,
    compressKeepTurns: 3,
  };

  it('renders correctly in edit mode', () => {
    render(<AssistantEditPage assistant={defaultAssistant} onSave={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByText('特调伙伴档案')).toBeInTheDocument();
  });

  it('renders correctly in create mode', () => {
    render(<AssistantEditPage assistant={null} onSave={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByText('新建数字心智')).toBeInTheDocument();
  });

  it('triggers onBack when back button is clicked', () => {
    const onBack = vi.fn();
    const { container } = render(<AssistantEditPage assistant={null} onSave={vi.fn()} onBack={onBack} />);
    const backBtn = container.querySelector('button');
    if (backBtn) fireEvent.click(backBtn);
    expect(onBack).toHaveBeenCalled();
  });

  it('triggers onDelete if isEditing and not last assistant', () => {
    const onDelete = vi.fn();
    render(<AssistantEditPage assistant={defaultAssistant} isLastAssistant={false} onSave={vi.fn()} onBack={vi.fn()} onDelete={onDelete} />);
    const deleteBtn = screen.getByText(/清除数据流/);
    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalled();
  });

  it('validates and triggers onSave with correct data payload', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<AssistantEditPage assistant={null} onSave={onSave} onBack={vi.fn()} />);
    const saveBtn = screen.getByText(/锁定潜意识写入/);
    expect(saveBtn).toBeDisabled();

    const nameInput = screen.getByPlaceholderText('例如：机要助理、代码专家');
    await user.type(nameInput, 'New Bot');

    expect(saveBtn).not.toBeDisabled();
    await user.click(saveBtn);
    
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      name: 'New Bot',
      emoji: '🍵',
      systemPrompt: '',
    }));
  });
});
