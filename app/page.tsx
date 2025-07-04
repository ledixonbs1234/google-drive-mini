// app/page.tsx
'use client'; // Cần thiết vì sử dụng hooks (useState, useEffect) và Zustand

import { useState, useEffect, useCallback } from 'react';
import EnhancedFileUploader from '../components/EnhancedFileUploader';
import AdvancedSearch from '../components/AdvancedSearch';
import FileList from '../components/FileList';
import Breadcrumbs from '../components/Breadcrumbs';
import CreateFolderModal from '../components/CreateFolderModal';
import ImagePreviewModal from '../components/ImagePreviewModal';
import PreviewModal from '../components/PreviewModal';
import CodeEditorModal from '../components/CodeEditorModal'; 
import StorageIndicator from '../components/StorageIndicator'; // Chỉ giữ StorageIndicator
import { useAppStore } from '../store/useAppStore'; // Import store Zustand
import { FaFolderPlus, FaSearch, FaThLarge, FaList, FaSun, FaMoon } from 'react-icons/fa'; // Thêm icons
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
  const refreshData = () => {
      // Tạo một giá trị mới để buộc useEffect trong FileList chạy lại nếu cần
      // Tuy nhiên, cách tốt nhất là FileList tự fetch khi path thay đổi
      console.log("Yêu cầu refresh dữ liệu cho path:", currentPath);
      setRefreshKey(prevKey => prevKey + 1);
      // Trigger refresh storage quota
      setStorageRefreshTrigger(prev => prev + 1);
      // Nếu FileList không tự động cập nhật sau khi tạo/xóa, bạn cần cơ chế khác
      // Ví dụ: thêm một state `refreshKey` và thay đổi nó
  };


  // Xử lý điều hướng khi click Breadcrumb hoặc Folder
  const handleNavigate = useCallback((newPath: string) => {
      setCurrentPath(newPath);
      setSearchTerm(''); // Reset tìm kiếm khi chuyển thư mục
  }, []); // Không có dependency vì chỉ set state


  return (
    <main className="min-h-screen text-gray-900 dark:text-gray-100 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto bg-white dark:bg-zinc-800 shadow-lg rounded-xl overflow-hidden">
        {/* Header của ứng dụng */}
        <header className="p-4 border-b border-gray-200 dark:border-zinc-700 flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0">
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
                {viewMode === 'grid' ? <FaList className="w-4 h-4"/> : <FaThLarge className="w-4 h-4"/>}
            </button>

            {/* Theme Toggle */}
            <button
                onClick={toggleTheme}
                className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-zinc-800"
                title={theme === 'light' ? 'Chuyển sang nền tối' : 'Chuyển sang nền sáng'}
            >
                {theme === 'light' ? <FaMoon className="w-4 h-4"/> : <FaSun className="w-4 h-4"/>}
            </button>

            {/* Create Folder Button */}
            <button
                onClick={openCreateFolderModal}
                className="flex items-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-1.5 px-3 rounded-md text-sm transition-colors"
                title="Tạo thư mục mới"
            >
                <FaFolderPlus className="w-4 h-4 mr-1.5" />
                <span>Tạo mới</span>
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
    </main>
  );
}