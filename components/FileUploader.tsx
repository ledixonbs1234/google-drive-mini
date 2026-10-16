// components/FileUploader.tsx
'use client';

import { useDropzone } from 'react-dropzone';
import { useState, useCallback, useEffect } from 'react';
import { FaUpload } from 'react-icons/fa';
import { twMerge } from 'tailwind-merge';
import JSZip from 'jszip';
import { useFileUploadValidation } from '../hooks/useFileUploadValidation';
import { useStorageQuota } from '../hooks/useStorageQuota';
import { uploadFileToR2 } from '@/lib/storageClient';

interface FileUploaderProps {
  currentPath?: string;
  onUploadComplete?: () => void;
}

const EXECUTABLE_EXTENSIONS = ['exe', 'msi', 'bat', 'cmd', 'sh', 'app', 'dmg', 'deb', 'rpm', 'apk'];
const ARCHIVE_EXTENSIONS = ['zip', 'rar', '7z', 'tar', 'gz'];

export default function FileUploader({ currentPath = '', onUploadComplete }: FileUploaderProps) {
  const [uploadingFiles, setUploadingFiles] = useState<{ id: string; name: string; progress: number; status: 'pending' | 'zipping' | 'uploading' | 'error' | 'done' }[]>([]);
  
  const { validateFileUpload } = useFileUploadValidation();
  const { storageInfo, refreshStorageQuota } = useStorageQuota();

  useEffect(() => {
    const timer = setTimeout(() => {
      refreshStorageQuota();
    }, 500);
    return () => clearTimeout(timer);
  }, [refreshStorageQuota]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const zipFile = async (file: File): Promise<File> => {
    const zip = new JSZip();
    zip.file(file.name, file);
    const zipBlob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    });
    return new File([zipBlob], `${file.name}.zip`, { type: 'application/zip' });
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (storageInfo) {
      const totalFileSize = acceptedFiles.reduce((sum, file) => sum + file.size, 0);
      if (totalFileSize > storageInfo.remainingBytes) {
        alert(`Không đủ dung lượng! Cần ${formatBytes(totalFileSize)} nhưng chỉ còn ${formatBytes(storageInfo.remainingBytes)}.`);
        return;
      }
    }

    const initialFilesState = acceptedFiles.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      name: file.name,
      progress: 0,
      status: 'pending' as const
    }));

    setUploadingFiles(initialFilesState);

    const uploadPromises = initialFilesState.map(async (fileState, index) => {
      const originalFile = acceptedFiles[index];
      let fileToUpload: File = originalFile;
      const fileExtension = originalFile.name.slice(originalFile.name.lastIndexOf('.') + 1).toLowerCase();

      if (EXECUTABLE_EXTENSIONS.includes(fileExtension) && !ARCHIVE_EXTENSIONS.includes(fileExtension)) {
        setUploadingFiles(prev => prev.map(f => f.id === fileState.id ? { ...f, status: 'zipping' } : f));
        try {
          fileToUpload = await zipFile(originalFile);
        } catch (zipError) {
          setUploadingFiles(prev => prev.map(f => f.id === fileState.id ? { ...f, status: 'error', progress: -1 } : f));
          throw zipError;
        }
      }

      setUploadingFiles(prev => prev.map(f => f.id === fileState.id && f.status !== 'error' ? { ...f, status: 'uploading' } : f));

      try {
        await uploadFileToR2(fileToUpload, currentPath, (progress) => {
          setUploadingFiles(prev => prev.map(f => 
            f.id === fileState.id ? { ...f, progress } : f
          ));
        });

        setUploadingFiles(prev => prev.map(f => 
          f.id === fileState.id ? { ...f, status: 'done', progress: 100 } : f
        ));
      } catch (err) {
        setUploadingFiles(prev => prev.map(f => 
          f.id === fileState.id ? { ...f, status: 'error', progress: -1 } : f
        ));
        throw err;
      }
    });

    try {
      await Promise.all(uploadPromises);
      await refreshStorageQuota();
      onUploadComplete?.();
    } catch (error) {
      console.error("Lỗi upload:", error);
    }
  }, [currentPath, onUploadComplete, storageInfo, refreshStorageQuota]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: uploadingFiles.some(f => f.status === 'zipping' || f.status === 'uploading'),
  });

  const dropzoneClassName = twMerge(
    "p-6 border-2 border-dashed rounded-xl cursor-pointer text-center transition-colors duration-200",
    "border-gray-300 dark:border-gray-600",
    "bg-white dark:bg-zinc-800",
    isDragActive
      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
      : "hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-zinc-700",
    uploadingFiles.some(f => f.status === 'zipping' || f.status === 'uploading') ? "cursor-not-allowed opacity-70" : ""
  );

  const getStatusText = (status: string, progress: number) => {
    switch (status) {
      case 'pending': return 'Chờ xử lý...';
      case 'zipping': return 'Đang nén...';
      case 'uploading': return `${progress}%`;
      case 'error': return 'Lỗi!';
      case 'done': return 'Hoàn thành';
      default: return '';
    }
  };

  return (
    <div className="mb-6">
      <div {...getRootProps()} className={dropzoneClassName}>
        <input {...getInputProps()} disabled={uploadingFiles.some(f => f.status === 'zipping' || f.status === 'uploading')} />
        <FaUpload className="w-10 h-10 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
        {isDragActive ? (
          <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">Thả file vào đây...</p>
        ) : (
          <p className="text-gray-600 dark:text-gray-300">
            {uploadingFiles.some(f => f.status === 'zipping' || f.status === 'uploading')
              ? "Đang xử lý file..."
              : "Kéo & thả file hoặc click để chọn (Cloudflare R2)"}
          </p>
        )}
        {storageInfo && (
          <div className="mt-3 flex items-center justify-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
            <span>Còn lại: <strong className="text-blue-600 dark:text-blue-400">{formatBytes(storageInfo.remainingBytes)}</strong> / 10 GB</span>
            <span>|</span>
            <span>Đã dùng: {storageInfo.percentUsed.toFixed(1)}%</span>
          </div>
        )}
      </div>

      {uploadingFiles.length > 0 && (
        <div className="mt-4 space-y-3">
          <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300">Danh sách file xử lý:</h4>
          {uploadingFiles.map((file) => (
            <div key={file.id} className="text-sm border-b border-gray-200 dark:border-zinc-700 pb-2 last:border-b-0">
              <div className="flex justify-between items-center mb-1">
                <span className="text-gray-800 dark:text-gray-200 truncate mr-2" title={file.name}>
                  {file.name}
                </span>
                <span className={`font-medium text-xs px-1.5 py-0.5 rounded ${
                  file.status === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                  file.status === 'done' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                  'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                }`}>
                  {getStatusText(file.status, file.progress)}
                </span>
              </div>
              {(file.status === 'uploading' || file.status === 'done' || file.status === 'error') && file.progress >= 0 && (
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-1">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      file.status === 'error' ? 'bg-red-500' :
                      file.status === 'done' ? 'bg-green-500' :
                      'bg-blue-500'
                    }`}
                    style={{ width: `${file.progress}%` }}
                  ></div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
