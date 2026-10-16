// app/page.tsx
'use client';

import { useState, useCallback } from 'react';
import EnhancedFileUploader from '../components/EnhancedFileUploader';
import AdvancedSearch from '../components/AdvancedSearch';
import FileList from '../components/FileList';
import Breadcrumbs from '../components/Breadcrumbs';
import CreateFolderModal from '../components/CreateFolderModal';
import ImagePreviewModal from '../components/ImagePreviewModal';
import PreviewModal from '../components/PreviewModal';
import CodeEditorModal from '../components/CodeEditorModal';
import DocxEditorModal from '../components/DocxEditorModal';
import StorageIndicator from '../components/StorageIndicator';
import ResponsiveLayout from '../components/ResponsiveLayout';
import MobileActionSheet from '../components/MobileActionSheet';
import MultiSelectToolbar from '../components/MultiSelectToolbar';
import DragDropManager from '../components/DragDropManager';
import ContextMenu from '../components/ContextMenu';
import SettingsModal from '../components/SettingsModal';
import { useAppStore } from '../store/useAppStore';
import { FaFolderPlus, FaThLarge, FaList, FaSun, FaMoon, FaEye, FaDownload, FaTrash, FaEdit, FaCopy, FaCut, FaInfo, FaCog, FaCloud } from 'react-icons/fa';
import SharedNotepad from '@/components/SharedNotepad';
import { uploadFileToR2, deleteStorageItem } from '@/lib/storageClient';

export default function Home() {
  const [currentPath, setCurrentPath] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [storageRefreshTrigger, setStorageRefreshTrigger] = useState(0);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedItems, setDraggedItems] = useState<any[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    item: any;
  }>({
    isOpen: false,
    position: { x: 0, y: 0 },
    item: null
  });
  const [showSettings, setShowSettings] = useState(false);

  const {
    viewMode, setViewMode,
    theme, toggleTheme,
    openCreateFolderModal,
    openImagePreviewModal,
    openPreviewModal,
    isCreateFolderModalOpen,
    isImagePreviewModalOpen,
    isPreviewModalOpen,
    isEditorModalOpen,
    isDocxEditorModalOpen,
  } = useAppStore();

  const refreshData = useCallback(async () => {
    setRefreshKey(prevKey => prevKey + 1);
    setStorageRefreshTrigger(prev => prev + 1);
  }, []);

  const handleMobileAction = (item: any) => {
    setSelectedItem(item);
    setShowMobileActions(true);
  };

  const handleCloseMobileActions = () => {
    setShowMobileActions(false);
    setSelectedItem(null);
  };

  const handleMultiSelect = (items: any[]) => {
    setSelectedItems(items);
  };

  const handleClearSelection = () => {
    setSelectedItems([]);
  };

  const handleDragStart = (items: any[]) => {
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

    const itemsToMove = draggedItems.filter(item => 
      !item.isFolder || !targetPath.startsWith(item.fullPath)
    );

    if (itemsToMove.length !== draggedItems.length) {
      alert("Không thể di chuyển thư mục vào chính nó hoặc thư mục con của nó.");
    }

    if (itemsToMove.length === 0) {
      handleDragEnd();
      return;
    }

    for (const item of itemsToMove) {
      if (item.isFolder) {
        continue;
      }

      if (!item.url) {
        alert(`Không tìm thấy URL cho file ${item.name}.`);
        continue;
      }

      try {
        const originalPath = item.fullPath;
        const normalizedTarget = targetPath.endsWith('/') ? targetPath : `${targetPath}/`;
        
        // 1. Tải blob từ vị trí cũ
        const response = await fetch(item.url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const fileObj = new File([blob], item.name, { type: blob.type });

        // 2. Upload lên vị trí mới trong Cloudflare R2
        await uploadFileToR2(fileObj, normalizedTarget);

        // 3. Xóa file ở vị trí cũ
        await deleteStorageItem(originalPath, false);
      } catch (error) {
        console.error(`Thất bại khi di chuyển ${item.name}:`, error);
        alert(`Đã xảy ra lỗi khi di chuyển file ${item.name}. Vui lòng thử lại.`);
        break;
      }
    }

    handleDragEnd();
    refreshData();
  };

  const handleContextMenu = (event: React.MouseEvent, item: any) => {
    event.preventDefault();
    setContextMenu({
      isOpen: true,
      position: { x: event.clientX, y: event.clientY },
      item
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu({
      isOpen: false,
      position: { x: 0, y: 0 },
      item: null
    });
  };

  const handleNavigate = useCallback((newPath: string) => {
    setCurrentPath(newPath);
    setSearchTerm('');
  }, []);

  return (
    <ResponsiveLayout>
      <main className="min-h-screen bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-gray-100 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto bg-white dark:bg-zinc-800 shadow-lg rounded-xl overflow-hidden">
          {/* Header */}
          <header className="p-4 border-b border-gray-200 dark:border-zinc-700 flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0 bg-white dark:bg-zinc-800">
            <div className="flex items-center space-x-3">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <FaCloud className="text-orange-500" />
                <span>Drive Mini</span>
              </h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 font-medium border border-orange-200 dark:border-orange-800">
                Cloudflare R2 Free (10 GB)
              </span>
              <StorageIndicator
                refreshTrigger={storageRefreshTrigger}
                compact={true}
                showLabel={false}
              />
            </div>

            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="flex-1 max-w-md">
                <AdvancedSearch
                  onResultSelect={(result) => {
                    if (!result.isFolder && result.url) {
                      const fileType = result.type || 'unknown';
                      if (fileType === 'image') {
                        openImagePreviewModal(result.url);
                      } else {
                        openPreviewModal({
                          name: result.name,
                          url: result.url,
                          type: fileType as any
                        });
                      }
                    }
                  }}
                  onNavigate={(path) => {
                    setCurrentPath(path);
                  }}
                />
              </div>

              <button
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-zinc-800"
                title={viewMode === 'grid' ? 'Chuyển sang dạng danh sách' : 'Chuyển sang dạng lưới'}
              >
                {viewMode === 'grid' ? <FaList className="w-4 h-4" /> : <FaThLarge className="w-4 h-4" />}
              </button>

              <button
                onClick={toggleTheme}
                className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-zinc-800"
                title={theme === 'light' ? 'Chuyển sang nền tối' : 'Chuyển sang nền sáng'}
              >
                {theme === 'light' ? <FaMoon className="w-4 h-4" /> : <FaSun className="w-4 h-4" />}
              </button>

              <button
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-zinc-800"
                title="Cài đặt"
              >
                <FaCog className="w-4 h-4" />
              </button>

              <button
                onClick={openCreateFolderModal}
                className="flex items-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-1.5 px-3 rounded-md text-sm transition-colors"
                title="Tạo thư mục mới"
              >
                <FaFolderPlus className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">Tạo mới</span>
              </button>
            </div>
          </header>

          {/* Main content */}
          <div className="p-4 sm:p-6">
            <Breadcrumbs currentPath={currentPath} onNavigate={handleNavigate} />
            <EnhancedFileUploader currentPath={currentPath} onUploadComplete={refreshData} />
            <FileList
              key={currentPath}
              currentPath={currentPath}
              onNavigate={handleNavigate}
              searchTerm={searchTerm}
              refreshKey={refreshKey}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
            />
            <SharedNotepad />
          </div>
        </div>

        {/* Modals */}
        {isCreateFolderModalOpen && (
          <CreateFolderModal currentPath={currentPath} onFolderCreated={refreshData} />
        )}
        {isImagePreviewModalOpen && <ImagePreviewModal />}
        {isPreviewModalOpen && <PreviewModal />}
        {isEditorModalOpen && <CodeEditorModal />}
        {isDocxEditorModalOpen && <DocxEditorModal />}

        {showMobileActions && selectedItem && (
          <MobileActionSheet
            isOpen={showMobileActions}
            onClose={handleCloseMobileActions}
            title={selectedItem.name}
            subtitle={selectedItem.isFolder ? 'Thư mục' : 'Tệp tin'}
            actions={[
              {
                id: 'preview',
                label: 'Xem trước',
                icon: <FaEye className="w-4 h-4" />,
                onClick: () => {
                  if (!selectedItem.isFolder && selectedItem.url) {
                    const fileType = selectedItem.type || 'unknown';
                    if (fileType === 'image') {
                      openImagePreviewModal(selectedItem.url);
                    } else {
                      openPreviewModal({
                        name: selectedItem.name,
                        url: selectedItem.url,
                        type: fileType as any
                      });
                    }
                  }
                  handleCloseMobileActions();
                },
                disabled: selectedItem.isFolder
              },
              {
                id: 'download',
                label: 'Tải xuống',
                icon: <FaDownload className="w-4 h-4" />,
                onClick: () => {
                  handleCloseMobileActions();
                },
                disabled: selectedItem.isFolder
              },
              {
                id: 'delete',
                label: 'Xóa',
                icon: <FaTrash className="w-4 h-4" />,
                onClick: () => {
                  handleCloseMobileActions();
                },
                color: 'danger' as const
              }
            ]}
          />
        )}

        <MultiSelectToolbar
          selectedItems={selectedItems}
          onClearSelection={handleClearSelection}
          onDownload={(items) => {
            handleClearSelection();
          }}
          onDelete={(items) => {
            handleClearSelection();
          }}
          onMove={(items) => {
            handleClearSelection();
          }}
          onCopy={(items) => {
            handleClearSelection();
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
          items={contextMenu.item ? [
            {
              id: 'preview',
              label: 'Xem trước',
              icon: <FaEye className="w-4 h-4" />,
              onClick: () => {
                if (!contextMenu.item.isFolder && contextMenu.item.url) {
                  const fileType = contextMenu.item.type || 'unknown';
                  if (fileType === 'image') {
                    openImagePreviewModal(contextMenu.item.url);
                  } else {
                    openPreviewModal({
                      name: contextMenu.item.name,
                      url: contextMenu.item.url,
                      type: fileType as any
                    });
                  }
                }
              },
              disabled: contextMenu.item.isFolder,
              shortcut: 'Space'
            },
            {
              id: 'download',
              label: 'Tải xuống',
              icon: <FaDownload className="w-4 h-4" />,
              onClick: () => {},
              disabled: contextMenu.item.isFolder,
              shortcut: 'Ctrl+D'
            },
            {
              id: 'copy',
              label: 'Sao chép',
              icon: <FaCopy className="w-4 h-4" />,
              onClick: () => {},
              shortcut: 'Ctrl+C'
            },
            {
              id: 'cut',
              label: 'Cắt',
              icon: <FaCut className="w-4 h-4" />,
              onClick: () => {},
              shortcut: 'Ctrl+X'
            },
            {
              id: 'separator1',
              label: '',
              icon: null,
              onClick: () => { },
              separator: true
            },
            {
              id: 'edit',
              label: 'Sửa tên',
              icon: <FaEdit className="w-4 h-4" />,
              onClick: () => {},
              shortcut: 'F2'
            },
            {
              id: 'info',
              label: 'Thuộc tính',
              icon: <FaInfo className="w-4 h-4" />,
              onClick: () => {},
              shortcut: 'Alt+Enter'
            },
            {
              id: 'separator2',
              label: '',
              icon: null,
              onClick: () => { },
              separator: true
            },
            {
              id: 'delete',
              label: 'Xóa',
              icon: <FaTrash className="w-4 h-4" />,
              onClick: () => {},
              color: 'danger' as const,
              shortcut: 'Delete'
            }
          ] : []}
        />

        {showSettings && (
          <SettingsModal
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
          />
        )}
      </main>
    </ResponsiveLayout>
  );
}
