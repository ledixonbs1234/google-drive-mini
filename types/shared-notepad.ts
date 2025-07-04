// types/shared-notepad.ts
export interface SharedNotepadState {
  content: string;
  syncStatus: 'synced' | 'syncing' | 'offline' | 'error';
  lastSyncTime: Date | null;
  isOnline: boolean;
  wordCount: number;
}

export interface SharedNotepadProps {
  // Optional props for customization
  maxLength?: number;
  debounceDelay?: number;
  minHeight?: string;
  placeholder?: string;
  autoSave?: boolean;
  showWordCount?: boolean;
  showCharCount?: boolean;
  showLastSync?: boolean;
  showOnlineStatus?: boolean;
  className?: string;
}

export interface FirebaseError {
  code: string;
  message: string;
  details?: any;
}

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';
