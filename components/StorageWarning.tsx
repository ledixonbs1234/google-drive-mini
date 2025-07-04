// components/StorageWarning.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { FaExclamationTriangle, FaTimes, FaTrash } from 'react-icons/fa';
import { useStorageQuota } from '../hooks/useStorageQuota';

interface StorageWarningProps {
  refreshTrigger?: number;
}

const StorageWarning: React.FC<StorageWarningProps> = ({ refreshTrigger }) => {
  const { storageInfo, refreshStorageQuota } = useStorageQuota();
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [isClient, setIsClient] = useState<boolean>(false);

  useEffect(() => {
    setIsClient(true);
    refreshStorageQuota();
  }, [refreshStorageQuota]);

  useEffect(() => {
    if (refreshTrigger !== undefined) {
      refreshStorageQuota();
      // Reset dismissed state khi có refresh trigger
      setIsDismissed(false);
    }
  }, [refreshTrigger, refreshStorageQuota]);

  if (!isClient || !storageInfo || isDismissed) {
    return null;
  }

  const isNearLimit = storageInfo.percentUsed > 80;
  const isFull = storageInfo.percentUsed > 95;

  if (!isNearLimit) {
    return null;
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const remainingBytes = storageInfo.totalBytes - storageInfo.usedBytes;

  return (
    <div className={`mb-4 p-4 rounded-lg border ${
      isFull 
        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-800 dark:text-red-200'
        : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700 text-orange-800 dark:text-orange-200'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <FaExclamationTriangle className={`w-5 h-5 mt-0.5 ${
            isFull ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'
          }`} />
          
          <div className="flex-1">
            <h4 className="font-semibold text-sm mb-1">
              {isFull ? 'Dung lượng storage gần hết!' : 'Cảnh báo dung lượng storage'}
            </h4>
            
            <p className="text-sm mb-3">
              {isFull 
                ? `Bạn chỉ còn lại ${formatBytes(remainingBytes)} dung lượng. Hãy xóa bớt file để có thể upload thêm.`
                : `Bạn đã sử dụng ${storageInfo.percentUsed.toFixed(1)}% dung lượng storage. Còn lại ${formatBytes(remainingBytes)}.`
              }
            </p>
            
            <div className="flex items-center space-x-4 text-xs">
              <div className="flex items-center space-x-2">
                <span>Tiến trình:</span>
                <div className="w-24 bg-white dark:bg-gray-600 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      isFull ? 'bg-red-500' : 'bg-orange-500'
                    }`}
                    style={{ width: `${Math.min(storageInfo.percentUsed, 100)}%` }}
                  />
                </div>
                <span className="font-medium">
                  {storageInfo.percentUsed.toFixed(1)}%
                </span>
              </div>
            </div>
            
            {isFull && (
              <div className="mt-3 flex items-center space-x-2 text-xs">
                <FaTrash className="w-3 h-3" />
                <span>Gợi ý: Xóa những file lớn hoặc không cần thiết để giải phóng dung lượng.</span>
              </div>
            )}
          </div>
        </div>
        
        <button
          onClick={() => setIsDismissed(true)}
          className={`p-1 rounded-md hover:bg-white/50 dark:hover:bg-gray-600/50 transition-colors ${
            isFull ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'
          }`}
          title="Đóng cảnh báo"
        >
          <FaTimes className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default StorageWarning;
