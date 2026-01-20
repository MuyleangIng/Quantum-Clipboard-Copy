import type { ClipItem, Settings, Theme } from "../preload";

declare global {
  interface Window {
    clipvault: {
      getHistory: (query?: string) => Promise<ClipItem[]>;
      setClipboard: (payload: { kind: "text" | "image"; text?: string; imageDataUrl?: string }) => Promise<boolean>;
      deleteClip: (id: string) => Promise<boolean>;
      clearAll: () => Promise<boolean>;
      togglePin: (id: string) => Promise<boolean>;
      setTags: (id: string, tags: string[]) => Promise<boolean>;
      renameClip: (id: string, name: string) => Promise<boolean>;

      hidePopup: () => Promise<boolean>;

      getSettings: () => Promise<Settings>;
      setPopupShortcut: (accelerator: string) => Promise<{ ok: boolean; reason?: string }>;

      getTheme: () => Promise<Theme>;
      setTheme: (theme: Theme) => Promise<boolean>;

      onHistoryUpdated: (cb: () => void) => () => void;
      onPopupOpened: (cb: () => void) => () => void;
    };
  }
}

export {};