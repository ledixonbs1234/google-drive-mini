// components/MultiSelectToolbar.tsx
'use client';

import { useState, useEffect } from 'react';
import { FaCheckSquare, FaSquare, FaDownload, FaTrash, FaCopy, FaCut, FaFolder, FaTimes, FaShare } from 'react-icons/fa';
import { twMerge } from 'tailwind-merge';

interface SelectedItem {
  name: string;
  fullPath: string;
  isFolder: boolean;
  url?: string;
  size?: number;
  updated?: Date;
}

interface MultiSelectToolbarProps {
  selectedItems: SelectedItem[];
  onClearSelection: () => void;
  onDownload: (items: SelectedItem[]) => void;
  onDelete: (items: SelectedItem[]) => void;
  onMove: (items: SelectedItem[]) => void;
  onCopy: (items: SelectedItem[]) => void;
  className?: string;
}

const MultiSelectToolbar: React.FC<MultiSelectToolbarProps> = ({
  selectedItems,
  onClearSelection,
  onDownload,
  onDelete,
  onMove,
  onCopy,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(selectedItems.length > 0);
  }, [selectedItems]);

  if (!isVisible) return null;

  const selectedCount = selectedItems.length;
  const hasFiles = selectedItems.some(item => !item.isFolder);
  const hasFolders = selectedItems.some(item => item.isFolder);

  const totalSize = selectedItems
    .filter(item => !item.isFolder && item.size)
    .reduce((sum, item) => sum + (item.size || 0), 0);

  const formatSize = (bytes: number) => {
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className={twMerge(
      'fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-800 border-t border-gray-200 dark:border-zinc-700 shadow-lg z-50',
      'transform transition-transform duration-300 ease-in-out',
      isVisible ? 'translate-y-0' : 'translate-y-full',
      className
    )}>
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Selection Info */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <FaCheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {selectedCount} mục đã chọn
              </span>
            </div>
            
            {totalSize > 0 && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {formatSize(totalSize)}
              </div>
            )}
            
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {hasFolders && hasFiles ? 'Thư mục & Tệp tin' : 
               hasFolders ? 'Thư mục' : 'Tệp tin'}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2">
            {/* Download - only for files */}
            {hasFiles && (
              <button
                onClick={() => onDownload(selectedItems.filter(item => !item.isFolder))}
                className="flex items-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
                title="Tải xuống các tệp tin đã chọn"
              >
                <FaDownload className="w-4 h-4" />
                <span className="hidden sm:inline">Tải xuống</span>
              </button>
            )}

            {/* Copy */}
            <button
              onClick={() => onCopy(selectedItems)}
              className="flex items-center space-x-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium transition-colors"
              title="Sao chép"
            >
              <FaCopy className="w-4 h-4" />
              <span className="hidden sm:inline">Sao chép</span>
            </button>

            {/* Move */}
            <button
              onClick={() => onMove(selectedItems)}
              className="flex items-center space-x-2 px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-md text-sm font-medium transition-colors"
              title="Di chuyển"
            >
              <FaCut className="w-4 h-4" />
              <span className="hidden sm:inline">Di chuyển</span>
            </button>

            {/* Delete */}
            <button
              onClick={() => onDelete(selectedItems)}
              className="flex items-center space-x-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors"
              title="Xóa"
            >
              <FaTrash className="w-4 h-4" />
              <span className="hidden sm:inline">Xóa</span>
            </button>

            {/* Clear Selection */}
            <button
              onClick={onClearSelection}
              className="flex items-center space-x-2 px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-sm font-medium transition-colors"
              title="Hủy chọn"
            >
              <FaTimes className="w-4 h-4" />
              <span className="hidden sm:inline">Hủy</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiSelectToolbar;
