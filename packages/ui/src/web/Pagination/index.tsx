import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import styles from './Pagination.module.css';

export interface PaginationProps {
  /** 当前页码（从 1 开始） */
  current: number;
  /** 总页数 */
  total: number;
  /** 页码变化回调 */
  onChange: (page: number) => void;
  /** 相邻页码按钮数量（默认 1，即显示当前页及前后各 1 页，共 3 个） */
  siblingCount?: number;
  /** 是否显示首页/末页按钮 */
  showFirstLast?: boolean;
  /** 是否显示页码输入跳转框 */
  showJumper?: boolean;
  /** 输入跳转框占位文本 */
  jumperPlaceholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义类名 */
  className?: string;
}

/** 计算页码范围 */
function getPageRange(current: number, total: number, siblingCount: number): (number | 'ellipsis')[] {
  const pages: (number | 'ellipsis')[] = [];

  // 总页数较少时直接显示所有页码
  const totalPageNumbers = siblingCount * 2 + 3; // sibling + current + first + last
  if (total <= totalPageNumbers) {
    for (let i = 1; i <= total; i++) {
      pages.push(i);
    }
    return pages;
  }

  const leftSiblingIndex = Math.max(current - siblingCount, 1);
  const rightSiblingIndex = Math.min(current + siblingCount, total);

  const showLeftEllipsis = leftSiblingIndex > 2;
  const showRightEllipsis = rightSiblingIndex < total - 1;

  // 情况 1：不需要左省略号（当前页靠近开头）
  if (!showLeftEllipsis) {
    // 显示 1 到 rightSiblingIndex + 1 的页码
    for (let i = 1; i <= rightSiblingIndex + 1; i++) {
      pages.push(i);
    }
    pages.push('ellipsis');
    pages.push(total);
    return pages;
  }

  // 情况 2：不需要右省略号（当前页靠近结尾）
  if (!showRightEllipsis) {
    pages.push(1);
    pages.push('ellipsis');
    for (let i = leftSiblingIndex - 1; i <= total; i++) {
      pages.push(i);
    }
    return pages;
  }

  // 情况 3：两边都需要省略号（当前页在中间）
  pages.push(1);
  pages.push('ellipsis');
  for (let i = leftSiblingIndex; i <= rightSiblingIndex; i++) {
    pages.push(i);
  }
  pages.push('ellipsis');
  pages.push(total);

  return pages;
}

export const Pagination: React.FC<PaginationProps> = ({
  current,
  total,
  onChange,
  siblingCount = 1,
  showFirstLast = true,
  showJumper = true,
  jumperPlaceholder = '跳转',
  disabled = false,
  className = '',
}) => {
  const [jumperValue, setJumperValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // current 变化时清空输入框
  useEffect(() => {
    setJumperValue('');
  }, [current]);

  const handlePageChange = useCallback(
    (page: number) => {
      if (disabled) return;
      const safePage = Math.max(1, Math.min(total, page));
      if (safePage !== current) {
        onChange(safePage);
      }
    },
    [disabled, total, current, onChange],
  );

  const handleJumperSubmit = useCallback(() => {
    if (disabled) return;
    const page = parseInt(jumperValue, 10);
    if (!isNaN(page) && page >= 1 && page <= total) {
      handlePageChange(page);
    }
    setJumperValue('');
  }, [disabled, jumperValue, total, handlePageChange]);

  const handleJumperKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleJumperSubmit();
      }
    },
    [handleJumperSubmit],
  );

  const pageRange = getPageRange(current, total, siblingCount);

  return (
    <div className={`${styles.pagination} ${className}`}>
      {/* 首页按钮 */}
      {showFirstLast && (
        <button
          className={styles.pageBtn}
          disabled={disabled || current <= 1}
          onClick={() => handlePageChange(1)}
          aria-label="首页"
          title="首页"
        >
          <ChevronsLeft size={14} />
        </button>
      )}

      {/* 上一页按钮 */}
      <button
        className={styles.pageBtn}
        disabled={disabled || current <= 1}
        onClick={() => handlePageChange(current - 1)}
        aria-label="上一页"
        title="上一页"
      >
        <ChevronLeft size={14} />
      </button>

      {/* 页码按钮 */}
      {pageRange.map((page, index) =>
        page === 'ellipsis' ? (
          <span key={`ellipsis-${index}`} className={styles.ellipsis}>
            ···
          </span>
        ) : (
          <button
            key={page}
            className={`${styles.pageBtn} ${page === current ? styles.pageBtnActive : ''}`}
            disabled={disabled}
            onClick={() => handlePageChange(page)}
          >
            {page}
          </button>
        ),
      )}

      {/* 下一页按钮 */}
      <button
        className={styles.pageBtn}
        disabled={disabled || current >= total}
        onClick={() => handlePageChange(current + 1)}
        aria-label="下一页"
        title="下一页"
      >
        <ChevronRight size={14} />
      </button>

      {/* 末页按钮 */}
      {showFirstLast && (
        <button
          className={styles.pageBtn}
          disabled={disabled || current >= total}
          onClick={() => handlePageChange(total)}
          aria-label="末页"
          title="末页"
        >
          <ChevronsRight size={14} />
        </button>
      )}

      {/* 页码输入跳转 */}
      {showJumper && total > 1 && (
        <div className={styles.jumper}>
          <input
            ref={inputRef}
            className={styles.jumperInput}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={jumperValue}
            disabled={disabled}
            placeholder={jumperPlaceholder}
            onChange={(e) => {
              // 只允许输入数字
              const val = e.target.value.replace(/[^0-9]/g, '');
              setJumperValue(val);
            }}
            onKeyDown={handleJumperKeyDown}
            onBlur={handleJumperSubmit}
            aria-label="跳转到指定页"
          />
          <span className={styles.jumperSuffix}>页</span>
        </div>
      )}
    </div>
  );
};
