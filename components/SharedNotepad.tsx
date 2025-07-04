// FILE: components/SharedNotepad.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { database } from '../lib/firebase';
import { ref, onValue, set } from 'firebase/database';
import { FaSync, FaExclamationTriangle, FaKeyboard } from 'react-icons/fa';

const SharedNotepad: React.FC = () => {
  const [noteContent, setNoteContent] = useState<string>('');
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline' | 'error'>('offline');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true); // Mặc định true để tránh hydration mismatch
  const [wordCount, setWordCount] = useState<number>(0);
  const [isClient, setIsClient] = useState<boolean>(false); // Track client-side mounting
  const [isLoading, setIsLoading] = useState<boolean>(true); // Loading state cho lần đầu load
  
  // Refs để quản lý debounce và tránh stale closure
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestContentRef = useRef<string>('');
  const isSavingRef = useRef<boolean>(false);

  // Tạo một tham chiếu đến một "nút" trong Realtime Database
  // Đây là nơi dữ liệu text sẽ được lưu
  const noteRef = ref(database, 'shared-note/content');

  // Utility function: Đếm số từ
  const countWords = (text: string): number => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  // Utility function: Validate input
  const validateInput = (text: string): boolean => {
    // Giới hạn 10,000 ký tự để tránh spam
    return text.length <= 10000;
  };

  // Hàm lưu dữ liệu với debounce
  const debouncedSave = useCallback((content: string) => {
    // Xóa timeout cũ nếu có
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Tạo timeout mới
    saveTimeoutRef.current = setTimeout(async () => {
      if (!isOnline) return;
      
      isSavingRef.current = true;
      setSyncStatus('syncing');
      
      try {
        await set(noteRef, content);
        latestContentRef.current = content;
        setSyncStatus('synced');
        setLastSyncTime(new Date());
      } catch (error) {
        console.error("Lỗi khi lưu ghi chú:", error);
        setSyncStatus('error');
      } finally {
        isSavingRef.current = false;
      }
    }, 1000); // Debounce 1 giây
  }, [noteRef, isOnline]);

  // Theo dõi trạng thái online/offline
  useEffect(() => {
    // Đặt isClient = true khi component mount trên client
    setIsClient(true);
    
    // Thiết lập trạng thái online ban đầu
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
    }
    
    const handleOnline = () => {
      setIsOnline(true);
      // Nếu có nội dung chưa lưu, thử lưu lại
      if (latestContentRef.current !== noteContent) {
        debouncedSave(latestContentRef.current);
      }
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [debouncedSave, noteContent]);

  // Lắng nghe sự thay đổi dữ liệu từ Firebase
  useEffect(() => {
    // onValue sẽ được gọi 1 lần khi lắng nghe, và mỗi lần dữ liệu thay đổi
    const unsubscribe = onValue(noteRef, (snapshot) => {
      const data = snapshot.val();
      const newContent = data || '';
      
      // Chỉ cập nhật nếu không phải do chính mình gửi lên
      if (newContent !== latestContentRef.current) {
        setNoteContent(newContent);
        latestContentRef.current = newContent;
        setWordCount(countWords(newContent));
      }
      
      if (syncStatus !== 'synced' && !isSavingRef.current) {
        setSyncStatus('synced');
        setLastSyncTime(new Date());
      }
      
      // Đánh dấu đã load xong
      setIsLoading(false);
    }, (error) => {
      console.error("Lỗi kết nối Realtime Database:", error);
      setSyncStatus('error');
      setIsLoading(false);
    });

    // Rất quan trọng: Hủy lắng nghe khi component bị unmount để tránh rò rỉ bộ nhớ
    return () => {
      unsubscribe();
      // Cleanup timeout khi component unmount
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []); // Dependency array rỗng vì noteRef không thay đổi

  // Xử lý khi người dùng gõ vào textarea
  const handleNoteChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = event.target.value;
    
    // Validate input
    if (!validateInput(newText)) {
      // Không cập nhật nếu vượt quá giới hạn
      return;
    }
    
    // Cập nhật UI ngay lập tức để có trải nghiệm mượt mà
    setNoteContent(newText);
    setWordCount(countWords(newText));
    
    // Cập nhật ref để theo dõi nội dung mới nhất
    latestContentRef.current = newText;
    
    // Sử dụng debounce để giảm số lần gọi Firebase
    debouncedSave(newText);
  };

  // Hàm xử lý keyboard shortcuts
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+S hoặc Cmd+S để lưu ngay lập tức
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      if (latestContentRef.current && isOnline) {
        // Lưu ngay lập tức, không cần debounce
        setSyncStatus('syncing');
        set(noteRef, latestContentRef.current)
          .then(() => {
            setSyncStatus('synced');
            setLastSyncTime(new Date());
          })
          .catch((error) => {
            console.error("Lỗi khi lưu ghi chú:", error);
            setSyncStatus('error');
          });
      }
    }
  };

  const getStatusIndicator = () => {
    switch (syncStatus) {
      case 'synced':
        return <span className="text-xs text-green-600 dark:text-green-400">Đã đồng bộ</span>;
      case 'syncing':
        return <span className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center"><FaSync className="animate-spin mr-1"/> Đang đồng bộ...</span>;
      case 'offline':
        return <span className="text-xs text-red-600 dark:text-red-400">Mất kết nối</span>;
      case 'error':
        return <span className="text-xs text-red-600 dark:text-red-400 flex items-center"><FaExclamationTriangle className="mr-1"/> Lỗi đồng bộ</span>;
      default:
        return null;
    }
  };

  // Hiển thị skeleton placeholder khi đang loading
  if (isLoading) {
    return (
      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-zinc-700 animate-pulse">
        <div className="flex justify-between items-center mb-2">
          <div className="h-5 bg-gray-300 dark:bg-zinc-600 rounded w-1/3"></div>
          <div className="flex items-center space-x-2">
            <div className="h-4 bg-gray-300 dark:bg-zinc-600 rounded w-24"></div>
          </div>
        </div>
        <div className="h-3 bg-gray-200 dark:bg-zinc-700 rounded mb-3 w-2/3"></div>
        
        <div className="flex justify-between items-center mb-2 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center space-x-4">
            <div className="h-3 bg-gray-200 dark:bg-zinc-700 rounded w-20"></div>
            <div className="h-3 bg-gray-200 dark:bg-zinc-700 rounded w-20"></div>
            <div className="h-3 bg-gray-200 dark:bg-zinc-700 rounded w-32"></div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 bg-gray-300 dark:bg-zinc-600 rounded-full"></div>
          </div>
        </div>
        
        <div className="h-48 bg-gray-200 dark:bg-zinc-700 rounded-md"></div>
      </div>
    );
  }

  return (
    <div className="mt-8 pt-6 border-t border-gray-200 dark:border-zinc-700">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          📝 Ghi chú dùng chung
        </h2>
        <div className="flex items-center space-x-2">
          {getStatusIndicator()}
        </div>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
        Nội dung bạn gõ ở đây sẽ được tự động lưu và đồng bộ trên tất cả các thiết bị đang mở.
      </p>
      
      {/* Thông tin bổ sung */}
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
          {/* Chỉ hiển thị online status khi đã mount trên client */}
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
        value={noteContent}
        onChange={handleNoteChange}
        onKeyDown={handleKeyDown}
        placeholder="Nhập ghi chú của bạn vào đây..."
        className="w-full h-48 p-3 border border-gray-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-700 dark:text-gray-100 transition-shadow resize-none"
        style={{ minHeight: '12rem' }}
      />
    </div>
  );
};

export default SharedNotepad;