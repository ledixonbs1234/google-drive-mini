// components/MobileActionSheet.tsx
'use client';

import { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { FaTimes, FaDownload, FaTrash, FaEdit, FaEye, FaShare, FaFolder, FaCopy, FaCut } from 'react-icons/fa';

interface ActionItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  color?: 'default' | 'danger' | 'success' | 'warning';
  disabled?: boolean;
}

interface MobileActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  actions: ActionItem[];
  className?: string;
}

const MobileActionSheet: React.FC<MobileActionSheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  actions,
  className = ''
}) => {
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Handle swipe to dismiss
  const handleTouchStart = (e: React.TouchEvent) => {
    setStartY(e.touches[0].clientY);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    
    const currentYPos = e.touches[0].clientY;
    const deltaY = currentYPos - startY;
    
    if (deltaY > 0) {
      setCurrentY(deltaY);
    }
  };

  const handleTouchEnd = () => {
    if (currentY > 100) {
      onClose();
    }
    setCurrentY(0);
    setIsDragging(false);
  };

  // Reset currentY when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentY(0);
    }
  }, [isOpen]);

  const getActionColor = (color?: string) => {
    switch (color) {
      case 'danger':
        return 'text-red-600 dark:text-red-400';
      case 'success':
        return 'text-green-600 dark:text-green-400';
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400';
      default:
        return 'text-gray-700 dark:text-gray-300';
    }
  };

  const getActionBg = (color?: string) => {
    switch (color) {
      case 'danger':
        return 'hover:bg-red-50 dark:hover:bg-red-900/20';
      case 'success':
        return 'hover:bg-green-50 dark:hover:bg-green-900/20';
      case 'warning':
        return 'hover:bg-yellow-50 dark:hover:bg-yellow-900/20';
      default:
        return 'hover:bg-gray-50 dark:hover:bg-zinc-700';
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
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
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        {/* Bottom Sheet */}
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="transform translate-y-full"
              enterTo="transform translate-y-0"
              leave="ease-in duration-200"
              leaveFrom="transform translate-y-0"
              leaveTo="transform translate-y-full"
            >
              <Dialog.Panel 
                className={`w-full max-w-md transform overflow-hidden rounded-t-2xl bg-white dark:bg-zinc-800 shadow-xl transition-all ${className}`}
                style={{ 
                  transform: `translateY(${currentY}px)`,
                  transition: isDragging ? 'none' : 'transform 0.2s ease-out'
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {/* Drag Handle */}
                <div className="flex justify-center pt-4 pb-2">
                  <div className="w-12 h-1 bg-gray-300 dark:bg-zinc-600 rounded-full" />
                </div>

                {/* Header */}
                {(title || subtitle) && (
                  <div className="px-6 pb-4">
                    {title && (
                      <Dialog.Title as="h3" className="text-lg font-medium text-gray-900 dark:text-gray-100">
                        {title}
                      </Dialog.Title>
                    )}
                    {subtitle && (
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {subtitle}
                      </p>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="px-4 pb-6">
                  <div className="space-y-1">
                    {actions.map((action) => (
                      <button
                        key={action.id}
                        onClick={() => {
                          action.onClick();
                          onClose();
                        }}
                        disabled={action.disabled}
                        className={`w-full flex items-center space-x-4 px-4 py-3 text-left rounded-lg transition-colors ${
                          action.disabled 
                            ? 'opacity-50 cursor-not-allowed' 
                            : `${getActionBg(action.color)} active:scale-95`
                        }`}
                      >
                        <div className={`w-6 h-6 flex items-center justify-center ${getActionColor(action.color)}`}>
                          {action.icon}
                        </div>
                        <span className={`flex-1 ${getActionColor(action.color)} ${action.disabled ? 'opacity-50' : ''}`}>
                          {action.label}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Cancel Button */}
                  <button
                    onClick={onClose}
                    className="w-full mt-4 py-3 text-center text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-zinc-700 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-zinc-600 transition-colors"
                  >
                    Hủy
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

// Predefined action sets for common use cases
export const createFileActions = (
  fileName: string,
  onDownload: () => void,
  onDelete: () => void,
  onRename: () => void,
  onShare: () => void,
  onView?: () => void
): ActionItem[] => [
  ...(onView ? [{
    id: 'view',
    label: 'Xem trước',
    icon: <FaEye className="w-4 h-4" />,
    onClick: onView
  }] : []),
  {
    id: 'download',
    label: 'Tải xuống',
    icon: <FaDownload className="w-4 h-4" />,
    onClick: onDownload
  },
  {
    id: 'rename',
    label: 'Đổi tên',
    icon: <FaEdit className="w-4 h-4" />,
    onClick: onRename
  },
  {
    id: 'share',
    label: 'Chia sẻ',
    icon: <FaShare className="w-4 h-4" />,
    onClick: onShare
  },
  {
    id: 'delete',
    label: 'Xóa',
    icon: <FaTrash className="w-4 h-4" />,
    onClick: onDelete,
    color: 'danger' as const
  }
];

export const createFolderActions = (
  folderName: string,
  onOpen: () => void,
  onDelete: () => void,
  onRename: () => void,
  onShare: () => void
): ActionItem[] => [
  {
    id: 'open',
    label: 'Mở thư mục',
    icon: <FaFolder className="w-4 h-4" />,
    onClick: onOpen
  },
  {
    id: 'rename',
    label: 'Đổi tên',
    icon: <FaEdit className="w-4 h-4" />,
    onClick: onRename
  },
  {
    id: 'share',
    label: 'Chia sẻ',
    icon: <FaShare className="w-4 h-4" />,
    onClick: onShare
  },
  {
    id: 'delete',
    label: 'Xóa',
    icon: <FaTrash className="w-4 h-4" />,
    onClick: onDelete,
    color: 'danger' as const
  }
];

export const createMultiSelectActions = (
  selectedCount: number,
  onDownloadAll: () => void,
  onDeleteAll: () => void,
  onMoveToFolder: () => void,
  onCopy: () => void
): ActionItem[] => [
  {
    id: 'download',
    label: `Tải xuống ${selectedCount} mục`,
    icon: <FaDownload className="w-4 h-4" />,
    onClick: onDownloadAll
  },
  {
    id: 'move',
    label: 'Di chuyển đến...',
    icon: <FaFolder className="w-4 h-4" />,
    onClick: onMoveToFolder
  },
  {
    id: 'copy',
    label: 'Sao chép',
    icon: <FaCopy className="w-4 h-4" />,
    onClick: onCopy
  },
  {
    id: 'delete',
    label: `Xóa ${selectedCount} mục`,
    icon: <FaTrash className="w-4 h-4" />,
    onClick: onDeleteAll,
    color: 'danger' as const
  }
];

export default MobileActionSheet;
