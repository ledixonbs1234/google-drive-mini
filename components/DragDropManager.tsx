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

  // Only show a small drag preview following the cursor, no overlay
  return (
    <div
      ref={dragRef}
      className={twMerge(
        'fixed z-50 pointer-events-none select-none',
        'bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700',
        'rounded-lg shadow-lg p-2 min-w-[120px] max-w-[220px]',
        className
      )}
      style={{
        left: dragPosition.x + 12,
        top: dragPosition.y + 12,
        transform: 'translate(0, 0)',
        pointerEvents: 'none',
        opacity: 0.95
      }}
    >
      <div className="flex items-center space-x-2">
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
        <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
          {draggedItems.length === 1 ? draggedItems[0].name : `${draggedItems.length} mục`}
        </span>
      </div>
      {draggedItems.length > 1 && (
        <div className="text-[10px] text-gray-600 dark:text-gray-400 mt-1">
          {draggedItems.slice(0, 2).map((item, index) => (
            <div key={index} className="truncate">
              {item.name}
            </div>
          ))}
          {draggedItems.length > 2 && (
            <div className="text-gray-500">
              +{draggedItems.length - 2} mục khác
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DragDropManager;
