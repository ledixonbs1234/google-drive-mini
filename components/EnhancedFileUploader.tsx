// components/EnhancedFileUploader.tsx
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  FaUpload,
  FaCloudUploadAlt,
  FaTimes,
  FaFile,
  FaImage,
  FaFilePdf,
  FaVideo,
  FaMusic,
  FaFileCode,
  FaFolderOpen,
  FaCheckCircle,
  FaExclamationTriangle,
  FaInfoCircle,
  FaStopCircle,
  FaPaste,
  FaChevronDown,
  FaChevronUp,
} from 'react-icons/fa';
import { useStorageQuota } from '../hooks/useStorageQuota';
import { useFileUploadValidation } from '../hooks/useFileUploadValidation';
import { uploadFileToR2 } from '@/lib/storageClient';
import { useAppStore } from '../store/useAppStore';
import JSZip from 'jszip';

interface FileWithPreview {
  file: File;
  relativePath?: string; // Ví dụ "FolderA/SubB/photo.jpg"
  id: string;
  preview?: string;
  uploadProgress?: number;
  uploadStatus?: 'pending' | 'zipping' | 'uploading' | 'success' | 'error' | 'cancelled';
  errorMessage?: string;
}

interface EnhancedFileUploaderProps {
  currentPath: string;
  onUploadComplete: () => void;
  className?: string;
}

const EXECUTABLE_EXTENSIONS = ['exe', 'msi', 'bat', 'cmd', 'sh', 'app', 'dmg', 'deb', 'rpm', 'apk'];

/**
 * Đệ quy đọc toàn bộ files bên trong thư mục được kéo-thả (FileSystemEntry API)
 */
async function readAllDroppedEntries(dataTransferItemList: DataTransferItemList): Promise<Array<{ file: File; relativePath?: string }>> {
  const collected: Array<{ file: File; relativePath?: string }> = [];

  const readEntry = async (entry: any, parentPath = ''): Promise<void> => {
    if (!entry) return;
    if (entry.isFile) {
      await new Promise<void>((resolve) => {
        entry.file(
          (file: File) => {
            const rel = parentPath ? `${parentPath}${file.name}` : undefined;
            collected.push({ file, relativePath: rel });
            resolve();
          },
          () => resolve()
        );
      });
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      const allChildEntries: any[] = [];

      const readBatch = async (): Promise<void> => {
        const batch: any[] = await new Promise((resolve) => {
          dirReader.readEntries(
            (entries: any[]) => resolve(entries || []),
            () => resolve([])
          );
        });
        if (batch.length > 0) {
          allChildEntries.push(...batch);
          await readBatch();
        }
      };

      await readBatch();
      const nextParent = `${parentPath}${entry.name}/`;
      for (const child of allChildEntries) {
        await readEntry(child, nextParent);
      }
    }
  };

  const entries: any[] = [];
  for (let i = 0; i < dataTransferItemList.length; i++) {
    const item = dataTransferItemList[i];
    if (item.kind === 'file') {
      const webkitEntry = (item as any).webkitGetAsEntry?.();
      if (webkitEntry) {
        entries.push(webkitEntry);
      } else {
        const f = item.getAsFile();
        if (f) collected.push({ file: f });
      }
    }
  }

  for (const entry of entries) {
    await readEntry(entry, '');
  }

  return collected;
}

const EnhancedFileUploader: React.FC<EnhancedFileUploaderProps> = ({
  currentPath,
  onUploadComplete,
  className = '',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showCompactView, setShowCompactView] = useState(false);
  const [pasteBanner, setPasteBanner] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  const { storageInfo, refreshStorageQuota } = useStorageQuota();
  const { validateFileUpload } = useFileUploadValidation();
  const settings = useAppStore((state) => state.settings);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const markUploadedKeys = useAppStore((state) => state.markUploadedKeys);

  const needsCompression = useCallback(
    (fileName: string): boolean => {
      if (!settings.compressionEnabled) return false;
      const ext = fileName.split('.').pop()?.toLowerCase();
      return EXECUTABLE_EXTENSIONS.includes(ext || '');
    },
    [settings.compressionEnabled]
  );

  const generateImagePreview = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const processIncomingEntries = useCallback(
    async (incoming: Array<{ file: File; relativePath?: string }>) => {
      if (incoming.length === 0) return;

      const rawFiles = incoming.map((i) => i.file);
      const validationResult = validateFileUpload(rawFiles);
      if (!validationResult.canUpload) {
        alert(validationResult.message);
        return;
      }

      const newItems: FileWithPreview[] = [];
      for (const entry of incoming) {
        const { file, relativePath } = entry;
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const item: FileWithPreview = {
          file,
          relativePath: relativePath || (file as any).webkitRelativePath || undefined,
          id,
          uploadStatus: 'pending',
        };

        // Chỉ tạo ảnh preview nếu số lượng ít (< 25 files) và file nhỏ (< 8MB) để không giật UI
        if (incoming.length <= 25 && file.type.startsWith('image/') && file.size < 8 * 1024 * 1024) {
          try {
            item.preview = await generateImagePreview(file);
          } catch {
            // Bỏ qua lỗi tạo thumbnail
          }
        }

        newItems.push(item);
      }

      setFiles((prev) => [...prev, ...newItems]);
      setShowCompactView(false);
    },
    [validateFileUpload]
  );

  // Lắng nghe sự kiện Ctrl+V (Paste ảnh chụp màn hình hoặc file từ clipboard)
  useEffect(() => {
    const handleWindowPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.closest('[role="dialog"]'))
      ) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      const pastedFiles: Array<{ file: File }> = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const blob = item.getAsFile();
          if (blob) {
            const ext = blob.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
            const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const hasCustomName = blob.name && blob.name !== 'image.png';
            const finalName = hasCustomName ? blob.name : `clipboard-${stamp}.${ext}`;
            const namedFile = new File([blob], finalName, { type: blob.type });
            pastedFiles.push({ file: namedFile });
          }
        }
      }

      if (pastedFiles.length > 0) {
        e.preventDefault();
        processIncomingEntries(pastedFiles);
        setPasteBanner(`Đã dán ${pastedFiles.length} tệp từ Clipboard! Nhấn "Upload tất cả" để tải lên.`);
        setTimeout(() => setPasteBanner(null), 4000);
      }
    };

    window.addEventListener('paste', handleWindowPaste);
    return () => window.removeEventListener('paste', handleWindowPaste);
  }, [processIncomingEntries]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    // Bỏ qua nếu đang kéo file nội bộ trong FileList
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes('Files')) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        const entries = await readAllDroppedEntries(e.dataTransfer.items);
        await processIncomingEntries(entries);
      } else {
        const droppedFiles = Array.from(e.dataTransfer.files).map((file) => ({ file }));
        await processIncomingEntries(droppedFiles);
      }
    },
    [processIncomingEntries]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(e.target.files || []).map((file) => ({
        file,
        relativePath: (file as any).webkitRelativePath || undefined,
      }));
      processIncomingEntries(selected);
      e.target.value = '';
    },
    [processIncomingEntries]
  );

  const compressFile = async (file: File): Promise<File> => {
    const zip = new JSZip();
    zip.file(file.name, file);
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    return new File([zipBlob], `${file.name}.zip`, { type: 'application/zip' });
  };

  const cancelSingleUpload = useCallback((id: string) => {
    const controller = abortControllersRef.current.get(id);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(id);
    }
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, uploadStatus: 'cancelled', errorMessage: 'Đã hủy tải lên' } : f
      )
    );
  }, []);

  const cancelAllUploads = useCallback(() => {
    abortControllersRef.current.forEach((ctrl) => ctrl.abort());
    abortControllersRef.current.clear();
    setFiles((prev) =>
      prev.map((f) =>
        f.uploadStatus === 'uploading' || f.uploadStatus === 'pending'
          ? { ...f, uploadStatus: 'cancelled', errorMessage: 'Đã hủy' }
          : f
      )
    );
    setIsUploading(false);
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const clearQueue = useCallback(() => {
    setFiles((prev) => prev.filter((f) => f.uploadStatus === 'uploading' || f.uploadStatus === 'zipping'));
  }, []);

  const uploadSingleItem = async (fileWithPreview: FileWithPreview): Promise<void> => {
    const { file, id, relativePath } = fileWithPreview;
    let fileToUpload = file;
    let effectiveRelPath = relativePath;

    const controller = new AbortController();
    abortControllersRef.current.set(id, controller);

    try {
      if (needsCompression(file.name)) {
        setFiles((prev) =>
          prev.map((f) => (f.id === id ? { ...f, uploadStatus: 'zipping' } : f))
        );
        fileToUpload = await compressFile(file);
        if (effectiveRelPath) {
          effectiveRelPath = `${effectiveRelPath}.zip`;
        }
      }

      setFiles((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, uploadStatus: 'uploading', uploadProgress: 0, errorMessage: undefined } : f
        )
      );

      const uploaded = await uploadFileToR2(
        fileToUpload,
        currentPath,
        (progress) => {
          setFiles((prev) =>
            prev.map((f) => (f.id === id ? { ...f, uploadProgress: progress } : f))
          );
        },
        {
          signal: controller.signal,
          relativePath: effectiveRelPath,
          conflictMode: settings.conflictMode,
        }
      );

      if (uploaded.key) {
        const keysToMark = [uploaded.key];
        if (effectiveRelPath && effectiveRelPath.includes('/')) {
          const topSubFolder = effectiveRelPath.split('/')[0];
          const cleanCurr = currentPath ? (currentPath.endsWith('/') ? currentPath : `${currentPath}/`) : '';
          keysToMark.push(`uploads/${cleanCurr}${topSubFolder}/`);
        }
        markUploadedKeys(keysToMark);
      }

      setFiles((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, uploadStatus: 'success', uploadProgress: 100 } : f
        )
      );
    } catch (error: any) {
      const isCancelled = error?.message === 'Đã hủy tải lên';
      setFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? {
                ...f,
                uploadStatus: isCancelled ? 'cancelled' : 'error',
                errorMessage: error?.message || 'Upload thất bại',
              }
            : f
        )
      );
    } finally {
      abortControllersRef.current.delete(id);
    }
  };

  const uploadFiles = useCallback(async () => {
    const pendingFiles = files.filter(
      (f) => f.uploadStatus === 'pending' || f.uploadStatus === 'error' || f.uploadStatus === 'cancelled'
    );
    if (pendingFiles.length === 0) return;

    if (storageInfo) {
      const totalSize = pendingFiles.reduce((sum, f) => sum + f.file.size, 0);
      if (storageInfo.remainingBytes < totalSize) {
        alert('Không đủ dung lượng an toàn (10 GB) để upload tất cả các tệp này!');
        return;
      }
    }

    setIsUploading(true);

    // Hàng đợi giới hạn số luồng upload đồng thời (mặc định 3) để đường truyền ổn định
    const concurrency = Math.max(1, Math.min(settings.maxConcurrentUploads || 3, 6));
    let index = 0;

    const worker = async () => {
      while (index < pendingFiles.length) {
        const currentIdx = index++;
        const target = pendingFiles[currentIdx];
        if (!target) break;
        await uploadSingleItem(target);
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, pendingFiles.length) }, () => worker());
    await Promise.all(workers);

    setIsUploading(false);
    refreshStorageQuota();
    onUploadComplete();

    setTimeout(() => {
      setFiles((prev) => prev.filter((f) => f.uploadStatus !== 'success'));
    }, 2500);
  }, [files, storageInfo, settings.maxConcurrentUploads, settings.conflictMode, currentPath, refreshStorageQuota, onUploadComplete]);

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <FaImage className="w-5 h-5 text-blue-500" />;
    if (file.type.startsWith('video/')) return <FaVideo className="w-5 h-5 text-rose-500" />;
    if (file.type.startsWith('audio/')) return <FaMusic className="w-5 h-5 text-emerald-500" />;
    if (file.type === 'application/pdf') return <FaFilePdf className="w-5 h-5 text-red-600" />;
    if (file.type.includes('text/') || file.name.endsWith('.md')) return <FaFileCode className="w-5 h-5 text-purple-500" />;
    return <FaFile className="w-5 h-5 text-gray-500" />;
  };

  const getStatusIcon = (status: FileWithPreview['uploadStatus']) => {
    switch (status) {
      case 'success':
        return <FaCheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
      case 'cancelled':
        return <FaExclamationTriangle className="w-4 h-4 text-red-500" />;
      case 'uploading':
        return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      case 'zipping':
        return <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />;
      default:
        return null;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (showCompactView) {
    return (
      <div className={`w-full mb-4 ${className}`}>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/70'
          }`}
        >
          <div className="flex items-center space-x-3">
            <FaCloudUploadAlt className="w-5 h-5 text-blue-500" />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Kéo thả file/thư mục hoặc nhấn <kbd className="px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-zinc-700 rounded">Ctrl+V</kbd> để dán ảnh
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md"
            >
              + Chọn tệp
            </button>
            <button
              onClick={() => folderInputRef.current?.click()}
              className="px-2.5 py-1 text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-md"
            >
              + Tải thư mục
            </button>
            <button
              onClick={() => setShowCompactView(false)}
              className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              title="Mở rộng khung tải lên"
            >
              <FaChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          // @ts-expect-error webkitdirectory is standard in modern browsers
          webkitdirectory=""
          directory=""
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>
    );
  }

  return (
    <div className={`w-full mb-5 ${className}`}>
      {pasteBanner && (
        <div className="mb-3 px-4 py-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between text-sm text-blue-800 dark:text-blue-200">
          <span className="flex items-center gap-2">
            <FaPaste className="w-4 h-4" />
            {pasteBanner}
          </span>
          <button onClick={() => setPasteBanner(null)} className="text-blue-500 hover:text-blue-700">
            <FaTimes className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
            Tải lên kho lưu trữ chung
          </h3>
          <select
            value={settings.conflictMode}
            onChange={(e) => updateSettings({ conflictMode: e.target.value as 'rename' | 'overwrite' })}
            className="text-xs border border-gray-300 dark:border-zinc-600 rounded-md px-2 py-1 bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300"
            title="Cách xử lý khi tên file tải lên bị trùng"
          >
            <option value="rename">Trùng tên: Tự thêm số (1)</option>
            <option value="overwrite">Trùng tên: Ghi đè file cũ</option>
          </select>
        </div>

        <button
          onClick={() => setShowCompactView(true)}
          className="text-xs flex items-center gap-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <span>Thu gọn</span>
          <FaChevronUp className="w-3 h-3" />
        </button>
      </div>

      <div
        className={`relative border-2 border-dashed rounded-xl p-6 transition-all duration-200 ${
          isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-[1.01]'
            : 'border-gray-300 dark:border-zinc-600 hover:border-blue-400 dark:hover:border-zinc-500 bg-gray-50/50 dark:bg-zinc-800/30'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center space-y-3">
          <FaCloudUploadAlt className={`w-12 h-12 transition-transform ${isDragging ? 'text-blue-500 scale-110' : 'text-gray-400'}`} />

          <div className="text-center">
            <p className="text-base font-medium text-gray-700 dark:text-gray-200">
              {isDragging ? 'Thả tệp hoặc thư mục vào đây!' : 'Kéo & thả tệp hoặc nguyên cả thư mục vào đây'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-2.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors inline-flex items-center gap-1.5"
              >
                <FaUpload className="w-3 h-3" />
                Chọn tệp tin
              </button>
              <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                className="px-3 py-1.5 text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-md transition-colors inline-flex items-center gap-1.5"
              >
                <FaFolderOpen className="w-3.5 h-3.5" />
                Tải cả thư mục
              </button>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                hoặc nhấn <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-zinc-700 rounded text-[11px]">Ctrl+V</kbd> để dán ảnh chụp màn hình
              </span>
            </div>
          </div>

          {storageInfo && (
            <div className="flex items-center space-x-1.5 text-xs text-gray-500 dark:text-gray-400">
              <FaInfoCircle className="w-3 h-3 text-emerald-500" />
              <span>
                Còn trống: <strong>{formatFileSize(storageInfo.remainingBytes)}</strong> / {formatFileSize(storageInfo.totalBytes)}
              </span>
            </div>
          )}
        </div>
      </div>

      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        // @ts-expect-error webkitdirectory is supported in modern browsers
        webkitdirectory=""
        directory=""
        className="hidden"
        onChange={handleFileSelect}
      />

      {files.length > 0 && (
        <div className="mt-4 space-y-2.5 bg-gray-50 dark:bg-zinc-900/60 border border-gray-200 dark:border-zinc-700 rounded-xl p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              Hàng đợi tải lên ({files.filter((f) => f.uploadStatus === 'success').length}/{files.length} hoàn tất)
            </h4>
            <div className="flex items-center gap-2">
              {!isUploading && (
                <button
                  onClick={clearQueue}
                  className="px-2.5 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-md"
                >
                  Xóa danh sách
                </button>
              )}
              {isUploading ? (
                <button
                  onClick={cancelAllUploads}
                  className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-md hover:bg-red-700 flex items-center gap-1.5"
                >
                  <FaStopCircle className="w-3.5 h-3.5" />
                  <span>Dừng tất cả</span>
                </button>
              ) : (
                <button
                  onClick={uploadFiles}
                  disabled={files.every((f) => f.uploadStatus === 'success')}
                  className="px-3.5 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                >
                  <FaUpload className="w-3.5 h-3.5" />
                  <span>Upload tất cả ({files.filter((f) => f.uploadStatus !== 'success').length})</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1">
            {files.map((item) => (
              <div
                key={item.id}
                className="flex items-center space-x-3 p-2.5 bg-white dark:bg-zinc-800 rounded-lg border border-gray-100 dark:border-zinc-700/80"
              >
                <div className="flex-shrink-0">
                  {item.preview ? (
                    <img src={item.preview} alt={item.file.name} className="w-10 h-10 object-cover rounded" />
                  ) : (
                    <div className="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-zinc-700/50 rounded">
                      {getFileIcon(item.file)}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title={item.relativePath || item.file.name}>
                      {item.relativePath || item.file.name}
                    </p>
                    {needsCompression(item.file.name) && (
                      <span className="text-[11px] bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 px-1.5 py-0.5 rounded">
                        Nén ZIP
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>{formatFileSize(item.file.size)}</span>
                    {item.uploadStatus === 'uploading' && <span>• {item.uploadProgress || 0}%</span>}
                    {item.uploadStatus === 'zipping' && <span className="text-yellow-600">• Đang nén...</span>}
                  </div>

                  {item.uploadStatus === 'uploading' && (
                    <div className="mt-1.5 w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-1.5">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full transition-all duration-200"
                        style={{ width: `${item.uploadProgress || 0}%` }}
                      />
                    </div>
                  )}

                  {(item.uploadStatus === 'error' || item.uploadStatus === 'cancelled') && (
                    <p className="text-xs text-red-500 mt-0.5 truncate">{item.errorMessage}</p>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  {getStatusIcon(item.uploadStatus)}

                  {item.uploadStatus === 'uploading' ? (
                    <button
                      onClick={() => cancelSingleUpload(item.id)}
                      className="p-1 text-red-500 hover:text-red-700 transition-colors"
                      title="Hủy tải file này"
                    >
                      <FaStopCircle className="w-4 h-4" />
                    </button>
                  ) : (
                    item.uploadStatus !== 'zipping' && (
                      <button
                        onClick={() => removeFile(item.id)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        title="Xóa khỏi danh sách"
                      >
                        <FaTimes className="w-3.5 h-3.5" />
                      </button>
                    )
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
