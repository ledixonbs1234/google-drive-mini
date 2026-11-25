// app/page.tsx
'use client';

import { useState, useCallback, useEffect } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import EnhancedFileUploader from '../components/EnhancedFileUploader';
import AdvancedSearch from '../components/AdvancedSearch';
import FileList, {
  downloadSingleStorageItem,
  getPreviewFileType,
  isDocxFile,
  isEditableFile,
} from '../components/FileList';
import Breadcrumbs from '../components/Breadcrumbs';
import CreateFolderModal from '../components/CreateFolderModal';
import CreateFileModal from '../components/CreateFileModal';
import ImagePreviewModal from '../components/ImagePreviewModal';
import PreviewModal from '../components/PreviewModal';
import CodeEditorModal from '../components/CodeEditorModal';
import DocxEditorModal from '../components/DocxEditorModal';
import StorageIndicator from '../components/StorageIndicator';
import StorageDashboard from '../components/StorageDashboard';
import ResponsiveLayout from '../components/ResponsiveLayout';
import MultiSelectToolbar from '../components/MultiSelectToolbar';
import DragDropManager from '../components/DragDropManager';
import ContextMenu from '../components/ContextMenu';
import SettingsModal from '../components/SettingsModal';
import SharedNotepad from '@/components/SharedNotepad';
import {
  RenameModal,
  FolderPickerModal,
  ShareModal,
  PropertiesModal,
} from '../components/FileActionModals';
import { useAppStore } from '../store/useAppStore';
import {
  StorageItem,
  BrowseMode,
  moveOrCopyStorageItems,
  deleteMultipleStorageItems,
  restoreStorageTrashItems,
  toggleStarStorageItem,
} from '@/lib/storageClient';
import {
  FaFolderPlus,
  FaFileMedical,
  FaThLarge,
  FaList,
  FaSun,
  FaMoon,
  FaEye,
  FaDownload,
  FaTrash,
  FaEdit,
  FaCopy,
  FaCut,
  FaInfo,
  FaCog,
  FaCloud,
  FaHdd,
  FaClock,
  FaStar,
  FaStickyNote,
  FaShareAlt,
  FaFolderOpen,
  FaUndo,
} from 'react-icons/fa';

type ActiveSection = 'browse' | 'recent' | 'starred' | 'trash' | 'notepad' | 'storage';

export default function Home() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('browse');
  const [currentPath, setCurrentPath] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [storageRefreshTrigger, setStorageRefreshTrigger] = useState(0);
  const [selectedItems, setSelectedItems] = useState<StorageItem[]>([]);
  const [isZippingDownload, setIsZippingDownload] = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  const [draggedItems, setDraggedItems] = useState<StorageItem[]>([]);

  // State cho các Modal thao tác tệp
  const [renameTarget, setRenameTarget] = useState<StorageItem | null>(null);
  const [shareTarget, setShareTarget] = useState<StorageItem | null>(null);
  const [propertiesTarget, setPropertiesTarget] = useState<StorageItem | null>(null);
  const [moveCopyState, setMoveCopyState] = useState<{
    isOpen: boolean;
    mode: 'move' | 'copy';
    items: StorageItem[];
  }>({ isOpen: false, mode: 'move', items: [] });

  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    item: StorageItem | null;
  }>({
    isOpen: false,
    position: { x: 0, y: 0 },
    item: null,
  });

  const [showSettings, setShowSettings] = useState(false);

  const {
    viewMode,
    setViewMode,
    theme,
    toggleTheme,
    settings,
    loadSettings,
    openCreateFolderModal,
    openCreateFileModal,
    openImagePreviewModal,
    openPreviewModal,
    openEditorModal,
    openDocxEditorModal,
    setClipboard,
    isCreateFolderModalOpen,
    isCreateFileModalOpen,
    isImagePreviewModalOpen,
    isPreviewModalOpen,
    isEditorModalOpen,
    isDocxEditorModalOpen,
  } = useAppStore();

  // Khởi tạo cài đặt & đọc đường dẫn từ URL khi mở trang
  useEffect(() => {
    loadSettings();

    const syncFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const urlPath = params.get('path') || '';
      const urlTab = (params.get('tab') as ActiveSection) || 'browse';
      setCurrentPath(urlPath);
      if (['browse', 'recent', 'starred', 'trash', 'notepad', 'storage'].includes(urlTab)) {
        setActiveSection(urlTab);
      }
    };

    syncFromUrl();
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, [loadSettings]);

  const updateUrlState = useCallback((nextPath: string, nextTab: ActiveSection) => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams();
    if (nextTab !== 'browse') params.set('tab', nextTab);
    if (nextPath && nextTab === 'browse') params.set('path', nextPath);
    const qs = params.toString();
    const nextUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.pushState({}, '', nextUrl);
  }, []);

  const refreshData = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
    setStorageRefreshTrigger((prev) => prev + 1);
  }, []);

  const handleNavigate = useCallback(
    (newPath: string) => {
      setCurrentPath(newPath);
      setActiveSection('browse');
      setSearchTerm('');
      setSelectedItems([]);
      updateUrlState(newPath, 'browse');
    },
    [updateUrlState]
  );

  const handleSelectSection = useCallback(
    (section: ActiveSection) => {
      setActiveSection(section);
      setSelectedItems([]);
      updateUrlState(section === 'browse' ? currentPath : '', section);
    },
    [currentPath, updateUrlState]
  );

  // Phím tắt bàn phím tiện lợi (F2 đổi tên, Delete xóa mục đang chọn, Esc bỏ chọn)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
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

      if (e.key === 'Escape' && selectedItems.length > 0) {
        setSelectedItems([]);
      } else if (e.key === 'F2' && selectedItems.length === 1 && activeSection !== 'trash') {
        e.preventDefault();
        setRenameTarget(selectedItems[0]);
      } else if (e.key === 'Delete' && selectedItems.length > 0) {
        e.preventDefault();
        handleBatchDelete(selectedItems);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedItems, activeSection, settings]);

  // Di chuyển Kéo-Thả trực tiếp Server-Side trên Cloudflare R2 (không cần tải về trình duyệt!)
  const handleDragStart = (items: StorageItem[]) => {
    setDraggedItems(items);
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDraggedItems([]);
  };

  const handleDrop = async (targetPath: string) => {
    if (!draggedItems || draggedItems.length === 0) {
      handleDragEnd();
      return;
    }

    try {
      const res = await moveOrCopyStorageItems(
        'move',
        draggedItems.map((i) => ({ fullPath: i.fullPath, isFolder: i.isFolder, name: i.name })),
        targetPath,
        'rename'
      );
      if (res.skipped.length > 0) {
        alert(`Một số mục không thể di chuyển: ${res.skipped.join(', ')}`);
      }
      setSelectedItems([]);
      refreshData();
    } catch (err: any) {
      alert(`Lỗi khi di chuyển: ${err.message}`);
    } finally {
      handleDragEnd();
    }
  };

  // Tải xuống hàng loạt (1 tệp tải trực tiếp, >= 2 tệp đóng gói thành 1 file .ZIP)
  const handleBatchDownload = async (itemsToDownload: StorageItem[]) => {
    const filesOnly = itemsToDownload.filter((i) => !i.isFolder && i.url);
    if (filesOnly.length === 0) return;

    if (filesOnly.length === 1) {
      await downloadSingleStorageItem(filesOnly[0]);
      return;
    }

    setIsZippingDownload(true);
    try {
      const zip = new JSZip();
      await Promise.all(
        filesOnly.map(async (item) => {
          const res = await fetch(item.url!);
          if (res.ok) {
            const blob = await res.blob();
            zip.file(item.name, blob);
          }
        })
      );
      const archive = await zip.generateAsync({ type: 'blob' });
      const stamp = new Date().toISOString().slice(0, 10);
      saveAs(archive, `drive-mini-${stamp}.zip`);
    } catch (err: any) {
      alert(`Lỗi khi đóng gói ZIP: ${err.message}`);
    } finally {
      setIsZippingDownload(false);
    }
  };

  const handleBatchDelete = async (itemsToDelete: StorageItem[]) => {
    if (itemsToDelete.length === 0) return;
    const isTrash = activeSection === 'trash';
    const permanent = isTrash || !settings.useTrash;

    if (settings.confirmDelete) {
      const msg = permanent
        ? `Xóa VĨNH VIỄN ${itemsToDelete.length} mục đã chọn? Không thể hoàn tác!`
        : `Chuyển ${itemsToDelete.length} mục đã chọn vào Thùng rác?`;
      if (!window.confirm(msg)) return;
    }

    try {
      await deleteMultipleStorageItems(itemsToDelete, permanent);
      setSelectedItems([]);
      refreshData();
    } catch (err: any) {
      alert(`Lỗi khi xóa: ${err.message}`);
    }
  };

  const handleBatchRestore = async (itemsToRestore: StorageItem[]) => {
    const trashIds = itemsToRestore.map((i) => i.trashId).filter((id): id is string => Boolean(id));
    if (trashIds.length === 0) return;
    try {
      await restoreStorageTrashItems(trashIds);
      setSelectedItems([]);
      refreshData();
    } catch (err: any) {
      alert(`Lỗi khôi phục: ${err.message}`);
    }
  };

  const handleContextMenu = (event: React.MouseEvent, item: StorageItem) => {
    event.preventDefault();
    setContextMenu({
      isOpen: true,
      position: { x: event.clientX, y: event.clientY },
      item,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu((prev) => ({ ...prev, isOpen: false, item: null }));
  };

  const openItemPreviewOrFolder = (item: StorageItem) => {
    if (item.isFolder) {
      handleNavigate(item.fullPath.replace(/^uploads\//, ''));
      return;
    }
    if (!item.url) return;
    const fType = getPreviewFileType(item.name);
    if (fType === 'image') {
      openImagePreviewModal(item.url);
    } else if (isDocxFile(item.name)) {
      openDocxEditorModal({ name: item.name, fullPath: item.fullPath, url: item.url });
    } else {
      openPreviewModal({ name: item.name, url: item.url, fullPath: item.fullPath, type: fType });
    }
  };

  const navItems: Array<{ id: ActiveSection; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'browse', label: 'Kho lưu trữ chung', icon: FaFolderOpen },
    { id: 'recent', label: 'Cập nhật gần đây', icon: FaClock },
    { id: 'starred', label: 'Đã gắn sao', icon: FaStar },
    { id: 'notepad', label: 'Sổ tay dùng chung', icon: FaStickyNote },
    { id: 'trash', label: 'Thùng rác', icon: FaTrash },
    { id: 'storage', label: 'Dung lượng & Thẻ', icon: FaHdd },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between space-y-6">
      <div className="space-y-5">
        {/* Brand */}
        <div className="hidden md:flex items-center gap-2.5 px-2">
          <div className="p-2 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-500">
            <FaCloud className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-base text-gray-900 dark:text-white leading-tight">Drive Mini</h1>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Kho chung • Khóa 10GB</p>
          </div>
        </div>

        {/* Nút Tạo mới nhanh */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              if (activeSection !== 'browse') handleSelectSection('browse');
              openCreateFolderModal();
            }}
            className="flex items-center justify-center gap-1.5 py-2 px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
          >
            <FaFolderPlus className="w-3.5 h-3.5" />
            <span>Thư mục mới</span>
          </button>
          <button
            onClick={() => {
              if (activeSection !== 'browse') handleSelectSection('browse');
              openCreateFileModal();
            }}
            className="flex items-center justify-center gap-1.5 py-2 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
          >
            <FaFileMedical className="w-3.5 h-3.5" />
            <span>Tạo tệp mới</span>
          </button>
        </div>

        {/* Danh mục điều hướng */}
        <nav className="space-y-1">
          {navItems.map((nav) => {
            const Icon = nav.icon;
            const isActive = activeSection === nav.id;
            return (
              <button
                key={nav.id}
                onClick={() => handleSelectSection(nav.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700/50'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive
                      ? 'text-blue-600 dark:text-blue-400'
                      : nav.id === 'starred'
                      ? 'text-amber-400'
                      : nav.id === 'trash'
                      ? 'text-rose-500'
                      : 'text-gray-400'
                  }`}
                />
                <span>{nav.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Thẻ chỉ báo dung lượng ở cuối Sidebar */}
      <div className="pt-4 border-t border-gray-100 dark:border-zinc-700">
        <StorageIndicator refreshTrigger={storageRefreshTrigger} compact={false} showLabel={false} />
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 text-center">
          🛡️ Bảo vệ thẻ tự động ở ngưỡng 10 GB
        </p>
      </div>
    </div>
  );

  const ctxItem = contextMenu.item;

  return (
    <ResponsiveLayout sidebar={sidebarContent}>
      <main className="min-h-screen text-gray-900 dark:text-gray-100 p-3 sm:p-6 pb-24">
        <div className="max-w-7xl mx-auto bg-white dark:bg-zinc-800 shadow-sm border border-gray-200/80 dark:border-zinc-700 rounded-2xl overflow-hidden">
          {/* Top Bar */}
          <header className="px-4 py-3.5 border-b border-gray-200 dark:border-zinc-700 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-white dark:bg-zinc-800">
            <div className="flex-1 max-w-xl">
              <AdvancedSearch
                onResultSelect={(result) => {
                  if (!result.isFolder && result.url) {
                    const fType = getPreviewFileType(result.name);
                    if (fType === 'image') {
                      openImagePreviewModal(result.url);
                    } else if (isDocxFile(result.name)) {
                      openDocxEditorModal({ name: result.name, fullPath: result.fullPath, url: result.url });
                    } else {
                      openPreviewModal({
                        name: result.name,
                        url: result.url,
                        fullPath: result.fullPath,
                        type: fType,
                      });
                    }
                  }
                }}
                onNavigate={(path) => handleNavigate(path)}
              />
            </div>

            <div className="flex items-center justify-end space-x-2">
              <span
                className="hidden lg:inline-flex text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 font-medium border border-emerald-200 dark:border-emerald-800 items-center gap-1"
                title="Đã khóa cứng 10 GB Free Tier để bảo vệ thẻ"
              >
                🛡️ Khóa 10 GB Miễn Phí
              </span>

              <button
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700"
                title={viewMode === 'grid' ? 'Chuyển sang dạng danh sách' : 'Chuyển sang dạng lưới'}
              >
                {viewMode === 'grid' ? <FaList className="w-4 h-4" /> : <FaThLarge className="w-4 h-4" />}
              </button>

              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700"
                title={theme === 'light' ? 'Chuyển sang nền tối' : 'Chuyển sang nền sáng'}
              >
                {theme === 'light' ? <FaMoon className="w-4 h-4" /> : <FaSun className="w-4 h-4" />}
              </button>

              <button
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700"
                title="Cài đặt ứng dụng"
              >
                <FaCog className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Nội dung theo từng phân mục Sidebar */}
          <div className="p-4 sm:p-6">
            {activeSection === 'storage' ? (
              <StorageDashboard refreshTrigger={storageRefreshTrigger} />
            ) : activeSection === 'notepad' ? (
              <SharedNotepad fullHeight={true} />
            ) : (
              <>
                {activeSection === 'browse' ? (
                  <>
                    <Breadcrumbs
                      currentPath={currentPath}
                      onNavigate={handleNavigate}
                      onDropToPath={handleDrop}
                    />
                    <EnhancedFileUploader currentPath={currentPath} onUploadComplete={refreshData} />
                  </>
                ) : (
                  <div className="mb-4">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      {activeSection === 'recent' && (
                        <>
                          <FaClock className="text-blue-500" /> Tệp cập nhật gần đây
                        </>
                      )}
                      {activeSection === 'starred' && (
                        <>
                          <FaStar className="text-amber-400" /> Các mục đã gắn sao quan trọng
                        </>
                      )}
                      {activeSection === 'trash' && (
                        <>
                          <FaTrash className="text-rose-500" /> Thùng rác chung (có thể khôi phục)
                        </>
                      )}
                    </h2>
                  </div>
                )}

                <FileList
                  key={`${activeSection}-${currentPath}`}
                  currentPath={currentPath}
                  browseMode={activeSection as BrowseMode}
                  onNavigate={handleNavigate}
                  searchTerm={searchTerm}
                  refreshKey={refreshKey}
                  selectedItems={selectedItems}
                  onSelectionChange={setSelectedItems}
                  onDragStart={handleDragStart}
                  onDrop={handleDrop}
                  onContextMenu={handleContextMenu}
                  onOpenRename={(item) => setRenameTarget(item)}
                  onOpenShare={(item) => setShareTarget(item)}
                  onOpenMoveCopy={(mode, items) => setMoveCopyState({ isOpen: true, mode, items })}
                  onOpenProperties={(item) => setPropertiesTarget(item)}
                />

                {activeSection === 'browse' && <SharedNotepad />}
              </>
            )}
          </div>
        </div>

        {/* Các Modal chức năng */}
        {isCreateFolderModalOpen && (
          <CreateFolderModal currentPath={currentPath} onFolderCreated={refreshData} />
        )}
        {isCreateFileModalOpen && (
          <CreateFileModal currentPath={currentPath} onFileCreated={refreshData} />
        )}
        {isImagePreviewModalOpen && <ImagePreviewModal />}
        {isPreviewModalOpen && <PreviewModal />}
        {isEditorModalOpen && <CodeEditorModal />}
        {isDocxEditorModalOpen && <DocxEditorModal />}

        <RenameModal
          isOpen={Boolean(renameTarget)}
          item={renameTarget}
          onClose={() => setRenameTarget(null)}
          onSuccess={refreshData}
        />

        <ShareModal
          isOpen={Boolean(shareTarget)}
          item={shareTarget}
          onClose={() => setShareTarget(null)}
        />

        <PropertiesModal
          isOpen={Boolean(propertiesTarget)}
          item={propertiesTarget}
          onClose={() => setPropertiesTarget(null)}
        />

        <FolderPickerModal
          isOpen={moveCopyState.isOpen}
          mode={moveCopyState.mode}
          items={moveCopyState.items}
          onClose={() => setMoveCopyState((prev) => ({ ...prev, isOpen: false }))}
          onSuccess={() => {
            setSelectedItems([]);
            refreshData();
          }}
        />

        <MultiSelectToolbar
          selectedItems={selectedItems}
          browseMode={activeSection as BrowseMode}
          isZipping={isZippingDownload}
          onClearSelection={() => setSelectedItems([])}
          onDownload={handleBatchDownload}
          onDelete={handleBatchDelete}
          onRestore={handleBatchRestore}
          onMove={(items) => {
            setClipboard({
              action: 'move',
              items: items.map((i) => ({ fullPath: i.fullPath, isFolder: i.isFolder, name: i.name })),
            });
            setMoveCopyState({ isOpen: true, mode: 'move', items });
          }}
          onCopy={(items) => {
            setClipboard({
              action: 'copy',
              items: items.map((i) => ({ fullPath: i.fullPath, isFolder: i.isFolder, name: i.name })),
            });
            setMoveCopyState({ isOpen: true, mode: 'copy', items });
          }}
        />

        <DragDropManager
          isDragging={isDragging}
          draggedItems={draggedItems}
          onDragEnd={handleDragEnd}
          onDrop={handleDrop}
        />

        <ContextMenu
          isOpen={contextMenu.isOpen}
          position={contextMenu.position}
          onClose={handleCloseContextMenu}
          items={
            ctxItem
              ? activeSection === 'trash'
                ? [
                    {
                      id: 'restore',
                      label: 'Khôi phục về vị trí gốc',
                      icon: <FaUndo className="w-4 h-4" />,
                      color: 'success',
                      onClick: () => handleBatchRestore([ctxItem]),
                    },
                    {
                      id: 'info',
                      label: 'Thuộc tính chi tiết',
                      icon: <FaInfo className="w-4 h-4" />,
                      onClick: () => setPropertiesTarget(ctxItem),
                    },
                    {
                      id: 'delete-perm',
                      label: 'Xóa vĩnh viễn',
                      icon: <FaTrash className="w-4 h-4" />,
                      color: 'danger',
                      separator: true,
                      onClick: () => handleBatchDelete([ctxItem]),
                    },
                  ]
                : [
                    {
                      id: 'open',
                      label: ctxItem.isFolder ? 'Mở thư mục' : 'Xem trước',
                      icon: <FaEye className="w-4 h-4" />,
                      onClick: () => openItemPreviewOrFolder(ctxItem),
                    },
                    ...(!ctxItem.isFolder && (isEditableFile(ctxItem.name) || isDocxFile(ctxItem.name))
                      ? [
                          {
                            id: 'edit-content',
                            label: 'Chỉnh sửa nội dung',
                            icon: <FaEdit className="w-4 h-4" />,
                            onClick: () => {
                              if (!ctxItem.url) return;
                              if (isDocxFile(ctxItem.name)) {
                                openDocxEditorModal({ name: ctxItem.name, fullPath: ctxItem.fullPath, url: ctxItem.url });
                              } else {
                                openEditorModal({ name: ctxItem.name, fullPath: ctxItem.fullPath, url: ctxItem.url });
                              }
                            },
                          },
                        ]
                      : []),
                    {
                      id: 'share',
                      label: 'Chia sẻ & Mã QR',
                      icon: <FaShareAlt className="w-4 h-4" />,
                      onClick: () => setShareTarget(ctxItem),
                    },
                    {
                      id: 'star',
                      label: ctxItem.starred ? 'Bỏ gắn sao' : 'Gắn sao chung',
                      icon: <FaStar className="w-4 h-4 text-amber-400" />,
                      onClick: async () => {
                        await toggleStarStorageItem(ctxItem.fullPath);
                        refreshData();
                      },
                    },
                    ...(!ctxItem.isFolder
                      ? [
                          {
                            id: 'download',
                            label: 'Tải xuống',
                            icon: <FaDownload className="w-4 h-4" />,
                            onClick: () => downloadSingleStorageItem(ctxItem),
                          },
                        ]
                      : []),
                    {
                      id: 'copy',
                      label: 'Sao chép đến...',
                      icon: <FaCopy className="w-4 h-4" />,
                      separator: true,
                      onClick: () => {
                        setClipboard({
                          action: 'copy',
                          items: [{ fullPath: ctxItem.fullPath, isFolder: ctxItem.isFolder, name: ctxItem.name }],
                        });
                        setMoveCopyState({ isOpen: true, mode: 'copy', items: [ctxItem] });
                      },
                    },
                    {
                      id: 'cut',
                      label: 'Di chuyển đến...',
                      icon: <FaCut className="w-4 h-4" />,
                      onClick: () => {
                        setClipboard({
                          action: 'move',
                          items: [{ fullPath: ctxItem.fullPath, isFolder: ctxItem.isFolder, name: ctxItem.name }],
                        });
                        setMoveCopyState({ isOpen: true, mode: 'move', items: [ctxItem] });
                      },
                    },
                    {
                      id: 'rename',
                      label: 'Đổi tên',
                      icon: <FaEdit className="w-4 h-4" />,
                      shortcut: 'F2',
                      onClick: () => setRenameTarget(ctxItem),
                    },
                    {
                      id: 'info',
                      label: 'Thuộc tính',
                      icon: <FaInfo className="w-4 h-4" />,
                      onClick: () => setPropertiesTarget(ctxItem),
                    },
                    {
                      id: 'delete',
                      label: settings.useTrash ? 'Chuyển vào Thùng rác' : 'Xóa vĩnh viễn',
                      icon: <FaTrash className="w-4 h-4" />,
                      color: 'danger',
                      shortcut: 'Del',
                      separator: true,
                      onClick: () => handleBatchDelete([ctxItem]),
                    },
                  ]
              : []
          }
        />

        {showSettings && (
          <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
        )}
      </main>
    </ResponsiveLayout>
  );
}
