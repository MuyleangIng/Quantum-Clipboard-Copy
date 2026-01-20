export {};

type ClipKind = "text" | "image";
type Lang = "en" | "km";

type ClipItem = {
  id: string;
  kind: ClipKind;
  text?: string;
  imageDataUrl?: string;
  imageName?: string;
  color?: string;
  createdAt: number;
  pinned: 0 | 1;
  tags: string[];
  borderColor?: string;
bgColor?: string;
};

type Theme = {
  bg: string;
  panel: string;
  border: string;
  text: string;
  muted: string;
  danger: string;
  accent: string;
};

declare global {
  interface Window {
    clipvault: {
      // Clipboard
      getHistory: (query?: string) => Promise<ClipItem[]>;
      setClipboard: (payload: { kind: ClipKind; text?: string; imageDataUrl?: string }) => Promise<boolean>;

      deleteClip: (id: string) => Promise<boolean>;
      clearAll: () => Promise<boolean>;
      togglePin: (id: string) => Promise<boolean>;
      setTags: (id: string, tags: string[]) => Promise<boolean>;

      updateClipText: (id: string, text: string) => Promise<boolean>;
      renameClip: (id: string, name: string) => Promise<boolean>;
      setClipColor: (id: string, color: string) => Promise<boolean>;

      setClipBorderColor: (id: string, color: string) => Promise<boolean>;
      setClipBgColor: (id: string, color: string) => Promise<boolean>;
      // Window
      hidePopup: () => Promise<boolean>;

      // Settings
      getSettings: () => Promise<{ popupShortcut: string }>;
      setPopupShortcut: (accelerator: string) => Promise<{ ok: boolean; reason?: string }>;

      // Theme
      getTheme: () => Promise<Theme>;
      setTheme: (theme: Theme) => Promise<boolean>;

      // Language
      getLang: () => Promise<Lang>;
      setLang: (lang: Lang) => Promise<boolean>;

      // Events
      onHistoryUpdated: (cb: () => void) => () => void;
      onPopupOpened: (cb: () => void) => () => void;
    };
  }
}