// components/Breadcrumbs.tsx
import React from 'react';
import { FaChevronRight } from 'react-icons/fa'; // Icon mũi tên phải

interface BreadcrumbsProps {
  currentPath: string; // Ví dụ: "folder1/subfolderA/" hoặc ""
  onNavigate: (path: string) => void;
}

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ currentPath, onNavigate }) => {
  // Tách path thành các phần, loại bỏ phần tử rỗng (do dấu / cuối cùng)
  const pathSegments = currentPath.split('/').filter(Boolean);

  const handleNavigate = (index: number) => {
    // Tạo path mới dựa trên index được click
    // index = -1 nghĩa là về thư mục gốc
    const newPath = pathSegments.slice(0, index + 1).join('/') + (index >= 0 ? '/' : '');
    onNavigate(newPath);
  };

  return (
    <nav className="flex items-center space-x-1.5 text-sm text-gray-600 dark:text-gray-400 mb-4 px-1" aria-label="Breadcrumb">
      {/* Nút về gốc */}
      <button
        onClick={() => handleNavigate(-1)}
        className={`hover:text-blue-600 dark:hover:text-blue-400 ${pathSegments.length === 0 ? 'font-medium text-gray-800 dark:text-gray-200' : ''}`}
        aria-current={pathSegments.length === 0 ? 'page' : undefined}
      >
        Home
      </button>

      {/* Các phần của đường dẫn */}
      {pathSegments.map((segment, index) => (
        <React.Fragment key={index}>
          <FaChevronRight className="w-3 h-3 text-gray-400 dark:text-gray-500" />
          <button
            onClick={() => handleNavigate(index)}
            className={`hover:text-blue-600 dark:hover:text-blue-400 ${index === pathSegments.length - 1 ? 'font-medium text-gray-800 dark:text-gray-200' : ''}`}
            aria-current={index === pathSegments.length - 1 ? 'page' : undefined}
          >
            {/* Decode tên thư mục nếu cần (trường hợp tên có ký tự đặc biệt đã được encode) */}
            {decodeURIComponent(segment)}
          </button>
        </React.Fragment>
      ))}
    </nav>
  );
};

export default Breadcrumbs;