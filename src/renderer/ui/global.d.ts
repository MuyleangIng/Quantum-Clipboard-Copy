// ============================
// FILE: src/renderer/global.d.ts
// (TypeScript) window.clipvault typing
// ============================

export {};

declare global {
  interface Window {
    clipvault: {
      rendererReady: () => void;

      onPopupOpened: (cb: () => void) => () => void;
      onSettingsUpdated: (cb: (s: any) => void) => () => void;
      onHistoryUpdated: (cb: () => void) => () => void;

      showPopup: () => Promise<any>;
      hidePopup: () => Promise<any>;
      minimizePopup: () => Promise<any>;

      setInteractionState: (partial: {
        isSettingsOpen?: boolean;
        isModalOpen?: boolean;
        isPickingColor?: boolean;
        isRecordingShortcut?: boolean;
        isTypingSearch?: boolean;
      }) => Promise<{ ok: boolean }>;

      getSettings: () => Promise<any>;
      setSettings: (partial: any) => Promise<{ ok: boolean }>;

      setPopupShortcut: (accel: string) => Promise<{ ok: boolean; reason?: string }>;
      getStartAtLogin: () => Promise<{ ok: boolean; value: boolean }>;
      setStartAtLogin: (openAtLogin: boolean) => Promise<{ ok: boolean }>;

      getHistory: (q: string) => Promise<any[]>;
      deleteClip: (id: string) => Promise<any>;
      clearAll: () => Promise<any>;
      togglePin: (id: string) => Promise<any>;
      setTags: (id: string, tags: string[]) => Promise<any>;
      updateClipText: (id: string, text: string) => Promise<any>;
      renameClip: (id: string, name: string) => Promise<any>;
      setClipboard: (payload: any) => Promise<any>;
            onCopied: () => Promise<void>;

    };
  }
}