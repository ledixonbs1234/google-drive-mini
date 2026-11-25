// components/ImagePreviewModal.tsx
'use client';

import { Dialog, Transition } from '@headlessui/react';
import { Fragment, useState, useEffect, useCallback } from 'react';
import {
  FaTimes,
  FaChevronLeft,
  FaChevronRight,
  FaSearchPlus,
  FaSearchMinus,
  FaRedo,
  FaDownload,
  FaUndo,
} from 'react-icons/fa';
import { useAppStore } from '../store/useAppStore';

const ImagePreviewModal: React.FC = () => {
  const isOpen = useAppStore((state) => state.isImagePreviewModalOpen);
  const initialUrl = useAppStore((state) => state.previewImageUrl);
  const gallery = useAppStore((state) => state.previewImageGallery);
  const closeModal = useAppStore((state) => state.closeImagePreviewModal);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const effectiveGallery =
    gallery.length > 0
      ? gallery
      : initialUrl
      ? [{ name: initialUrl.split('/').pop()?.split('?')[0] || 'Hình ảnh', url: initialUrl }]
      : [];

  useEffect(() => {
    if (isOpen && initialUrl) {
      const idx = effectiveGallery.findIndex((g) => g.url === initialUrl);
      setCurrentIndex(idx >= 0 ? idx : 0);
      setZoom(1);
      setRotation(0);
    }
  }, [isOpen, initialUrl, gallery.length]);

  const resetTransforms = () => {
    setZoom(1);
    setRotation(0);
  };

  const goPrev = useCallback(() => {
    if (effectiveGallery.length <= 1) return;
    resetTransforms();
    setCurrentIndex((prev) => (prev - 1 + effectiveGallery.length) % effectiveGallery.length);
  }, [effectiveGallery.length]);

  const goNext = useCallback(() => {
    if (effectiveGallery.length <= 1) return;
    resetTransforms();
    setCurrentIndex((prev) => (prev + 1) % effectiveGallery.length);
  }, [effectiveGallery.length]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(z + 0.25, 4));
      else if (e.key === '-') setZoom((z) => Math.max(z - 0.25, 0.5));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, goPrev, goNext]);

  if (!initialUrl || effectiveGallery.length === 0) return null;

  const currentImg = effectiveGallery[currentIndex] || effectiveGallery[0];

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = currentImg.url.includes('/api/files/download')
      ? `${currentImg.url}&download=1`
      : currentImg.url;
    a.download = currentImg.name;
    a.click();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={closeModal}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/90" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <Dialog.Panel className="w-full h-full flex flex-col justify-between select-none">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 bg-black/50 text-white z-20">
              <div className="flex items-center gap-3 min-w-0">
                {effectiveGallery.length > 1 && (
                  <span className="px-2.5 py-0.5 text-xs bg-white/15 rounded-full font-medium">
                    {currentIndex + 1} / {effectiveGallery.length}
                  </span>
                )}
                <span className="text-sm font-medium truncate">{currentImg.name}</span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                  className="p-2 rounded-lg hover:bg-white/15 transition-colors"
                  title="Thu nhỏ (-)"
                >
                  <FaSearchMinus className="w-4 h-4" />
                </button>
                <button
                  onClick={resetTransforms}
                  className="px-2 py-1 text-xs rounded hover:bg-white/15"
                  title="Đặt lại tỷ lệ"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
                  className="p-2 rounded-lg hover:bg-white/15 transition-colors"
                  title="Phóng to (+)"
                >
                  <FaSearchPlus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setRotation((r) => (r - 90) % 360)}
                  className="p-2 rounded-lg hover:bg-white/15 transition-colors"
                  title="Xoay trái 90°"
                >
                  <FaUndo className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="p-2 rounded-lg hover:bg-white/15 transition-colors"
                  title="Xoay phải 90°"
                >
                  <FaRedo className="w-4 h-4" />
                </button>
                <button
                  onClick={handleDownload}
                  className="p-2 rounded-lg hover:bg-white/15 transition-colors"
                  title="Tải ảnh xuống"
                >
                  <FaDownload className="w-4 h-4" />
                </button>
                <button
                  onClick={closeModal}
                  className="p-2 ml-2 rounded-lg bg-white/10 hover:bg-red-600 transition-colors"
                  title="Đóng (Esc)"
                >
                  <FaTimes className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Main Image Canvas */}
            <div className="relative flex-1 flex items-center justify-center overflow-hidden p-4">
              {effectiveGallery.length > 1 && (
                <button
                  onClick={goPrev}
                  className="absolute left-4 z-20 p-3 rounded-full bg-black/60 text-white hover:bg-black/90 transition-colors"
                  title="Ảnh trước (←)"
                >
                  <FaChevronLeft className="w-5 h-5" />
                </button>
              )}

              <img
                src={currentImg.url}
                alt={currentImg.name}
                onDoubleClick={() => setZoom((z) => (z === 1 ? 2 : 1))}
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transition: 'transform 0.2s ease-out',
                }}
                className="max-w-full max-h-[82vh] object-contain rounded shadow-2xl cursor-zoom-in"
              />

              {effectiveGallery.length > 1 && (
                <button
                  onClick={goNext}
                  className="absolute right-4 z-20 p-3 rounded-full bg-black/60 text-white hover:bg-black/90 transition-colors"
                  title="Ảnh tiếp theo (→)"
                >
                  <FaChevronRight className="w-5 h-5" />
                </button>
              )}
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </Transition>
  );
};

export default ImagePreviewModal;
