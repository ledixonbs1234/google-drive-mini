// components/EnhancedFileUploader.tsx
'use client';

import { useState, useCallback, useRef } from 'react';
import { FaUpload, FaCloudUploadAlt, FaTimes, FaFile, FaImage, FaFilePdf, FaVideo, FaMusic, FaFileCode, FaFolder, FaCheckCircle, FaExclamationTriangle, FaInfoCircle } from 'react-icons/fa';
import { useStorageQuota } from '../hooks/useStorageQuota';
import { useFileUploadValidation } from '../hooks/useFileUploadValidation';
import { uploadFileToR2 } from '@/lib/storageClient';
import JSZip from 'jszip';

interface FileWithPreview {
  file: File;
  id: string;
  preview?: string;
  uploadProgress?: number;
  uploadStatus?: 'pending' | 'zipping' | 'uploading' | 'success' | 'error';
  errorMessage?: string;
}

interface EnhancedFileUploaderProps {
  currentPath: string;
  onUploadComplete: () => void;
  className?: string;
}

const EXECUTABLE_EXTENSIONS = ['exe', 'msi', 'bat', 'cmd', 'sh', 'app', 'dmg', 'deb', 'rpm', 'apk'];
const ARCHIVE_EXTENSIONS = ['zip', 'rar', '7z', 'tar', 'gz'];

const EnhancedFileUploader: React.FC<EnhancedFileUploaderProps> = ({ 
  currentPath, 
  onUploadComplete, 
  className = '' 
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showCompactView, setShowCompactView] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { storageInfo, refreshStorageQuota } = useStorageQuota();
  const { validateFileUpload } = useFileUploadValidation();

  const needsCompression = (fileName: string): boolean => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    return EXECUTABLE_EXTENSIONS.includes(ext || '');
  };

  const isArchive = (fileName: string): boolean => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    return ARCHIVE_EXTENSIONS.includes(ext || '');
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    processFiles(droppedFiles);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    processFiles(selectedFiles);
  }, []);

  const processFiles = useCallback(async (fileList: File[]) => {
    const newFiles: FileWithPreview[] = [];
    for (const file of fileList) {
      const validationResult = validateFileUpload([file]);
      if (!validationResult.canUpload) {
        alert(`File ${file.name}: ${validationResult.message}`);
        continue;
      }

      const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      const fileWithPreview: FileWithPreview = {
        file,
        id,
        uploadStatus: 'pending'
      };

      if (file.type.startsWith('image/')) {
        try {
          const preview = await generateImagePreview(file);
          fileWithPreview.preview = preview;
        } catch (error) {
          console.error('Error generating preview:', error);
        }
      }

      newFiles.push(fileWithPreview);
    }
    setFiles(prev => [...prev, ...newFiles]);
  }, [validateFileUpload]);

  const generateImagePreview = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const compressFile = async (file: File): Promise<File> => {
    const zip = new JSZip();
    zip.file(file.name, file);
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const zipName = `${file.name}.zip`;
    return new File([zipBlob], zipName, { type: 'application/zip' });
  };

  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const uploadFile = async (fileWithPreview: FileWithPreview): Promise<void> => {
    const { file, id } = fileWithPreview;
    let fileToUpload = file;

    try {
      if (needsCompression(file.name)) {
        setFiles(prev => prev.map(f => 
          f.id === id ? { ...f, uploadStatus: 'zipping' as const } : f
        ));
        fileToUpload = await compressFile(file);
      }

      setFiles(prev => prev.map(f => 
        f.id === id ? { ...f, uploadStatus: 'uploading' as const, uploadProgress: 0 } : f
      ));

      // Upload lên Cloudflare R2 qua API
      await uploadFileToR2(fileToUpload, currentPath, (progress) => {
        setFiles(prev => prev.map(f => 
          f.id === id ? { ...f, uploadProgress: progress } : f
        ));
      });

      setFiles(prev => prev.map(f => 
        f.id === id ? { ...f, uploadStatus: 'success' as const, uploadProgress: 100 } : f
      ));
    } catch (error: any) {
      console.error('Upload failed:', error);
      setFiles(prev => prev.map(f => 
        f.id === id ? { 
          ...f, 
          uploadStatus: 'error' as const, 
          errorMessage: error?.message || 'Upload failed' 
        } : f
      ));
    }
  };

  const uploadFiles = useCallback(async () => {
    if (files.length === 0) return;

    if (storageInfo) {
      const totalSize = files.reduce((sum, f) => sum + f.file.size, 0);
      if (storageInfo.remainingBytes < totalSize) {
        alert('Không đủ dung lượng để upload tất cả files này!');
        return;
      }
    }

    setIsUploading(true);

    const pendingFiles = files.filter(f => f.uploadStatus === 'pending' || f.uploadStatus === 'error');
    const uploadPromises = pendingFiles.map(uploadFile);
    await Promise.all(uploadPromises);

    setIsUploading(false);
    refreshStorageQuota();
    onUploadComplete();

    setTimeout(() => {
      setFiles(prev => prev.filter(f => f.uploadStatus !== 'success'));
    }, 3000);
  }, [files, storageInfo, refreshStorageQuota, onUploadComplete, currentPath]);

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <FaImage className="w-6 h-6 text-blue-500" />;
    if (file.type.startsWith('video/')) return <FaVideo className="w-6 h-6 text-red-500" />;
    if (file.type.startsWith('audio/')) return <FaMusic className="w-6 h-6 text-green-500" />;
    if (file.type === 'application/pdf') return <FaFilePdf className="w-6 h-6 text-red-600" />;
    if (file.type.includes('text/') || file.name.endsWith('.md')) return <FaFileCode className="w-6 h-6 text-purple-500" />;
    return <FaFile className="w-6 h-6 text-gray-500" />;
  };

  const getStatusIcon = (status: FileWithPreview['uploadStatus']) => {
    switch (status) {
      case 'success':
        return <FaCheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <FaExclamationTriangle className="w-4 h-4 text-red-500" />;
      case 'uploading':
        return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>;
      case 'zipping':
        return <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>;
      default:
        return null;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (showCompactView) {
    return (
      <div className={`w-full ${className}`}>
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-zinc-800 rounded-lg">
          <div className="flex items-center space-x-3">
            <FaUpload className="w-5 h-5 text-gray-500" />
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {files.length > 0 ? `${files.length} files chọn` : 'Chưa có file nào'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            {storageInfo && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatFileSize(storageInfo.remainingBytes)} còn lại
              </span>
            )}
            <button
              onClick={() => setShowCompactView(false)}
              className="text-blue-500 hover:text-blue-600 text-sm"
            >
              Mở rộng
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-200">
          Upload Files (Cloudflare R2)
        </h3>
        <button
          onClick={() => setShowCompactView(true)}
          className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          Thu gọn
        </button>
      </div>

      <div
        className={`relative border-2 border-dashed rounded-lg p-8 transition-all duration-200 ${
          isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-105'
            : 'border-gray-300 dark:border-zinc-600 hover:border-gray-400 dark:hover:border-zinc-500'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className={`transition-all duration-200 ${isDragging ? 'scale-110' : ''}`}>
            <FaCloudUploadAlt className={`w-16 h-16 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
          </div>
          
          <div className="text-center">
            <p className="text-lg font-medium text-gray-700 dark:text-gray-200">
              {isDragging ? 'Thả files vào đây' : 'Kéo & thả files vào đây'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              hoặc{' '}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-blue-500 hover:text-blue-600 font-medium underline"
              >
                chọn files
              </button>
            </p>
          </div>
          
          {storageInfo && (
            <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
              <FaInfoCircle className="w-3 h-3" />
              <span>Dung lượng còn lại: {formatFileSize(storageInfo.remainingBytes)} / 10 GB</span>
            </div>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {files.length > 0 && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-md font-medium text-gray-700 dark:text-gray-200">
              Files đã chọn ({files.length})
            </h4>
            {files.length > 0 && !isUploading && (
              <button
                onClick={uploadFiles}
                disabled={files.every(f => f.uploadStatus === 'success')}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                <FaUpload className="w-4 h-4" />
                <span>Upload tất cả</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 max-h-80 overflow-y-auto">
            {files.map((fileWithPreview) => (
              <div
                key={fileWithPreview.id}
                className="flex items-center space-x-4 p-3 bg-gray-50 dark:bg-zinc-800 rounded-lg"
              >
                <div className="flex-shrink-0">
                  {fileWithPreview.preview ? (
                    <img
                      src={fileWithPreview.preview}
                      alt={fileWithPreview.file.name}
                      className="w-12 h-12 object-cover rounded"
                    />
                  ) : (
                    <div className="w-12 h-12 flex items-center justify-center">
                      {getFileIcon(fileWithPreview.file)}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {fileWithPreview.file.name}
                    </p>
                    {needsCompression(fileWithPreview.file.name) && (
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                        Sẽ nén
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatFileSize(fileWithPreview.file.size)}
                  </p>
                  
                  {fileWithPreview.uploadStatus === 'zipping' && (
                    <p className="text-xs text-yellow-600 mt-1">Đang nén file...</p>
                  )}
                  
                  {fileWithPreview.uploadStatus === 'uploading' && (
                    <div className="mt-2 w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${fileWithPreview.uploadProgress || 0}%` }}
                      ></div>
                    </div>
                  )}
                  
                  {fileWithPreview.uploadStatus === 'error' && (
                    <p className="text-xs text-red-500 mt-1">
                      {fileWithPreview.errorMessage}
                    </p>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  {getStatusIcon(fileWithPreview.uploadStatus)}
                  
                  {!['uploading', 'zipping'].includes(fileWithPreview.uploadStatus || '') && (
                    <button
                      onClick={() => removeFile(fileWithPreview.id)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <FaTimes className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedFileUploader;
