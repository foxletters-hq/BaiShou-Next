import '@testing-library/jest-dom';

// react-dom@19 在 jsdom unmount 时需要访问 window
if (typeof window === 'undefined') {
  (globalThis as any).window = globalThis;
}
