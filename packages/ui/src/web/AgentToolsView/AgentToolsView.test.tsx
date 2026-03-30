// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { AgentToolsView } from './index';
import type { AgentTool } from './index';

describe('AgentToolsView Component', () => {
  const mockTools: AgentTool[] = [
    { id: '1', name: 'Web Search', description: 'Search the web', icon: '🌐', isEnabled: true, version: '1.0' },
    { id: '2', name: 'Code Interpreter', description: 'Run python code', icon: '🐍', isEnabled: false, version: '2.0' }
  ];

  it('should render all tools in the list', () => {
    const { container } = render(<AgentToolsView tools={mockTools} onToggleTool={vi.fn()} />);
    expect(container.textContent).toContain('Web Search');
    expect(container.textContent).toContain('Code Interpreter');
  });

  it('should render only matching tools when pre-filtered list is passed', () => {
    // 只传入 Code Interpreter，验证 Web Search 不会出现
    const singleTool = [mockTools[1]!];
    const { container } = render(<AgentToolsView tools={singleTool} onToggleTool={vi.fn()} />);

    expect(container.textContent).toContain('Code Interpreter');
    expect(container.textContent).not.toContain('Web Search');
  });

  it('should render empty state when no tools match', () => {
    const { container } = render(<AgentToolsView tools={[]} onToggleTool={vi.fn()} />);
    expect(container.textContent).toContain('未能找到相关工具插件');
  });

  it('should call onToggleTool with correct id and new state when checkbox changes', async () => {
    const user = userEvent.setup();
    const handleToggle = vi.fn();
    const { container } = render(<AgentToolsView tools={mockTools} onToggleTool={handleToggle} />);
    
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes).toHaveLength(2);
    
    const secondCheckbox = checkboxes[1] as HTMLInputElement;
    await user.click(secondCheckbox);

    expect(handleToggle).toHaveBeenCalledWith('2', true);
  });
});
