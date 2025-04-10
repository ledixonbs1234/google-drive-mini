// store/useAppStore.ts
import { create } from 'zustand';

type ViewMode = 'grid' | 'list';
type Theme = 'light' | 'dark';

interface AppState {
    viewMode: ViewMode;
    theme: Theme;
    isCreateFolderModalOpen: boolean;
    isImagePreviewModalOpen: boolean;
    previewImageUrl: string | null;
    setViewMode: (mode: ViewMode) => void;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
    openCreateFolderModal: () => void;
    closeCreateFolderModal: () => void;
    openImagePreviewModal: (url: string) => void;
    closeImagePreviewModal: () => void;
}
const updateThemeDOM = (theme: Theme) => {
    if (typeof window !== 'undefined') {
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('theme', theme); // Lưu lựa chọn
    }
};

export const useAppStore = create<AppState>((set, get) => ({
    // Giá trị mặc định
    viewMode: 'grid',
    theme: 'light', // Mặc định là light
    isCreateFolderModalOpen: false,
    isImagePreviewModalOpen: false,
    previewImageUrl: null,

    // Các hàm cập nhật state
    setViewMode: (mode) => set({ viewMode: mode }),
    toggleTheme: () => {
        const newTheme = get().theme === 'light' ? 'dark' : 'light';
        set({ theme: newTheme });
        // Lưu theme vào localStorage để ghi nhớ lựa chọn
        updateThemeDOM(newTheme); // Gọi hàm cập nhật DOM
    },
    // Hàm set theme, dùng khi khởi tạo app từ localStorage
    setTheme: (theme) => {
        set({ theme });
        updateThemeDOM(theme); // Gọi hàm cập nhật DOM
    },
    openCreateFolderModal: () => set({ isCreateFolderModalOpen: true }),
  closeCreateFolderModal: () => set({ isCreateFolderModalOpen: false }),
  openImagePreviewModal: (url) => set({ isImagePreviewModalOpen: true, previewImageUrl: url }),
  closeImagePreviewModal: () => set({ isImagePreviewModalOpen: false, previewImageUrl: null }),
}));
