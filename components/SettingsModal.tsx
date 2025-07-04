// components/SettingsModal.tsx
'use client';

import { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { FaTimes, FaCog, FaShieldAlt, FaDatabase, FaPalette, FaCode } from 'react-icons/fa';
import { useAppStore } from '../store/useAppStore';
import { twMerge } from 'tailwind-merge';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 'general' | 'appearance' | 'storage' | 'privacy' | 'advanced';

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const { theme, viewMode, setViewMode, toggleTheme, setTheme } = useAppStore();

  const [settings, setSettings] = useState({
    // General
    autoSave: true,
    defaultView: 'grid' as 'grid' | 'list',
    showHiddenFiles: false,
    confirmDelete: true,
    autoRefresh: true,
    language: 'vi',
    
    // Appearance
    compactMode: false,
    showThumbnails: true,
    animationsEnabled: true,
    
    // Storage
    maxUploadSize: 100, // MB
    compressionEnabled: true,
    autoCleanup: false,
    backupEnabled: true,
    
    // Privacy
    shareLinks: true,
    downloadTracking: false,
    analyticsEnabled: false,
    
    // Advanced
    debugMode: false,
    experimentalFeatures: false,
    cacheEnabled: true,
    preloadEnabled: true
  });

  const handleSettingChange = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const tabs = [
    { id: 'general', label: 'Chung', icon: FaCog },
    { id: 'appearance', label: 'Giao diện', icon: FaPalette },
    { id: 'storage', label: 'Lưu trữ', icon: FaDatabase },
    { id: 'privacy', label: 'Riêng tư', icon: FaShieldAlt },
    { id: 'advanced', label: 'Nâng cao', icon: FaCode }
  ] as const;

  const renderGeneralSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Cài đặt chung</h3>
        
        {/* Auto Save */}
        <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-zinc-700">
          <div>
            <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Tự động lưu
            </label>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Tự động lưu các thay đổi mà không cần xác nhận
            </p>
          </div>
          <input
            type="checkbox"
            checked={settings.autoSave}
            onChange={(e) => handleSettingChange('autoSave', e.target.checked)}
            className="toggle-checkbox"
          />
        </div>

        {/* Default View */}
        <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-zinc-700">
          <div>
            <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Chế độ xem mặc định
            </label>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Chế độ hiển thị file và thư mục
            </p>
          </div>
          <select
            value={settings.defaultView}
            onChange={(e) => handleSettingChange('defaultView', e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-sm"
          >
            <option value="grid">Lưới</option>
            <option value="list">Danh sách</option>
          </select>
        </div>

        {/* Show Hidden Files */}
        <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-zinc-700">
          <div>
            <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Hiển thị file ẩn
            </label>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Hiển thị các file và thư mục ẩn
            </p>
          </div>
          <input
            type="checkbox"
            checked={settings.showHiddenFiles}
            onChange={(e) => handleSettingChange('showHiddenFiles', e.target.checked)}
            className="toggle-checkbox"
          />
        </div>

        {/* Confirm Delete */}
        <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-zinc-700">
          <div>
            <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Xác nhận xóa
            </label>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Hiển thị hộp thoại xác nhận trước khi xóa
            </p>
          </div>
          <input
            type="checkbox"
            checked={settings.confirmDelete}
            onChange={(e) => handleSettingChange('confirmDelete', e.target.checked)}
            className="toggle-checkbox"
          />
        </div>

        {/* Language */}
        <div className="flex items-center justify-between py-3">
          <div>
            <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Ngôn ngữ
            </label>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Ngôn ngữ hiển thị giao diện
            </p>
          </div>
          <select
            value={settings.language}
            onChange={(e) => handleSettingChange('language', e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-sm"
          >
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
            <option value="ko">한국어</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderAppearanceSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Giao diện</h3>
        
        {/* Theme */}
        <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-zinc-700">
          <div>
            <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Chế độ màu
            </label>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Chọn chế độ sáng hoặc tối - Hiện tại: {theme === 'light' ? '☀️ Sáng' : '🌙 Tối'}
            </p>
          </div>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
            className="px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-sm"
          >
            <option value="light">☀️ Sáng</option>
            <option value="dark">🌙 Tối</option>
          </select>
        </div>

        {/* Compact Mode */}
        <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-zinc-700">
          <div>
            <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Chế độ thu gọn
            </label>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Hiển thị giao diện thu gọn để tiết kiệm không gian
            </p>
          </div>
          <input
            type="checkbox"
            checked={settings.compactMode}
            onChange={(e) => handleSettingChange('compactMode', e.target.checked)}
            className="toggle-checkbox"
          />
        </div>

        {/* Show Thumbnails */}
        <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-zinc-700">
          <div>
            <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Hiển thị thumbnail
            </label>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Hiển thị hình thu nhỏ cho ảnh và video
            </p>
          </div>
          <input
            type="checkbox"
            checked={settings.showThumbnails}
            onChange={(e) => handleSettingChange('showThumbnails', e.target.checked)}
            className="toggle-checkbox"
          />
        </div>

        {/* Animations */}
        <div className="flex items-center justify-between py-3">
          <div>
            <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Hiệu ứng chuyển động
            </label>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Bật/tắt hiệu ứng chuyển động trong giao diện
            </p>
          </div>
          <input
            type="checkbox"
            checked={settings.animationsEnabled}
            onChange={(e) => handleSettingChange('animationsEnabled', e.target.checked)}
            className="toggle-checkbox"
          />
        </div>
      </div>
    </div>
  );

  const renderStorageSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Lưu trữ</h3>
        
        {/* Max Upload Size */}
        <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-zinc-700">
          <div>
            <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Kích thước upload tối đa
            </label>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Kích thước tối đa cho mỗi file upload (MB)
            </p>
          </div>
          <input
            type="number"
            value={settings.maxUploadSize}
            onChange={(e) => handleSettingChange('maxUploadSize', parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-sm w-20"
            min="1"
            max="1000"
          />
        </div>

        {/* Compression */}
        <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-zinc-700">
          <div>
            <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Nén file tự động
            </label>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Tự động nén file lớn trước khi upload
            </p>
          </div>
          <input
            type="checkbox"
            checked={settings.compressionEnabled}
            onChange={(e) => handleSettingChange('compressionEnabled', e.target.checked)}
            className="toggle-checkbox"
          />
        </div>

        {/* Auto Cleanup */}
        <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-zinc-700">
          <div>
            <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Tự động dọn dẹp
            </label>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Tự động xóa file tạm và file rác
            </p>
          </div>
          <input
            type="checkbox"
            checked={settings.autoCleanup}
            onChange={(e) => handleSettingChange('autoCleanup', e.target.checked)}
            className="toggle-checkbox"
          />
        </div>

        {/* Backup */}
        <div className="flex items-center justify-between py-3">
          <div>
            <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Sao lưu tự động
            </label>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Tự động sao lưu dữ liệu quan trọng
            </p>
          </div>
          <input
            type="checkbox"
            checked={settings.backupEnabled}
            onChange={(e) => handleSettingChange('backupEnabled', e.target.checked)}
            className="toggle-checkbox"
          />
        </div>
      </div>
    </div>
  );

  const renderPrivacySettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Riêng tư & Bảo mật</h3>
        
        {/* Share Links */}
        <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-zinc-700">
          <div>
            <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Cho phép chia sẻ link
            </label>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Cho phép tạo và chia sẻ link công khai
            </p>
          </div>
          <input
            type="checkbox"
            checked={settings.shareLinks}
            onChange={(e) => handleSettingChange('shareLinks', e.target.checked)}
            className="toggle-checkbox"
          />
        </div>

        {/* Download Tracking */}
        <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-zinc-700">
          <div>
            <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Theo dõi tải xuống
            </label>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Theo dõi và thống kê hoạt động tải xuống
            </p>
          </div>
          <input
            type="checkbox"
            checked={settings.downloadTracking}
            onChange={(e) => handleSettingChange('downloadTracking', e.target.checked)}
            className="toggle-checkbox"
          />
        </div>

        {/* Analytics */}
        <div className="flex items-center justify-between py-3">
          <div>
            <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Phân tích sử dụng
            </label>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Chia sẻ dữ liệu sử dụng để cải thiện sản phẩm
            </p>
          </div>
          <input
            type="checkbox"
            checked={settings.analyticsEnabled}
            onChange={(e) => handleSettingChange('analyticsEnabled', e.target.checked)}
            className="toggle-checkbox"
          />
        </div>
      </div>
    </div>
  );

  const renderAdvancedSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Nâng cao</h3>
        
        {/* Debug Mode */}
        <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-zinc-700">
          <div>
            <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Chế độ debug
            </label>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Hiển thị thông tin debug trong console
            </p>
          </div>
          <input
            type="checkbox"
            checked={settings.debugMode}
            onChange={(e) => handleSettingChange('debugMode', e.target.checked)}
            className="toggle-checkbox"
          />
        </div>

        {/* Experimental Features */}
        <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-zinc-700">
          <div>
            <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Tính năng thử nghiệm
            </label>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Bật các tính năng đang trong giai đoạn thử nghiệm
            </p>
          </div>
          <input
            type="checkbox"
            checked={settings.experimentalFeatures}
            onChange={(e) => handleSettingChange('experimentalFeatures', e.target.checked)}
            className="toggle-checkbox"
          />
        </div>

        {/* Cache */}
        <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-zinc-700">
          <div>
            <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Bộ nhớ đệm
            </label>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Sử dụng bộ nhớ đệm để tăng tốc độ
            </p>
          </div>
          <input
            type="checkbox"
            checked={settings.cacheEnabled}
            onChange={(e) => handleSettingChange('cacheEnabled', e.target.checked)}
            className="toggle-checkbox"
          />
        </div>

        {/* Preload */}
        <div className="flex items-center justify-between py-3">
          <div>
            <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Tải trước
            </label>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Tải trước nội dung để cải thiện trải nghiệm
            </p>
          </div>
          <input
            type="checkbox"
            checked={settings.preloadEnabled}
            onChange={(e) => handleSettingChange('preloadEnabled', e.target.checked)}
            className="toggle-checkbox"
          />
        </div>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return renderGeneralSettings();
      case 'appearance':
        return renderAppearanceSettings();
      case 'storage':
        return renderStorageSettings();
      case 'privacy':
        return renderPrivacySettings();
      case 'advanced':
        return renderAdvancedSettings();
      default:
        return null;
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white dark:bg-zinc-800 text-left align-middle shadow-xl transition-all">
                <div className="flex">
                  {/* Sidebar */}
                  <div className="w-64 bg-gray-50 dark:bg-zinc-900 p-4 border-r border-gray-200 dark:border-zinc-700">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Cài đặt
                      </h2>
                      <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <FaTimes className="w-5 h-5" />
                      </button>
                    </div>
                    
                    <nav className="space-y-2">
                      {tabs.map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={twMerge(
                            'w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                            activeTab === tab.id
                              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800'
                          )}
                        >
                          <tab.icon className="w-4 h-4" />
                          <span>{tab.label}</span>
                        </button>
                      ))}
                    </nav>
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-6">
                    {renderTabContent()}
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 dark:border-zinc-700 p-4 flex justify-end space-x-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={() => {
                      // Save settings
                      console.log('Save settings:', settings);
                      onClose();
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md"
                  >
                    Lưu thay đổi
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default SettingsModal;
