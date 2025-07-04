// components/StorageDashboard.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { FaHdd, FaFile, FaFolder, FaChartPie, FaInfoCircle, FaRedo, FaExclamationTriangle, FaCheckCircle } from 'react-icons/fa';
import { useStorageQuota } from '../hooks/useStorageQuota';

interface StorageDashboardProps {
  refreshTrigger?: number;
}

const StorageDashboard: React.FC<StorageDashboardProps> = ({ refreshTrigger }) => {
  const { storageInfo, isLoading, error, refreshStorageQuota } = useStorageQuota();
  const [isClient, setIsClient] = useState<boolean>(false);
  const [showDetails, setShowDetails] = useState<boolean>(false);

  // Format bytes với đơn vị đầy đủ
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStorageRecommendation = (percentUsed: number) => {
    if (percentUsed > 95) {
      return {
        message: "Dung lượng gần hết! Hãy xóa bớt file không cần thiết.",
        color: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-50 dark:bg-red-900/20",
        borderColor: "border-red-200 dark:border-red-700",
        icon: <FaExclamationTriangle className="w-4 h-4 text-red-500" />
      };
    } else if (percentUsed > 80) {
      return {
        message: "Dung lượng sắp hết. Cân nhắc dọn dẹp file cũ.",
        color: "text-orange-600 dark:text-orange-400", 
        bgColor: "bg-orange-50 dark:bg-orange-900/20",
        borderColor: "border-orange-200 dark:border-orange-700",
        icon: <FaInfoCircle className="w-4 h-4 text-orange-500" />
      };
    } else if (percentUsed > 60) {
      return {
        message: "Dung lượng ở mức trung bình, vẫn còn nhiều chỗ trống.",
        color: "text-blue-600 dark:text-blue-400",
        bgColor: "bg-blue-50 dark:bg-blue-900/20", 
        borderColor: "border-blue-200 dark:border-blue-700",
        icon: <FaCheckCircle className="w-4 h-4 text-blue-500" />
      };
    } else {
      return {
        message: "Dung lượng còn rất nhiều, thoải mái upload file!",
        color: "text-green-600 dark:text-green-400",
        bgColor: "bg-green-50 dark:bg-green-900/20",
        borderColor: "border-green-200 dark:border-green-700", 
        icon: <FaCheckCircle className="w-4 h-4 text-green-500" />
      };
    }
  };

  useEffect(() => {
    setIsClient(true);
    refreshStorageQuota();
  }, [refreshStorageQuota]);

  useEffect(() => {
    if (refreshTrigger !== undefined) {
      const timeoutId = setTimeout(() => {
        refreshStorageQuota();
      }, 1500);
      return () => clearTimeout(timeoutId);
    }
  }, [refreshTrigger, refreshStorageQuota]);

  if (!isClient) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 p-6">
        <div className="flex items-center justify-center space-x-3">
          <FaHdd className="w-6 h-6 text-gray-400 animate-pulse" />
          <span className="text-gray-500 dark:text-gray-400">Đang tính toán dung lượng...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-zinc-800 rounded-lg border border-red-200 dark:border-red-700 p-6">
        <div className="flex items-center space-x-3 text-red-600 dark:text-red-400">
          <FaExclamationTriangle className="w-6 h-6" />
          <div>
            <p className="font-medium">Lỗi tính dung lượng</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!storageInfo) return null;

  const remainingBytes = storageInfo.totalBytes - storageInfo.usedBytes;
  const recommendation = getStorageRecommendation(storageInfo.percentUsed);

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <FaChartPie className="w-6 h-6 text-blue-500" />
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Tổng quan Storage
          </h3>
        </div>
        <button
          onClick={refreshStorageQuota}
          disabled={isLoading}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-700"
          title="Cập nhật dung lượng"
        >
          <FaRedo className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Storage Visual */}
      <div className="space-y-4">
        {/* Progress Ring or Bar */}
        <div className="relative">
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-3">
            <div 
              className={`h-3 rounded-full transition-all duration-500 ${
                storageInfo.percentUsed > 95 ? 'bg-red-500' :
                storageInfo.percentUsed > 80 ? 'bg-orange-500' :
                storageInfo.percentUsed > 60 ? 'bg-blue-500' :
                'bg-green-500'
              }`}
              style={{ width: `${Math.min(storageInfo.percentUsed, 100)}%` }}
            />
          </div>
          
          {/* Percentage overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
              {storageInfo.percentUsed.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Storage Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 dark:bg-zinc-900 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <FaFile className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Đã sử dụng</span>
            </div>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {formatBytes(storageInfo.usedBytes)}
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-zinc-900 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <FaFolder className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Còn lại</span>
            </div>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {formatBytes(remainingBytes)}
            </p>
          </div>
        </div>

        {/* Total Storage */}
        <div className="bg-gray-50 dark:bg-zinc-900 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <FaHdd className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Tổng dung lượng</span>
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {formatBytes(storageInfo.totalBytes)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Firebase Storage (Plan miễn phí)
          </p>
        </div>
      </div>

      {/* Recommendation */}
      <div className={`p-4 rounded-lg border ${recommendation.bgColor} ${recommendation.borderColor}`}>
        <div className="flex items-start space-x-3">
          {recommendation.icon}
          <div>
            <p className={`text-sm font-medium ${recommendation.color}`}>
              Khuyến nghị
            </p>
            <p className={`text-sm ${recommendation.color} mt-1`}>
              {recommendation.message}
            </p>
          </div>
        </div>
      </div>

      {/* Details toggle */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full text-left text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
      >
        {showDetails ? 'Ẩn chi tiết' : 'Xem thêm chi tiết'} →
      </button>

      {/* Detailed breakdown */}
      {showDetails && (
        <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-zinc-600">
          <h4 className="font-medium text-gray-800 dark:text-gray-200">Thông tin chi tiết</h4>
          
          <div className="grid grid-cols-1 gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Dung lượng upload tối đa/file:</span>
              <span className="font-medium">32 MB</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Số file có thể upload thêm (ước tính):</span>
              <span className="font-medium">
                {Math.floor(remainingBytes / (10 * 1024 * 1024))} file (10MB/file)
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Tỷ lệ sử dụng:</span>
              <span className="font-medium">{storageInfo.percentUsed.toFixed(2)}%</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Loại tài khoản:</span>
              <span className="font-medium">Firebase Free Tier</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StorageDashboard;
