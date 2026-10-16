// store/useAppStore.ts
import { create } from 'zustand';
// import { StorageItem } from '@/components/FileList'; // <-- Import kiểu StorageItem từ FileList
type ViewMode = 'grid' | 'list';
type Theme = 'light' | 'dark';
interface EditingFile {
    name: string;
    fullPath: string;
    url: string; // Cần URL để fetch nội dung ban đầu
}

interface EditingDocxFile {
    name: string;
    fullPath: string;
    url: string; // URL để fetch file .doc/.docx
}

interface PreviewFile {
    name: string;
    url: string;
    type: 'pdf' | 'video' | 'audio' | 'markdown' | 'image' | '3d' | 'code' | 'unknown';
}

interface AppState {
    viewMode: ViewMode;
    theme: Theme;
    isCreateFolderModalOpen: boolean;
    isImagePreviewModalOpen: boolean;
    previewImageUrl: string | null;
    
    // New preview modal
    isPreviewModalOpen: boolean;
    previewFile: PreviewFile | null;
    
    setViewMode: (mode: ViewMode) => void;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
    openCreateFolderModal: () => void;
    closeCreateFolderModal: () => void;
    openImagePreviewModal: (url: string) => void;
    closeImagePreviewModal: () => void;

    // New preview modal actions
    openPreviewModal: (file: PreviewFile) => void;
    closePreviewModal: () => void;

    // --- State mới cho Editor ---
    isEditorModalOpen: boolean;
    editingFile: EditingFile | null; // Thông tin file đang sửa
    openEditorModal: (file: EditingFile) => void;
    closeEditorModal: () => void;

    // --- State mới cho Docx Editor ---
    isDocxEditorModalOpen: boolean;
    editingDocxFile: EditingDocxFile | null; // Thông tin file .doc/.docx đang sửa
    openDocxEditorModal: (file: EditingDocxFile) => void;
    closeDocxEditorModal: () => void;
}
const updateThemeDOM = (theme: Theme) => {
    if (typeof window !== 'undefined') {
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }
};

export const useAppStore = create<AppState>((set, get) => ({
    // Giá trị mặc định
    viewMode: 'grid',
    theme: 'light', // Mặc định là light
    isCreateFolderModalOpen: false,
    isImagePreviewModalOpen: false,
    previewImageUrl: null,
    isPreviewModalOpen: false,
    previewFile: null,
    isEditorModalOpen: false,
    editingFile: null,
    isDocxEditorModalOpen: false,
    editingDocxFile: null,
    // Các hàm cập nhật state
    setViewMode: (mode) => set({ viewMode: mode }),
    toggleTheme: () => {
        const current = get();
        const newTheme = current.theme === 'light' ? 'dark' : 'light';
        console.log('🎨 Toggle theme:', current.theme, '->', newTheme);
        
        // Cập nhật state trước
        set({ theme: newTheme });
        
        // Force update DOM ngay lập tức
        if (typeof window !== 'undefined') {
            const root = document.documentElement;
            console.log('🎨 Force updating DOM classes...');
            
            // Remove all theme classes first
            root.classList.remove('dark', 'light');
            
            // Add new theme class
            root.classList.add(newTheme);
            
            console.log('🎨 DOM classes after toggle:', root.classList.toString());
            
            // Save to localStorage
            localStorage.setItem('theme', newTheme);
        }
    },
    // Hàm set theme, dùng khi khởi tạo app từ localStorage
    setTheme: (theme) => {
        console.log('🎨 SetTheme called with:', theme);
        set({ theme });
        
        // Force update DOM ngay lập tức
        if (typeof window !== 'undefined') {
            const root = document.documentElement;
            console.log('🎨 Force updating DOM classes with setTheme...');
            
            // Remove all theme classes first
            root.classList.remove('dark', 'light');
            
            // Add new theme class
            root.classList.add(theme);
            
            console.log('🎨 DOM classes after setTheme:', root.classList.toString());
            
            // Save to localStorage
            localStorage.setItem('theme', theme);
        }
    },
    openCreateFolderModal: () => set({ isCreateFolderModalOpen: true }),
    closeCreateFolderModal: () => set({ isCreateFolderModalOpen: false }),
    openImagePreviewModal: (url) => set({ isImagePreviewModalOpen: true, previewImageUrl: url }),
    closeImagePreviewModal: () => set({ isImagePreviewModalOpen: false, previewImageUrl: null }),
    openPreviewModal: (file) => set({ isPreviewModalOpen: true, previewFile: file }),
    closePreviewModal: () => set({ isPreviewModalOpen: false, previewFile: null }),
    // --- Hàm mới cho Editor ---
    openEditorModal: (file) => set({ editingFile: file, isEditorModalOpen: true }),
    // Reset file đang sửa khi đóng modal
    closeEditorModal: () => set({ isEditorModalOpen: false, editingFile: null }),
    // --- Hàm mới cho Docx Editor ---
    openDocxEditorModal: (file) => set({ editingDocxFile: file, isDocxEditorModalOpen: true }),
    closeDocxEditorModal: () => set({ isDocxEditorModalOpen: false, editingDocxFile: null }),
}));
// Export lại kiểu EditingFile nếu cần dùng ở nơi khác
export type { EditingFile, EditingDocxFile, PreviewFile };