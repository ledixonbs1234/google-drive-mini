// components/SettingsModal.tsx
'use client';

import { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { FaTimes, FaCog, FaDatabase, FaPalette, FaCheck } from 'react-icons/fa';
import { useAppStore, AppSettings } from '../store/useAppStore';
import { twMerge } from 'tailwind-merge';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 'general' | 'appearance' | 'storage';

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const { theme, setTheme, settings, updateSettings } = useAppStore();
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDraft(settings);
      setSavedToast(false);
    }
  }, [isOpen, settings]);

  const handleSave = () => {
    updateSettings(draft);
    setSavedToast(true);
    setTimeout(() => {
      onClose();
    }, 400);
  };

  const tabs = [
    { id: 'general' as const, label: 'Chung & Thao tác', icon: FaCog },
    { id: 'appearance' as const, label: 'Giao diện hiển thị', icon: FaPalette },
    { id: 'storage' as const, label: 'Tải lên & Lưu trữ', icon: FaDatabase },
  ];

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <div className="fixed inset-0 bg-black/50" />

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-zinc-800 text-left shadow-xl">
              <div className="flex flex-col sm:flex-row min-h-[380px]">
                {/* Sidebar */}
                <div className="w-full sm:w-52 bg-gray-50 dark:bg-zinc-900 p-4 border-b sm:border-b-0 sm:border-r border-gray-200 dark:border-zinc-700">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Cài đặt</h2>
                    <button onClick={onClose} className="sm:hidden text-gray-400 hover:text-gray-600">
                      <FaTimes />
                    </button>
                  </div>
                  <nav className="flex sm:flex-col gap-1.5 overflow-x-auto">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={twMerge(
                          'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-colors',
                          activeTab === tab.id
                            ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800'
                        )}
                      >
                        <tab.icon className="w-4 h-4 flex-shrink-0" />
                        <span>{tab.label}</span>
                      </button>
                    ))}
                  </nav>
                </div>

                {/* Content */}
                <div className="flex-1 p-5 space-y-4">
                  {activeTab === 'general' && (
                    <div className="space-y-4">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-white">Tùy chọn chung</h3>

                      <div className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-zinc-700">
                        <div>
                          <div className="text-sm font-medium">Chuyển vào Thùng rác khi xóa</div>
                          <div className="text-xs text-gray-500">Giúp khôi phục lại tệp nếu thành viên xóa nhầm</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={draft.useTrash}
                          onChange={(e) => setDraft({ ...draft, useTrash: e.target.checked })}
                          className="h-4 w-4 rounded text-blue-600"
                        />
                      </div>

                      <div className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-zinc-700">
                        <div>
                          <div className="text-sm font-medium">Hỏi xác nhận trước khi xóa</div>
                          <div className="text-xs text-gray-500">Hiển thị hộp thoại xác nhận an toàn</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={draft.confirmDelete}
                          onChange={(e) => setDraft({ ...draft, confirmDelete: e.target.checked })}
                          className="h-4 w-4 rounded text-blue-600"
                        />
                      </div>

                      <div className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-zinc-700">
                        <div>
                          <div className="text-sm font-medium">Hiển thị tệp ẩn (bắt đầu bằng dấu chấm)</div>
                          <div className="text-xs text-gray-500">Ví dụ: .env, .gitignore</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={draft.showHiddenFiles}
                          onChange={(e) => setDraft({ ...draft, showHiddenFiles: e.target.checked })}
                          className="h-4 w-4 rounded text-blue-600"
                        />
                      </div>

                      <div className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-zinc-700">
                        <div>
                          <div className="text-sm font-medium">Chế độ xem mặc định</div>
                          <div className="text-xs text-gray-500">Áp dụng khi mở ứng dụng</div>
                        </div>
                        <select
                          value={draft.defaultView}
                          onChange={(e) => setDraft({ ...draft, defaultView: e.target.value as 'grid' | 'list' })}
                          className="px-3 py-1.5 text-sm border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700"
                        >
                          <option value="grid">Lưới (Grid)</option>
                          <option value="list">Danh sách (List)</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between py-2.5">
                        <div>
                          <div className="text-sm font-medium">Thứ tự sắp xếp mặc định</div>
                          <div className="text-xs text-gray-500">Mặc định ưu tiên tệp mới tải lên đứng đầu</div>
                        </div>
                        <select
                          value={`${draft.defaultSortField}-${draft.defaultSortOrder}`}
                          onChange={(e) => {
                            const [field, order] = e.target.value.split('-') as [
                              AppSettings['defaultSortField'],
                              AppSettings['defaultSortOrder']
                            ];
                            setDraft({ ...draft, defaultSortField: field, defaultSortOrder: order });
                          }}
                          className="px-3 py-1.5 text-xs sm:text-sm border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700"
                        >
                          <option value="updated-desc">Thời gian (Mới nhất trước)</option>
                          <option value="updated-asc">Thời gian (Cũ nhất trước)</option>
                          <option value="name-asc">Tên (A → Z)</option>
                          <option value="size-desc">Kích thước (Lớn nhất trước)</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {activeTab === 'appearance' && (
                    <div className="space-y-4">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-white">Giao diện hiển thị</h3>

                      <div className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-zinc-700">
                        <div>
                          <div className="text-sm font-medium">Chủ đề màu sắc</div>
                          <div className="text-xs text-gray-500">Chuyển đổi nền Sáng / Tối</div>
                        </div>
                        <select
                          value={theme}
                          onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
                          className="px-3 py-1.5 text-sm border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700"
                        >
                          <option value="light">☀️ Nền Sáng</option>
                          <option value="dark">🌙 Nền Tối</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-zinc-700">
                        <div>
                          <div className="text-sm font-medium">Hiển thị ảnh thu nhỏ (Thumbnails)</div>
                          <div className="text-xs text-gray-500">Xem trước hình ảnh ngay trên lưới thư mục</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={draft.showThumbnails}
                          onChange={(e) => setDraft({ ...draft, showThumbnails: e.target.checked })}
                          className="h-4 w-4 rounded text-blue-600"
                        />
                      </div>

                      <div className="flex items-center justify-between py-2.5">
                        <div>
                          <div className="text-sm font-medium">Mật độ hiển thị thu gọn (Compact)</div>
                          <div className="text-xs text-gray-500">Hiển thị nhiều tệp hơn trên cùng một màn hình</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={draft.compactMode}
                          onChange={(e) => setDraft({ ...draft, compactMode: e.target.checked })}
                          className="h-4 w-4 rounded text-blue-600"
                        />
                      </div>
                    </div>
                  )}

                  {activeTab === 'storage' && (
                    <div className="space-y-4">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-white">Tải lên & Lưu trữ R2</h3>

                      <div className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-zinc-700">
                        <div>
                          <div className="text-sm font-medium">Khi tải lên tệp trùng tên</div>
                          <div className="text-xs text-gray-500">Tránh ghi đè nhầm tệp của người khác trong kho chung</div>
                        </div>
                        <select
                          value={draft.conflictMode}
                          onChange={(e) => setDraft({ ...draft, conflictMode: e.target.value as 'rename' | 'overwrite' })}
                          className="px-2.5 py-1.5 text-xs border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700"
                        >
                          <option value="rename">Tự đổi tên: file (1)</option>
                          <option value="overwrite">Ghi đè tệp cũ</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-zinc-700">
                        <div>
                          <div className="text-sm font-medium">Tự động nén tệp thực thi (.exe, .msi, .apk)</div>
                          <div className="text-xs text-gray-500">Đóng gói thành .zip an toàn khi tải lên & tự giải nén khi tải về</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={draft.compressionEnabled}
                          onChange={(e) => setDraft({ ...draft, compressionEnabled: e.target.checked })}
                          className="h-4 w-4 rounded text-blue-600"
                        />
                      </div>

                      <div className="flex items-center justify-between py-2.5">
                        <div>
                          <div className="text-sm font-medium">Số tệp tải lên song song tối đa</div>
                          <div className="text-xs text-gray-500">Giúp ổn định tốc độ mạng khi tải cả thư mục lớn</div>
                        </div>
                        <select
                          value={draft.maxConcurrentUploads}
                          onChange={(e) => setDraft({ ...draft, maxConcurrentUploads: Number(e.target.value) })}
                          className="px-3 py-1.5 text-sm border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700"
                        >
                          <option value={1}>1 tệp / lượt</option>
                          <option value={3}>3 tệp / lượt (Khuyên dùng)</option>
                          <option value={5}>5 tệp / lượt (Mạng nhanh)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-zinc-700 px-5 py-3.5 flex items-center justify-between bg-gray-50 dark:bg-zinc-900/60">
                <div>
                  {savedToast && (
                    <span className="text-xs text-emerald-600 font-medium inline-flex items-center gap-1">
                      <FaCheck /> Đã lưu cài đặt!
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={onClose}
                    className="px-4 py-1.5 text-sm rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700"
                  >
                    Đóng
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
                  >
                    Lưu cài đặt
                  </button>
                </div>
              </div>
            </Dialog.Panel>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default SettingsModal;
