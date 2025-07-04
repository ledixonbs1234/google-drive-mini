// components/DragDropUploader.tsx
'use client';

import { useState, useCallback, useRef } from 'react';
import { FaUpload, FaCloudUploadAlt, FaTimes, FaFile, FaImage, FaFilePdf, FaVideo, FaMusic, FaFileCode, FaFolder, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import { uploadBytes, ref, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { useStorageQuota } from '../hooks/useStorageQuota';

interface FileWithPreview {
  file: File;
  id: string;
  preview?: string;
  uploadProgress?: number;
  uploadStatus?: 'pending' | 'uploading' | 'success' | 'error';
  errorMessage?: string;
}

interface DragDropUploaderProps {
  currentPath: string;
  onUploadComplete: () => void;
  className?: string;
}

const DragDropUploader: React.FC<DragDropUploaderProps> = ({ 
  currentPath, 
  onUploadComplete, 
  className = '' 
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { storageInfo, isLoading, refreshStorageQuota } = useStorageQuota();

  // Drag & Drop handlers
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

  // File selection handler
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    processFiles(selectedFiles);
  }, []);

  // Process files with preview generation
  const processFiles = useCallback(async (fileList: File[]) => {
    const newFiles: FileWithPreview[] = [];

    for (const file of fileList) {
      const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      const fileWithPreview: FileWithPreview = {
        file,
        id,
        uploadStatus: 'pending'
      };

      // Generate preview for images
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
  }, []);

  // Generate image preview
  const generateImagePreview = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Remove file from list
  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  // Upload files
  const uploadFiles = useCallback(async () => {
    if (files.length === 0) return;

    // Check storage quota
    if (storageInfo) {
      const totalSize = files.reduce((sum, f) => sum + f.file.size, 0);
      if (storageInfo.remainingBytes < totalSize) {
        alert('Không đủ dung lượng để upload tất cả files này!');
        return;
      }
    }

    setIsUploading(true);

    const uploadPromises = files.map(async (fileWithPreview) => {
      const { file, id } = fileWithPreview;
      
      try {
        // Update status to uploading
        setFiles(prev => prev.map(f => 
          f.id === id ? { ...f, uploadStatus: 'uploading' as const, uploadProgress: 0 } : f
        ));

        const storageRef = ref(storage, `uploads/${currentPath}${file.name}`);
        
        // Upload with progress tracking
        const uploadTask = uploadBytes(storageRef, file);
        
        // Simulate progress (Firebase doesn't provide real-time progress for uploadBytes)
        const progressInterval = setInterval(() => {
          setFiles(prev => prev.map(f => 
            f.id === id ? { 
              ...f, 
              uploadProgress: Math.min((f.uploadProgress || 0) + Math.random() * 30, 90) 
            } : f
          ));
        }, 200);

        await uploadTask;
        clearInterval(progressInterval);

        // Update status to success
        setFiles(prev => prev.map(f => 
          f.id === id ? { ...f, uploadStatus: 'success' as const, uploadProgress: 100 } : f
        ));

      } catch (error) {
        console.error('Upload failed:', error);
        setFiles(prev => prev.map(f => 
          f.id === id ? { 
            ...f, 
            uploadStatus: 'error' as const, 
            errorMessage: error instanceof Error ? error.message : 'Upload failed'
          } : f
        ));
      }
    });

    await Promise.all(uploadPromises);
    
    setIsUploading(false);
    refreshStorageQuota();
    onUploadComplete();
    
    // Clear successful uploads after a delay
    setTimeout(() => {
      setFiles(prev => prev.filter(f => f.uploadStatus !== 'success'));
    }, 3000);
  }, [files, currentPath, storageInfo, refreshStorageQuota, onUploadComplete]);

  // Get file icon
  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <FaImage className="w-6 h-6 text-blue-500" />;
    if (file.type.startsWith('video/')) return <FaVideo className="w-6 h-6 text-red-500" />;
    if (file.type.startsWith('audio/')) return <FaMusic className="w-6 h-6 text-green-500" />;
    if (file.type === 'application/pdf') return <FaFilePdf className="w-6 h-6 text-red-600" />;
    if (file.type.includes('text/') || file.name.endsWith('.md')) return <FaFileCode className="w-6 h-6 text-purple-500" />;
    return <FaFile className="w-6 h-6 text-gray-500" />;
  };

  // Get status icon
  const getStatusIcon = (status: FileWithPreview['uploadStatus']) => {
    switch (status) {
      case 'success':
        return <FaCheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <FaExclamationTriangle className="w-4 h-4 text-red-500" />;
      case 'uploading':
        return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>;
      default:
        return null;
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Drag & Drop Zone */}
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
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Dung lượng còn lại: {formatFileSize(storageInfo.remainingBytes)}
            </div>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-200">
              Files đã chọn ({files.length})
            </h3>
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
                {/* File Icon/Preview */}
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

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {fileWithPreview.file.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatFileSize(fileWithPreview.file.size)}
                  </p>
                  
                  {/* Progress Bar */}
                  {fileWithPreview.uploadStatus === 'uploading' && (
                    <div className="mt-2 w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${fileWithPreview.uploadProgress || 0}%` }}
                      ></div>
                    </div>
                  )}
                  
                  {/* Error Message */}
                  {fileWithPreview.uploadStatus === 'error' && (
                    <p className="text-xs text-red-500 mt-1">
                      {fileWithPreview.errorMessage}
                    </p>
                  )}
                </div>

                {/* Status & Actions */}
                <div className="flex items-center space-x-2">
                  {getStatusIcon(fileWithPreview.uploadStatus)}
                  
                  {fileWithPreview.uploadStatus !== 'uploading' && (
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

export default DragDropUploader;
