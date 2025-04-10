// components/CreateFolderModal.tsx
'use client';
import { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { FaFolderPlus, FaTimes } from 'react-icons/fa';
import { useAppStore } from '../store/useAppStore';
import { storage, createFolder } from '../lib/firebase'; // Import hàm createFolder

interface CreateFolderModalProps {
  currentPath: string; // Đường dẫn thư mục hiện tại để tạo thư mục con
  onFolderCreated: () => void; // Callback để load lại danh sách
}

const CreateFolderModal: React.FC<CreateFolderModalProps> = ({ currentPath, onFolderCreated }) => {
  const [folderName, setFolderName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isOpen = useAppStore((state) => state.isCreateFolderModalOpen);
  const closeModal = useAppStore((state) => state.closeCreateFolderModal);

  const handleCreate = async () => {
    if (!folderName.trim()) {
      setError('Tên thư mục không được để trống.');
      return;
    }
    // Validate tên thư mục (tránh các ký tự không hợp lệ như / \ : * ? " < > |)
    const invalidChars = /[\\/:\*\?"<>\|]/;
    if (invalidChars.test(folderName)) {
        setError('Tên thư mục chứa ký tự không hợp lệ.');
        return;
    }

    setIsLoading(true);
    setError(null);

    // Đường dẫn đầy đủ đến thư mục mới trong Firebase Storage
    // Ví dụ: currentPath = "folderA/", folderName = "newFolder" => newFolderPath = "uploads/folderA/newFolder/"
    const fullPath = `uploads/${currentPath}${folderName.trim()}/`;


    try {
      await createFolder(fullPath); // Gọi hàm tạo thư mục từ firebase.ts
      onFolderCreated(); // Gọi callback để refresh danh sách
      closeModalAndReset();
    } catch (err) {
      console.error("Lỗi tạo thư mục:", err);
      setError('Tạo thư mục thất bại. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  const closeModalAndReset = () => {
    closeModal();
    setFolderName('');
    setError(null);
    setIsLoading(false);
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={closeModalAndReset}>
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25 dark:bg-opacity-50" />
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
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-zinc-800 p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100 flex justify-between items-center"
                >
                  <span><FaFolderPlus className="inline mr-2 mb-1"/>Tạo thư mục mới</span>
                  <button onClick={closeModalAndReset} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                      <FaTimes />
                  </button>
                </Dialog.Title>
                <div className="mt-4">
                  <input
                    type="text"
                    value={folderName}
                    onChange={(e) => {
                        setFolderName(e.target.value);
                        if (error) setError(null); // Xóa lỗi khi người dùng gõ
                    }}
                    placeholder="Nhập tên thư mục..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-700 dark:text-gray-100"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }} // Cho phép nhấn Enter để tạo
                  />
                  {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
                </div>

                <div className="mt-5 sm:mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-transparent bg-gray-200 dark:bg-zinc-600 px-4 py-2 text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-800 disabled:opacity-50"
                    onClick={closeModalAndReset}
                    disabled={isLoading}
                  >
                    Hủy
                  </button>
                   <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleCreate}
                    disabled={isLoading || !folderName.trim()}
                  >
                    {isLoading ? 'Đang tạo...' : 'Tạo'}
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

export default CreateFolderModal;