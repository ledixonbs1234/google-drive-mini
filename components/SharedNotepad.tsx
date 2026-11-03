// components/SharedNotepad.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FaSync, FaExclamationTriangle, FaKeyboard, FaCloud } from 'react-icons/fa';

const SharedNotepad: React.FC = () => {
  const [noteContent, setNoteContent] = useState<string>('');
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline' | 'error'>('synced');
  const [storageSource, setStorageSource] = useState<string>('Cloudflare R2');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [wordCount, setWordCount] = useState<number>(0);
  const [isClient, setIsClient] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestContentRef = useRef<string>('');
  const isSavingRef = useRef<boolean>(false);
  const hasPendingChangesRef = useRef<boolean>(false);

  const countWords = (text: string): number => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  const validateInput = (text: string): boolean => {
    return text.length <= 10000;
  };

  // Lưu nội dung ghi chú lên Cloudflare API
  const saveToServer = useCallback(async (content: string) => {
    if (typeof window !== 'undefined' && !navigator.onLine) {
      setSyncStatus('offline');
      return;
    }

    isSavingRef.current = true;
    setSyncStatus('syncing');

    try {
      const res = await fetch('/api/notepad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      latestContentRef.current = content;
      hasPendingChangesRef.current = false;
      setSyncStatus('synced');
      setLastSyncTime(new Date());

      if (data.source) {
        setStorageSource(data.source === 'cloudflare-d1' ? 'Cloudflare D1' : 'Cloudflare R2');
      }
    } catch (error) {
      console.error('Lỗi khi lưu ghi chú lên Cloudflare:', error);
      setSyncStatus('error');
    } finally {
      isSavingRef.current = false;
    }
  }, []);

  const triggerDebouncedSave = useCallback((content: string) => {
    hasPendingChangesRef.current = true;
    setSyncStatus('syncing');

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveToServer(content);
    }, 800);
  }, [saveToServer]);

  // Đọc nội dung ghi chú ban đầu hoặc đồng bộ định kỳ
  const fetchNote = useCallback(async (isInitialLoad = false) => {
    try {
      // TUYỆT ĐỐI KHÔNG ghi đè nếu:
      // 1. Đang có thay đổi chưa lưu (hasPendingChangesRef)
      // 2. Đang trong quá trình lưu (isSavingRef)
      // 3. Người dùng đang focus vào textarea để gõ chữ (trừ lần đầu mount)
      const isFocused = typeof document !== 'undefined' && textareaRef.current && document.activeElement === textareaRef.current;
      if (!isInitialLoad && (hasPendingChangesRef.current || isSavingRef.current || isFocused)) {
        return;
      }

      const res = await fetch('/api/notepad');
      if (res.ok) {
        const data = await res.json();
        const serverContent = data.content || '';

        if (data.source) {
          setStorageSource(data.source === 'cloudflare-d1' ? 'Cloudflare D1' : 'Cloudflare R2');
        }

        // Kiểm tra lại lần nữa trước khi cập nhật state
        const stillFocused = typeof document !== 'undefined' && textareaRef.current && document.activeElement === textareaRef.current;
        if (isInitialLoad || (!hasPendingChangesRef.current && !isSavingRef.current && !stillFocused)) {
          setNoteContent(serverContent);
          latestContentRef.current = serverContent;
          setWordCount(countWords(serverContent));
          setSyncStatus('synced');
          if (data.updatedAt) {
            setLastSyncTime(new Date(data.updatedAt));
          }
        }
      }
    } catch (err) {
      console.error('Lỗi khi fetch notepad từ Cloudflare:', err);
      if (isInitialLoad) {
        setSyncStatus('error');
      }
    } finally {
      if (isInitialLoad) {
        setIsLoading(false);
      }
    }
  }, []);

  // Chỉ chạy 1 lần duy nhất khi component mount
  useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
    }

    // Tải dữ liệu ban đầu
    fetchNote(true);

    // Polling định kỳ mỗi 20 giây để đồng bộ nếu có thay đổi từ tab/thiết bị khác
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchNote(false);
      }
    }, 20000);

    const handleOnline = () => {
      setIsOnline(true);
      if (hasPendingChangesRef.current && latestContentRef.current) {
        saveToServer(latestContentRef.current);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [fetchNote, saveToServer]);

  const handleNoteChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = event.target.value;
    if (!validateInput(newText)) return;

    setNoteContent(newText);
    setWordCount(countWords(newText));
    latestContentRef.current = newText;
    triggerDebouncedSave(newText);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveToServer(latestContentRef.current);
    }
  };

  const getStatusIndicator = () => {
    switch (syncStatus) {
      case 'synced':
        return <span className="text-xs text-green-600 dark:text-green-400">Đã đồng bộ</span>;
      case 'syncing':
        return (
          <span className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center">
            <FaSync className="animate-spin mr-1" /> Đang đồng bộ...
          </span>
        );
      case 'offline':
        return <span className="text-xs text-red-600 dark:text-red-400">Mất kết nối</span>;
      case 'error':
        return (
          <span className="text-xs text-red-600 dark:text-red-400 flex items-center">
            <FaExclamationTriangle className="mr-1" /> Lỗi đồng bộ
          </span>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-zinc-700 animate-pulse">
        <div className="flex justify-between items-center mb-2">
          <div className="h-5 bg-gray-300 dark:bg-zinc-600 rounded w-1/3"></div>
          <div className="h-4 bg-gray-300 dark:bg-zinc-600 rounded w-24"></div>
        </div>
        <div className="h-3 bg-gray-200 dark:bg-zinc-700 rounded mb-3 w-2/3"></div>
        <div className="h-48 bg-gray-200 dark:bg-zinc-700 rounded-md"></div>
      </div>
    );
  }

  return (
    <div className="mt-8 pt-6 border-t border-gray-200 dark:border-zinc-700">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            📝 Ghi chú dùng chung
          </h2>
          <span className="inline-flex items-center text-xs px-2 py-0.5 rounded bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
            <FaCloud className="mr-1" /> {storageSource}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          {getStatusIndicator()}
        </div>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
        Nội dung được lưu trữ và đồng bộ tự động trên nền tảng <strong>Cloudflare R2</strong>.
      </p>

      <div className="flex justify-between items-center mb-2 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center space-x-4">
          <span className="flex items-center">
            <FaKeyboard className="mr-1" />
            Số từ: {wordCount}
          </span>
          <span className={`${noteContent.length > 9000 ? 'text-orange-500' : noteContent.length > 9500 ? 'text-red-500' : ''}`}>
            {noteContent.length}/10,000 ký tự
          </span>
          {lastSyncTime && (
            <span>
              Lần cuối đồng bộ: {lastSyncTime.toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {isClient && (
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              isOnline 
                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' 
                : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
            }`}>
              {isOnline ? '🟢 Online' : '🔴 Offline'}
            </span>
          )}
        </div>
      </div>

      <textarea
        ref={textareaRef}
        value={noteContent}
        onChange={handleNoteChange}
        onKeyDown={handleKeyDown}
        placeholder="Nhập ghi chú của bạn vào đây (tự động đồng bộ lên Cloudflare R2)..."
        className="w-full h-48 p-3 border border-gray-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-700 dark:text-gray-100 transition-shadow resize-none"
        style={{ minHeight: '12rem' }}
      />
    </div>
  );
};

export default SharedNotepad;
