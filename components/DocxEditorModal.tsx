// components/DocxEditorModal.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FaTimes, FaSave, FaSpinner, FaDownload } from 'react-icons/fa';
import { Editor } from '@tinymce/tinymce-react';
import mammoth from 'mammoth';
import { useAppStore } from '../store/useAppStore';
import { uploadRawContentToR2 } from '@/lib/storageClient';

const DocxEditorModal: React.FC = () => {
  const { isDocxEditorModalOpen, editingDocxFile, closeDocxEditorModal, triggerGlobalRefresh } = useAppStore();
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
        const result = await mammoth.convertToHtml({ arrayBuffer });
        setHtmlContent(result.value || '<p>Tài liệu trống</p>');
      } catch (err) {
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
      const newFileName = editingDocxFile.name.replace(/\.(docx?|DOCX?)$/, '.html');

      await uploadRawContentToR2(content, newPath, 'text/html; charset=utf-8');
      triggerGlobalRefresh();
      alert(`Đã lưu bản chỉnh sửa thành công lên Cloudflare R2: ${newFileName}`);
      closeDocxEditorModal();
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Không thể lưu file');
      setIsSaving(false);
    }
  };

  const handleDownloadWordCompatible = () => {
    if (!editorRef.current || !editingDocxFile) return;
    const bodyHtml = editorRef.current.getContent();
    const wordDoc = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'></head><body>${bodyHtml}</body></html>`;
    const blob = new Blob(['\ufeff', wordDoc], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = editingDocxFile.name.replace(/\.(docx?|DOCX?)$/, '-edited.doc');
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-700">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
              {editingDocxFile.name}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Trình biên tập tài liệu Word trực tuyến trên Cloudflare R2
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={isSaving}
            className="ml-4 p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <FaTimes className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full py-16">
              <FaSpinner className="animate-spin w-8 h-8 text-blue-500" />
              <span className="ml-3 text-gray-600 dark:text-gray-400">Đang chuyển đổi tài liệu Word...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full p-6">
              <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
              <button onClick={handleClose} className="px-4 py-2 bg-gray-200 dark:bg-zinc-700 rounded">
                Đóng
              </button>
            </div>
          ) : (
            <div className="h-[62vh]">
              <Editor
                onInit={(_, editor) => (editorRef.current = editor)}
                initialValue={htmlContent}
                apiKey="no-api-key"
                init={{
                  height: '100%',
                  menubar: true,
                  plugins: [
                    'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                    'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                    'insertdatetime', 'media', 'table', 'help', 'wordcount',
                  ],
                  toolbar:
                    'undo redo | blocks | bold italic forecolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | table | removeformat',
                  skin: typeof window !== 'undefined' && document.documentElement.classList.contains('dark') ? 'oxide-dark' : 'oxide',
                  content_css: typeof window !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'default',
                }}
              />
            </div>
          )}
        </div>

        {!isLoading && !error && (
          <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-t border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 rounded-b-xl">
            <span className="text-xs text-amber-600 dark:text-amber-400">
              Lưu lên R2 dưới dạng .html (giữ nguyên file gốc) hoặc tải ngay file Word (.doc) về máy.
            </span>
            <div className="flex space-x-2">
              <button
                onClick={handleDownloadWordCompatible}
                disabled={isSaving}
                className="flex items-center px-3.5 py-2 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                <FaDownload className="w-3.5 h-3.5 mr-1.5" />
                Tải về bản Word (.doc)
              </button>
              <button
                onClick={handleClose}
                disabled={isSaving}
                className="px-3.5 py-2 text-xs font-medium bg-gray-200 dark:bg-zinc-700 text-gray-800 dark:text-gray-200 rounded-lg"
              >
                Hủy
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center px-4 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? <FaSpinner className="animate-spin w-3.5 h-3.5 mr-1.5" /> : <FaSave className="w-3.5 h-3.5 mr-1.5" />}
                <span>{isSaving ? 'Đang lưu...' : 'Lưu lên Cloudflare R2'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocxEditorModal;
