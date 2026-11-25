// components/Breadcrumbs.tsx
import React from 'react';
import { FaChevronRight, FaHome } from 'react-icons/fa';

interface BreadcrumbsProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onDropToPath?: (targetPath: string) => void;
}

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ currentPath, onNavigate, onDropToPath }) => {
  const pathSegments = currentPath.split('/').filter(Boolean);

  const handleNavigate = (index: number) => {
    const newPath = pathSegments.slice(0, index + 1).join('/') + (index >= 0 ? '/' : '');
    onNavigate(newPath);
  };

  const makeDropHandlers = (targetPath: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!onDropToPath) return;
      e.preventDefault();
      e.currentTarget.classList.add('bg-blue-100', 'dark:bg-blue-900/40', 'text-blue-700');
    },
    onDragLeave: (e: React.DragEvent) => {
      e.currentTarget.classList.remove('bg-blue-100', 'dark:bg-blue-900/40', 'text-blue-700');
    },
    onDrop: (e: React.DragEvent) => {
      if (!onDropToPath) return;
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.classList.remove('bg-blue-100', 'dark:bg-blue-900/40', 'text-blue-700');
      onDropToPath(targetPath);
    },
  });

  return (
    <nav
      className="flex flex-wrap items-center gap-1 text-sm text-gray-600 dark:text-gray-400 mb-4 px-1"
      aria-label="Breadcrumb"
    >
      <button
        type="button"
        onClick={() => handleNavigate(-1)}
        {...makeDropHandlers('uploads/')}
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors hover:bg-gray-100 dark:hover:bg-zinc-700 hover:text-blue-600 dark:hover:text-blue-400 ${
          pathSegments.length === 0 ? 'font-semibold text-gray-900 dark:text-gray-100' : ''
        }`}
        title="Nhấp để về thư mục gốc (hoặc kéo thả file vào đây để chuyển ra ngoài gốc)"
      >
        <FaHome className="w-3.5 h-3.5 text-blue-500" />
        <span>Kho chung</span>
      </button>

      {pathSegments.map((segment, index) => {
        const segmentTarget = `uploads/${pathSegments.slice(0, index + 1).join('/')}/`;
        const isLast = index === pathSegments.length - 1;
        return (
          <React.Fragment key={segmentTarget}>
            <FaChevronRight className="w-2.5 h-2.5 text-gray-400 dark:text-gray-500" />
            <button
              type="button"
              onClick={() => handleNavigate(index)}
              {...makeDropHandlers(segmentTarget)}
              className={`px-2 py-1 rounded-md transition-colors hover:bg-gray-100 dark:hover:bg-zinc-700 hover:text-blue-600 dark:hover:text-blue-400 ${
                isLast ? 'font-semibold text-gray-900 dark:text-gray-100' : ''
              }`}
            >
              {decodeURIComponent(segment)}
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default Breadcrumbs;
