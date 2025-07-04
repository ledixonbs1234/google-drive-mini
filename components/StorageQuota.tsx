// components/StorageQuota.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { FaHdd, FaSpinner, FaExclamationTriangle } from 'react-icons/fa';
import { useStorageQuota } from '../hooks/useStorageQuota';

interface StorageQuotaProps {
  onRefresh?: () => void; // Callback khi cần refresh từ component cha
}

const StorageQuota: React.FC<StorageQuotaProps> = ({ onRefresh }) => {
  const { storageInfo, isLoading, error, refreshStorageQuota } = useStorageQuota();
  const [isClient, setIsClient] = useState<boolean>(false);

  // Format bytes thành dạng human-readable
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Load storage info khi component mount
  useEffect(() => {
    setIsClient(true);
    refreshStorageQuota();
  }, [refreshStorageQuota]);

  // Refresh khi có callback từ component cha
  useEffect(() => {
    if (onRefresh) {
      const timeoutId = setTimeout(() => {
        refreshStorageQuota();
      }, 1000); // Delay 1 giây để đảm bảo file đã được upload/xóa hoàn toàn

      return () => clearTimeout(timeoutId);
    }
  }, [onRefresh, refreshStorageQuota]);

  // Không render gì trên server-side
  if (!isClient) {
    return null;
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 p-4">
        <div className="flex items-center space-x-2">
          <FaSpinner className="animate-spin text-gray-500" />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Đang tính dung lượng...
          </span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-white dark:bg-zinc-800 rounded-lg border border-red-200 dark:border-red-700 p-4">
        <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
          <FaExclamationTriangle />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  // Main content
  if (!storageInfo) return null;

  const remainingBytes = storageInfo.totalBytes - storageInfo.usedBytes;
  const isNearLimit = storageInfo.percentUsed > 80;
  const isFull = storageInfo.percentUsed > 95;

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <FaHdd className="text-gray-600 dark:text-gray-400" />
          <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200">
            Dung lượng Storage
          </h3>
        </div>
        <button
          onClick={refreshStorageQuota}
          disabled={isLoading}
          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors disabled:opacity-50"
        >
          Cập nhật
        </button>
      </div>
      
      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-gray-600 dark:text-gray-400">
            Đã sử dụng: {formatBytes(storageInfo.usedBytes)}
          </span>
          <span className={`text-xs font-medium ${
            isFull ? 'text-red-600 dark:text-red-400' :
            isNearLimit ? 'text-orange-600 dark:text-orange-400' :
            'text-gray-600 dark:text-gray-400'
          }`}>
            {storageInfo.percentUsed.toFixed(1)}%
          </span>
        </div>
        
        <div className="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${
              isFull ? 'bg-red-500' :
              isNearLimit ? 'bg-orange-500' :
              'bg-blue-500'
            }`}
            style={{ width: `${Math.min(storageInfo.percentUsed, 100)}%` }}
          />
        </div>
      </div>
      
      {/* Storage details */}
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <span className="text-gray-500 dark:text-gray-400">Còn lại:</span>
          <div className={`font-medium ${
            isFull ? 'text-red-600 dark:text-red-400' :
            isNearLimit ? 'text-orange-600 dark:text-orange-400' :
            'text-green-600 dark:text-green-400'
          }`}>
            {formatBytes(remainingBytes)}
          </div>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Tổng cộng:</span>
          <div className="font-medium text-gray-800 dark:text-gray-200">
            {formatBytes(storageInfo.totalBytes)}
          </div>
        </div>
      </div>
      
      {/* Warning messages */}
      {isNearLimit && (
        <div className={`mt-3 p-2 rounded text-xs ${
          isFull 
            ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700'
            : 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-700'
        }`}>
          {isFull 
            ? '⚠️ Dung lượng gần hết! Hãy xóa bớt file để có thể upload thêm.'
            : '⚠️ Dung lượng sắp hết. Hãy cân nhắc xóa bớt file không cần thiết.'
          }
        </div>
      )}
    </div>
  );
};

export default StorageQuota;
