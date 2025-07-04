// components/DragDropManager.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { FaFolder, FaFile, FaArrowRight, FaTimes } from 'react-icons/fa';
import { twMerge } from 'tailwind-merge';

interface DragDropItem {
  name: string;
  fullPath: string;
  isFolder: boolean;
  url?: string;
}

interface DragDropManagerProps {
  isDragging: boolean;
  draggedItems: DragDropItem[];
  onDragEnd: () => void;
  onDrop: (targetPath: string) => void;
  className?: string;
}

const DragDropManager: React.FC<DragDropManagerProps> = ({
  isDragging,
  draggedItems,
  onDragEnd,
  onDrop,
  className = ''
}) => {
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsVisible(isDragging && draggedItems.length > 0);
  }, [isDragging, draggedItems]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setDragPosition({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => {
      onDragEnd();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onDragEnd]);

  if (!isVisible) return null;

  return (
    <>
      {/* Drag Preview */}
      <div
        ref={dragRef}
        className={twMerge(
          'fixed z-50 pointer-events-none',
          'bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700',
          'rounded-lg shadow-lg p-3 min-w-[200px] max-w-[300px]',
          className
        )}
        style={{
          left: dragPosition.x + 10,
          top: dragPosition.y + 10,
          transform: 'translate(0, 0)'
        }}
      >
        <div className="flex items-center space-x-2 mb-2">
          <div className="text-blue-600 dark:text-blue-400">
            {draggedItems.length === 1 ? (
              draggedItems[0].isFolder ? <FaFolder className="w-4 h-4" /> : <FaFile className="w-4 h-4" />
            ) : (
              <div className="flex -space-x-1">
                <FaFolder className="w-4 h-4" />
                <FaFile className="w-4 h-4" />
              </div>
            )}
          </div>
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {draggedItems.length === 1 ? draggedItems[0].name : `${draggedItems.length} mục`}
          </span>
        </div>
        
        {draggedItems.length > 1 && (
          <div className="text-xs text-gray-600 dark:text-gray-400">
            {draggedItems.slice(0, 3).map((item, index) => (
              <div key={index} className="truncate">
                {item.name}
              </div>
            ))}
            {draggedItems.length > 3 && (
              <div className="text-gray-500">
                +{draggedItems.length - 3} mục khác
              </div>
            )}
          </div>
        )}
      </div>

      {/* Drop Zones Overlay */}
      <div className="fixed inset-0 z-40 pointer-events-none">
        <div className="absolute inset-0 bg-black bg-opacity-10" />
        <div className="absolute inset-4 border-2 border-dashed border-blue-500 rounded-lg bg-blue-50 dark:bg-blue-900 bg-opacity-50 flex items-center justify-center">
          <div className="text-center">
            <FaArrowRight className="w-8 h-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
            <p className="text-lg font-medium text-blue-800 dark:text-blue-200">
              Kéo và thả vào thư mục đích
            </p>
            <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
              Hoặc nhấn ESC để hủy
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default DragDropManager;
