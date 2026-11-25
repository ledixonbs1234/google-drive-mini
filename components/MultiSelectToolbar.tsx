// components/MultiSelectToolbar.tsx
'use client';

import { FaCheckSquare, FaDownload, FaTrash, FaCopy, FaCut, FaTimes, FaUndo, FaSpinner } from 'react-icons/fa';
import { twMerge } from 'tailwind-merge';
import { StorageItem, BrowseMode } from '@/lib/storageClient';

interface MultiSelectToolbarProps {
  selectedItems: StorageItem[];
  browseMode?: BrowseMode;
  isZipping?: boolean;
  onClearSelection: () => void;
  onDownload: (items: StorageItem[]) => void;
  onDelete: (items: StorageItem[]) => void;
  onMove: (items: StorageItem[]) => void;
  onCopy: (items: StorageItem[]) => void;
  onRestore?: (items: StorageItem[]) => void;
  className?: string;
}

const MultiSelectToolbar: React.FC<MultiSelectToolbarProps> = ({
  selectedItems,
  browseMode = 'browse',
  isZipping = false,
  onClearSelection,
  onDownload,
  onDelete,
  onMove,
  onCopy,
  onRestore,
  className = '',
}) => {
  if (selectedItems.length === 0) return null;

  const selectedCount = selectedItems.length;
  const filesOnly = selectedItems.filter((item) => !item.isFolder);
  const hasFiles = filesOnly.length > 0;

  const totalSize = filesOnly.reduce((sum, item) => sum + (item.size || 0), 0);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div
      className={twMerge(
        'fixed bottom-4 left-1/2 -translate-x-1/2 w-[95%] max-w-4xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-2xl shadow-2xl z-40 px-4 py-3',
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <FaCheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Đã chọn {selectedCount} mục
            </span>
          </div>

          {totalSize > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-gray-300">
              {formatSize(totalSize)}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {browseMode === 'trash' ? (
            <>
              <button
                onClick={() => onRestore?.(selectedItems)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors"
              >
                <FaUndo className="w-3.5 h-3.5" />
                <span>Khôi phục ({selectedCount})</span>
              </button>
              <button
                onClick={() => onDelete(selectedItems)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition-colors"
              >
                <FaTrash className="w-3.5 h-3.5" />
                <span>Xóa vĩnh viễn</span>
              </button>
            </>
          ) : (
            <>
              {hasFiles && (
                <button
                  onClick={() => onDownload(filesOnly)}
                  disabled={isZipping}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
                  title="Tải xuống (tự động đóng gói .ZIP nếu chọn nhiều tệp)"
                >
                  {isZipping ? <FaSpinner className="w-3.5 h-3.5 animate-spin" /> : <FaDownload className="w-3.5 h-3.5" />}
                  <span>
                    {isZipping ? 'Đang nén ZIP...' : filesOnly.length > 1 ? `Tải ZIP (${filesOnly.length})` : 'Tải xuống'}
                  </span>
                </button>
              )}

              <button
                onClick={() => onCopy(selectedItems)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors"
              >
                <FaCopy className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sao chép</span>
              </button>

              <button
                onClick={() => onMove(selectedItems)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-medium transition-colors"
              >
                <FaCut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Di chuyển</span>
              </button>

              <button
                onClick={() => onDelete(selectedItems)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition-colors"
              >
                <FaTrash className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Xóa</span>
              </button>
            </>
          )}

          <button
            onClick={onClearSelection}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-200 dark:bg-zinc-700 hover:bg-gray-300 dark:hover:bg-zinc-600 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-medium transition-colors"
            title="Bỏ chọn tất cả (Esc)"
          >
            <FaTimes className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Bỏ chọn</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MultiSelectToolbar;
