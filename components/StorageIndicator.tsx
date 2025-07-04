// components/StorageIndicator.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { FaHdd, FaInfoCircle, FaRedo, FaExclamationTriangle, FaCheckCircle } from 'react-icons/fa';
import { useStorageQuota } from '../hooks/useStorageQuota';

interface StorageIndicatorProps {
  refreshTrigger?: number;
  showLabel?: boolean;
  compact?: boolean;
}

const StorageIndicator: React.FC<StorageIndicatorProps> = ({ 
  refreshTrigger, 
  showLabel = true, 
  compact = false 
}) => {
  const { storageInfo, isLoading, refreshStorageQuota } = useStorageQuota();
  const [isClient, setIsClient] = useState<boolean>(false);
  const [showTooltip, setShowTooltip] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Format bytes cho hiển thị compact
  const formatBytesCompact = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
  };

  // Format bytes cho hiển thị đầy đủ
  const formatBytesFull = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshStorageQuota();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  // Load storage info sau khi component mount (không blocking)
  useEffect(() => {
    setIsClient(true);
    // Delay load storage để không block UI
    setTimeout(() => {
      refreshStorageQuota();
    }, 1000);
  }, [refreshStorageQuota]);

  // Refresh khi có trigger từ component cha (có delay)
  useEffect(() => {
    if (refreshTrigger !== undefined) {
      const timeoutId = setTimeout(() => {
        refreshStorageQuota();
      }, 2000); // Tăng delay để không ảnh hưởng performance
      return () => clearTimeout(timeoutId);
    }
  }, [refreshTrigger, refreshStorageQuota]);

  if (!isClient) {
    return null;
  }

  if (isLoading || !storageInfo) {
    return (
      <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
        <FaHdd className="w-4 h-4 animate-pulse" />
        {!compact && showLabel && <span>Đang tính...</span>}
      </div>
    );
  }

  const remainingBytes = storageInfo.totalBytes - storageInfo.usedBytes;
  const isNearLimit = storageInfo.percentUsed > 80;
  const isFull = storageInfo.percentUsed > 95;
  const isHealthy = storageInfo.percentUsed <= 60;

  const getStatusIcon = () => {
    if (isFull) return <FaExclamationTriangle className="w-3 h-3 text-red-500" />;
    if (isNearLimit) return <FaInfoCircle className="w-3 h-3 text-orange-500" />;
    return <FaCheckCircle className="w-3 h-3 text-green-500" />;
  };

  const getStatusColor = () => {
    if (isFull) return 'text-red-600 dark:text-red-400';
    if (isNearLimit) return 'text-orange-600 dark:text-orange-400';
    return 'text-green-600 dark:text-green-400';
  };

  if (compact) {
    return (
      <div 
        className="relative flex items-center space-x-1 cursor-pointer group"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <FaHdd className={`w-4 h-4 ${
          isFull ? 'text-red-500' : 
          isNearLimit ? 'text-orange-500' : 
          'text-gray-500 dark:text-gray-400'
        }`} />
        
        <span className={`text-xs font-medium ${getStatusColor()}`}>
          {formatBytesCompact(remainingBytes)}
        </span>

        {/* Compact Tooltip */}
        {showTooltip && (
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg whitespace-nowrap z-50">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                {getStatusIcon()}
                <span className="font-medium">Storage Status</span>
              </div>
              <div>Còn lại: <span className="font-medium">{formatBytesFull(remainingBytes)}</span></div>
              <div>Đã dùng: <span className="font-medium">{formatBytesFull(storageInfo.usedBytes)}</span></div>
              <div className="flex items-center space-x-2">
                <div className="w-20 bg-gray-600 rounded-full h-1.5">
                  <div 
                    className={`h-1.5 rounded-full transition-all ${
                      isFull ? 'bg-red-500' : 
                      isNearLimit ? 'bg-orange-500' : 
                      'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(storageInfo.percentUsed, 100)}%` }}
                  />
                </div>
                <span className="font-medium">{storageInfo.percentUsed.toFixed(1)}%</span>
              </div>
            </div>
            
            {/* Arrow */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-b-gray-900 dark:border-b-gray-700"></div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-3 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2">
      <div className="flex items-center space-x-2">
        <FaHdd className={`w-4 h-4 ${
          isFull ? 'text-red-500' : 
          isNearLimit ? 'text-orange-500' : 
          'text-blue-500'
        }`} />
        
        {showLabel && (
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Storage
          </span>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <div className="text-xs">
          <span className={`font-medium ${getStatusColor()}`}>
            {formatBytesCompact(remainingBytes)} còn lại
          </span>
          <span className="text-gray-500 dark:text-gray-400 ml-1">
            / {formatBytesCompact(storageInfo.totalBytes)}
          </span>
        </div>

        <div className="w-16 bg-gray-200 dark:bg-zinc-600 rounded-full h-1.5">
          <div 
            className={`h-1.5 rounded-full transition-all duration-300 ${
              isFull ? 'bg-red-500' : 
              isNearLimit ? 'bg-orange-500' : 
              'bg-blue-500'
            }`}
            style={{ width: `${Math.min(storageInfo.percentUsed, 100)}%` }}
          />
        </div>

        <span className={`text-xs font-medium ${getStatusColor()}`}>
          {storageInfo.percentUsed.toFixed(1)}%
        </span>
      </div>

      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
        title="Cập nhật dung lượng"
      >
        <FaRedo className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
};

export default StorageIndicator;
