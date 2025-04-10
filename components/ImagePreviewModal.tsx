// components/ImagePreviewModal.tsx
'use client';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { FaTimes } from 'react-icons/fa';
import { useAppStore } from '../store/useAppStore';

const ImagePreviewModal: React.FC = () => {
  const isOpen = useAppStore((state) => state.isImagePreviewModalOpen);
  const imageUrl = useAppStore((state) => state.previewImageUrl);
  const closeModal = useAppStore((state) => state.closeImagePreviewModal);

  if (!imageUrl) return null; // Không render gì nếu không có url

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-20" onClose={closeModal}>
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
          <div className="fixed inset-0 bg-black bg-opacity-75" />
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
              <Dialog.Panel className="relative w-full max-w-4xl transform overflow-hidden rounded-lg bg-white dark:bg-zinc-800 p-2 text-left align-middle shadow-xl transition-all">
                 {/* Nút đóng ở góc trên bên phải */}
                 <button
                    onClick={closeModal}
                    className="absolute top-2 right-2 z-30 p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-75 focus:outline-none"
                    aria-label="Đóng xem trước"
                  >
                    <FaTimes className="w-5 h-5" />
                  </button>

                {/* Nội dung ảnh */}
                <div className="flex justify-center items-center max-h-[85vh]">
                  <img
                    src={imageUrl}
                    alt="Xem trước ảnh"
                    className="max-w-full max-h-full object-contain rounded"
                  />
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default ImagePreviewModal;