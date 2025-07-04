// components/ContextMenu.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { FaDownload, FaTrash, FaEdit, FaEye, FaShare, FaCopy, FaCut, FaFolder, FaFile, FaInfo } from 'react-icons/fa';
import { twMerge } from 'tailwind-merge';

interface ContextMenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  separator?: boolean;
  color?: 'default' | 'danger' | 'success' | 'warning';
  shortcut?: string;
}

interface ContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  items: ContextMenuItem[];
  className?: string;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  isOpen,
  position,
  onClose,
  items,
  className = ''
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !menuRef.current) return;

    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    let adjustedX = position.x;
    let adjustedY = position.y;

    // Adjust horizontal position
    if (position.x + rect.width > viewport.width) {
      adjustedX = viewport.width - rect.width - 10;
    }

    // Adjust vertical position
    if (position.y + rect.height > viewport.height) {
      adjustedY = viewport.height - rect.height - 10;
    }

    setAdjustedPosition({ x: adjustedX, y: adjustedY });
  }, [isOpen, position]);

  if (!isOpen) return null;

  const getItemColorClass = (color: string = 'default') => {
    switch (color) {
      case 'danger':
        return 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20';
      case 'success':
        return 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20';
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20';
      default:
        return 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700';
    }
  };

  return (
    <div
      ref={menuRef}
      className={twMerge(
        'fixed z-50 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700',
        'rounded-lg shadow-lg py-2 min-w-[200px] max-w-[300px]',
        'animate-in fade-in-0 zoom-in-95 duration-200',
        className
      )}
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y
      }}
    >
      {items.map((item, index) => (
        <div key={item.id}>
          {item.separator && (
            <div className="h-px bg-gray-200 dark:bg-zinc-700 my-1" />
          )}
          <button
            onClick={() => {
              if (!item.disabled) {
                item.onClick();
                onClose();
              }
            }}
            disabled={item.disabled}
            className={twMerge(
              'w-full flex items-center justify-between px-3 py-2 text-sm',
              'transition-colors duration-150',
              item.disabled
                ? 'opacity-50 cursor-not-allowed'
                : 'cursor-pointer',
              !item.disabled && getItemColorClass(item.color)
            )}
          >
            <div className="flex items-center space-x-3">
              <span className="w-4 h-4 flex-shrink-0">
                {item.icon}
              </span>
              <span className="truncate">
                {item.label}
              </span>
            </div>
            {item.shortcut && (
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                {item.shortcut}
              </span>
            )}
          </button>
        </div>
      ))}
    </div>
  );
};

export default ContextMenu;
