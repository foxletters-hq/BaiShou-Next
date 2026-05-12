import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination } from '../index';

describe('Pagination', () => {
  const defaultProps = {
    current: 1,
    total: 10,
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('基本渲染', () => {
    it('should render pagination buttons', () => {
      render(<Pagination {...defaultProps} />);
      expect(screen.getByRole('button', { name: '上一页' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '下一页' })).toBeInTheDocument();
    });

    it('should render first and last buttons by default', () => {
      render(<Pagination {...defaultProps} />);
      expect(screen.getByRole('button', { name: '首页' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '末页' })).toBeInTheDocument();
    });

    it('should hide first and last buttons when showFirstLast is false', () => {
      render(<Pagination {...defaultProps} showFirstLast={false} />);
      expect(screen.queryByRole('button', { name: '首页' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '末页' })).not.toBeInTheDocument();
    });

    it('should show jumper input when total > 1', () => {
      render(<Pagination {...defaultProps} />);
      expect(screen.getByRole('textbox', { name: '跳转到指定页' })).toBeInTheDocument();
    });

    it('should hide jumper input when showJumper is false', () => {
      render(<Pagination {...defaultProps} showJumper={false} />);
      expect(screen.queryByRole('textbox', { name: '跳转到指定页' })).not.toBeInTheDocument();
    });

    it('should hide jumper input when total is 1', () => {
      render(<Pagination current={1} total={1} onChange={vi.fn()} />);
      expect(screen.queryByRole('textbox', { name: '跳转到指定页' })).not.toBeInTheDocument();
    });
  });

  describe('页码显示（siblingCount=1，显示3个页码）', () => {
    it('should show 3 page buttons when current is in the middle', () => {
      render(<Pagination current={5} total={10} onChange={vi.fn()} />);
      // 当前页 5，显示 4, 5, 6
      expect(screen.getByRole('button', { name: '4' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '5' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '6' })).toBeInTheDocument();
    });

    it('should show correct pages when current is 1', () => {
      render(<Pagination current={1} total={10} onChange={vi.fn()} />);
      // 当前页 1，显示 1, 2, 3
      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument();
    });

    it('should show correct pages when current is last page', () => {
      render(<Pagination current={10} total={10} onChange={vi.fn()} />);
      // 当前页 10，显示 8, 9, 10
      expect(screen.getByRole('button', { name: '8' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '9' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '10' })).toBeInTheDocument();
    });

    it('should show ellipsis when there are gaps', () => {
      render(<Pagination current={5} total={20} onChange={vi.fn()} />);
      // 应该显示省略号
      const ellipses = screen.getAllByText('···');
      expect(ellipses.length).toBeGreaterThan(0);
    });

    it('should show all pages when total is small', () => {
      render(<Pagination current={2} total={5} onChange={vi.fn()} />);
      // 总页数较少，显示所有页码
      for (let i = 1; i <= 5; i++) {
        expect(screen.getByRole('button', { name: String(i) })).toBeInTheDocument();
      }
    });
  });

  describe('页码点击', () => {
    it('should call onChange when clicking a page number', async () => {
      const onChange = vi.fn();
      render(<Pagination current={1} total={10} onChange={onChange} />);
      await userEvent.click(screen.getByRole('button', { name: '3' }));
      expect(onChange).toHaveBeenCalledWith(3);
    });

    it('should call onChange when clicking next page', async () => {
      const onChange = vi.fn();
      render(<Pagination current={5} total={10} onChange={onChange} />);
      await userEvent.click(screen.getByRole('button', { name: '下一页' }));
      expect(onChange).toHaveBeenCalledWith(6);
    });

    it('should call onChange when clicking previous page', async () => {
      const onChange = vi.fn();
      render(<Pagination current={5} total={10} onChange={onChange} />);
      await userEvent.click(screen.getByRole('button', { name: '上一页' }));
      expect(onChange).toHaveBeenCalledWith(4);
    });

    it('should call onChange when clicking first page', async () => {
      const onChange = vi.fn();
      render(<Pagination current={5} total={10} onChange={onChange} />);
      await userEvent.click(screen.getByRole('button', { name: '首页' }));
      expect(onChange).toHaveBeenCalledWith(1);
    });

    it('should call onChange when clicking last page', async () => {
      const onChange = vi.fn();
      render(<Pagination current={5} total={10} onChange={onChange} />);
      await userEvent.click(screen.getByRole('button', { name: '末页' }));
      expect(onChange).toHaveBeenCalledWith(10);
    });

    it('should not call onChange when clicking current page', async () => {
      const onChange = vi.fn();
      render(<Pagination current={5} total={10} onChange={onChange} />);
      await userEvent.click(screen.getByRole('button', { name: '5' }));
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('按钮禁用状态', () => {
    it('should disable previous and first buttons when current is 1', () => {
      render(<Pagination current={1} total={10} onChange={vi.fn()} />);
      expect(screen.getByRole('button', { name: '上一页' })).toBeDisabled();
      expect(screen.getByRole('button', { name: '首页' })).toBeDisabled();
    });

    it('should disable next and last buttons when current is last page', () => {
      render(<Pagination current={10} total={10} onChange={vi.fn()} />);
      expect(screen.getByRole('button', { name: '下一页' })).toBeDisabled();
      expect(screen.getByRole('button', { name: '末页' })).toBeDisabled();
    });

    it('should disable all buttons when disabled prop is true', () => {
      render(<Pagination current={5} total={10} onChange={vi.fn()} disabled />);
      expect(screen.getByRole('button', { name: '上一页' })).toBeDisabled();
      expect(screen.getByRole('button', { name: '下一页' })).toBeDisabled();
      expect(screen.getByRole('button', { name: '首页' })).toBeDisabled();
      expect(screen.getByRole('button', { name: '末页' })).toBeDisabled();
    });
  });

  describe('输入跳转', () => {
    it('should jump to page on Enter key', async () => {
      const onChange = vi.fn();
      render(<Pagination current={1} total={10} onChange={onChange} />);
      const input = screen.getByRole('textbox', { name: '跳转到指定页' });
      await userEvent.type(input, '5{Enter}');
      expect(onChange).toHaveBeenCalledWith(5);
    });

    it('should jump to page on blur', async () => {
      const onChange = vi.fn();
      render(<Pagination current={1} total={10} onChange={onChange} />);
      const input = screen.getByRole('textbox', { name: '跳转到指定页' });
      await userEvent.type(input, '7');
      fireEvent.blur(input);
      expect(onChange).toHaveBeenCalledWith(7);
    });

    it('should not jump when input is empty', async () => {
      const onChange = vi.fn();
      render(<Pagination current={1} total={10} onChange={onChange} />);
      const input = screen.getByRole('textbox', { name: '跳转到指定页' });
      fireEvent.blur(input);
      expect(onChange).not.toHaveBeenCalled();
    });

    it('should not jump when input is out of range', async () => {
      const onChange = vi.fn();
      render(<Pagination current={1} total={10} onChange={onChange} />);
      const input = screen.getByRole('textbox', { name: '跳转到指定页' });
      await userEvent.type(input, '15{Enter}');
      expect(onChange).not.toHaveBeenCalled();
    });

    it('should not jump when input is 0', async () => {
      const onChange = vi.fn();
      render(<Pagination current={1} total={10} onChange={onChange} />);
      const input = screen.getByRole('textbox', { name: '跳转到指定页' });
      await userEvent.type(input, '0{Enter}');
      expect(onChange).not.toHaveBeenCalled();
    });

    it('should only allow numeric input', async () => {
      const onChange = vi.fn();
      render(<Pagination current={1} total={10} onChange={onChange} />);
      const input = screen.getByRole('textbox', { name: '跳转到指定页' }) as HTMLInputElement;
      await userEvent.type(input, 'abc123');
      expect(input.value).toBe('123');
    });

    it('should clear input after successful jump', async () => {
      const onChange = vi.fn();
      render(<Pagination current={1} total={10} onChange={onChange} />);
      const input = screen.getByRole('textbox', { name: '跳转到指定页' }) as HTMLInputElement;
      await userEvent.type(input, '5{Enter}');
      expect(input.value).toBe('');
    });
  });

  describe('边界情况', () => {
    it('should handle total of 1', () => {
      render(<Pagination current={1} total={1} onChange={vi.fn()} />);
      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '上一页' })).toBeDisabled();
      expect(screen.getByRole('button', { name: '下一页' })).toBeDisabled();
    });

    it('should handle total of 2', () => {
      render(<Pagination current={1} total={2} onChange={vi.fn()} />);
      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
    });

    it('should handle large total', () => {
      render(<Pagination current={50} total={100} onChange={vi.fn()} />);
      expect(screen.getByRole('button', { name: '49' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '50' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '51' })).toBeInTheDocument();
    });
  });
});
