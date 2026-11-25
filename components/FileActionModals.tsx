// components/FileActionModals.tsx
'use client';

import React, { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  FaEdit,
  FaTimes,
  FaFolder,
  FaFolderOpen,
  FaShareAlt,
  FaCopy,
  FaCheck,
  FaQrcode,
  FaInfoCircle,
  FaSpinner,
  FaStar,
  FaDownload,
} from 'react-icons/fa';
import {
  StorageItem,
  FolderOption,
  listAllStorageFolders,
  renameStorageItem,
  moveOrCopyStorageItems,
  createStorageShareLink,
} from '@/lib/storageClient';

/* =========================================================
 * 1. RENAME MODAL (Đổi tên File / Thư mục trên Cloudflare R2)
 * ========================================================= */
interface RenameModalProps {
  isOpen: boolean;
  item: StorageItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const RenameModal: React.FC<RenameModalProps> = ({ isOpen, item, onClose, onSuccess }) => {
  const [newName, setNewName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && item) {
      setNewName(item.name);
      setError(null);
      setIsLoading(false);
    }
  }, [isOpen, item]);

  if (!item) return null;

  const handleRename = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setError('Tên không được để trống.');
      return;
    }
    if (trimmed === item.name) {
      onClose();
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await renameStorageItem(item.fullPath, trimmed, item.isFolder);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi đổi tên.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <div className="fixed inset-0 bg-black/50" />
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-800 p-6 shadow-xl">
              <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FaEdit className="text-blue-500" />
                  Đổi tên {item.isFolder ? 'thư mục' : 'tệp tin'}
                </span>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <FaTimes />
                </button>
              </Dialog.Title>

              <div className="mt-4">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    if (error) setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename();
                  }}
                  autoFocus
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-700 dark:text-white"
                />
                {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={onClose}
                  disabled={isLoading}
                  className="px-4 py-2 text-sm rounded-lg bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200"
                >
                  Hủy
                </button>
                <button
                  onClick={handleRename}
                  disabled={isLoading || !newName.trim()}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {isLoading && <FaSpinner className="animate-spin w-3.5 h-3.5" />}
                  <span>Lưu tên mới</span>
                </button>
              </div>
            </Dialog.Panel>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

/* =========================================================
 * 2. FOLDER PICKER MODAL (Di chuyển / Sao chép đến thư mục)
 * ========================================================= */
interface FolderPickerModalProps {
  isOpen: boolean;
  mode: 'move' | 'copy';
  items: StorageItem[];
  onClose: () => void;
  onSuccess: () => void;
}

export const FolderPickerModal: React.FC<FolderPickerModalProps> = ({
  isOpen,
  mode,
  items,
  onClose,
  onSuccess,
}) => {
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>(''); // '' = Thư mục gốc (Home)
  const [customSubfolder, setCustomSubfolder] = useState<string>('');
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsLoadingFolders(true);
      setError(null);
      setCustomSubfolder('');
      listAllStorageFolders()
        .then((list) => setFolders(list))
        .finally(() => setIsLoadingFolders(false));
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      let target = selectedFolder;
      if (customSubfolder.trim()) {
        const cleanSub = customSubfolder.trim().replace(/^\/+|\/+$/g, '');
        target = `${target}${cleanSub}/`;
      }

      const res = await moveOrCopyStorageItems(
        mode,
        items.map((i) => ({ fullPath: i.fullPath, isFolder: i.isFolder, name: i.name })),
        target,
        'rename'
      );

      if (res.skipped.length > 0) {
        alert(`Đã bỏ qua: ${res.skipped.join(', ')}`);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Thao tác thất bại');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <div className="fixed inset-0 bg-black/50" />
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-800 p-6 shadow-xl">
              <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FaFolderOpen className="text-amber-500" />
                  {mode === 'move' ? 'Di chuyển' : 'Sao chép'} {items.length} mục đến...
                </span>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <FaTimes />
                </button>
              </Dialog.Title>

              <div className="mt-4 space-y-3">
                <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-zinc-700 rounded-lg divide-y divide-gray-100 dark:divide-zinc-700/60">
                  <button
                    type="button"
                    onClick={() => setSelectedFolder('')}
                    className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-left transition-colors ${
                      selectedFolder === ''
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold'
                        : 'hover:bg-gray-50 dark:hover:bg-zinc-700/50 text-gray-800 dark:text-gray-200'
                    }`}
                  >
                    <FaFolder className="text-yellow-500 flex-shrink-0" />
                    <span>/ (Thư mục gốc - Home)</span>
                  </button>

                  {isLoadingFolders ? (
                    <div className="p-4 text-center text-sm text-gray-500">Đang tải danh sách thư mục...</div>
                  ) : (
                    folders.map((f) => (
                      <button
                        key={f.fullPath}
                        type="button"
                        onClick={() => setSelectedFolder(f.relativePath)}
                        className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-left transition-colors ${
                          selectedFolder === f.relativePath
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold'
                            : 'hover:bg-gray-50 dark:hover:bg-zinc-700/50 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <FaFolder className="text-yellow-500 flex-shrink-0" />
                        <span className="truncate">/{f.relativePath}</span>
                      </button>
                    ))
                  )}
                </div>

                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Hoặc nhập thêm tên thư mục con mới (tùy chọn):
                  </label>
                  <input
                    type="text"
                    value={customSubfolder}
                    onChange={(e) => setCustomSubfolder(e.target.value)}
                    placeholder="Ví dụ: TaiLieu2026"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-600 rounded-lg dark:bg-zinc-700 dark:text-white"
                  />
                </div>

                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm rounded-lg bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-200"
                >
                  Hủy
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {isSubmitting && <FaSpinner className="animate-spin w-3.5 h-3.5" />}
                  <span>{mode === 'move' ? 'Di chuyển tới đây' : 'Sao chép tới đây'}</span>
                </button>
              </div>
            </Dialog.Panel>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

/* =========================================================
 * 3. SHARE MODAL (Tạo Link chia sẻ có thời hạn & Mã QR)
 * ========================================================= */
interface ShareModalProps {
  isOpen: boolean;
  item: StorageItem | null;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, item, onClose }) => {
  const [expiry, setExpiry] = useState<number>(86400); // 24 giờ
  const [shareUrl, setShareUrl] = useState<string>('');
  const [downloadUrl, setDownloadUrl] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copiedType, setCopiedType] = useState<'view' | 'download' | null>(null);
  const [showQr, setShowQr] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !item) return;

    if (item.isFolder) {
      const folderRel = item.fullPath.replace(/^uploads\//, '');
      const url = `${window.location.origin}/?path=${encodeURIComponent(folderRel)}`;
      setShareUrl(url);
      setDownloadUrl('');
      setExpiresAt('');
      return;
    }

    setIsLoading(true);
    setError(null);
    createStorageShareLink(item.fullPath, expiry)
      .then((res) => {
        setShareUrl(res.shareUrl);
        setDownloadUrl(res.downloadUrl);
        setExpiresAt(res.expiresAt);
      })
      .catch((err) => setError(err.message || 'Lỗi tạo liên kết'))
      .finally(() => setIsLoading(false));
  }, [isOpen, item, expiry]);

  if (!item) return null;

  const copyText = async (text: string, type: 'view' | 'download') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
    } catch {
      // Fallback
    }
  };

  const qrTarget = downloadUrl || shareUrl;

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <div className="fixed inset-0 bg-black/50" />
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-800 p-6 shadow-xl">
              <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center justify-between">
                <span className="flex items-center gap-2 truncate">
                  <FaShareAlt className="text-emerald-500 flex-shrink-0" />
                  <span className="truncate">Chia sẻ: {item.name}</span>
                </span>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <FaTimes />
                </button>
              </Dialog.Title>

              <div className="mt-4 space-y-4">
                {!item.isFolder && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Thời hạn hiệu lực của liên kết trực tiếp R2:
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { label: '1 giờ', sec: 3600 },
                        { label: '24 giờ', sec: 86400 },
                        { label: '3 ngày', sec: 259200 },
                        { label: '7 ngày', sec: 604800 },
                      ].map((opt) => (
                        <button
                          key={opt.sec}
                          type="button"
                          onClick={() => setExpiry(opt.sec)}
                          className={`py-1.5 text-xs font-medium rounded-md border transition-colors ${
                            expiry === opt.sec
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-gray-50 dark:bg-zinc-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-zinc-600'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {isLoading ? (
                  <div className="py-8 flex items-center justify-center text-sm text-gray-500">
                    <FaSpinner className="animate-spin mr-2 text-blue-500" />
                    Đang tạo liên kết Cloudflare R2...
                  </div>
                ) : error ? (
                  <p className="text-sm text-red-500">{error}</p>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        {item.isFolder ? 'Liên kết mở thư mục này:' : 'Liên kết xem trực tiếp:'}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={shareUrl}
                          className="flex-1 px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg text-gray-700 dark:text-gray-300"
                        />
                        <button
                          onClick={() => copyText(shareUrl, 'view')}
                          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium inline-flex items-center gap-1.5"
                        >
                          {copiedType === 'view' ? <FaCheck /> : <FaCopy />}
                          <span>{copiedType === 'view' ? 'Đã chép' : 'Sao chép'}</span>
                        </button>
                      </div>
                    </div>

                    {downloadUrl && (
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                          Liên kết tải xuống ngay (buộc lưu file):
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            readOnly
                            value={downloadUrl}
                            className="flex-1 px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg text-gray-700 dark:text-gray-300"
                          />
                          <button
                            onClick={() => copyText(downloadUrl, 'download')}
                            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium inline-flex items-center gap-1.5"
                          >
                            {copiedType === 'download' ? <FaCheck /> : <FaDownload />}
                            <span>{copiedType === 'download' ? 'Đã chép' : 'Chép link tải'}</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {qrTarget && (
                      <div className="pt-2 border-t border-gray-100 dark:border-zinc-700 text-center">
                        <button
                          type="button"
                          onClick={() => setShowQr(!showQr)}
                          className="text-xs text-blue-600 dark:text-blue-400 inline-flex items-center gap-1 mb-2"
                        >
                          <FaQrcode />
                          <span>{showQr ? 'Ẩn mã QR điện thoại' : 'Hiện mã QR quét bằng điện thoại'}</span>
                        </button>
                        {showQr && (
                          <div className="flex flex-col items-center">
                            <div className="p-2.5 bg-white rounded-xl border border-gray-200 shadow-sm">
                              <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrTarget)}`}
                                alt="QR Code chia sẻ"
                                className="w-40 h-40"
                              />
                            </div>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5">
                              Dùng camera điện thoại quét để mở/tải ngay lập tức
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {expiresAt && (
                      <p className="text-[11px] text-center text-gray-400">
                        Hết hạn lúc: {new Date(expiresAt).toLocaleString('vi-VN')}
                      </p>
                    )}
                  </>
                )}
              </div>
            </Dialog.Panel>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

/* =========================================================
 * 4. PROPERTIES MODAL (Xem chi tiết thuộc tính File/Folder)
 * ========================================================= */
interface PropertiesModalProps {
  isOpen: boolean;
  item: StorageItem | null;
  onClose: () => void;
}

export const PropertiesModal: React.FC<PropertiesModalProps> = ({ isOpen, item, onClose }) => {
  if (!item) return null;

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]} (${bytes.toLocaleString('vi-VN')} bytes)`;
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <div className="fixed inset-0 bg-black/50" />
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-800 p-6 shadow-xl">
              <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FaInfoCircle className="text-blue-500" />
                  Thuộc tính chi tiết
                </span>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <FaTimes />
                </button>
              </Dialog.Title>

              <dl className="mt-4 divide-y divide-gray-100 dark:divide-zinc-700 text-sm">
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-gray-500 dark:text-gray-400">Tên:</dt>
                  <dd className="font-medium text-gray-900 dark:text-gray-100 text-right break-all">{item.name}</dd>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-gray-500 dark:text-gray-400">Loại:</dt>
                  <dd className="font-medium text-gray-900 dark:text-gray-100">
                    {item.isFolder ? 'Thư mục' : `Tệp (.${item.name.split('.').pop()?.toLowerCase() || 'file'})`}
                  </dd>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-gray-500 dark:text-gray-400">Đường dẫn R2:</dt>
                  <dd className="font-mono text-xs text-gray-700 dark:text-gray-300 text-right break-all">
                    {item.fullPath}
                  </dd>
                </div>
                {item.originalPath && (
                  <div className="py-2.5 flex justify-between gap-4">
                    <dt className="text-gray-500 dark:text-gray-400">Vị trí gốc:</dt>
                    <dd className="font-mono text-xs text-gray-700 dark:text-gray-300 text-right break-all">
                      {item.originalPath}
                    </dd>
                  </div>
                )}
                {!item.isFolder && (
                  <div className="py-2.5 flex justify-between gap-4">
                    <dt className="text-gray-500 dark:text-gray-400">Dung lượng:</dt>
                    <dd className="font-medium text-gray-900 dark:text-gray-100 text-right">{formatBytes(item.size)}</dd>
                  </div>
                )}
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-gray-500 dark:text-gray-400">{item.deletedAt ? 'Ngày xóa:' : 'Cập nhật cuối:'}</dt>
                  <dd className="font-medium text-gray-900 dark:text-gray-100">
                    {(item.deletedAt || item.updated)?.toLocaleString('vi-VN') || '-'}
                  </dd>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-gray-500 dark:text-gray-400">Gắn sao chung:</dt>
                  <dd className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1">
                    <FaStar className={item.starred ? 'text-yellow-400' : 'text-gray-300'} />
                    <span>{item.starred ? 'Đã gắn sao' : 'Chưa gắn sao'}</span>
                  </dd>
                </div>
              </dl>

              <div className="mt-5 flex justify-end">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                >
                  Đóng
                </button>
              </div>
            </Dialog.Panel>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};
