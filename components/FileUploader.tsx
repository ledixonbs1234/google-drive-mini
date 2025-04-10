// components/FileUploader.tsx
'use client';

import { useDropzone } from 'react-dropzone';
import { ref, uploadBytesResumable, UploadTaskSnapshot } from 'firebase/storage';
import { useState, useCallback } from 'react';
import { storage } from '../lib/firebase';
import { FaUpload } from 'react-icons/fa';
import { twMerge } from 'tailwind-merge';
import JSZip from 'jszip'; // <--- Import JSZip

interface FileUploaderProps {
  currentPath?: string;
  onUploadComplete?: () => void;
}

// --- Định nghĩa các phần mở rộng cần nén ---
const EXECUTABLE_EXTENSIONS = ['exe', 'msi', 'bat', 'cmd', 'sh', 'app', 'dmg', 'deb', 'rpm', 'apk'];
// --- Định nghĩa các phần mở rộng lưu trữ không cần nén lại ---
const ARCHIVE_EXTENSIONS = ['zip', 'rar', '7z', 'tar', 'gz'];


export default function FileUploader({ currentPath = '', onUploadComplete }: FileUploaderProps) {
  // Giữ state cho từng file riêng biệt, bao gồm cả trạng thái "đang nén"
  const [uploadingFiles, setUploadingFiles] = useState<{ id: string; name: string; progress: number; status: 'pending' | 'zipping' | 'uploading' | 'error' | 'done' }[]>([]);

  // --- Hàm helper để nén file ---
  const zipFile = async (file: File): Promise<File> => {
    console.log(`Zipping file: ${file.name}`);
    const zip = new JSZip();
    zip.file(file.name, file); // Thêm file gốc vào zip

    // Tạo blob zip (có thể chọn mức độ nén)
    const zipBlob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE", // Thuật toán nén
      compressionOptions: {
        level: 6 // Mức độ nén (1-9), 6 là cân bằng tốt
      }
    });

    // Tạo file mới từ blob với tên đã đổi thành .zip
    const zippedFileName = `${file.name}.zip`;
    return new File([zipBlob], zippedFileName, { type: 'application/zip' });
  };
  // --- Kết thúc hàm helper ---


  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    // Tạo ID duy nhất và trạng thái ban đầu cho mỗi file
    const initialFilesState = acceptedFiles.map((file, index) => ({
      id: `${Date.now()}-${index}`, // ID đơn giản
      name: file.name,
      progress: 0,
      status: 'pending' as 'pending' | 'zipping' | 'uploading' | 'error' | 'done'
    }));
    setUploadingFiles(initialFilesState);

    // Xử lý từng file (nén nếu cần, sau đó upload)
    const uploadPromises = initialFilesState.map(async (fileState, index) => {
      const originalFile = acceptedFiles[index];
      let fileToUpload: File = originalFile; // Mặc định là file gốc
      let finalFileName = originalFile.name;

      // Lấy phần mở rộng file (viết thường)
      const fileExtension = originalFile.name.slice(originalFile.name.lastIndexOf('.') + 1).toLowerCase();

      // --- Logic kiểm tra và nén ---
      if (EXECUTABLE_EXTENSIONS.includes(fileExtension) && !ARCHIVE_EXTENSIONS.includes(fileExtension)) {
        // Cập nhật trạng thái là "đang nén"
        setUploadingFiles(prev => prev.map(f => f.id === fileState.id ? { ...f, status: 'zipping' } : f));
        try {
          fileToUpload = await zipFile(originalFile); // Gọi hàm nén
          finalFileName = fileToUpload.name; // Cập nhật tên file sẽ upload
          console.log(`File ${originalFile.name} zipped to ${finalFileName}`);
        } catch (zipError) {
          console.error(`Error zipping file ${originalFile.name}:`, zipError);
          // Cập nhật trạng thái lỗi
          setUploadingFiles(prev => prev.map(f => f.id === fileState.id ? { ...f, status: 'error', progress: -1 } : f));
          throw new Error(`Failed to zip ${originalFile.name}`); // Ném lỗi để Promise.all bắt
        }
      }
      // --- Kết thúc logic nén ---

      // Cập nhật trạng thái là "đang upload" (nếu không lỗi khi nén)
      setUploadingFiles(prev => prev.map(f => f.id === fileState.id && f.status !== 'error' ? { ...f, status: 'uploading' } : f));

      // Tiến hành upload file (gốc hoặc đã nén)
      const storageRef = ref(storage, `uploads/${currentPath}${finalFileName}`);
      const uploadTask = uploadBytesResumable(storageRef, fileToUpload);

      // Trả về một promise để theo dõi upload của file này
      return new Promise<void>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot: UploadTaskSnapshot) => {
            const percent = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            // Cập nhật tiến trình cho file tương ứng bằng ID
            setUploadingFiles(prev => prev.map(f =>
              f.id === fileState.id ? { ...f, progress: Math.round(percent) } : f
            ));
          },
          (error) => {
            console.error(`Lỗi upload file ${finalFileName}:`, error);
            // Cập nhật trạng thái lỗi
            setUploadingFiles(prev => prev.map(f =>
              f.id === fileState.id ? { ...f, status: 'error', progress: -1 } : f
            ));
            reject(error); // Reject promise khi có lỗi upload
          },
          () => {
            // Upload thành công
            console.log(`File ${finalFileName} uploaded successfully.`);
            // Cập nhật trạng thái hoàn thành
            setUploadingFiles(prev => prev.map(f =>
              f.id === fileState.id ? { ...f, status: 'done', progress: 100 } : f
            ));
            resolve(); // Resolve promise khi upload hoàn thành
          }
        );
      });
    });

    try {
      // Chờ tất cả các file xử lý (nén + upload) xong
      await Promise.all(uploadPromises);
      console.log("Tất cả file đã được xử lý.");
      // Gọi callback khi tất cả xong (có thể giữ lại các file đã xong/lỗi để hiển thị)
      onUploadComplete?.();
      // Tùy chọn: Xóa danh sách file sau một thời gian hoặc khi người dùng bắt đầu upload mới
      // setTimeout(() => setUploadingFiles([]), 5000); // Ví dụ xóa sau 5s
    } catch (error) {
      console.error("Có lỗi xảy ra trong quá trình xử lý files:", error);
      alert('Một hoặc nhiều file xử lý thất bại. Vui lòng kiểm tra danh sách.');
      // Không cần làm gì thêm vì trạng thái lỗi đã được set cho từng file
    }

  }, [currentPath, onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: uploadingFiles.some(f => f.status === 'zipping' || f.status === 'uploading'), // Disable khi đang nén hoặc upload
  });

  const dropzoneClassName = twMerge(
    "p-6 border-2 border-dashed rounded-xl cursor-pointer text-center transition-colors duration-200",
    "border-gray-300 dark:border-gray-600",
    "bg-white dark:bg-zinc-800",
    isDragActive
      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
      : "hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-zinc-700",
    uploadingFiles.some(f => f.status === 'zipping' || f.status === 'uploading') ? "cursor-not-allowed opacity-70" : "" // Làm mờ khi đang xử lý
  );

  // Hàm helper để lấy text trạng thái
  const getStatusText = (status: string, progress: number) => {
    switch (status) {
      case 'pending': return 'Chờ xử lý...';
      case 'zipping': return 'Đang nén...';
      case 'uploading': return `${progress}%`;
      case 'error': return 'Lỗi!';
      case 'done': return 'Hoàn thành';
      default: return '';
    }
  }

  return (
    <div className="mb-6">
      <div {...getRootProps()} className={dropzoneClassName}>
        <input {...getInputProps()} disabled={uploadingFiles.some(f => f.status === 'zipping' || f.status === 'uploading')} />
        <FaUpload className="w-10 h-10 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
        {isDragActive ? (
          <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">Thả file vào đây...</p>
        ) : (
          <p className="text-gray-600 dark:text-gray-300">
            {uploadingFiles.some(f => f.status === 'zipping' || f.status === 'uploading')
              ? "Đang xử lý file..."
              : "Kéo & thả file hoặc click để chọn"}
          </p>
        )}
      </div>

      {/* Hiển thị tiến trình và trạng thái cho từng file */}
      {uploadingFiles.length > 0 && (
        <div className="mt-4 space-y-3">
          <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300">Danh sách file xử lý:</h4>
          {uploadingFiles.map((file) => (
            <div key={file.id} className="text-sm border-b border-gray-200 dark:border-zinc-700 pb-2 last:border-b-0">
              <div className="flex justify-between items-center mb-1">
                <span className="text-gray-800 dark:text-gray-200 truncate mr-2" title={file.name}>
                  {file.name} {file.status === 'zipping' || (file.status === 'done' && file.name.endsWith('.zip')) ? '(đã nén)' : ''}
                </span>
                <span className={`font-medium text-xs px-1.5 py-0.5 rounded ${file.status === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                    file.status === 'done' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                      'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                  }`}>
                  {getStatusText(file.status, file.progress)}
                </span>
              </div>
              {/* Chỉ hiển thị thanh progress khi đang upload */}
              {(file.status === 'uploading' || file.status === 'done' || file.status === 'error') && file.progress >= 0 && (
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-1">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${file.status === 'error' ? 'bg-red-500' :
                        file.status === 'done' ? 'bg-green-500' :
                          'bg-blue-500'
                      }`}
                    style={{ width: `${file.progress}%` }}
                  ></div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}