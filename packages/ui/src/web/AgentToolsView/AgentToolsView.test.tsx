// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { AgentToolsView } from './index';

describe('AgentToolsView Component', () => {
  it('should render core builtin tools in the list', () => {
    const { container } = render(<AgentToolsView config={{ enabledTools: ['web_search'], autoApproveSafeTools: false }} onChange={vi.fn()} />);
    expect(container.textContent).toContain('全网神经链爬虫');
    expect(container.textContent).toContain('安全仓代码执行');
  });

  it('should reflect config enabled tools correctly', () => {
    const { container } = render(<AgentToolsView config={{ enabledTools: ['web_search'], autoApproveSafeTools: false }} onChange={vi.fn()} />);
    const buttons = container.querySelectorAll('button');
    let onCount = 0;
    buttons.forEach(btn => {
      if (btn.textContent === 'ON') onCount++;
    });
    // Only web_search should be ON
    expect(onCount).toBe(1);
  });

  it('should switch tabs', async () => {
    const user = userEvent.setup();
    const { container } = render(<AgentToolsView config={{ enabledTools: [], autoApproveSafeTools: false }} onChange={vi.fn()} />);
    
    expect(container.textContent).not.toContain('共生体集市正在跃迁中');
    
    // click community tab
    const tabs = container.querySelectorAll('div[class*="tabBtn"]');
    await user.click(tabs[1] as HTMLElement);

    expect(container.textContent).toContain('共生体集市正在跃迁中');
  });

  it('should call onChange with correct config when auto-approve checkbox changes', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const { container } = render(<AgentToolsView config={{ enabledTools: [], autoApproveSafeTools: false }} onChange={handleChange} />);
    
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes).toHaveLength(1);
    
    await user.click(checkboxes[0] as HTMLInputElement);

    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({ autoApproveSafeTools: true }));
  });
});
