// components/DocxEditorModal.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FaTimes, FaSave, FaSpinner, FaDownload } from 'react-icons/fa';
import { Editor } from '@tinymce/tinymce-react';
import mammoth from 'mammoth';
import { useAppStore } from '../store/useAppStore';
import { uploadRawContentToR2 } from '@/lib/storageClient';

const DocxEditorModal: React.FC = () => {
  const { isDocxEditorModalOpen, editingDocxFile, closeDocxEditorModal } = useAppStore();
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<any>(null);

  useEffect(() => {
    if (!isDocxEditorModalOpen || !editingDocxFile) {
      return;
    }

    const loadDocxContent = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(editingDocxFile.url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();

        // Convert .doc/.docx sang HTML sử dụng Mammoth
        const result = await mammoth.convertToHtml({ arrayBuffer });
        setHtmlContent(result.value || '<p>Tài liệu trống</p>');
      } catch (err) {
        console.error('Error loading .doc/.docx file:', err);
        const errorMessage = err instanceof Error ? err.message : 'Không thể tải file';
        setError(`Lỗi khi tải file: ${errorMessage}`);
      } finally {
        setIsLoading(false);
      }
    };

    loadDocxContent();
  }, [isDocxEditorModalOpen, editingDocxFile]);

  const handleSave = async () => {
    if (!editingDocxFile || !editorRef.current) return;
    setIsSaving(true);
    setError(null);

    try {
      const content = editorRef.current.getContent();
      const originalPath = editingDocxFile.fullPath;
      const newPath = originalPath.replace(/\.(docx?|DOCX?)$/, '.html');
      const originalName = editingDocxFile.name;
      const newFileName = originalName.replace(/\.(docx?|DOCX?)$/, '.html');

      // Lưu file HTML lên Cloudflare R2
      await uploadRawContentToR2(content, newPath, 'text/html; charset=utf-8');

      alert(`Đã lưu thành công lên Cloudflare R2 dưới dạng HTML: ${newFileName}\n\nLưu ý: File gốc .doc/.docx vẫn được giữ nguyên.`);
      closeDocxEditorModal();
    } catch (err: any) {
      console.error('Error saving file:', err);
      setError(err instanceof Error ? err.message : 'Không thể lưu file');
      setIsSaving(false);
    }
  };

  const handleDownloadHtml = () => {
    if (!editorRef.current || !editingDocxFile) return;
    const content = editorRef.current.getContent();
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = editingDocxFile.name.replace(/\.(docx?|DOCX?)$/, '.html');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    if (editorRef.current) {
      const currentContent = editorRef.current.getContent();
      if (currentContent !== htmlContent && !isSaving) {
        if (!window.confirm('Bạn có thay đổi chưa lưu. Bạn có chắc muốn đóng?')) {
          return;
        }
      }
    }
    closeDocxEditorModal();
  };

  if (!isDocxEditorModalOpen || !editingDocxFile) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-700">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
              {editingDocxFile.name}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Chỉnh sửa tài liệu Word (.doc/.docx) trên Cloudflare R2
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={isSaving}
            className="ml-4 p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
            title="Đóng"
          >
            <FaTimes className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <FaSpinner className="animate-spin w-8 h-8 text-blue-500" />
              <span className="ml-3 text-gray-600 dark:text-gray-400">Đang tải tài liệu...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full p-6">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 max-w-2xl">
                <p className="text-red-600 dark:text-red-400 mb-4 whitespace-pre-line">{error}</p>
              </div>
              <button
                onClick={handleClose}
                className="mt-4 px-4 py-2 bg-gray-200 dark:bg-zinc-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-zinc-600"
              >
                Đóng
              </button>
            </div>
          ) : (
            <div className="h-full">
              <Editor
                onInit={(evt, editor) => (editorRef.current = editor)}
                initialValue={htmlContent}
                apiKey="no-api-key"
                init={{
                  height: '100%',
                  menubar: true,
                  plugins: [
                    'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                    'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                    'insertdatetime', 'media', 'table', 'code', 'help', 'wordcount'
                  ],
                  toolbar: 'undo redo | blocks | ' +
                    'bold italic forecolor | alignleft aligncenter ' +
                    'alignright alignjustify | bullist numlist outdent indent | ' +
                    'removeformat | help',
                  content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }',
                  skin: typeof window !== 'undefined' && document.documentElement.classList.contains('dark') ? 'oxide-dark' : 'oxide',
                  content_css: typeof window !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'default',
                }}
              />
            </div>
          )}
        </div>

        {!isLoading && !error && (
          <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900">
            <div className="text-sm text-amber-600 dark:text-amber-400">
              ⚠️ Lưu ý: File sẽ được lưu dưới dạng HTML lên Cloudflare R2. File .doc/.docx gốc không thay đổi.
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handleDownloadHtml}
                disabled={isSaving}
                className="flex items-center px-4 py-2 bg-gray-200 dark:bg-zinc-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-zinc-600 disabled:opacity-50"
                title="Tải xuống dưới dạng HTML"
              >
                <FaDownload className="w-4 h-4 mr-2" />
                Tải HTML
              </button>
              <button
                onClick={handleClose}
                disabled={isSaving}
                className="px-4 py-2 bg-gray-200 dark:bg-zinc-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-zinc-600 disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <FaSpinner className="animate-spin w-4 h-4 mr-2" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <FaSave className="w-4 h-4 mr-2" />
                    Lưu lên Cloudflare R2
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocxEditorModal;
