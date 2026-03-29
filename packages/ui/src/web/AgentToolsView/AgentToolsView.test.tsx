import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AgentToolsView, AgentTool } from './index';

describe('AgentToolsView Component', () => {
  const mockTools: AgentTool[] = [
    { id: '1', name: 'Web Search', description: 'Search the web', icon: '🌐', isEnabled: true, version: '1.0' },
    { id: '2', name: 'Code Interpreter', description: 'Run python code', icon: '🐍', isEnabled: false, version: '2.0' }
  ];

  it('renders correctly with tools list', () => {
    render(<AgentToolsView tools={mockTools} onToggleTool={vi.fn()} />);
    expect(screen.getByText('Web Search')).toBeDefined();
    expect(screen.getByText('Code Interpreter')).toBeDefined();
  });

  it('filters tools based on search query', () => {
    render(<AgentToolsView tools={mockTools} onToggleTool={vi.fn()} />);
    
    const searchInput = screen.getByPlaceholderText('检索工具插件...');
    fireEvent.change(searchInput, { target: { value: 'Web' } });
    
    // Web Search should remain
    expect(screen.getByText('Web Search')).toBeDefined();
    
    // Code Interpreter should be hidden. Testing-library's queryByText returns null if not found
    expect(screen.queryByText('Code Interpreter')).toBeNull();
  });

  it('calls onToggleTool when a switch is clicked', () => {
    const handleToggle = vi.fn();
    render(<AgentToolsView tools={mockTools} onToggleTool={handleToggle} />);
    
    // The second tool is disabled, let's enable it
    const checkboxes = screen.getAllByRole('checkbox');
    // Index 1 corresponds to 'Code Interpreter' based on mock data order
    fireEvent.click(checkboxes[1]);
    
    expect(handleToggle).toHaveBeenCalledWith('2', true);
  });
});
