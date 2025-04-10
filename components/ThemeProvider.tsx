// components/ThemeProvider.tsx
'use client';

import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const setTheme = useAppStore((state) => state.setTheme);

  useEffect(() => {
    // Lấy theme từ localStorage khi component mount
    const storedTheme = localStorage.getItem('theme');
    // Kiểm tra cả chế độ dark của hệ thống nếu chưa có lựa chọn lưu trữ
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    let initialTheme: 'light' | 'dark' = 'light'; // Mặc định là light

    if (storedTheme === 'dark' || (!storedTheme && prefersDark)) {
        initialTheme = 'dark';
    }
  }, [setTheme]); // Chỉ chạy một lần khi mount

  // Chỉ render children, không cần thẻ bao bọc thêm
  return <>{children}</>;
}