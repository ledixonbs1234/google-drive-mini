// store/useAppStore.ts
import { create } from 'zustand';

export type ViewMode = 'grid' | 'list';
export type Theme = 'light' | 'dark';
export type SortField = 'updated' | 'name' | 'size' | 'type';
export type SortOrder = 'asc' | 'desc';

export interface EditingFile {
  name: string;
  fullPath: string;
  url: string;
}

export interface EditingDocxFile {
  name: string;
  fullPath: string;
  url: string;
}

export interface PreviewFile {
  name: string;
  url: string;
  fullPath?: string;
  type: 'pdf' | 'video' | 'audio' | 'markdown' | 'image' | '3d' | 'code' | 'csv' | 'unknown';
}

export interface GalleryImageItem {
  name: string;
  url: string;
}

export interface AppSettings {
  defaultView: ViewMode;
  defaultSortField: SortField;
  defaultSortOrder: SortOrder;
  showHiddenFiles: boolean;
  confirmDelete: boolean;
  useTrash: boolean;
  compactMode: boolean;
  showThumbnails: boolean;
  animationsEnabled: boolean;
  compressionEnabled: boolean;
  conflictMode: 'rename' | 'overwrite';
  maxConcurrentUploads: number;
}

export interface ClipboardData {
  action: 'copy' | 'move';
  items: Array<{ fullPath: string; isFolder: boolean; name: string }>;
}

const DEFAULT_SETTINGS: AppSettings = {
  defaultView: 'grid',
  defaultSortField: 'updated',
  defaultSortOrder: 'desc',
  showHiddenFiles: false,
  confirmDelete: true,
  useTrash: true,
  compactMode: false,
  showThumbnails: true,
  animationsEnabled: true,
  compressionEnabled: true,
  conflictMode: 'rename',
  maxConcurrentUploads: 3,
};

const SETTINGS_STORAGE_KEY = 'drive_mini_settings_v3';

interface AppState {
  viewMode: ViewMode;
  theme: Theme;
  settings: AppSettings;

  // Trạng thái sắp xếp danh sách tệp (mặc định: theo thời gian mới nhất lên đầu)
  sortField: SortField;
  sortOrder: SortOrder;
  pinFoldersTop: boolean;
  recentlyUploadedKeys: string[];

  // Modals
  isCreateFolderModalOpen: boolean;
  isCreateFileModalOpen: boolean;
  isImagePreviewModalOpen: boolean;
  previewImageUrl: string | null;
  previewImageGallery: GalleryImageItem[];

  isPreviewModalOpen: boolean;
  previewFile: PreviewFile | null;

  isEditorModalOpen: boolean;
  editingFile: EditingFile | null;

  isDocxEditorModalOpen: boolean;
  editingDocxFile: EditingDocxFile | null;

  // Clipboard cho Copy / Cut / Paste giữa các thư mục
  clipboard: ClipboardData | null;

  // Global refresh counter để các modal con thông báo tải lại danh sách
  globalRefreshCounter: number;

  // Actions
  setViewMode: (mode: ViewMode) => void;
  setSort: (field: SortField, order: SortOrder) => void;
  setPinFoldersTop: (pin: boolean) => void;
  markUploadedKeys: (keys: string[]) => void;

  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  loadSettings: () => void;
  updateSettings: (partial: Partial<AppSettings>) => void;

  openCreateFolderModal: () => void;
  closeCreateFolderModal: () => void;

  openCreateFileModal: () => void;
  closeCreateFileModal: () => void;

  openImagePreviewModal: (url: string, gallery?: GalleryImageItem[]) => void;
  closeImagePreviewModal: () => void;

  openPreviewModal: (file: PreviewFile) => void;
  closePreviewModal: () => void;

  openEditorModal: (file: EditingFile) => void;
  closeEditorModal: () => void;

  openDocxEditorModal: (file: EditingDocxFile) => void;
  closeDocxEditorModal: () => void;

  setClipboard: (data: ClipboardData | null) => void;
  clearClipboard: () => void;

  triggerGlobalRefresh: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  viewMode: 'grid',
  theme: 'light',
  settings: DEFAULT_SETTINGS,

  sortField: 'updated',
  sortOrder: 'desc',
  pinFoldersTop: false,
  recentlyUploadedKeys: [],

  isCreateFolderModalOpen: false,
  isCreateFileModalOpen: false,
  isImagePreviewModalOpen: false,
  previewImageUrl: null,
  previewImageGallery: [],

  isPreviewModalOpen: false,
  previewFile: null,

  isEditorModalOpen: false,
  editingFile: null,

  isDocxEditorModalOpen: false,
  editingDocxFile: null,

  clipboard: null,
  globalRefreshCounter: 0,

  setViewMode: (mode) => set({ viewMode: mode }),

  setSort: (field, order) =>
    set({
      sortField: field,
      sortOrder: order,
      // Khi chọn sắp xếp theo Thời gian, mặc định không ghim cứng thư mục cũ đè lên file mới
      pinFoldersTop: field === 'name' ? true : false,
    }),

  setPinFoldersTop: (pin) => set({ pinFoldersTop: pin }),

  markUploadedKeys: (keys) =>
    set((state) => ({
      recentlyUploadedKeys: Array.from(new Set([...keys, ...state.recentlyUploadedKeys])).slice(0, 50),
      sortField: 'updated',
      sortOrder: 'desc',
      pinFoldersTop: false,
    })),

  toggleTheme: () => {
    const current = get();
    const newTheme = current.theme === 'light' ? 'dark' : 'light';
    set({ theme: newTheme });

    if (typeof window !== 'undefined') {
      const root = document.documentElement;
      root.classList.remove('dark', 'light');
      root.classList.add(newTheme);
      localStorage.setItem('theme', newTheme);
    }
  },

  setTheme: (theme) => {
    set({ theme });
    if (typeof window !== 'undefined') {
      const root = document.documentElement;
      root.classList.remove('dark', 'light');
      root.classList.add(theme);
      localStorage.setItem('theme', theme);
    }
  },

  loadSettings: () => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const merged: AppSettings = { ...DEFAULT_SETTINGS, ...parsed };
        set({
          settings: merged,
          viewMode: merged.defaultView,
          sortField: merged.defaultSortField || 'updated',
          sortOrder: merged.defaultSortOrder || 'desc',
          pinFoldersTop: merged.defaultSortField === 'name',
        });
      }
    } catch (e) {
      console.warn('Không thể tải cài đặt từ localStorage:', e);
    }
  },

  updateSettings: (partial) => {
    const nextSettings: AppSettings = { ...get().settings, ...partial };
    set((state) => ({
      settings: nextSettings,
      viewMode: partial.defaultView ? partial.defaultView : state.viewMode,
      sortField: partial.defaultSortField ? partial.defaultSortField : state.sortField,
      sortOrder: partial.defaultSortOrder ? partial.defaultSortOrder : state.sortOrder,
    }));
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
      } catch (e) {
        console.warn('Không thể lưu cài đặt:', e);
      }
    }
  },

  openCreateFolderModal: () => set({ isCreateFolderModalOpen: true }),
  closeCreateFolderModal: () => set({ isCreateFolderModalOpen: false }),

  openCreateFileModal: () => set({ isCreateFileModalOpen: true }),
  closeCreateFileModal: () => set({ isCreateFileModalOpen: false }),

  openImagePreviewModal: (url, gallery = []) =>
    set({
      isImagePreviewModalOpen: true,
      previewImageUrl: url,
      previewImageGallery: gallery,
    }),
  closeImagePreviewModal: () =>
    set({
      isImagePreviewModalOpen: false,
      previewImageUrl: null,
      previewImageGallery: [],
    }),

  openPreviewModal: (file) => set({ isPreviewModalOpen: true, previewFile: file }),
  closePreviewModal: () => set({ isPreviewModalOpen: false, previewFile: null }),

  openEditorModal: (file) => set({ editingFile: file, isEditorModalOpen: true }),
  closeEditorModal: () => set({ isEditorModalOpen: false, editingFile: null }),

  openDocxEditorModal: (file) => set({ editingDocxFile: file, isDocxEditorModalOpen: true }),
  closeDocxEditorModal: () => set({ isDocxEditorModalOpen: false, editingDocxFile: null }),

  setClipboard: (data) => set({ clipboard: data }),
  clearClipboard: () => set({ clipboard: null }),

  triggerGlobalRefresh: () =>
    set((state) => ({ globalRefreshCounter: state.globalRefreshCounter + 1 })),
}));
