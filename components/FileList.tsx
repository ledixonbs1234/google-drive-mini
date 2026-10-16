// components/FileList.tsx
'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import FileIcon from './FileIcon';
import { FaDownload, FaTrash, FaFolder, FaFile, FaEdit, FaEllipsisV, FaImage, FaList, FaThLarge, FaInfoCircle, FaSpinner } from 'react-icons/fa';
import { useAppStore, EditingFile, EditingDocxFile } from '../store/useAppStore';
import { twMerge } from 'tailwind-merge';
import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { StorageItem, listStorageItems, deleteStorageItem } from '@/lib/storageClient';

const EXECUTABLE_EXTENSIONS_FOR_UNZIP = ['exe', 'msi', 'bat', 'cmd', 'sh', 'app', 'dmg', 'deb', 'rpm', 'apk'];

const EDITABLE_EXTENSIONS = [
  'txt', 'log', 'md', 'json', 'js', 'jsx', 'ts', 'tsx', 'html', 'htm', 'css', 'scss', 'sass', 'less', 'xml', 'yaml', 'yml', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'php', 'rb', 'swift', 'kt', 'kts', 'sql', 'sh', 'bash', 'zsh', 'bat', 'cmd', 'ps1', 'ini', 'cfg', 'conf', 'env', 'dockerfile', 'gitignore'
];

const isDocxFile = (fileName: string): boolean => {
  if (!fileName || fileName.includes('/')) return false;
  const extension = fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase();
  return ['doc', 'docx'].includes(extension);
};

const isEditableFile = (fileName: string): boolean => {
  if (!fileName || fileName.includes('/')) return false;
  const extension = fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase();
  return EDITABLE_EXTENSIONS.includes(extension);
};

const getFileType = (fileName: string): 'pdf' | 'video' | 'audio' | 'markdown' | 'image' | '3d' | 'code' | 'unknown' => {
  const ext = fileName.toLowerCase().split('.').pop();
  if (['pdf'].includes(ext || '')) return 'pdf';
  if (['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'flv', '3gp'].includes(ext || '')) return 'video';
  if (['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'wma'].includes(ext || '')) return 'audio';
  if (['md', 'markdown', 'txt'].includes(ext || '')) return 'markdown';
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'tiff'].includes(ext || '')) return 'image';
  if (['obj', 'stl', 'ply', 'gltf', 'glb', '3ds'].includes(ext || '')) return '3d';
  if (['json', 'xml', 'csv', 'yaml', 'yml', 'toml', 'ini'].includes(ext || '')) return 'code';
  return 'unknown';
};

const isPreviewableFile = (fileName: string): boolean => {
  const fileType = getFileType(fileName);
  return ['pdf', 'video', 'audio', 'markdown', 'image', '3d', 'code'].includes(fileType);
};

interface FileListProps {
  currentPath?: string;
  onNavigate: (path: string) => void;
  searchTerm: string;
  refreshKey: number;
  onDragStart: (items: StorageItem[]) => void;
  onDrop: (targetPath: string) => void;
}

interface ItemActionsProps {
  item: StorageItem;
  onDelete: (path: string) => void;
}

interface FolderActionsProps {
  item: StorageItem;
  onDelete: (path: string) => void;
}

const FolderActions: React.FC<FolderActionsProps> = ({ item, onDelete }) => {
  return (
    <Menu as="div" className="relative inline-block text-left">
      <div>
        <Menu.Button
          className={twMerge(
            "inline-flex justify-center rounded-md p-1.5 text-sm font-medium",
            "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75",
            "md:opacity-0 md:group-hover:opacity-100",
            "transition-opacity duration-150"
          )}
          aria-label="Tùy chọn thư mục"
        >
          <FaEllipsisV className="w-4 h-4" aria-hidden="true" />
        </Menu.Button>
      </div>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 mt-2 w-40 origin-top-right divide-y divide-gray-100 dark:divide-zinc-600 rounded-md bg-white dark:bg-zinc-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
          <div className="px-1 py-1">
            <Menu.Item>
              {({ active }) => (
                <button
                  onClick={() => onDelete(item.fullPath)}
                  className={twMerge(
                    'group flex rounded-md items-center w-full px-2 py-2 text-sm',
                    active ? 'bg-red-500 text-white' : 'text-red-600 dark:text-red-400'
                  )}
                >
                  <FaTrash className="mr-2 h-4 w-4" aria-hidden="true" />
                  Xóa thư mục
                </button>
              )}
            </Menu.Item>
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
};

const ItemActions: React.FC<ItemActionsProps> = ({ item, onDelete }) => {
  const [isProcessingDownload, setIsProcessingDownload] = useState(false);
  const openEditor = useAppStore((state) => state.openEditorModal);
  const openDocxEditor = useAppStore((state) => state.openDocxEditorModal);

  const handleDownload = async () => {
    if (!item || !item.url || item.isFolder) return;
    setIsProcessingDownload(true);
    const fileName = item.name;
    let shouldUnzip = false;
    let originalFileName = fileName;

    if (fileName.toLowerCase().endsWith('.zip')) {
      const baseName = fileName.slice(0, -4);
      const potentialOriginalExtension = baseName.slice(baseName.lastIndexOf('.') + 1).toLowerCase();
      if (EXECUTABLE_EXTENSIONS_FOR_UNZIP.includes(potentialOriginalExtension)) {
        shouldUnzip = true;
        originalFileName = baseName;
      }
    }

    try {
      if (shouldUnzip) {
        const response = await fetch(item.url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const zipBlob = await response.blob();
        const zip = await JSZip.loadAsync(zipBlob);
        const fileInsideZip = zip.file(originalFileName);
        if (fileInsideZip) {
          const unzippedBlob = await fileInsideZip.async('blob');
          saveAs(unzippedBlob, originalFileName);
        } else {
          saveAs(item.url, fileName);
        }
      } else {
        saveAs(item.url, fileName);
      }
    } catch (error) {
      console.error("Error during download/unzip:", error);
      alert(`Đã xảy ra lỗi khi tải hoặc giải nén file: ${fileName}.\n${error instanceof Error ? error.message : String(error)}`);
      if (shouldUnzip) {
        try {
          saveAs(item.url, fileName);
        } catch (fallbackError) {
          console.error("Fallback download also failed:", fallbackError);
        }
      }
    } finally {
      setIsProcessingDownload(false);
    }
  };

  const handleEditClick = () => {
    if (!item || !item.url || item.isFolder) return;
    if (isDocxFile(item.name)) {
      const fileToEdit: EditingDocxFile = {
        name: item.name,
        fullPath: item.fullPath,
        url: item.url
      };
      openDocxEditor(fileToEdit);
      return;
    }
    if (isEditableFile(item.name)) {
      const fileToEdit: EditingFile = {
        name: item.name,
        fullPath: item.fullPath,
        url: item.url
      };
      openEditor(fileToEdit);
    } else {
      alert("Không thể chỉnh sửa loại file này.");
    }
  };

  if (item.isFolder) return null;
  const canEdit = isEditableFile(item.name) || isDocxFile(item.name);

  return (
    <Menu as="div" className="relative inline-block text-left">
      <div>
        <Menu.Button
          className={twMerge(
            "inline-flex justify-center rounded-md p-1.5 text-sm font-medium",
            "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75",
            "md:opacity-0 md:group-hover:opacity-100",
            "transition-opacity duration-150"
          )}
          disabled={isProcessingDownload}
          aria-label="Tùy chọn khác"
        >
          {isProcessingDownload ? (
            <FaSpinner className="animate-spin h-4 w-4 text-blue-500" />
          ) : (
            <FaEllipsisV className="w-4 h-4" aria-hidden="true" />
          )}
        </Menu.Button>
      </div>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 mt-2 w-40 origin-top-right divide-y divide-gray-100 dark:divide-zinc-600 rounded-md bg-white dark:bg-zinc-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
          <div className="px-1 py-1">
            {canEdit && (
              <Menu.Item disabled={isProcessingDownload}>
                {({ active, disabled }) => (
                  <button
                    onClick={handleEditClick}
                    disabled={disabled}
                    className={twMerge(
                      'group flex rounded-md items-center w-full px-2 py-2 text-sm',
                      disabled ? 'opacity-50 cursor-not-allowed' : '',
                      active ? 'bg-blue-500 text-white' : 'text-gray-900 dark:text-gray-100'
                    )}
                  >
                    <FaEdit className="mr-2 h-4 w-4" aria-hidden="true" />
                    Chỉnh sửa
                  </button>
                )}
              </Menu.Item>
            )}
            <Menu.Item disabled={isProcessingDownload}>
              {({ active, disabled }) => (
                <button
                  onClick={handleDownload}
                  disabled={disabled}
                  className={twMerge(
                    'group flex rounded-md items-center w-full px-2 py-2 text-sm',
                    disabled ? 'opacity-50 cursor-not-allowed' : '',
                    active ? 'bg-blue-500 text-white' : 'text-gray-900 dark:text-gray-100'
                  )}
                >
                  {isProcessingDownload ? (
                    'Đang xử lý...'
                  ) : (
                    <>
                      <FaDownload className="mr-2 h-4 w-4" aria-hidden="true" />
                      Tải xuống
                    </>
                  )}
                </button>
              )}
            </Menu.Item>
            {item.url && item.name.match(/\.(jpg|jpeg|png|gif|bmp|svg|webp)$/i) && (
              <Menu.Item disabled={isProcessingDownload}>
                {({ active, disabled }) => (
                  <button
                    onClick={() => useAppStore.getState().openImagePreviewModal(item.url!)}
                    disabled={disabled}
                    className={twMerge(
                      'group flex rounded-md items-center w-full px-2 py-2 text-sm',
                      disabled ? 'opacity-50 cursor-not-allowed' : '',
                      active ? 'bg-blue-500 text-white' : 'text-gray-900 dark:text-gray-100'
                    )}
                  >
                    <FaImage className="mr-2 h-4 w-4" aria-hidden="true" />
                    Xem trước
                  </button>
                )}
              </Menu.Item>
            )}
          </div>
          <div className="px-1 py-1">
            <Menu.Item disabled={isProcessingDownload}>
              {({ active, disabled }) => (
                <button
                  onClick={() => onDelete(item.fullPath)}
                  disabled={disabled}
                  className={twMerge(
                    'group flex rounded-md items-center w-full px-2 py-2 text-sm',
                    disabled ? 'opacity-50 cursor-not-allowed' : '',
                    active ? 'bg-red-500 text-white' : 'text-red-600 dark:text-red-400'
                  )}
                >
                  <FaTrash className="mr-2 h-4 w-4" aria-hidden="true" />
                  Xóa
                </button>
              )}
            </Menu.Item>
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
};

export default function FileList({ currentPath = '', onNavigate, searchTerm, refreshKey, onDragStart, onDrop }: FileListProps) {
  const [items, setItems] = useState<StorageItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const viewMode = useAppStore((state) => state.viewMode);
  const openImagePreviewModal = useAppStore((state) => state.openImagePreviewModal);
  const openPreviewModal = useAppStore((state) => state.openPreviewModal);

  // Fetch dữ liệu từ Cloudflare R2 qua API Route
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await listStorageItems(currentPath, searchTerm);
      if (!res.configured && res.items.length === 0) {
        setError('Cloudflare R2 chưa được cấu hình. Vui lòng thêm các biến môi trường trong .env.local.');
      }
      setItems(res.items);
    } catch (err: any) {
      console.error('Lỗi khi lấy danh sách files:', err);
      setError(err.message || 'Không thể tải dữ liệu. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  }, [currentPath, searchTerm]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  // Xóa file đơn lẻ
  const handleDelete = async (itemPath: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa tệp này?\nHành động này không thể hoàn tác.`)) {
      try {
        setIsLoading(true);
        await deleteStorageItem(itemPath, false);
        fetchData();
      } catch (err: any) {
        console.error('Xóa file thất bại:', err);
        alert(`Xóa file thất bại: ${err.message}`);
        setIsLoading(false);
      }
    }
  };

  // Xóa thư mục (recursive)
  const handleDeleteFolder = async (folderPath: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa thư mục này và toàn bộ nội dung bên trong?\nHành động này không thể hoàn tác.`)) {
      try {
        setIsLoading(true);
        await deleteStorageItem(folderPath, true);
        fetchData();
      } catch (err: any) {
        console.error('Xóa thư mục thất bại:', err);
        alert(`Xóa thư mục thất bại: ${err.message}`);
        setIsLoading(false);
      }
    }
  };

  const handleFolderClick = (folderName: string) => {
    const newPath = `${currentPath}${folderName}/`;
    onNavigate(newPath);
  };

  const handleFileClick = (item: StorageItem) => {
    if (item.isFolder || !item.url) return;
    const fileType = getFileType(item.name);
    if (fileType === 'image') {
      openImagePreviewModal(item.url);
    } else if (isPreviewableFile(item.name)) {
      openPreviewModal({
        name: item.name,
        url: item.url,
        type: fileType
      });
    }
  };

  // Sắp xếp: thư mục lên trước, sau đó theo tên
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
  }, [items]);

  const formatFileSize = (bytes?: number): string => {
    if (bytes === undefined || bytes === 0) return '-';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (date?: Date): string => {
    if (!date) return '-';
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (isLoading) {
    return <div className="text-center py-10 text-gray-500 dark:text-gray-400">Đang tải dữ liệu từ Cloudflare R2...</div>;
  }

  if (error) {
    return <div className="text-center py-10 text-red-600 dark:text-red-400">{error}</div>;
  }

  if (sortedItems.length === 0 && !searchTerm) {
    return (
      <div className="text-center py-10 text-gray-500 dark:text-gray-400">
        <FaInfoCircle className="inline-block w-6 h-6 mr-2 mb-1" />
        Thư mục này trống. Kéo thả file vào đây hoặc nhấn nút "Tạo mới".
      </div>
    );
  }

  if (sortedItems.length === 0 && searchTerm) {
    return (
      <div className="text-center py-10 text-gray-500 dark:text-gray-400">
        <FaInfoCircle className="inline-block w-6 h-6 mr-2 mb-1" />
        Không tìm thấy file hoặc thư mục nào khớp với "{searchTerm}".
      </div>
    );
  }

  const renderGridView = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {sortedItems.map((item) => (
        <div
          key={item.fullPath}
          draggable={!item.isFolder}
          onDragStart={(e) => {
            e.stopPropagation();
            onDragStart([item]);
          }}
          className={twMerge(
            "group relative bg-white dark:bg-zinc-800 rounded-lg shadow hover:shadow-md transition-shadow duration-200 p-3 flex flex-col items-center text-center cursor-pointer",
            item.isFolder ? "hover:bg-blue-50 dark:hover:bg-blue-900/20" : "hover:bg-gray-50 dark:hover:bg-zinc-700"
          )}
          onClick={() => item.isFolder ? handleFolderClick(item.name) : handleFileClick(item)}
          onDragOver={(e) => {
            if (item.isFolder) {
              e.preventDefault();
              e.currentTarget.classList.add('ring-2', 'ring-blue-500');
            }
          }}
          onDragLeave={(e) => {
            if (item.isFolder) {
              e.currentTarget.classList.remove('ring-2', 'ring-blue-500');
            }
          }}
          onDrop={(e) => {
            if (item.isFolder) {
              e.preventDefault();
              e.stopPropagation();
              e.currentTarget.classList.remove('ring-2', 'ring-blue-500');
              onDrop(item.fullPath);
            }
          }}
          title={item.name}
        >
          <div className="mb-2 flex-shrink-0 h-16 w-16 flex items-center justify-center">
            {!item.isFolder && item.url && item.name.match(/\.(jpg|jpeg|png|gif|bmp|svg|webp)$/i) ? (
              <img src={item.url} alt={item.name} className="max-h-full max-w-full object-contain rounded" loading="lazy" />
            ) : (
              <FileIcon fileName={item.name} isFolder={item.isFolder} className="w-12 h-12" />
            )}
          </div>
          <p className="w-full text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
            {item.name}
          </p>
          <div
            className="absolute top-1 right-1"
            onClick={(e) => e.stopPropagation()}
          >
            {!item.isFolder ? (
              <ItemActions item={item} onDelete={handleDelete} />
            ) : (
              <FolderActions item={item} onDelete={handleDeleteFolder} />
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const renderListView = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
        <thead className="bg-gray-50 dark:bg-zinc-800">
          <tr>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-10"></th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tên</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">Ngày sửa đổi</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">Kích thước</th>
            <th scope="col" className="relative px-4 py-3 w-10">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-zinc-800/50 divide-y divide-gray-200 dark:divide-zinc-700">
          {sortedItems.map((item) => (
            <tr
              key={item.fullPath}
              draggable={!item.isFolder}
              onDragStart={(e) => {
                e.stopPropagation();
                onDragStart([item]);
              }}
              className="hover:bg-gray-50 dark:hover:bg-zinc-700/50 group cursor-pointer"
              onClick={() => item.isFolder ? handleFolderClick(item.name) : handleFileClick(item)}
              onDragOver={(e) => {
                if (item.isFolder) {
                  e.preventDefault();
                  e.currentTarget.classList.add('bg-blue-100', 'dark:bg-blue-900');
                }
              }}
              onDragLeave={(e) => {
                if (item.isFolder) {
                  e.currentTarget.classList.remove('bg-blue-100', 'dark:bg-blue-900');
                }
              }}
              onDrop={(e) => {
                if (item.isFolder) {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.classList.remove('bg-blue-100', 'dark:bg-blue-900');
                  onDrop(item.fullPath);
                }
              }}
            >
              <td className="px-4 py-2 whitespace-nowrap">
                <div className="flex-shrink-0 h-5 w-5">
                  <FileIcon fileName={item.name} isFolder={item.isFolder} className="w-5 h-5" />
                </div>
              </td>
              <td className="px-4 py-2 whitespace-nowrap max-w-xs sm:max-w-md md:max-w-lg">
                <span
                  className={`text-sm font-medium truncate ${item.isFolder ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'}`}
                  title={item.name}
                >
                  {item.name}
                </span>
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">
                {formatDate(item.updated)}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                {item.isFolder ? '-' : formatFileSize(item.size)}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-right text-sm font-medium w-10">
                <div onClick={(e) => e.stopPropagation()}>
                  {!item.isFolder ? (
                    <ItemActions item={item} onDelete={handleDelete} />
                  ) : (
                    <FolderActions item={item} onDelete={handleDeleteFolder} />
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="mt-6">
      {viewMode === 'grid' ? renderGridView() : renderListView()}
    </div>
  );
}
