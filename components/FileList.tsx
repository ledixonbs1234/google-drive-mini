// components/FileList.tsx
'use client';
import { ref, listAll, getDownloadURL, deleteObject, getMetadata, ListResult, StorageReference } from 'firebase/storage';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { storage } from '../lib/firebase';
import FileIcon from './FileIcon';
import { FaDownload, FaTrash, FaFolder, FaFile, FaEdit, FaEllipsisV, FaImage, FaList, FaThLarge, FaInfoCircle, FaSpinner } from 'react-icons/fa'; // Thêm icons
import { useAppStore, EditingFile } from '../store/useAppStore'; // <-- Import EditingFile type
import { twMerge } from 'tailwind-merge';
import { Menu, Transition } from '@headlessui/react'; // Dùng cho menu context
import { Fragment } from 'react'; // Dùng cho Transition
import JSZip from 'jszip'; // Cần JSZip để giải nén
import { saveAs } from 'file-saver'; // Import saveAs từ file-saver
// Định nghĩa kiểu dữ liệu cho file và folder
interface StorageItem {
  name: string;
  fullPath: string;
  isFolder: boolean;
  url?: string; // Chỉ file mới có URL download
  size?: number; // Kích thước file (bytes)
  updated?: Date; // Thời gian cập nhật
}
const EXECUTABLE_EXTENSIONS_FOR_UNZIP = ['exe', 'msi', 'bat', 'cmd', 'sh', 'app', 'dmg', 'deb', 'rpm', 'apk'];
// --- Helper xác định file có thể chỉnh sửa ---
const EDITABLE_EXTENSIONS = [
  'txt', 'log', 'md', 'json', 'js', 'jsx', 'ts', 'tsx', 'html', 'htm', 'css', 'scss', 'sass', 'less', 'xml', 'yaml', 'yml', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'php', 'rb', 'swift', 'kt', 'kts', 'sql', 'sh', 'bash', 'zsh', 'bat', 'cmd', 'ps1', 'ini', 'cfg', 'conf', 'env', 'dockerfile', 'gitignore'
  // Thêm các đuôi file text/code bạn muốn cho phép sửa
];
const isEditableFile = (fileName: string): boolean => {
  if (!fileName || fileName.includes('/')) return false; // Không cho sửa nếu có vẻ là path
  const extension = fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase();
  return EDITABLE_EXTENSIONS.includes(extension);
};

// Helper function để xác định loại file
const getFileType = (fileName: string): 'pdf' | 'video' | 'audio' | 'markdown' | 'image' | '3d' | 'code' | 'unknown' => {
  const ext = fileName.toLowerCase().split('.').pop();
  
  if (['pdf'].includes(ext || '')) return 'pdf';
  if (['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'flv', '3gp'].includes(ext || '')) return 'video';
  if (['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'wma'].includes(ext || '')) return 'audio';
  if (['md', 'markdown', 'txt'].includes(ext || '')) return 'markdown';
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'tiff'].includes(ext || '')) return 'image';
  if (['obj', 'stl', 'ply', 'gltf', 'glb', '3ds'].includes(ext || '')) return '3d';
  if (['json', 'xml', 'csv', 'yaml', 'yml', 'toml', 'ini'].includes(ext || '')) return 'code';
  
  return 'unknown';
};

// Helper để kiểm tra file có thể preview không
const isPreviewableFile = (fileName: string): boolean => {
  const fileType = getFileType(fileName);
  return ['pdf', 'video', 'audio', 'markdown', 'image', '3d', 'code'].includes(fileType);
};


interface FileListProps {
  currentPath?: string;
  onNavigate: (path: string) => void;
  // onUploadComplete?: () => void; // Không cần nữa nếu dùng refreshKey
  searchTerm: string;
  refreshKey: number; // --- Thêm prop refreshKey ---
  onDragStart: (items: StorageItem[]) => void; // Thêm prop onDragStart
  onDrop: (targetPath: string) => void; // Thêm prop onDrop
}
interface ItemActionsProps {
  item: StorageItem;
  onDelete: (path: string) => void;
  // Không cần truyền thêm gì khác cho việc download
}
const ItemActions: React.FC<ItemActionsProps> = ({ item, onDelete }) => {
  // State để quản lý trạng thái đang xử lý tải/giải nén
  const [isProcessingDownload, setIsProcessingDownload] = useState(false);
  const openEditor = useAppStore((state) => state.openEditorModal); // Lấy hàm mở editor từ store
  // --- Hàm xử lý tải xuống và giải nén tự động ---
  const handleDownload = async () => {
    if (!item || !item.url || item.isFolder) return; // Kiểm tra cơ bản

    setIsProcessingDownload(true); // Bắt đầu xử lý

    const fileName = item.name;
    let shouldUnzip = false;
    let originalFileName = fileName; // Tên file cuối cùng sẽ tải về

    // 1. Kiểm tra xem có phải file zip cần giải nén tự động không
    if (fileName.toLowerCase().endsWith('.zip')) {
      const baseName = fileName.slice(0, -4); // Bỏ phần .zip
      const potentialOriginalExtension = baseName.slice(baseName.lastIndexOf('.') + 1).toLowerCase();
      if (EXECUTABLE_EXTENSIONS_FOR_UNZIP.includes(potentialOriginalExtension)) {
        shouldUnzip = true;
        originalFileName = baseName; // Tên file gốc là phần trước .zip
        console.log(`Detected auto-zipped file: ${fileName}. Will attempt to unzip to ${originalFileName}`);
      }
    }

    try {
      if (shouldUnzip) {
        // 2. Fetch dữ liệu file zip
        console.log(`Fetching ${item.url}...`);
        const response = await fetch(item.url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const zipBlob = await response.blob();
        console.log(`Fetched ${zipBlob.size} bytes.`);

        // 3. Dùng JSZip để đọc và giải nén
        const zip = await JSZip.loadAsync(zipBlob);
        console.log("Zip file loaded by JSZip.");

        // Tìm file gốc bên trong (dựa vào tên đã lưu khi nén)
        const fileInsideZip = zip.file(originalFileName);

        if (fileInsideZip) {
          console.log(`Found original file inside zip: ${originalFileName}`);
          // 4. Trích xuất nội dung file gốc thành Blob
          const unzippedBlob = await fileInsideZip.async('blob');
          console.log(`Unzipped content size: ${unzippedBlob.size} bytes.`);

          // 5. Kích hoạt tải xuống file đã giải nén với tên gốc
          saveAs(unzippedBlob, originalFileName); // Dùng file-saver
          console.log(`Download triggered for ${originalFileName}`);
        } else {
          // Trường hợp hiếm: file zip đúng định dạng tên nhưng không chứa file gốc bên trong?
          console.warn(`Could not find ${originalFileName} inside ${fileName}. Downloading the zip file directly.`);
          saveAs(item.url, fileName); // Tải file zip gốc về
        }

      } else {
        // 6. Tải xuống thông thường (không phải file zip cần giải nén)
        console.log(`Performing standard download for: ${fileName}`);
        saveAs(item.url, fileName); // Dùng file-saver để tải trực tiếp từ URL
      }
    } catch (error) {
      console.error("Error during download/unzip:", error);
      alert(`Đã xảy ra lỗi khi tải hoặc giải nén file: ${fileName}. Vui lòng thử lại.\n${error instanceof Error ? error.message : String(error)}`);
      // Có thể thử tải file zip gốc về nếu giải nén lỗi
      if (shouldUnzip) {
        try {
          console.log("Attempting to download the original zip file due to error...");
          saveAs(item.url, fileName);
        } catch (fallbackError) {
          console.error("Fallback download also failed:", fallbackError);
        }
      }
    } finally {
      setIsProcessingDownload(false); // Kết thúc xử lý
    }
  };
  // --- Kết thúc hàm xử lý ---
  // --- Hàm xử lý khi click nút Edit ---
  const handleEditClick = () => {
    if (item && item.url && !item.isFolder && isEditableFile(item.name)) {
      const fileToEdit: EditingFile = {
        name: item.name,
        fullPath: item.fullPath,
        url: item.url // Truyền URL để modal fetch nội dung
      };
      openEditor(fileToEdit); // Gọi action trong store
    } else {
      console.warn("Cannot edit this file type or file info is missing.");
      alert("Không thể chỉnh sửa loại file này.");
    }
  };
  // --- Kết thúc hàm xử lý Edit ---


  // Không render actions cho folder
  if (item.isFolder) return null;
  const canEdit = isEditableFile(item.name);
  return (
    <Menu as="div" className="relative inline-block text-left">
      <div>
        <Menu.Button
          className={twMerge(
            // Luôn hiển thị trên mobile (mặc định)
            "inline-flex justify-center rounded-md p-1.5 text-sm font-medium", // Tăng padding cho dễ bấm
            "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700", // Style cơ bản
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75", // Focus style
            // Chỉ ẩn và hiện khi hover trên màn hình md trở lên
            "md:opacity-0 md:group-hover:opacity-100", // <-- THAY ĐỔI QUAN TRỌNG
            "transition-opacity duration-150" // Thêm transition cho mượt
          )}
          disabled={isProcessingDownload}
          aria-label="Tùy chọn khác" // Thêm aria-label cho accessibility
        >
          {isProcessingDownload ? (
            <FaSpinner className="animate-spin h-4 w-4 text-blue-500" />
          ) : (
            <FaEllipsisV className="w-4 h-4" aria-hidden="true" />
          )}
        </Menu.Button>
      </div>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 mt-2 w-40 origin-top-right divide-y divide-gray-100 dark:divide-zinc-600 rounded-md bg-white dark:bg-zinc-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
          <div className="px-1 py-1 ">
            {/* Chỉnh sửa */}
            {canEdit && ( // Chỉ hiển thị nếu file có thể sửa
              <Menu.Item disabled={isProcessingDownload}>
                {({ active, disabled }) => (
                  <button
                    onClick={handleEditClick}
                    disabled={disabled}
                    className={twMerge(
                      'group flex rounded-md items-center w-full px-2 py-2 text-sm',
                      disabled ? 'opacity-50 cursor-not-allowed' : '',
                      active ? 'bg-blue-500 text-white' : 'text-gray-900 dark:text-gray-100'
                    )}
                  >
                    <FaEdit className="mr-2 h-4 w-4" aria-hidden="true" />
                    Chỉnh sửa
                  </button>
                )}
              </Menu.Item>
            )}
            <Menu.Item disabled={isProcessingDownload}>
              {({ active, disabled }) => (
                <button
                  onClick={handleDownload} // Gọi hàm xử lý mới
                  disabled={disabled} // Disable từ Menu.Item
                  className={twMerge( // Sử dụng twMerge để quản lý class tốt hơn
                    'group flex rounded-md items-center w-full px-2 py-2 text-sm',
                    disabled ? 'opacity-50 cursor-not-allowed' : '',
                    active ? 'bg-blue-500 text-white' : 'text-gray-900 dark:text-gray-100'
                  )}
                >
                  {/* Có thể thay đổi text/icon khi đang xử lý */}
                  {isProcessingDownload ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">...</svg> {/* Icon loading nhỏ */}
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      <FaDownload className="mr-2 h-4 w-4" aria-hidden="true" />
                      Tải xuống
                    </>
                  )}

                </button>
              )}
            </Menu.Item>



            {/* Xem trước (nếu là ảnh) - Giữ nguyên */}
            {item.url && item.name.match(/\.(jpg|jpeg|png|gif|bmp|svg|webp)$/i) && (
              <Menu.Item disabled={isProcessingDownload}>
                {({ active, disabled }) => (
                  <button
                    onClick={() => useAppStore.getState().openImagePreviewModal(item.url!)}
                    disabled={disabled}
                    className={twMerge(
                      'group flex rounded-md items-center w-full px-2 py-2 text-sm',
                      disabled ? 'opacity-50 cursor-not-allowed' : '',
                      active ? 'bg-blue-500 text-white' : 'text-gray-900 dark:text-gray-100'
                    )}
                  >
                    <FaImage className="mr-2 h-4 w-4" aria-hidden="true" />
                    Xem trước
                  </button>
                )}
              </Menu.Item>
            )}
          </div>
          <div className="px-1 py-1">
            {/* Xóa - Giữ nguyên */}
            <Menu.Item disabled={isProcessingDownload}>
              {({ active, disabled }) => (
                <button
                  onClick={() => onDelete(item.fullPath)}
                  disabled={disabled}
                  className={twMerge(
                    'group flex rounded-md items-center w-full px-2 py-2 text-sm',
                    disabled ? 'opacity-50 cursor-not-allowed' : '',
                    active ? 'bg-red-500 text-white' : 'text-red-600 dark:text-red-400'
                  )}
                >
                  <FaTrash className="mr-2 h-4 w-4" aria-hidden="true" />
                  Xóa
                </button>
              )}
            </Menu.Item>
          </div>
        </Menu.Items>
      </Transition>
    </Menu >
  );
}

export default function FileList({ currentPath = '', onNavigate, searchTerm, refreshKey, onDragStart, onDrop }: FileListProps) {
  const [items, setItems] = useState<StorageItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lấy state từ store Zustand
  const viewMode = useAppStore((state) => state.viewMode);
  const openImagePreviewModal = useAppStore((state) => state.openImagePreviewModal);
  const openPreviewModal = useAppStore((state) => state.openPreviewModal);

  // Hàm fetch dữ liệu từ Firebase
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const storageRef = ref(storage, `uploads/${currentPath}`);

    try {
      const res: ListResult = await listAll(storageRef);
      const fetchedItems: StorageItem[] = [];

      // Xử lý thư mục (Prefixes)
      res.prefixes.forEach((folderRef: StorageReference) => {
        // Loại bỏ file .keep khỏi danh sách hiển thị nếu có
        if (folderRef.name !== '.keep') {
          fetchedItems.push({
            name: folderRef.name,
            fullPath: folderRef.fullPath,
            isFolder: true,
          });
        }
      });

      // Xử lý file (Items) - Lấy metadata và URL song song
      const filePromises = res.items
        .filter(itemRef => !itemRef.name.endsWith('.keep')) // Lọc bỏ file .keep
        .map(async (itemRef: StorageReference): Promise<StorageItem | null> => {
          try {
            const [url, metadata] = await Promise.all([
              getDownloadURL(itemRef),
              getMetadata(itemRef)
            ]);
            return {
              name: itemRef.name,
              fullPath: itemRef.fullPath,
              isFolder: false,
              url: url,
              size: metadata.size,
              updated: metadata.updated ? new Date(metadata.updated) : undefined,
            };
          } catch (error) {
            console.error(`Lỗi khi lấy thông tin file ${itemRef.name}:`, error);
            // Có thể trả về một item lỗi hoặc null để lọc ra sau
            return null; // Bỏ qua file lỗi
          }
        });

      const fileResults = await Promise.all(filePromises);
      fetchedItems.push(...fileResults.filter((item): item is StorageItem => item !== null)); // Lọc bỏ các file lỗi

      setItems(fetchedItems);

    } catch (error: any) {
      console.error('Lỗi khi lấy danh sách files/folders:', error);
      if (error.code === 'storage/object-not-found') {
        setError('Thư mục không tồn tại hoặc trống.');
        setItems([]); // Đặt lại danh sách thành rỗng
      } else {
        setError('Không thể tải dữ liệu. Vui lòng thử lại.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentPath]); // Phụ thuộc vào currentPath

  // Fetch dữ liệu khi component mount hoặc currentPath thay đổi
  useEffect(() => {
    console.log(`FileList: useEffect triggered. currentPath: ${currentPath}, refreshKey: ${refreshKey}`); // Thêm log
    fetchData();
  }, [fetchData, refreshKey]); // Thêm refreshKey vào dependency array

  // Hàm xử lý xóa file
  const handleDelete = async (itemPath: string) => {
    // Thêm xác nhận trước khi xóa
    if (window.confirm(`Bạn có chắc chắn muốn xóa mục này?\nHành động này không thể hoàn tác.`)) {
      try {
        setIsLoading(true); // Có thể hiển thị loading cục bộ cho item đó
        await deleteObject(ref(storage, itemPath));
        // Xóa thành công, gọi fetchData để cập nhật lại list
        fetchData();
        // Hoặc cập nhật state trực tiếp để nhanh hơn:
        // setItems((prev) => prev.filter((i) => i.fullPath !== itemPath));
      } catch (error) {
        console.error('Xóa file thất bại:', error);
        alert('Xóa file thất bại. Vui lòng thử lại.');
        setIsLoading(false); // Tắt loading nếu có lỗi
      }
      // Bỏ setIsLoading(false) ở đây vì fetchData đã có finally
    }
  };

  // Hàm xử lý click vào thư mục
  const handleFolderClick = (folderName: string) => {
    // Path mới là path hiện tại + tên folder + /
    const newPath = `${currentPath}${folderName}/`;
    onNavigate(newPath); // Gọi callback để chuyển trang/component cha cập nhật state
  };

  // Hàm xử lý click vào file để preview
  const handleFileClick = (item: StorageItem) => {
    if (item.isFolder || !item.url) return;
    
    const fileType = getFileType(item.name);
    
    if (fileType === 'image') {
      // Giữ nguyên image preview modal cho ảnh
      openImagePreviewModal(item.url);
    } else if (isPreviewableFile(item.name)) {
      // Sử dụng preview modal mới cho các file khác
      openPreviewModal({
        name: item.name,
        url: item.url,
        type: fileType
      });
    }
    // Nếu không thể preview thì không làm gì
  };


  // Lọc danh sách dựa trên searchTerm
  const filteredItems = useMemo(() => {
    if (!searchTerm) return items;
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    return items.filter(item =>
      item.name.toLowerCase().includes(lowerCaseSearchTerm)
    );
  }, [items, searchTerm]);

  // Sắp xếp: thư mục lên trước, sau đó theo tên
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      // Thư mục luôn lên trước file
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      // Cùng loại thì sắp xếp theo tên (không phân biệt hoa thường)
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
  }, [filteredItems]);


  // Helper function để format kích thước file
  const formatFileSize = (bytes?: number): string => {
    if (bytes === undefined || bytes === 0) return '-';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Helper function để format ngày
  const formatDate = (date?: Date): string => {
    if (!date) return '-';
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }


  // --- Render UI ---

  if (isLoading) {
    return <div className="text-center py-10 text-gray-500 dark:text-gray-400">Đang tải dữ liệu...</div>;
  }

  if (error) {
    return <div className="text-center py-10 text-red-600 dark:text-red-400">{error}</div>;
  }

  if (sortedItems.length === 0 && !searchTerm) {
    return (
      <div className="text-center py-10 text-gray-500 dark:text-gray-400">
        <FaInfoCircle className="inline-block w-6 h-6 mr-2 mb-1" />
        Thư mục này trống. Kéo thả file vào đây hoặc nhấn nút "Tạo thư mục".
      </div>
    );
  }

  if (sortedItems.length === 0 && searchTerm) {
    return (
      <div className="text-center py-10 text-gray-500 dark:text-gray-400">
        <FaInfoCircle className="inline-block w-6 h-6 mr-2 mb-1" />
        Không tìm thấy file hoặc thư mục nào khớp với "{searchTerm}".
      </div>
    );
  }


  // Render dạng Lưới (Grid View)
  const renderGridView = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {sortedItems.map((item) => (
        <div
          key={item.fullPath}
          draggable={!item.isFolder} // Chỉ cho phép kéo file
          onDragStart={(e) => {
            // Ngăn chặn hành vi mặc định có thể gây xung đột
            e.stopPropagation(); 
            // Bắt đầu kéo một mục
            onDragStart([item]);
          }}
          className={twMerge(
            "group relative bg-white dark:bg-zinc-800 rounded-lg shadow hover:shadow-md transition-shadow duration-200 p-3 flex flex-col items-center text-center cursor-pointer",
            item.isFolder ? "hover:bg-blue-50 dark:hover:bg-blue-900/20" : "hover:bg-gray-50 dark:hover:bg-zinc-700"
          )}
          onClick={() => item.isFolder ? handleFolderClick(item.name) : handleFileClick(item)} // Click folder để vào, click file để preview
          onDragOver={(e) => {
            if (item.isFolder) {
              e.preventDefault(); // Cho phép thả vào thư mục
              // Thêm hiệu ứng visual (ví dụ: đổi màu border)
              e.currentTarget.classList.add('ring-2', 'ring-blue-500');
            }
          }}
          onDragLeave={(e) => {
            if (item.isFolder) {
              // Xóa hiệu ứng visual khi kéo ra ngoài
              e.currentTarget.classList.remove('ring-2', 'ring-blue-500');
            }
          }}
          onDrop={(e) => {
            if (item.isFolder) {
              e.preventDefault();
              e.stopPropagation();
              // Xóa hiệu ứng visual
              e.currentTarget.classList.remove('ring-2', 'ring-blue-500');
              // Gọi hàm onDrop từ props
              onDrop(item.fullPath);
            }
          }}
          title={item.name} // Hiển thị full name khi hover
        >
          {/* Icon hoặc Thumbnail */}
          <div className="mb-2 flex-shrink-0 h-16 w-16 flex items-center justify-center">
            {!item.isFolder && item.url && item.name.match(/\.(jpg|jpeg|png|gif|bmp|svg|webp)$/i) ? (
              // Nếu là ảnh, hiển thị thumbnail
              <img src={item.url} alt={item.name} className="max-h-full max-w-full object-contain rounded" loading="lazy" />
            ) : (
              // Nếu là folder hoặc file khác, hiển thị Icon
              <FileIcon fileName={item.name} isFolder={item.isFolder} className="w-12 h-12" />
            )}
          </div>

          {/* Tên File/Folder */}
          <p className="w-full text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
            {item.name}
          </p>
          {/* Thông tin thêm (kích thước, ngày) - có thể ẩn đi ở grid view cho gọn */}
          {/* <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{formatFileSize(item.size)}</p> */}

          {/* Nút actions (hiện khi hover) - dùng Menu của Headless UI */}
          {!item.isFolder && (
            // Chỉ giữ lại class định vị, xóa opacity và group-hover
            <div 
              className="absolute top-1 right-1"
              onClick={(e) => e.stopPropagation()} // Ngăn chặn event bubbling
            >
              <ItemActions item={item} onDelete={handleDelete} />
            </div>
          )}
          {/* Nếu là thư mục, có thể thêm actions riêng cho thư mục sau */}
        </div>
      ))}
    </div>
  );

  // Render dạng Danh sách (List View)
  const renderListView = () => (
    
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
        <thead className="bg-gray-50 dark:bg-zinc-800">
          <tr>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-10"></th> {/* Icon */}
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tên</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">Ngày sửa đổi</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">Kích thước</th>
            <th scope="col" className="relative px-4 py-3 w-10">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-zinc-800/50 divide-y divide-gray-200 dark:divide-zinc-700">
          {sortedItems.map((item) => (
            <tr 
              key={item.fullPath} 
              draggable={!item.isFolder} // Chỉ cho phép kéo file
              onDragStart={(e) => {
                e.stopPropagation();
                onDragStart([item]);
              }}
              className="hover:bg-gray-50 dark:hover:bg-zinc-700/50 group cursor-pointer"
              onClick={() => item.isFolder ? handleFolderClick(item.name) : handleFileClick(item)}
              onDragOver={(e) => {
                if (item.isFolder) {
                  e.preventDefault();
                  e.currentTarget.classList.add('bg-blue-100', 'dark:bg-blue-900');
                }
              }}
              onDragLeave={(e) => {
                if (item.isFolder) {
                  e.currentTarget.classList.remove('bg-blue-100', 'dark:bg-blue-900');
                }
              }}
              onDrop={(e) => {
                if (item.isFolder) {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.classList.remove('bg-blue-100', 'dark:bg-blue-900');
                  onDrop(item.fullPath);
                }
              }}
            >
              {/* Icon */}
              <td className="px-4 py-2 whitespace-nowrap">
                <div className="flex-shrink-0 h-5 w-5">
                  {/* Nếu là ảnh, có thể vẫn hiện icon file ảnh thay vì thumbnail nhỏ */}
                  <FileIcon fileName={item.name} isFolder={item.isFolder} className="w-5 h-5" />
                </div>
              </td>
              {/* Tên */}
              <td className="px-4 py-2 whitespace-nowrap max-w-xs sm:max-w-md md:max-w-lg">
                <span
                  className={`text-sm font-medium truncate ${item.isFolder ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'}`}
                  title={item.name}
                >
                  {item.name}
                </span>
              </td>
              {/* Ngày sửa đổi */}
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">
                {formatDate(item.updated)}
              </td>
              {/* Kích thước */}
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                {item.isFolder ? '-' : formatFileSize(item.size)}
              </td>
              {/* Actions */}
              <td className="px-4 py-2 whitespace-nowrap text-right text-sm font-medium w-10">
                {!item.isFolder && (
                   // Xóa class opacity và group-hover khỏi div này (hoặc bỏ hẳn div nếu không cần)
                   // Chỉ cần render ItemActions trực tiếp là đủ
                  <div onClick={(e) => e.stopPropagation()}> {/* Ngăn chặn event bubbling */}
                     <ItemActions item={item} onDelete={handleDelete} />
                   </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // Return dựa trên viewMode
  return (
    <div className="mt-6">
      {viewMode === 'grid' ? renderGridView() : renderListView()}
    </div>
  );
}

