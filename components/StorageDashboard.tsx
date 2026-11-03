// components/StorageDashboard.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { FaHdd, FaFile, FaFolder, FaChartPie, FaInfoCircle, FaRedo, FaExclamationTriangle, FaCheckCircle, FaShieldAlt } from 'react-icons/fa';
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
        message: "Dung lượng sắp chạm ngưỡng an toàn 10 GB! Upload sẽ bị khóa tự động để bảo vệ thẻ thanh toán của bạn.",
        color: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-50 dark:bg-red-900/20",
        borderColor: "border-red-200 dark:border-red-700",
        icon: <FaExclamationTriangle className="w-4 h-4 text-red-500" />
      };
    } else if (percentUsed > 80) {
      return {
        message: "Đã sử dụng hơn 80% hạn mức an toàn 10 GB miễn phí. Hãy xóa bớt file không cần thiết.",
        color: "text-orange-600 dark:text-orange-400", 
        bgColor: "bg-orange-50 dark:bg-orange-900/20",
        borderColor: "border-orange-200 dark:border-orange-700",
        icon: <FaInfoCircle className="w-4 h-4 text-orange-500" />
      };
    } else if (percentUsed > 60) {
      return {
        message: "Dung lượng ở mức an toàn. Chế độ Khóa Bảo Vệ Thẻ đang hoạt động tích cực.",
        color: "text-blue-600 dark:text-blue-400",
        bgColor: "bg-blue-50 dark:bg-blue-900/20", 
        borderColor: "border-blue-200 dark:border-blue-700",
        icon: <FaCheckCircle className="w-4 h-4 text-blue-500" />
      };
    } else {
      return {
        message: "Dung lượng còn rất nhiều chỗ trống. Đã khóa cứng mức 10 GB Free Tier, chi phí đảm bảo $0.00!",
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
            <FaShieldAlt className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Hạn mức an toàn ($0 phí thẻ)</span>
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <span>{formatBytes(storageInfo.totalBytes)}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              🛡️ Đã Khóa Cứng 10 GB Miễn Phí
            </span>
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">
            Chống phát sinh chi phí • $0 Phí băng thông Egress
          </p>
        </div>
      </div>

      {/* Safety Banner */}
      <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3.5 flex items-start gap-3">
        <FaShieldAlt className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-semibold text-emerald-900 dark:text-emerald-200">
            🛡️ Chế độ Bảo Vệ Thẻ Ngân Hàng: ĐANG HOẠT ĐỘNG
          </p>
          <p className="text-emerald-700 dark:text-emerald-300">
            Ứng dụng đã được khóa cứng tại mốc 10 GB dung lượng miễn phí của Cloudflare R2. Nếu file tải lên vượt quá hạn mức này, server sẽ tự động từ chối để tuyệt đối không trừ tiền vào thẻ của bạn.
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
              <span className="text-gray-600 dark:text-gray-400">Tổng số tệp lưu trữ:</span>
              <span className="font-medium">{storageInfo.totalObjects ?? '-'} tệp</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Loại tài khoản R2:</span>
              <span className="font-medium text-orange-600 dark:text-orange-400 font-semibold">
                {storageInfo.planType === 'paid' ? 'Cloudflare R2 Paid Plan' : 'Cloudflare R2 Free Tier'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Phí tải ra (Egress Fees):</span>
              <span className="font-medium text-green-600 dark:text-green-400">$0 (Miễn phí 100%)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StorageDashboard;
