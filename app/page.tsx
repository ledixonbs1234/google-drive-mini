// app/page.tsx
'use client'; // Cần thiết vì sử dụng hooks (useState, useEffect) và Zustand

import { useState, useCallback } from 'react';
import EnhancedFileUploader from '../components/EnhancedFileUploader';
import AdvancedSearch from '../components/AdvancedSearch';
import FileList from '../components/FileList';
import Breadcrumbs from '../components/Breadcrumbs';
import CreateFolderModal from '../components/CreateFolderModal';
import ImagePreviewModal from '../components/ImagePreviewModal';
import PreviewModal from '../components/PreviewModal';
import CodeEditorModal from '../components/CodeEditorModal';
import StorageIndicator from '../components/StorageIndicator'; // Chỉ giữ StorageIndicator
import ResponsiveLayout from '../components/ResponsiveLayout';
import MobileActionSheet from '../components/MobileActionSheet';
import MultiSelectToolbar from '../components/MultiSelectToolbar';
import DragDropManager from '../components/DragDropManager';
import ContextMenu from '../components/ContextMenu';
import SettingsModal from '../components/SettingsModal';
import { useAppStore } from '../store/useAppStore'; // Import store Zustand
import { FaFolderPlus, FaThLarge, FaList, FaSun, FaMoon, FaEye, FaDownload, FaTrash, FaEdit, FaCopy, FaCut, FaInfo, FaCog } from 'react-icons/fa'; // Thêm icons
import SharedNotepad from '@/components/SharedNotepad';

export default function Home() {
  // State quản lý đường dẫn thư mục hiện tại
  // Ví dụ: "" (gốc), "folderA/", "folderA/subFolderB/"
  const [currentPath, setCurrentPath] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  // State cho việc tìm kiếm
  const [searchTerm, setSearchTerm] = useState('');
  // State để trigger refresh storage quota
  const [storageRefreshTrigger, setStorageRefreshTrigger] = useState(0);
  // State cho mobile action sheet
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showMobileActions, setShowMobileActions] = useState(false);
  // State cho multi-select
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  // State cho drag & drop
  const [isDragging, setIsDragging] = useState(false);
  const [draggedItems, setDraggedItems] = useState<any[]>([]);
  // State cho context menu
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    item: any;
  }>({
    isOpen: false,
    position: { x: 0, y: 0 },
    item: null
  });
  // State cho settings modal
  const [showSettings, setShowSettings] = useState(false);

  // Lấy các state và actions từ store Zustand
  const {
    viewMode, setViewMode,
    theme, toggleTheme,
    openCreateFolderModal,
    openImagePreviewModal,
    openPreviewModal,
    isCreateFolderModalOpen,
    isImagePreviewModalOpen,
    isPreviewModalOpen,
    isEditorModalOpen, // <-- Lấy state của editor modal
  } = useAppStore();


  // Callback để refresh dữ liệu (truyền xuống FileList nếu cần, hoặc FileList tự fetch lại)
  // Trong trường hợp này FileList tự fetch lại khi path thay đổi, nên chỉ cần thay đổi path
  const refreshData = useCallback(async () => {
    // Tạo một giá trị mới để buộc useEffect trong FileList chạy lại nếu cần
    // Tuy nhiên, cách tốt nhất là FileList tự fetch khi path thay đổi
    console.log("Yêu cầu refresh dữ liệu cho path:", currentPath);
    setRefreshKey(prevKey => prevKey + 1);
    // Trigger refresh storage quota
    setStorageRefreshTrigger(prev => prev + 1);
    // Nếu FileList không tự động cập nhật sau khi tạo/xóa, bạn cần cơ chế khác
    // Ví dụ: thêm một state `refreshKey` và thay đổi nó
  }, [currentPath]);

  // Xử lý mobile action sheet
  const handleMobileAction = (item: any) => {
    setSelectedItem(item);
    setShowMobileActions(true);
  };

  const handleCloseMobileActions = () => {
    setShowMobileActions(false);
    setSelectedItem(null);
  };

  // Xử lý multi-select
  const handleMultiSelect = (items: any[]) => {
    setSelectedItems(items);
  };

  const handleClearSelection = () => {
    setSelectedItems([]);
  };

  // Xử lý drag & drop
  const handleDragStart = (items: any[]) => {
    setDraggedItems(items);
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDraggedItems([]);
  };

  const handleDrop = (targetPath: string) => {
    console.log('Drop items:', draggedItems, 'to:', targetPath);
    // Implement actual drop logic here
    handleDragEnd();
  };

  // Xử lý context menu
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


  // Xử lý điều hướng khi click Breadcrumb hoặc Folder
  const handleNavigate = useCallback((newPath: string) => {
    setCurrentPath(newPath);
    setSearchTerm(''); // Reset tìm kiếm khi chuyển thư mục
  }, []); // Không có dependency vì chỉ set state


  return (
    <ResponsiveLayout>
      <main className="min-h-screen bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-gray-100 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto bg-white dark:bg-zinc-800 shadow-lg rounded-xl overflow-hidden">
          {/* Header của ứng dụng */}
          <header className="p-4 border-b border-gray-200 dark:border-zinc-700 flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0 bg-white dark:bg-zinc-800">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">
                🪟 Drive Mini
              </h1>
              {/* Storage Indicator compact trong header */}
              <StorageIndicator
                refreshTrigger={storageRefreshTrigger}
                compact={true}
                showLabel={false}
              />
            </div>

            {/* Thanh công cụ: Search, View, Theme, Create */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              {/* Advanced Search */}
              <div className="flex-1 max-w-md">
                <AdvancedSearch
                  onResultSelect={(result) => {
                    // Handle file selection for preview
                    if (!result.isFolder && result.url) {
                      // Determine file type and open appropriate preview
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
                    // Handle navigation to folder
                    setCurrentPath(path);
                  }}
                />
              </div>

              {/* View Toggle */}
              <button
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-zinc-800"
                title={viewMode === 'grid' ? 'Chuyển sang dạng danh sách' : 'Chuyển sang dạng lưới'}
              >
                {viewMode === 'grid' ? <FaList className="w-4 h-4" /> : <FaThLarge className="w-4 h-4" />}
              </button>

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-zinc-800"
                title={theme === 'light' ? 'Chuyển sang nền tối' : 'Chuyển sang nền sáng'}
              >
                {theme === 'light' ? <FaMoon className="w-4 h-4" /> : <FaSun className="w-4 h-4" />}
              </button>

              {/* Settings */}
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-zinc-800"
                title="Cài đặt"
              >
                <FaCog className="w-4 h-4" />
              </button>

              {/* Create Folder Button */}
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

          {/* Khu vực nội dung chính */}
          <div className="p-4 sm:p-6">
            {/* Breadcrumbs */}
            <Breadcrumbs currentPath={currentPath} onNavigate={handleNavigate} />

            {/* File Uploader */}
            <EnhancedFileUploader currentPath={currentPath} onUploadComplete={refreshData} />

            {/* File List */}
            <FileList
              key={currentPath} // Giữ lại để remount khi navigate
              currentPath={currentPath}
              onNavigate={handleNavigate}
              // onUploadComplete không cần thiết ở đây nữa vì page xử lý refresh
              searchTerm={searchTerm}
              refreshKey={refreshKey} // --- Thêm prop refreshKey ---
            />
            <SharedNotepad />
          </div>
        </div>

        {/* Modals (nằm ngoài cấu trúc layout chính để đảm bảo hiển thị đúng) */}
        {isCreateFolderModalOpen && (
          <CreateFolderModal currentPath={currentPath} onFolderCreated={refreshData} />
        )}
        {isImagePreviewModalOpen && <ImagePreviewModal />}
        {isPreviewModalOpen && <PreviewModal />}

        {/* Render Code Editor Modal nếu isEditorModalOpen là true */}
        {isEditorModalOpen && <CodeEditorModal />}

        {/* Mobile Action Sheet */}
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
                  // Handle download action
                  console.log('Download:', selectedItem);
                  handleCloseMobileActions();
                },
                disabled: selectedItem.isFolder
              },
              {
                id: 'delete',
                label: 'Xóa',
                icon: <FaTrash className="w-4 h-4" />,
                onClick: () => {
                  // Handle delete action
                  console.log('Delete:', selectedItem);
                  handleCloseMobileActions();
                },
                color: 'danger' as const
              }
            ]}
          />
        )}

        {/* Multi-Select Toolbar */}
        <MultiSelectToolbar
          selectedItems={selectedItems}
          onClearSelection={handleClearSelection}
          onDownload={(items) => {
            console.log('Download items:', items);
            handleClearSelection();
          }}
          onDelete={(items) => {
            console.log('Delete items:', items);
            handleClearSelection();
          }}
          onMove={(items) => {
            console.log('Move items:', items);
            handleClearSelection();
          }}
          onCopy={(items) => {
            console.log('Copy items:', items);
            handleClearSelection();
          }}
        />

        {/* Drag Drop Manager */}
        <DragDropManager
          isDragging={isDragging}
          draggedItems={draggedItems}
          onDragEnd={handleDragEnd}
          onDrop={handleDrop}
        />

        {/* Context Menu */}
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
              onClick: () => {
                console.log('Download:', contextMenu.item);
              },
              disabled: contextMenu.item.isFolder,
              shortcut: 'Ctrl+D'
            },
            {
              id: 'copy',
              label: 'Sao chép',
              icon: <FaCopy className="w-4 h-4" />,
              onClick: () => {
                console.log('Copy:', contextMenu.item);
              },
              shortcut: 'Ctrl+C'
            },
            {
              id: 'cut',
              label: 'Cắt',
              icon: <FaCut className="w-4 h-4" />,
              onClick: () => {
                console.log('Cut:', contextMenu.item);
              },
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
              onClick: () => {
                console.log('Edit:', contextMenu.item);
              },
              shortcut: 'F2'
            },
            {
              id: 'info',
              label: 'Thuộc tính',
              icon: <FaInfo className="w-4 h-4" />,
              onClick: () => {
                console.log('Info:', contextMenu.item);
              },
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
              onClick: () => {
                console.log('Delete:', contextMenu.item);
              },
              color: 'danger' as const,
              shortcut: 'Delete'
            }
          ] : []}
        />

        {/* Settings Modal */}
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

