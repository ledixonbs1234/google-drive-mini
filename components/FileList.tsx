// components/FileList.tsx
'use client';

import React, { useEffect, useState, useCallback, useMemo, Fragment } from 'react';
import FileIcon from './FileIcon';
import {
  FaDownload,
  FaTrash,
  FaEdit,
  FaEllipsisV,
  FaInfoCircle,
  FaSpinner,
  FaStar,
  FaRegStar,
  FaShareAlt,
  FaSort,
  FaSortUp,
  FaSortDown,
  FaUndo,
  FaBroom,
  FaPaste,
  FaCopy,
  FaCut,
  FaEye,
  FaCheckSquare,
  FaRegSquare,
  FaClock,
  FaSortAlphaDown,
  FaWeightHanging,
  FaFolder,
} from 'react-icons/fa';
import {
  useAppStore,
  EditingFile,
  EditingDocxFile,
  PreviewFile,
  SortField,
} from '../store/useAppStore';
import { twMerge } from 'tailwind-merge';
import { Menu, Transition } from '@headlessui/react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import {
  StorageItem,
  BrowseMode,
  listStorageItems,
  deleteStorageItem,
  toggleStarStorageItem,
  restoreStorageTrashItems,
  emptyStorageTrash,
  moveOrCopyStorageItems,
} from '@/lib/storageClient';

const EXECUTABLE_EXTENSIONS_FOR_UNZIP = ['exe', 'msi', 'bat', 'cmd', 'sh', 'app', 'dmg', 'deb', 'rpm', 'apk'];

const EDITABLE_EXTENSIONS = [
  'txt', 'log', 'md', 'markdown', 'csv', 'tsv', 'json', 'js', 'jsx', 'ts', 'tsx', 'html', 'htm',
  'css', 'scss', 'sass', 'less', 'xml', 'yaml', 'yml', 'py', 'java', 'c', 'cpp', 'h', 'hpp',
  'cs', 'go', 'php', 'rb', 'swift', 'kt', 'kts', 'sql', 'sh', 'bash', 'zsh', 'bat', 'cmd',
  'ps1', 'ini', 'cfg', 'conf', 'env', 'dockerfile', 'gitignore',
];

export const isDocxFile = (fileName: string): boolean => {
  if (!fileName || fileName.includes('/')) return false;
  const extension = fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase();
  return ['doc', 'docx'].includes(extension);
};

export const isEditableFile = (fileName: string): boolean => {
  if (!fileName || fileName.includes('/')) return false;
  const lower = fileName.toLowerCase();
  if (lower === 'dockerfile' || lower === '.gitignore') return true;
  const extension = fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase();
  return EDITABLE_EXTENSIONS.includes(extension);
};

export const getPreviewFileType = (fileName: string): PreviewFile['type'] => {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  if (ext === 'pdf') return 'pdf';
  if (['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'flv', '3gp'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'wma'].includes(ext)) return 'audio';
  if (['md', 'markdown', 'txt', 'log'].includes(ext)) return 'markdown';
  if (['csv', 'tsv'].includes(ext)) return 'csv';
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'tiff'].includes(ext)) return 'image';
  if (['obj', 'stl', 'ply', 'gltf', 'glb', '3ds'].includes(ext)) return '3d';
  if (EDITABLE_EXTENSIONS.includes(ext)) return 'code';
  return 'unknown';
};

export const isPreviewableFile = (fileName: string): boolean => {
  return getPreviewFileType(fileName) !== 'unknown';
};

export interface FileListProps {
  currentPath?: string;
  browseMode?: BrowseMode;
  onNavigate: (path: string) => void;
  searchTerm: string;
  refreshKey: number;
  selectedItems: StorageItem[];
  onSelectionChange: (items: StorageItem[]) => void;
  onDragStart: (items: StorageItem[]) => void;
  onDrop: (targetPath: string) => void;
  onContextMenu?: (e: React.MouseEvent, item: StorageItem) => void;
  onOpenRename?: (item: StorageItem) => void;
  onOpenShare?: (item: StorageItem) => void;
  onOpenMoveCopy?: (mode: 'move' | 'copy', items: StorageItem[]) => void;
  onOpenProperties?: (item: StorageItem) => void;
}

export async function downloadSingleStorageItem(item: StorageItem): Promise<void> {
  if (!item || !item.url || item.isFolder) return;
  const fileName = item.name;
  let shouldUnzip = false;
  let originalFileName = fileName;

  if (fileName.toLowerCase().endsWith('.zip')) {
    const baseName = fileName.slice(0, -4);
    const potentialExt = baseName.slice(baseName.lastIndexOf('.') + 1).toLowerCase();
    if (EXECUTABLE_EXTENSIONS_FOR_UNZIP.includes(potentialExt)) {
      shouldUnzip = true;
      originalFileName = baseName;
    }
  }

  if (shouldUnzip) {
    const response = await fetch(item.url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const zipBlob = await response.blob();
    const zip = await JSZip.loadAsync(zipBlob);
    const fileInsideZip = zip.file(originalFileName);
    if (fileInsideZip) {
      const unzippedBlob = await fileInsideZip.async('blob');
      saveAs(unzippedBlob, originalFileName);
      return;
    }
  }

  const downloadUrl = item.url.includes('/api/files/download')
    ? `${item.url}&download=1`
    : item.url;
  saveAs(downloadUrl, fileName);
}

export default function FileList({
  currentPath = '',
  browseMode = 'browse',
  onNavigate,
  searchTerm,
  refreshKey,
  selectedItems,
  onSelectionChange,
  onDragStart,
  onDrop,
  onContextMenu,
  onOpenRename,
  onOpenShare,
  onOpenMoveCopy,
  onOpenProperties,
}: FileListProps) {
  const [items, setItems] = useState<StorageItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPasting, setIsPasting] = useState(false);
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastClickedIdx, setLastClickedIdx] = useState<number | null>(null);

  const viewMode = useAppStore((state) => state.viewMode);
  const settings = useAppStore((state) => state.settings);
  const sortField = useAppStore((state) => state.sortField);
  const sortOrder = useAppStore((state) => state.sortOrder);
  const pinFoldersTop = useAppStore((state) => state.pinFoldersTop);
  const setSort = useAppStore((state) => state.setSort);
  const setPinFoldersTop = useAppStore((state) => state.setPinFoldersTop);
  const recentlyUploadedKeys = useAppStore((state) => state.recentlyUploadedKeys);

  const clipboard = useAppStore((state) => state.clipboard);
  const setClipboard = useAppStore((state) => state.setClipboard);
  const clearClipboard = useAppStore((state) => state.clearClipboard);
  const globalRefreshCounter = useAppStore((state) => state.globalRefreshCounter);
  const openImagePreviewModal = useAppStore((state) => state.openImagePreviewModal);
  const openPreviewModal = useAppStore((state) => state.openPreviewModal);
  const openEditorModal = useAppStore((state) => state.openEditorModal);
  const openDocxEditorModal = useAppStore((state) => state.openDocxEditorModal);

  const recentUploadedSet = useMemo(() => new Set(recentlyUploadedKeys), [recentlyUploadedKeys]);

  const isNewlyUploadedItem = useCallback(
    (item: StorageItem): boolean => {
      if (browseMode === 'trash') return false;
      if (recentUploadedSet.has(item.fullPath)) return true;
      if (item.updated) {
        const diffMs = Date.now() - item.updated.getTime();
        // Đánh dấu "MỚI" cho các tệp vừa tải lên trong vòng 10 phút gần nhất
        return diffMs >= 0 && diffMs <= 10 * 60 * 1000;
      }
      return false;
    },
    [browseMode, recentUploadedSet]
  );

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await listStorageItems(currentPath, searchTerm, browseMode, settings.showHiddenFiles);
      if (!res.configured && res.items.length === 0) {
        setError('Cloudflare R2 chưa được cấu hình. Vui lòng thêm biến môi trường trong .env.local.');
      }
      setItems(res.items);
    } catch (err: any) {
      setError(err.message || 'Không thể tải dữ liệu từ kho lưu trữ.');
    } finally {
      setIsLoading(false);
    }
  }, [currentPath, searchTerm, browseMode, settings.showHiddenFiles]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey, globalRefreshCounter]);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      // Nếu bật "Ghim thư mục" (mặc định tắt khi xếp theo Thời gian để tệp mới tải lên đứng ngay vị trí #1)
      if (pinFoldersTop && (browseMode === 'browse' || browseMode === 'starred')) {
        if (a.isFolder && !b.isFolder) return -1;
        if (!a.isFolder && b.isFolder) return 1;
      }

      // Ưu tiên mục vừa mới tải lên trong phiên làm việc hiện tại khi đang xếp Mới nhất trước
      if (sortField === 'updated' && sortOrder === 'desc') {
        const aJustUploaded = recentUploadedSet.has(a.fullPath);
        const bJustUploaded = recentUploadedSet.has(b.fullPath);
        if (aJustUploaded && !bJustUploaded) return -1;
        if (!aJustUploaded && bJustUploaded) return 1;
      }

      let cmp = 0;
      switch (sortField) {
        case 'updated': {
          const dA = a.deletedAt || a.updated;
          const dB = b.deletedAt || b.updated;
          // Các mục chưa có timestamp luôn đẩy xuống cuối danh sách để không che khuất file mới
          if (!dA && !dB) {
            return a.name.toLowerCase().localeCompare(b.name.toLowerCase(), 'vi');
          }
          if (!dA) return 1;
          if (!dB) return -1;
          cmp = dA.getTime() - dB.getTime();
          if (cmp === 0) {
            return a.name.toLowerCase().localeCompare(b.name.toLowerCase(), 'vi');
          }
          break;
        }
        case 'name':
          cmp = a.name.toLowerCase().localeCompare(b.name.toLowerCase(), 'vi');
          break;
        case 'size':
          cmp = (a.size || 0) - (b.size || 0);
          break;
        case 'type': {
          const extA = a.isFolder ? '0_folder' : a.name.split('.').pop()?.toLowerCase() || '';
          const extB = b.isFolder ? '0_folder' : b.name.split('.').pop()?.toLowerCase() || '';
          cmp = extA.localeCompare(extB);
          break;
        }
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [items, sortField, sortOrder, pinFoldersTop, browseMode, recentUploadedSet]);

  const imageGallery = useMemo(
    () =>
      sortedItems
        .filter((i) => !i.isFolder && i.url && getPreviewFileType(i.name) === 'image')
        .map((i) => ({ name: i.name, url: i.url! })),
    [sortedItems]
  );

  const selectedPathsSet = useMemo(
    () => new Set(selectedItems.map((i) => i.fullPath)),
    [selectedItems]
  );

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSort(field, sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(field, field === 'updated' || field === 'size' ? 'desc' : 'asc');
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <FaSort className="w-3 h-3 text-gray-400 inline ml-1" />;
    return sortOrder === 'asc' ? (
      <FaSortUp className="w-3 h-3 text-blue-600 inline ml-1" />
    ) : (
      <FaSortDown className="w-3 h-3 text-blue-600 inline ml-1" />
    );
  };

  const handleToggleSelect = (item: StorageItem, idx: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (e?.shiftKey && lastClickedIdx !== null) {
      const start = Math.min(lastClickedIdx, idx);
      const end = Math.max(lastClickedIdx, idx);
      const slice = sortedItems.slice(start, end + 1);
      const mergedMap = new Map(selectedItems.map((s) => [s.fullPath, s]));
      slice.forEach((s) => mergedMap.set(s.fullPath, s));
      onSelectionChange(Array.from(mergedMap.values()));
    } else {
      if (selectedPathsSet.has(item.fullPath)) {
        onSelectionChange(selectedItems.filter((s) => s.fullPath !== item.fullPath));
      } else {
        onSelectionChange([...selectedItems, item]);
      }
      setLastClickedIdx(idx);
    }
  };

  const handleSelectAll = () => {
    if (selectedItems.length === sortedItems.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange([...sortedItems]);
    }
  };

  const handleToggleStar = async (item: StorageItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const optimistic = !item.starred;
    setItems((prev) =>
      prev.map((i) => (i.fullPath === item.fullPath ? { ...i, starred: optimistic } : i))
    );
    try {
      await toggleStarStorageItem(item.fullPath);
      if (browseMode === 'starred' && !optimistic) {
        setItems((prev) => prev.filter((i) => i.fullPath !== item.fullPath));
      }
    } catch {
      fetchData();
    }
  };

  const handleDelete = async (item: StorageItem, forcePermanent = false) => {
    const isInTrash = browseMode === 'trash' || Boolean(item.trashId);
    const permanent = forcePermanent || isInTrash || !settings.useTrash;

    if (settings.confirmDelete) {
      const msg = permanent
        ? `Xóa VĨNH VIỄN "${item.name}"?\nHành động này không thể khôi phục!`
        : `Chuyển "${item.name}" vào Thùng rác? (Bạn có thể khôi phục lại bất kỳ lúc nào)`;
      if (!window.confirm(msg)) return;
    }

    try {
      setIsLoading(true);
      await deleteStorageItem(item.fullPath, item.isFolder, {
        permanent,
        trashId: item.trashId,
      });
      onSelectionChange(selectedItems.filter((s) => s.fullPath !== item.fullPath));
      await fetchData();
    } catch (err: any) {
      alert(`Xóa thất bại: ${err.message}`);
      setIsLoading(false);
    }
  };

  const handleRestore = async (item: StorageItem) => {
    if (!item.trashId) return;
    try {
      setIsLoading(true);
      await restoreStorageTrashItems([item.trashId]);
      await fetchData();
    } catch (err: any) {
      alert(`Khôi phục thất bại: ${err.message}`);
      setIsLoading(false);
    }
  };

  const handleEmptyTrash = async () => {
    if (!window.confirm('Bạn có chắc muốn xóa vĩnh viễn TOÀN BỘ mục trong Thùng rác để giải phóng dung lượng R2?')) {
      return;
    }
    try {
      setIsLoading(true);
      await emptyStorageTrash();
      onSelectionChange([]);
      await fetchData();
    } catch (err: any) {
      alert(`Lỗi dọn thùng rác: ${err.message}`);
      setIsLoading(false);
    }
  };

  const handlePasteHere = async () => {
    if (!clipboard || clipboard.items.length === 0) return;
    setIsPasting(true);
    try {
      await moveOrCopyStorageItems(clipboard.action, clipboard.items, currentPath, 'rename');
      if (clipboard.action === 'move') {
        clearClipboard();
      }
      await fetchData();
    } catch (err: any) {
      alert(`Dán thất bại: ${err.message}`);
    } finally {
      setIsPasting(false);
    }
  };

  const handleItemOpen = (item: StorageItem) => {
    if (browseMode === 'trash') return;
    if (item.isFolder) {
      const rel = item.fullPath.replace(/^uploads\//, '');
      onNavigate(rel);
      return;
    }
    if (!item.url) return;
    const fileType = getPreviewFileType(item.name);
    if (fileType === 'image') {
      openImagePreviewModal(item.url, imageGallery);
    } else if (isDocxFile(item.name)) {
      openDocxEditorModal({ name: item.name, fullPath: item.fullPath, url: item.url });
    } else if (fileType !== 'unknown') {
      openPreviewModal({
        name: item.name,
        url: item.url,
        fullPath: item.fullPath,
        type: fileType,
      });
    } else {
      onOpenProperties?.(item);
    }
  };

  const handleEditItem = (item: StorageItem) => {
    if (!item.url || item.isFolder) return;
    if (isDocxFile(item.name)) {
      openDocxEditorModal({ name: item.name, fullPath: item.fullPath, url: item.url } as EditingDocxFile);
    } else if (isEditableFile(item.name)) {
      openEditorModal({ name: item.name, fullPath: item.fullPath, url: item.url } as EditingFile);
    }
  };

  const handleDownloadClick = async (item: StorageItem) => {
    if (item.isFolder || !item.url) return;
    setDownloadingPath(item.fullPath);
    try {
      await downloadSingleStorageItem(item);
    } catch (err: any) {
      alert(`Lỗi tải tệp: ${err.message}`);
    } finally {
      setDownloadingPath(null);
    }
  };

  const formatFileSize = (bytes?: number): string => {
    if (bytes === undefined || bytes === 0) return '-';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  /**
   * Hiển thị thời gian trực quan ("Vừa xong", "4 phút trước", "2 giờ trước", hoặc ngày giờ cụ thể)
   */
  const formatRelativeTime = (date?: Date): string => {
    if (!date) return '';
    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSec < 60) return 'Vừa xong';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút trước`;
    if (diffSec < 86400) {
      const hrs = Math.floor(diffSec / 3600);
      const hm = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      return `${hrs} giờ trước (${hm})`;
    }
    if (diffSec < 7 * 86400) {
      return `${Math.floor(diffSec / 86400)} ngày trước`;
    }
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatFullDate = (date?: Date): string => {
    if (!date) return '-';
    const rel = formatRelativeTime(date);
    const exact = date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    return diffWithinWeek(date) ? `${rel} • ${exact}` : exact;
  };

  const diffWithinWeek = (date: Date) => Date.now() - date.getTime() < 7 * 86400 * 1000;

  const renderActionMenu = (item: StorageItem) => {
    if (browseMode === 'trash') {
      return (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleRestore(item)}
            className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-md"
            title="Khôi phục về vị trí cũ"
          >
            <FaUndo className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleDelete(item, true)}
            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md"
            title="Xóa vĩnh viễn"
          >
            <FaTrash className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    }

    const canEdit = !item.isFolder && (isEditableFile(item.name) || isDocxFile(item.name));
    const isDownloading = downloadingPath === item.fullPath;

    return (
      <Menu as="div" className="relative inline-block text-left">
        <Menu.Button
          className={twMerge(
            'inline-flex justify-center rounded-md p-1.5 text-sm',
            'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700',
            'md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition-opacity'
          )}
          disabled={isDownloading}
          aria-label="Tùy chọn"
        >
          {isDownloading ? <FaSpinner className="animate-spin h-4 w-4 text-blue-500" /> : <FaEllipsisV className="w-3.5 h-3.5" />}
        </Menu.Button>

        <Transition
          as={Fragment}
          enter="transition ease-out duration-100"
          enterFrom="transform opacity-0 scale-95"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-95"
        >
          <Menu.Items className="absolute right-0 mt-1.5 w-48 origin-top-right divide-y divide-gray-100 dark:divide-zinc-700 rounded-xl bg-white dark:bg-zinc-800 shadow-xl ring-1 ring-black/5 focus:outline-none z-30">
            <div className="p-1">
              {!item.isFolder && isPreviewableFile(item.name) && (
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={() => handleItemOpen(item)}
                      className={`${active ? 'bg-blue-50 dark:bg-zinc-700 text-blue-600 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200'} flex w-full items-center rounded-lg px-2.5 py-2 text-xs font-medium`}
                    >
                      <FaEye className="mr-2.5 h-3.5 w-3.5" />
                      Xem trước
                    </button>
                  )}
                </Menu.Item>
              )}

              {canEdit && (
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={() => handleEditItem(item)}
                      className={`${active ? 'bg-blue-50 dark:bg-zinc-700 text-blue-600 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200'} flex w-full items-center rounded-lg px-2.5 py-2 text-xs font-medium`}
                    >
                      <FaEdit className="mr-2.5 h-3.5 w-3.5" />
                      Chỉnh sửa nội dung
                    </button>
                  )}
                </Menu.Item>
              )}

              {!item.isFolder && (
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={() => handleDownloadClick(item)}
                      className={`${active ? 'bg-blue-50 dark:bg-zinc-700 text-blue-600 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200'} flex w-full items-center rounded-lg px-2.5 py-2 text-xs font-medium`}
                    >
                      <FaDownload className="mr-2.5 h-3.5 w-3.5" />
                      Tải xuống
                    </button>
                  )}
                </Menu.Item>
              )}

              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={() => onOpenShare?.(item)}
                    className={`${active ? 'bg-blue-50 dark:bg-zinc-700 text-blue-600 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200'} flex w-full items-center rounded-lg px-2.5 py-2 text-xs font-medium`}
                  >
                    <FaShareAlt className="mr-2.5 h-3.5 w-3.5 text-emerald-500" />
                    Chia sẻ & Mã QR
                  </button>
                )}
              </Menu.Item>
            </div>

            <div className="p-1">
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={() => onOpenRename?.(item)}
                    className={`${active ? 'bg-blue-50 dark:bg-zinc-700 text-blue-600 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200'} flex w-full items-center rounded-lg px-2.5 py-2 text-xs font-medium`}
                  >
                    <FaEdit className="mr-2.5 h-3.5 w-3.5" />
                    Đổi tên
                  </button>
                )}
              </Menu.Item>

              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={() => {
                      setClipboard({
                        action: 'copy',
                        items: [{ fullPath: item.fullPath, isFolder: item.isFolder, name: item.name }],
                      });
                      onOpenMoveCopy?.('copy', [item]);
                    }}
                    className={`${active ? 'bg-blue-50 dark:bg-zinc-700 text-blue-600 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200'} flex w-full items-center rounded-lg px-2.5 py-2 text-xs font-medium`}
                  >
                    <FaCopy className="mr-2.5 h-3.5 w-3.5" />
                    Sao chép đến...
                  </button>
                )}
              </Menu.Item>

              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={() => {
                      setClipboard({
                        action: 'move',
                        items: [{ fullPath: item.fullPath, isFolder: item.isFolder, name: item.name }],
                      });
                      onOpenMoveCopy?.('move', [item]);
                    }}
                    className={`${active ? 'bg-blue-50 dark:bg-zinc-700 text-blue-600 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200'} flex w-full items-center rounded-lg px-2.5 py-2 text-xs font-medium`}
                  >
                    <FaCut className="mr-2.5 h-3.5 w-3.5" />
                    Di chuyển đến...
                  </button>
                )}
              </Menu.Item>

              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={() => onOpenProperties?.(item)}
                    className={`${active ? 'bg-blue-50 dark:bg-zinc-700 text-blue-600 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200'} flex w-full items-center rounded-lg px-2.5 py-2 text-xs font-medium`}
                  >
                    <FaInfoCircle className="mr-2.5 h-3.5 w-3.5" />
                    Thuộc tính chi tiết
                  </button>
                )}
              </Menu.Item>
            </div>

            <div className="p-1">
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={() => handleDelete(item)}
                    className={`${active ? 'bg-red-500 text-white' : 'text-red-600 dark:text-red-400'} flex w-full items-center rounded-lg px-2.5 py-2 text-xs font-medium`}
                  >
                    <FaTrash className="mr-2.5 h-3.5 w-3.5" />
                    {settings.useTrash ? 'Chuyển vào Thùng rác' : 'Xóa vĩnh viễn'}
                  </button>
                )}
              </Menu.Item>
            </div>
          </Menu.Items>
        </Transition>
      </Menu>
    );
  };

  return (
    <div className="mt-4">
      {/* Thanh công cụ Sắp xếp trực quan & Chọn nhanh */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3.5 pb-2.5 border-b border-gray-100 dark:border-zinc-700/70">
        <div className="flex flex-wrap items-center gap-2">
          {sortedItems.length > 0 && (
            <button
              type="button"
              onClick={handleSelectAll}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700"
            >
              {selectedItems.length === sortedItems.length && sortedItems.length > 0 ? (
                <FaCheckSquare className="text-blue-600" />
              ) : (
                <FaRegSquare />
              )}
              <span>
                {selectedItems.length > 0
                  ? `Đã chọn ${selectedItems.length}/${sortedItems.length}`
                  : `Chọn tất cả (${sortedItems.length})`}
              </span>
            </button>
          )}

          {clipboard && clipboard.items.length > 0 && browseMode === 'browse' && (
            <div className="inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 px-2.5 py-1 rounded-lg">
              <button
                onClick={handlePasteHere}
                disabled={isPasting}
                className="text-xs font-semibold text-blue-700 dark:text-blue-300 inline-flex items-center gap-1.5 hover:underline"
              >
                {isPasting ? <FaSpinner className="animate-spin" /> : <FaPaste />}
                <span>
                  Dán {clipboard.items.length} mục ({clipboard.action === 'move' ? 'Di chuyển' : 'Sao chép'}) vào đây
                </span>
              </button>
              <button
                onClick={clearClipboard}
                className="text-xs text-gray-400 hover:text-red-500 ml-1"
                title="Hủy bộ nhớ tạm"
              >
                ×
              </button>
            </div>
          )}
        </div>

        {/* Các nút chuyển nhanh Chế độ Sắp xếp */}
        <div className="flex flex-wrap items-center gap-1.5">
          {browseMode === 'trash' && sortedItems.length > 0 && (
            <button
              onClick={handleEmptyTrash}
              className="px-3 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg inline-flex items-center gap-1.5 mr-1"
            >
              <FaBroom className="w-3 h-3" />
              <span>Làm trống thùng rác</span>
            </button>
          )}

          {/* Nút Sắp xếp theo Thời gian (Mặc định kích hoạt) */}
          <button
            type="button"
            onClick={() => toggleSort('updated')}
            className={twMerge(
              'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              sortField === 'updated'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-700'
            )}
            title="Sắp xếp theo thời gian tải lên / cập nhật"
          >
            <FaClock className="w-3 h-3" />
            <span>
              {sortField === 'updated'
                ? sortOrder === 'desc'
                  ? 'Thời gian: Mới nhất ↓'
                  : 'Thời gian: Cũ nhất ↑'
                : 'Thời gian'}
            </span>
          </button>

          {/* Nút Sắp xếp theo Tên */}
          <button
            type="button"
            onClick={() => toggleSort('name')}
            className={twMerge(
              'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              sortField === 'name'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-700'
            )}
            title="Sắp xếp theo bảng chữ cái"
          >
            <FaSortAlphaDown className="w-3 h-3" />
            <span>
              {sortField === 'name' ? (sortOrder === 'asc' ? 'Tên A → Z' : 'Tên Z → A') : 'Tên'}
            </span>
          </button>

          {/* Nút Sắp xếp theo Kích thước */}
          <button
            type="button"
            onClick={() => toggleSort('size')}
            className={twMerge(
              'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              sortField === 'size'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-700'
            )}
            title="Sắp xếp theo dung lượng tệp"
          >
            <FaWeightHanging className="w-3 h-3" />
            <span>
              {sortField === 'size' ? (sortOrder === 'desc' ? 'Lớn nhất ↓' : 'Nhỏ nhất ↑') : 'Kích thước'}
            </span>
          </button>

          {/* Nút Ghim thư mục lên đầu (tùy chọn) */}
          {(browseMode === 'browse' || browseMode === 'starred') && (
            <button
              type="button"
              onClick={() => setPinFoldersTop(!pinFoldersTop)}
              className={twMerge(
                'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                pinFoldersTop
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                  : 'bg-white dark:bg-zinc-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-700'
              )}
              title={
                pinFoldersTop
                  ? 'Đang ghim thư mục lên trước tệp. Nhấp để trộn chung theo đúng thời gian mới nhất.'
                  : 'Đang ưu tiên mục mới nhất lên đầu. Nhấp nếu muốn ghim các thư mục lên trên.'
              }
            >
              <FaFolder className="w-3 h-3 text-amber-500" />
              <span className="hidden sm:inline">Ghim thư mục</span>
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-gray-500 dark:text-gray-400 flex flex-col items-center">
          <FaSpinner className="animate-spin w-7 h-7 text-blue-500 mb-2.5" />
          <span className="text-sm">Đang đồng bộ kho lưu trữ Cloudflare R2...</span>
        </div>
      ) : error ? (
        <div className="py-12 text-center text-red-600 dark:text-red-400 text-sm">{error}</div>
      ) : sortedItems.length === 0 ? (
        <div className="py-14 text-center text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-zinc-800/30 rounded-xl border border-dashed border-gray-200 dark:border-zinc-700">
          <FaInfoCircle className="inline-block w-6 h-6 mb-2 text-gray-400" />
          <p className="text-sm">
            {browseMode === 'trash'
              ? 'Thùng rác hiện đang trống.'
              : browseMode === 'starred'
              ? 'Chưa có mục nào được gắn sao chung.'
              : searchTerm
              ? `Không tìm thấy mục nào khớp với "${searchTerm}".`
              : 'Thư mục này đang trống. Hãy kéo thả tệp/thư mục vào đây hoặc nhấn "Tạo mới"!'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* ================= CHẾ ĐỘ LƯỚI (GRID) ================= */
        <div
          className={`grid gap-3.5 ${
            settings.compactMode
              ? 'grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8'
              : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
          }`}
        >
          {sortedItems.map((item, idx) => {
            const isSelected = selectedPathsSet.has(item.fullPath);
            const isNew = isNewlyUploadedItem(item);
            const timeText = formatRelativeTime(item.deletedAt || item.updated);

            return (
              <div
                key={item.fullPath}
                draggable={browseMode === 'browse'}
                onDragStart={(e) => {
                  e.stopPropagation();
                  const dragGroup = isSelected ? selectedItems : [item];
                  onDragStart(dragGroup);
                }}
                onClick={(e) => {
                  if (e.ctrlKey || e.metaKey || e.shiftKey) {
                    handleToggleSelect(item, idx, e);
                  } else {
                    handleItemOpen(item);
                  }
                }}
                onContextMenu={(e) => onContextMenu?.(e, item)}
                onDragOver={(e) => {
                  if (item.isFolder && browseMode === 'browse') {
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
                  if (item.isFolder && browseMode === 'browse') {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.classList.remove('ring-2', 'ring-blue-500');
                    onDrop(item.fullPath);
                  }
                }}
                className={twMerge(
                  'group relative rounded-xl border p-3 flex flex-col items-center text-center cursor-pointer transition-all duration-150 select-none',
                  isSelected
                    ? 'bg-blue-50/80 dark:bg-blue-900/25 border-blue-400 dark:border-blue-500 ring-1 ring-blue-400'
                    : isNew
                    ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-700/80 hover:shadow-md'
                    : 'bg-white dark:bg-zinc-800 border-gray-200/80 dark:border-zinc-700 hover:shadow-md hover:border-blue-300 dark:hover:border-zinc-500'
                )}
                title={`${item.name}${item.updated ? `\nCập nhật: ${item.updated.toLocaleString('vi-VN')}` : ''}`}
              >
                {/* Checkbox chọn nhiều & Nhãn MỚI ở góc trên trái */}
                <div className="absolute top-2 left-2 flex items-center gap-1 z-10">
                  <button
                    type="button"
                    onClick={(e) => handleToggleSelect(item, idx, e)}
                    className={twMerge(
                      'p-0.5 rounded transition-opacity',
                      isSelected
                        ? 'opacity-100 text-blue-600'
                        : 'opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600'
                    )}
                    title="Chọn mục này"
                  >
                    {isSelected ? <FaCheckSquare className="w-4 h-4" /> : <FaRegSquare className="w-4 h-4" />}
                  </button>
                  {isNew && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded bg-emerald-500 text-white shadow-sm">
                      MỚI
                    </span>
                  )}
                </div>

                {/* Gắn sao & Menu 3 chấm ở góc trên phải */}
                <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 z-10" onClick={(e) => e.stopPropagation()}>
                  {browseMode !== 'trash' && (
                    <button
                      type="button"
                      onClick={(e) => handleToggleStar(item, e)}
                      className={twMerge(
                        'p-1 rounded transition-opacity',
                        item.starred
                          ? 'opacity-100 text-yellow-400'
                          : 'opacity-0 group-hover:opacity-100 text-gray-300 hover:text-yellow-400'
                      )}
                      title={item.starred ? 'Bỏ gắn sao' : 'Gắn sao quan trọng'}
                    >
                      {item.starred ? <FaStar className="w-3.5 h-3.5" /> : <FaRegStar className="w-3.5 h-3.5" />}
                    </button>
                  )}
                  {renderActionMenu(item)}
                </div>

                {/* Thumbnail hoặc Icon */}
                <div className="mt-4 mb-2.5 flex-shrink-0 h-16 w-16 flex items-center justify-center">
                  {settings.showThumbnails &&
                  !item.isFolder &&
                  item.url &&
                  /\.(jpg|jpeg|png|gif|bmp|svg|webp)$/i.test(item.name) ? (
                    <img
                      src={item.url}
                      alt={item.name}
                      className="max-h-16 max-w-full object-contain rounded"
                      loading="lazy"
                    />
                  ) : (
                    <FileIcon fileName={item.name} isFolder={item.isFolder} className="w-12 h-12" />
                  )}
                </div>

                <p className="w-full text-xs sm:text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                  {item.name}
                </p>
                <div className="w-full flex flex-col items-center mt-0.5 leading-tight">
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">
                    {item.isFolder ? 'Thư mục' : formatFileSize(item.size)}
                  </span>
                  {timeText && (
                    <span
                      className={`text-[10px] mt-0.5 truncate max-w-full ${
                        isNew ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-gray-400 dark:text-gray-500'
                      }`}
                    >
                      {timeText}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ================= CHẾ ĐỘ DANH SÁCH (LIST) ================= */
        <div className="overflow-x-auto border border-gray-200 dark:border-zinc-700 rounded-xl">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
            <thead className="bg-gray-50 dark:bg-zinc-800/90">
              <tr>
                <th className="px-3 py-2.5 w-9 text-left">
                  <button type="button" onClick={handleSelectAll} className="text-gray-400 hover:text-blue-600">
                    {selectedItems.length === sortedItems.length && sortedItems.length > 0 ? (
                      <FaCheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <FaRegSquare className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th
                  onClick={() => toggleSort('name')}
                  className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:text-blue-600 select-none"
                >
                  Tên {renderSortIcon('name')}
                </th>
                {browseMode === 'trash' && (
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase hidden lg:table-cell">
                    Vị trí gốc
                  </th>
                )}
                <th
                  onClick={() => toggleSort('updated')}
                  className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell cursor-pointer hover:text-blue-600 select-none"
                >
                  {browseMode === 'trash' ? 'Thời gian xóa' : 'Thời gian tải lên / sửa'} {renderSortIcon('updated')}
                </th>
                <th
                  onClick={() => toggleSort('size')}
                  className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell cursor-pointer hover:text-blue-600 select-none"
                >
                  Kích thước {renderSortIcon('size')}
                </th>
                <th className="px-3 py-2.5 w-20 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">
                  Tác vụ
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-zinc-800/40 divide-y divide-gray-100 dark:divide-zinc-700/60">
              {sortedItems.map((item, idx) => {
                const isSelected = selectedPathsSet.has(item.fullPath);
                const isNew = isNewlyUploadedItem(item);

                return (
                  <tr
                    key={item.fullPath}
                    draggable={browseMode === 'browse'}
                    onDragStart={(e) => {
                      e.stopPropagation();
                      onDragStart(isSelected ? selectedItems : [item]);
                    }}
                    onClick={(e) => {
                      if (e.ctrlKey || e.metaKey || e.shiftKey) {
                        handleToggleSelect(item, idx, e);
                      } else {
                        handleItemOpen(item);
                      }
                    }}
                    onContextMenu={(e) => onContextMenu?.(e, item)}
                    onDragOver={(e) => {
                      if (item.isFolder && browseMode === 'browse') {
                        e.preventDefault();
                        e.currentTarget.classList.add('bg-blue-50', 'dark:bg-blue-900/30');
                      }
                    }}
                    onDragLeave={(e) => {
                      if (item.isFolder) {
                        e.currentTarget.classList.remove('bg-blue-50', 'dark:bg-blue-900/30');
                      }
                    }}
                    onDrop={(e) => {
                      if (item.isFolder && browseMode === 'browse') {
                        e.preventDefault();
                        e.stopPropagation();
                        e.currentTarget.classList.remove('bg-blue-50', 'dark:bg-blue-900/30');
                        onDrop(item.fullPath);
                      }
                    }}
                    className={twMerge(
                      'group cursor-pointer transition-colors',
                      isSelected
                        ? 'bg-blue-50/70 dark:bg-blue-900/25'
                        : isNew
                        ? 'bg-emerald-50/35 dark:bg-emerald-950/15 hover:bg-emerald-50/70 dark:hover:bg-emerald-900/25'
                        : 'hover:bg-gray-50 dark:hover:bg-zinc-700/40'
                    )}
                  >
                    <td className="px-3 py-2.5 whitespace-nowrap" onClick={(e) => handleToggleSelect(item, idx, e)}>
                      {isSelected ? (
                        <FaCheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <FaRegSquare className="w-4 h-4 text-gray-300 group-hover:text-gray-500" />
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap max-w-xs sm:max-w-md">
                      <div className="flex items-center gap-2">
                        <FileIcon fileName={item.name} isFolder={item.isFolder} className="w-5 h-5 flex-shrink-0" />
                        <span
                          className={`text-sm font-medium truncate ${
                            item.isFolder ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'
                          }`}
                          title={item.name}
                        >
                          {item.name}
                        </span>
                        {isNew && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase rounded bg-emerald-500 text-white flex-shrink-0">
                            MỚI
                          </span>
                        )}
                        {browseMode !== 'trash' && (
                          <button
                            type="button"
                            onClick={(e) => handleToggleStar(item, e)}
                            className={twMerge(
                              'p-1 transition-opacity flex-shrink-0',
                              item.starred ? 'opacity-100 text-yellow-400' : 'opacity-0 group-hover:opacity-100 text-gray-300 hover:text-yellow-400'
                            )}
                          >
                            {item.starred ? <FaStar className="w-3.5 h-3.5" /> : <FaRegStar className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </td>
                    {browseMode === 'trash' && (
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400 hidden lg:table-cell font-mono">
                        /{item.originalPath?.replace(/^uploads\//, '')}
                      </td>
                    )}
                    <td
                      className={twMerge(
                        'px-3 py-2.5 whitespace-nowrap text-xs hidden sm:table-cell',
                        isNew ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-gray-500 dark:text-gray-400'
                      )}
                    >
                      {formatFullDate(item.deletedAt || item.updated)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400 hidden md:table-cell">
                      {item.isFolder ? '-' : formatFileSize(item.size)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                      {renderActionMenu(item)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
