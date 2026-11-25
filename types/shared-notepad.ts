// types/shared-notepad.ts
export interface SharedNoteItem {
  id: string;
  title: string;
  content: string;
  pinned?: boolean;
  updatedAt: string;
}

export interface SharedNotepadState {
  notes: SharedNoteItem[];
  activeNoteId: string;
  syncStatus: 'synced' | 'syncing' | 'offline' | 'error';
  lastSyncTime: Date | null;
  isOnline: boolean;
  wordCount: number;
}

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';
