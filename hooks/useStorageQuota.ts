// hooks/useStorageQuota.ts
import { useState, useCallback, useRef } from 'react';
import { storage } from '../lib/firebase';
import { ref, listAll, getMetadata } from 'firebase/storage';

interface StorageInfo {
  usedBytes: number;
  totalBytes: number;
  remainingBytes: number;
  percentUsed: number;
}

// Cache để tránh tính toán lại liên tục
const CACHE_DURATION = 60 * 1000; // 1 phút
let storageCache: { data: StorageInfo; timestamp: number } | null = null;

export const useStorageQuota = () => {
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const calculatingRef = useRef<boolean>(false);

  // Tính toán dung lượng đã sử dụng (đã tối ưu)
  const calculateStorageUsage = useCallback(async (): Promise<StorageInfo> => {
    // Kiểm tra cache trước
    if (storageCache && Date.now() - storageCache.timestamp < CACHE_DURATION) {
      return storageCache.data;
    }

    try {
      const storageRef = ref(storage, 'uploads/');
      let totalUsedBytes = 0;
      
      // Hàm đệ quy tối ưu hơn - chỉ tính top-level folders
      const calculateFolderSize = async (folderRef: any, maxDepth: number = 2): Promise<number> => {
        if (maxDepth <= 0) return 0;
        
        let folderSize = 0;
        
        try {
          const result = await listAll(folderRef);
          
          // Tính dung lượng của tất cả file trong folder hiện tại
          const filePromises = result.items.slice(0, 100).map(async (itemRef) => { // Giới hạn 100 file đầu tiên
            try {
              const metadata = await getMetadata(itemRef);
              return metadata.size || 0;
            } catch (error) {
              console.warn(`Không thể lấy metadata cho file: ${itemRef.fullPath}`, error);
              return 0;
            }
          });
          
          const fileSizes = await Promise.all(filePromises);
          folderSize = fileSizes.reduce((sum, size) => sum + size, 0);
          
          // Đệ quy tính dung lượng các subfolder (giảm depth)
          const subfolderPromises = result.prefixes.slice(0, 20).map(async (prefixRef) => { // Giới hạn 20 subfolder đầu tiên
            return await calculateFolderSize(prefixRef, maxDepth - 1);
          });
          
          const subfolderSizes = await Promise.all(subfolderPromises);
          folderSize += subfolderSizes.reduce((sum, size) => sum + size, 0);
          
        } catch (error) {
          console.warn(`Lỗi khi tính dung lượng folder: ${folderRef.fullPath}`, error);
        }
        
        return folderSize;
      };
      
      totalUsedBytes = await calculateFolderSize(storageRef);
      
      // Firebase Storage free tier: 5GB
      const totalBytes = 5 * 1024 * 1024 * 1024; // 5GB in bytes
      const percentUsed = (totalUsedBytes / totalBytes) * 100;
      
      const result = {
        usedBytes: totalUsedBytes,
        totalBytes,
        remainingBytes: Math.max(0, totalBytes - totalUsedBytes),
        percentUsed: Math.min(percentUsed, 100)
      };

      // Cập nhật cache
      storageCache = {
        data: result,
        timestamp: Date.now()
      };

      return result;
    } catch (error) {
      console.error('Lỗi khi tính dung lượng storage:', error);
      throw error;
    }
  }, []);

  // Refresh storage quota với debounce
  const refreshStorageQuota = useCallback(async () => {
    if (calculatingRef.current) return; // Tránh multiple calls
    
    try {
      calculatingRef.current = true;
      setIsLoading(true);
      setError(null);
      const info = await calculateStorageUsage();
      setStorageInfo(info);
    } catch (error) {
      console.error('Lỗi khi refresh storage quota:', error);
      setError('Không thể cập nhật thông tin dung lượng');
    } finally {
      setIsLoading(false);
      calculatingRef.current = false;
    }
  }, [calculateStorageUsage]);

  return {
    storageInfo,
    isLoading,
    error,
    refreshStorageQuota,
    calculateStorageUsage
  };
};
