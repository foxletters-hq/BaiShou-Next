import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChatAppBar } from '../index';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}));

describe('ChatAppBar Component', () => {
  const mockProfile = {
    name: '白守',
    modelIdentifier: 'Claude-3.5-Sonnet',
    tokenSize: '200k',
    emoji: '❄️'
  };

  it('renders profile correctly with badges', () => {
    render(<ChatAppBar profile={mockProfile} />);
    
    // Check Name 
    expect(screen.getByText('白守')).toBeInTheDocument();
    
    // Check Emoji Avatar
    expect(screen.getByText('❄️')).toBeInTheDocument();

    // Check Badges
    expect(screen.getByText('✨ Claude-3.5-Sonnet')).toBeInTheDocument();
    expect(screen.getByText('200k Tokens')).toBeInTheDocument();
  });

  it('binds memory, clear and setting action callbacks', () => {
    const mockClear = vi.fn();
    const mockMemory = vi.fn();
    const mockSettings = vi.fn();

    render(
      <ChatAppBar 
        profile={{ name: 'Assistant' }} 
        onClearChat={mockClear}
        onOpenMemory={mockMemory}
        onOpenSettings={mockSettings}
      />
    );

    // Grab buttons by title attribute setup in code
    const memBtn = screen.getByTitle('agent.chat.memory');
    const setBtn = screen.getByTitle('common.settings');
    const clrBtn = screen.getByTitle('common.clear');

    fireEvent.click(memBtn);
    expect(mockMemory).toHaveBeenCalledTimes(1);

    fireEvent.click(setBtn);
    expect(mockSettings).toHaveBeenCalledTimes(1);

    fireEvent.click(clrBtn);
    expect(mockClear).toHaveBeenCalledTimes(1);
  });
});
