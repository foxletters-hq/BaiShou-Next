// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { MarkdownRenderer } from '../MarkdownRenderer';

describe('MarkdownRenderer Component', () => {
  beforeAll(() => {
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText: vi.fn() },
      configurable: true,
    });
  });

  it('renders standard text without crashing', () => {
    render(<MarkdownRenderer content="Hello World" />);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('renders bold and italic formatting', () => {
    const { container } = render(<MarkdownRenderer content="**Bold** and *Italic*" />);
    const strong = container.querySelector('strong');
    const em = container.querySelector('em');
    
    expect(strong?.textContent).toBe('Bold');
    expect(em?.textContent).toBe('Italic');
  });

  it('renders a code block safely', () => {
    const codeMarkdown = "```javascript\nconst a = 1;\n```";
    const { container } = render(<MarkdownRenderer content={codeMarkdown} />);
    expect(screen.getByText('javascript')).toBeInTheDocument();
    expect(screen.getByText('复制')).toBeInTheDocument();
    const code = container.querySelector('code');
    expect(code?.textContent).toContain('const a = 1;');
  });

  it('adds blinking cursor when isStreaming is true', () => {
    render(<MarkdownRenderer content="Stream..." isStreaming={true} />);
    expect(screen.getByText('Stream...')).toBeInTheDocument();
    expect(screen.getByText('▋')).toBeInTheDocument();
  });
});
