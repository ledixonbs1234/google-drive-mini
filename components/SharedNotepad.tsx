// FILE: components/SharedNotepad.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { database } from '../lib/firebase';
import { ref, onValue, set } from 'firebase/database';
import { FaSync } from 'react-icons/fa';

const SharedNotepad: React.FC = () => {
  const [noteContent, setNoteContent] = useState<string>('');
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline'>('offline');

  // Tạo một tham chiếu đến một "nút" trong Realtime Database
  // Đây là nơi dữ liệu text sẽ được lưu
  const noteRef = ref(database, 'shared-note/content');

  // Lắng nghe sự thay đổi dữ liệu từ Firebase
  useEffect(() => {
    // onValue sẽ được gọi 1 lần khi lắng nghe, và mỗi lần dữ liệu thay đổi
    const unsubscribe = onValue(noteRef, (snapshot) => {
      const data = snapshot.val();
      // Cập nhật state của component với dữ liệu từ Firebase
      setNoteContent(data || '');
      setSyncStatus('synced');
    }, (error) => {
      console.error("Lỗi kết nối Realtime Database:", error);
      setSyncStatus('offline');
    });

    // Rất quan trọng: Hủy lắng nghe khi component bị unmount để tránh rò rỉ bộ nhớ
    return () => {
      unsubscribe();
    };
  }, [noteRef]); // Dependency array đảm bảo useEffect chỉ chạy lại nếu noteRef thay đổi (hiếm)

  // Xử lý khi người dùng gõ vào textarea
  const handleNoteChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = event.target.value;
    // Cập nhật UI ngay lập tức để có trải nghiệm mượt mà
    setNoteContent(newText);
    
    // Ghi dữ liệu mới vào Firebase
    // Hàm set() sẽ ghi đè toàn bộ dữ liệu tại `noteRef`
    setSyncStatus('syncing');
    set(noteRef, newText)
      .then(() => {
        setSyncStatus('synced');
      })
      .catch((error) => {
        console.error("Lỗi khi lưu ghi chú:", error);
        setSyncStatus('offline');
      });
  };

  const getStatusIndicator = () => {
    switch (syncStatus) {
      case 'synced':
        return <span className="text-xs text-green-600 dark:text-green-400">Đã đồng bộ</span>;
      case 'syncing':
        return <span className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center"><FaSync className="animate-spin mr-1"/> Đang đồng bộ...</span>;
      case 'offline':
        return <span className="text-xs text-red-600 dark:text-red-400">Mất kết nối</span>;
      default:
        return null;
    }
  };

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
      <textarea
        value={noteContent}
        onChange={handleNoteChange}
        placeholder="Nhập ghi chú của bạn vào đây..."
        className="w-full h-48 p-3 border border-gray-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-700 dark:text-gray-100 transition-shadow"
      />
    </div>
  );
};

export default SharedNotepad;