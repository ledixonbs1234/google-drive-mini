// hooks/useStorageQuota.ts
import { useState, useCallback, useRef } from 'react';
import { StorageQuotaInfo, fetchR2StorageQuota } from '@/lib/storageClient';

export interface StorageInfo extends StorageQuotaInfo {}

export const useStorageQuota = () => {
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const calculatingRef = useRef<boolean>(false);

  const calculateStorageUsage = useCallback(async (): Promise<StorageInfo> => {
    try {
      const data = await fetchR2StorageQuota();
      return data;
    } catch (err: any) {
      console.error('Lỗi khi lấy thông tin storage quota Cloudflare R2:', err);
      throw err;
    }
  }, []);

  const refreshStorageQuota = useCallback(async () => {
    if (calculatingRef.current) return;

    try {
      calculatingRef.current = true;
      setIsLoading(true);
      setError(null);
      const info = await calculateStorageUsage();
      setStorageInfo(info);
    } catch (err: any) {
      console.error('Lỗi khi refresh storage quota:', err);
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
    calculateStorageUsage,
  };
};
