// components/CodeEditorModal.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import Editor, { Monaco, OnMount } from '@monaco-editor/react'; // Import các thành phần từ thư viện editor
import { ref, uploadString, getDownloadURL } from 'firebase/storage'; // Import hàm uploadString
import { storage } from '../lib/firebase';
import { useAppStore, EditingFile } from '../store/useAppStore';
import { FaSave, FaTimes, FaSpinner } from 'react-icons/fa';
import { twMerge } from 'tailwind-merge';

// --- Hàm helper xác định ngôn ngữ Monaco từ tên file ---
const getLanguageFromFileName = (fileName: string): string | undefined => {
    const extension = fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase();
    switch (extension) {
        case 'js':
        case 'jsx':
        case 'mjs':
            return 'javascript';
        case 'ts':
        case 'tsx':
            return 'typescript';
        case 'json':
            return 'json';
        case 'css':
            return 'css';
        case 'scss':
        case 'sass':
             return 'scss';
         case 'less':
             return 'less';
        case 'html':
        case 'htm':
            return 'html';
        case 'xml':
            return 'xml';
        case 'php':
            return 'php';
        case 'py':
            return 'python';
        case 'java':
            return 'java';
        case 'cs':
            return 'csharp';
        case 'rb':
            return 'ruby';
        case 'go':
            return 'go';
        case 'rs':
            return 'rust';
        case 'sql':
            return 'sql';
        case 'md':
            return 'markdown';
        case 'sh':
        case 'bash':
            return 'shell';
         case 'yaml':
         case 'yml':
             return 'yaml';
         case 'dockerfile':
             return 'dockerfile';
         case 'gitignore':
             return 'plaintext'; // Monaco không có gitignore sẵn, dùng text
        case 'txt':
        case 'log':
             return 'plaintext';
        // Thêm các ngôn ngữ khác nếu cần
        default:
            return undefined; // Để Monaco tự động phát hiện (nếu có thể) hoặc mặc định là text
    }
};
// --- Kết thúc hàm helper ---


const CodeEditorModal: React.FC = () => {
    const isOpen = useAppStore((state) => state.isEditorModalOpen);
    const editingFile = useAppStore((state) => state.editingFile);
    const closeEditor = useAppStore((state) => state.closeEditorModal);
    const currentTheme = useAppStore((state) => state.theme); // Lấy theme hiện tại

    const [fileContent, setFileContent] = useState<string>('');
    const [editedContent, setEditedContent] = useState<string>('');
    const [isLoadingContent, setIsLoadingContent] = useState<boolean>(false);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [language, setLanguage] = useState<string | undefined>('plaintext'); // Ngôn ngữ cho editor

    const editorRef = useRef<any>(null); // Tham chiếu đến instance của Monaco editor

    // Fetch nội dung file khi modal mở và có file được chọn
    useEffect(() => {
        if (isOpen && editingFile) {
            console.log("Opening editor for:", editingFile.name);
            setIsLoadingContent(true);
            setError(null);
            setFileContent(''); // Reset content cũ
            setEditedContent('');

            const fetchContent = async () => {
                try {
                    // Cần fetch lại URL mới nhất phòng trường hợp token cũ hết hạn (dù thường token tồn tại lâu)
                    // Hoặc đơn giản là dùng URL đã có nếu nó vẫn hợp lệ
                    // const freshUrl = await getDownloadURL(ref(storage, editingFile.fullPath)); // Option 1: Fetch URL mới
                    const urlToFetch = editingFile.url; // Option 2: Dùng URL đã có

                    console.log("Fetching content from:", urlToFetch);
                    const response = await fetch(urlToFetch); // CORS đã được cấu hình ở bước trước
                    if (!response.ok) {
                        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
                    }
                    const textContent = await response.text();
                    console.log("Content fetched successfully.");
                    setFileContent(textContent);
                    setEditedContent(textContent); // Nội dung chỉnh sửa ban đầu giống nội dung gốc
                    setLanguage(getLanguageFromFileName(editingFile.name)); // Xác định ngôn ngữ
                } catch (fetchError: any) {
                    console.error("Error fetching file content:", fetchError);
                    setError(`Không thể tải nội dung file. Lỗi: ${fetchError.message}`);
                } finally {
                    setIsLoadingContent(false);
                }
            };
            fetchContent();
        } else {
             // Reset khi modal đóng hoặc không có file
             setFileContent('');
             setEditedContent('');
             setError(null);
             setIsLoadingContent(false);
             setLanguage('plaintext');
        }
    }, [isOpen, editingFile]); // Chạy lại khi modal mở/đóng hoặc file thay đổi

    // Hàm lưu file
    const handleSave = async () => {
        if (!editingFile || isSaving) return;

        setIsSaving(true);
        setError(null);
        console.log("Saving file:", editingFile.fullPath);

        try {
            const storageRef = ref(storage, editingFile.fullPath); // Tham chiếu đến đúng file trên Storage

            // Upload nội dung đã chỉnh sửa (dưới dạng string)
            // Sử dụng uploadString là cách tiện lợi cho text-based files
            await uploadString(storageRef, editedContent, 'raw'); // 'raw' tương ứng với text/plain hoặc bạn có thể set content type cụ thể hơn nếu biết

            console.log("File saved successfully.");
            setFileContent(editedContent); // Cập nhật nội dung gốc sau khi lưu thành công
            alert('Lưu file thành công!');
            // Có thể tự đóng modal sau khi lưu hoặc để người dùng tự đóng
            // closeEditor();
        } catch (saveError: any) {
            console.error("Error saving file:", saveError);
            setError(`Lưu file thất bại. Lỗi: ${saveError.message}`);
             alert(`Lưu file thất bại!\n${saveError.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Hàm xử lý khi nội dung editor thay đổi
    const handleEditorChange = (value: string | undefined) => {
        setEditedContent(value || ''); // Cập nhật state chứa nội dung đã sửa
    };

    // Lưu instance của editor khi mount
    const handleEditorDidMount: OnMount = (editor, monaco) => {
       editorRef.current = editor;
       console.log("Monaco Editor Mounted");
       // Bạn có thể thực hiện các thao tác khác với editor instance ở đây
       // Ví dụ: editor.focus();
    };


    // --- Check xem có thay đổi chưa lưu không ---
    const hasUnsavedChanges = fileContent !== editedContent;


    // Hàm đóng modal, có cảnh báo nếu chưa lưu
    const handleClose = () => {
        if (hasUnsavedChanges) {
            if (window.confirm("Bạn có thay đổi chưa lưu. Bạn có chắc chắn muốn đóng?")) {
                closeEditor();
            }
        } else {
            closeEditor();
        }
    };

    return (
        <Transition appear show={isOpen} as={Fragment}>
            {/* Dùng z-index cao hơn cho editor modal */}
            <Dialog as="div" className="relative z-30" onClose={handleClose}>
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
                    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-75" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                     {/* Cho phép modal chiếm gần hết màn hình */}
                    <div className="flex min-h-full items-center justify-center p-2 text-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-5xl h-[85vh] transform overflow-hidden rounded-lg bg-white dark:bg-zinc-800 text-left align-middle shadow-xl transition-all flex flex-col">
                                {/* Header của Modal */}
                                <Dialog.Title
                                    as="h3"
                                    className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100 px-4 py-3 border-b border-gray-200 dark:border-zinc-700 flex justify-between items-center flex-shrink-0"
                                >
                                    <span>Chỉnh sửa: {editingFile?.name ?? 'File'} {hasUnsavedChanges ? '*' : ''}</span>
                                    <div className="flex items-center space-x-2">
                                         {/* Hiển thị lỗi nếu có */}
                                         {error && <span className="text-xs text-red-500 truncate" title={error}>{error}</span>}
                                        {/* Nút Lưu */}
                                        <button
                                            onClick={handleSave}
                                            disabled={isSaving || isLoadingContent || !hasUnsavedChanges}
                                            className={twMerge(
                                                "inline-flex items-center justify-center rounded-md border border-transparent px-3 py-1 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
                                                "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500 dark:focus-visible:ring-offset-zinc-800"
                                            )}
                                        >
                                            {isSaving ? <FaSpinner className="animate-spin mr-1.5" /> : <FaSave className="mr-1.5" />}
                                            {isSaving ? 'Đang lưu...' : 'Lưu'}
                                        </button>
                                        {/* Nút Đóng */}
                                        <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 p-1 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400">
                                            <FaTimes className="w-5 h-5" />
                                        </button>
                                    </div>
                                </Dialog.Title>

                                {/* Khu vực Editor */}
                                <div className="flex-grow overflow-hidden relative">
                                    {isLoadingContent ? (
                                        <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-zinc-800/50">
                                            <FaSpinner className="animate-spin h-8 w-8 text-blue-500" />
                                            <span className="ml-3 text-gray-700 dark:text-gray-300">Đang tải nội dung...</span>
                                        </div>
                                    ) : error && !fileContent ? ( // Chỉ hiển thị lỗi nếu không load được content ban đầu
                                        <div className="absolute inset-0 flex items-center justify-center bg-red-50 dark:bg-red-900/30 p-4">
                                            <p className="text-red-600 dark:text-red-300 text-center">{error}</p>
                                        </div>
                                    ) : (
                                         // Bọc Editor để nó chiếm hết không gian còn lại
                                        <Editor
                                            height="100%" // Chiếm hết chiều cao của div cha
                                            // width="100%" // Mặc định là 100%
                                            language={language}
                                            theme={currentTheme === 'dark' ? 'vs-dark' : 'light'} // Đồng bộ theme
                                            value={editedContent} // Sử dụng editedContent để hiển thị
                                            // defaultValue={fileContent} // Hoặc dùng defaultValue nếu không muốn controlled component
                                            onChange={handleEditorChange} // Cập nhật state khi có thay đổi
                                            onMount={handleEditorDidMount} // Lưu ref khi mount
                                            options={{ // Các tùy chọn của Monaco Editor
                                                minimap: { enabled: true }, // Bật minimap
                                                wordWrap: 'on', // Tự động xuống dòng
                                                fontSize: 14,
                                                scrollBeyondLastLine: false,
                                                automaticLayout: true, // Tự điều chỉnh layout khi container thay đổi size
                                                // Thêm các options khác tại đây:
                                                // https://microsoft.github.io/monaco-editor/typedoc/interfaces/editor.IStandaloneEditorConstructionOptions.html
                                            }}
                                        />
                                    )}
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};

export default CodeEditorModal;