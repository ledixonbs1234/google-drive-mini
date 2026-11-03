// hooks/useFileUploadValidation.ts
import { useStorageQuota } from './useStorageQuota';

export const useFileUploadValidation = () => {
  const { storageInfo } = useStorageQuota();

  const validateFileUpload = (files: File[]): { 
    canUpload: boolean; 
    message: string; 
    totalSize: number;
    remainingSpace: number;
  } => {
    const totalFileSize = files.reduce((sum, file) => sum + file.size, 0);
    
    if (!storageInfo) {
      return {
        canUpload: true,
        message: 'Đang kiểm tra dung lượng...',
        totalSize: totalFileSize,
        remainingSpace: 0
      };
    }

    const remainingSpace = storageInfo.totalBytes - storageInfo.usedBytes;
    
    // Kiểm tra xem có đủ dung lượng không (Chốt chặn Khóa An Toàn 10 GB)
    if (totalFileSize > remainingSpace || storageInfo.isLocked) {
      const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
      };

      return {
        canUpload: false,
        message: `🛡️ KHÓA AN TOÀN BẢO VỆ THẺ: Cần thêm ${formatBytes(totalFileSize)} nhưng hạn mức an toàn miễn phí 10 GB chỉ còn ${formatBytes(remainingSpace)}. Ứng dụng đã khóa upload để tuyệt đối không trừ tiền vào thẻ ngân hàng của bạn!`,
        totalSize: totalFileSize,
        remainingSpace
      };
    }

    // Cảnh báo nếu upload sẽ làm storage gần hết
    const afterUploadPercent = ((storageInfo.usedBytes + totalFileSize) / storageInfo.totalBytes) * 100;
    
    if (afterUploadPercent > 95) {
      return {
        canUpload: true,
        message: 'Cảnh báo: Sau khi upload, dung lượng storage sẽ gần hết!',
        totalSize: totalFileSize,
        remainingSpace
      };
    }

    if (afterUploadPercent > 80) {
      return {
        canUpload: true,
        message: 'Upload thành công nhưng dung lượng storage sẽ >80%.',
        totalSize: totalFileSize,
        remainingSpace
      };
    }

    return {
      canUpload: true,
      message: 'File có thể upload.',
      totalSize: totalFileSize,
      remainingSpace
    };
  };

  return { validateFileUpload };
};
