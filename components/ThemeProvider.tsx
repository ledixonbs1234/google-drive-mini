// components/ThemeProvider.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const setTheme = useAppStore((state) => state.setTheme);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    // Lấy theme từ localStorage khi component mount
    const storedTheme = localStorage.getItem('theme');
    
    // Kiểm tra cả chế độ dark của hệ thống nếu chưa có lựa chọn lưu trữ
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    let initialTheme: 'light' | 'dark' = 'light'; // Mặc định là light

    if (storedTheme === 'dark' || (!storedTheme && prefersDark)) {
        initialTheme = 'dark';
    }
    
    // Gọi setTheme để cập nhật state và DOM
    setTheme(initialTheme);
  }, [setTheme, mounted]); // Chỉ chạy khi mounted

  // Không render children cho đến khi mounted để tránh hydration issues
  if (!mounted) {
    return null;
  }

  // Chỉ render children, không cần thẻ bao bọc thêm
  return <>{children}</>;
}