import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { InputBar } from '../index';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('../../Toast/useToast', () => ({
  useToast: () => ({ showSuccess: vi.fn(), showError: vi.fn() })
}));

// Mock electron global API
type MockApi = { pickFiles?: () => Promise<any[]> };
declare global {
  interface Window {
    api?: MockApi;
  }
}

describe('InputBar Component', () => {

  it('should render standard elements', () => {
    const onSendMock = vi.fn();
    render(<InputBar isLoading={false} onSend={onSendMock} />);
    
    expect(screen.getByPlaceholderText('agent.chat.input_hint')).toBeInTheDocument();
  });

  it('should properly update text on change', () => {
    render(<InputBar isLoading={false} onSend={vi.fn()} />);
    const textarea = screen.getByPlaceholderText('agent.chat.input_hint');
    fireEvent.change(textarea, { target: { value: 'Hello BaiShou' } });
    expect(textarea).toHaveValue('Hello BaiShou');
  });

  it('should trigger onSend when Enter is pressed without Shift', () => {
    const onSendMock = vi.fn();
    render(<InputBar isLoading={false} onSend={onSendMock} />);
    
    const textarea = screen.getByPlaceholderText('agent.chat.input_hint');
    fireEvent.change(textarea, { target: { value: 'Process this please' } });
    
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter', shiftKey: false });
    
    expect(onSendMock).toHaveBeenCalledTimes(1);
    expect(onSendMock).toHaveBeenCalledWith('Process this please', undefined);
  });

  it('should NOT trigger onSend if Shift+Enter is pressed', () => {
    const onSendMock = vi.fn();
    render(<InputBar isLoading={false} onSend={onSendMock} />);
    
    const textarea = screen.getByPlaceholderText('agent.chat.input_hint');
    fireEvent.change(textarea, { target: { value: 'Line 1' } });
    
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter', shiftKey: true });
    
    expect(onSendMock).not.toHaveBeenCalled();
  });
});
